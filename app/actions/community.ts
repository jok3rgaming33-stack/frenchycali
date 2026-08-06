"use server"

import { db } from "@/lib/db"
import { communityMessages, users, type CommunityMedia } from "@/lib/db/schema"
import { and, desc, eq, gt, isNull, sql } from "drizzle-orm"
import { isAdminAuthenticated, isAdminToken } from "@/app/actions/admin-auth"
import {
  validateCommunityPost,
  normalizeForFilter,
  favoriteShopLabel,
  COMMUNITY_LIMITS,
} from "@/lib/community-filters"

const VALID_FAVORITES = new Set(["caliboyz31", "caliboyz94", "calidelivery"])

export type CommunityMessageDTO = {
  id: number
  pseudo: string
  favoriteShop: string | null
  favoriteLabel: string | null
  isAdminAuthor: boolean
  body: string
  media: CommunityMedia[]
  createdAt: Date | string
  isMine: boolean
  canModerate: boolean
}

async function ensureCommunitySchema() {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS community_messages (
        id SERIAL PRIMARY KEY,
        user_token TEXT NOT NULL,
        pseudo TEXT NOT NULL,
        favorite_shop TEXT,
        is_admin BOOLEAN NOT NULL DEFAULT FALSE,
        body TEXT NOT NULL DEFAULT '',
        media JSONB NOT NULL DEFAULT '[]'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at TIMESTAMPTZ
      )
    `)
    await db.execute(sql`
      ALTER TABLE community_messages
      ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE
    `)
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS community_messages_created_at_idx
      ON community_messages (created_at DESC)
    `)
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS community_messages_user_token_idx
      ON community_messages (user_token)
    `)
  } catch (e) {
    console.error("[community] ensure schema:", e)
  }
}

function toDTO(
  r: {
    id: number
    userToken: string
    pseudo: string
    favoriteShop: string | null
    isAdmin?: boolean | null
    body: string | null
    media: CommunityMedia[] | null
    createdAt: Date
  },
  viewerToken: string,
  canModerate: boolean,
): CommunityMessageDTO {
  const isAdminAuthor = Boolean(r.isAdmin) || r.pseudo === "Admin"
  return {
    id: r.id,
    pseudo: isAdminAuthor ? "Admin" : r.pseudo,
    favoriteShop: isAdminAuthor ? null : r.favoriteShop,
    favoriteLabel: isAdminAuthor ? null : favoriteShopLabel(r.favoriteShop),
    isAdminAuthor,
    body: r.body ?? "",
    media: Array.isArray(r.media) ? r.media : [],
    createdAt: r.createdAt,
    isMine: r.userToken === viewerToken,
    canModerate,
  }
}

function normalizeFavorite(raw: string | null | undefined): string | null {
  if (!raw) return null
  const k = raw.trim().toLowerCase()
  if (k === "31") return "caliboyz31"
  if (k === "94") return "caliboyz94"
  if (k === "delivery") return "calidelivery"
  if (VALID_FAVORITES.has(k)) return k
  return null
}

function sanitizeMedia(raw: unknown): CommunityMedia[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter(
      (m): m is CommunityMedia =>
        !!m &&
        typeof m === "object" &&
        (m.type === "image" || m.type === "video") &&
        typeof m.url === "string" &&
        m.url.startsWith("http"),
    )
    .slice(0, COMMUNITY_LIMITS.MAX_MEDIA)
}

/** Liste les derniers messages (non supprimés). */
export async function listCommunityMessages(
  userToken: string,
  opts?: { afterId?: number; limit?: number },
): Promise<{ ok: true; messages: CommunityMessageDTO[]; canModerate: boolean } | { ok: false; error: string }> {
  await ensureCommunitySchema()
  if (!userToken?.trim()) return { ok: false, error: "Non connecté." }

  const limit = Math.min(100, Math.max(20, opts?.limit ?? 60))
  const canModerate =
    (await isAdminAuthenticated()) || (await isAdminToken(userToken.trim()))

  try {
    let rows
    if (opts?.afterId && opts.afterId > 0) {
      rows = await db
        .select()
        .from(communityMessages)
        .where(and(isNull(communityMessages.deletedAt), gt(communityMessages.id, opts.afterId)))
        .orderBy(communityMessages.id)
        .limit(limit)
    } else {
      rows = await db
        .select()
        .from(communityMessages)
        .where(isNull(communityMessages.deletedAt))
        .orderBy(desc(communityMessages.createdAt))
        .limit(limit)
      rows = rows.reverse()
    }

    const token = userToken.trim()
    const messages: CommunityMessageDTO[] = rows.map((r) => toDTO(r, token, canModerate))

    return { ok: true, messages, canModerate }
  } catch (e) {
    console.error("[community] list:", e)
    return { ok: false, error: "Impossible de charger le canal." }
  }
}

/** Publie un message dans le canal. */
export async function postCommunityMessage(input: {
  userToken: string
  body?: string
  media?: CommunityMedia[]
  favoriteShop?: string | null
}): Promise<{ ok: true; message: CommunityMessageDTO } | { ok: false; error: string }> {
  await ensureCommunitySchema()
  const token = input.userToken?.trim()
  if (!token) return { ok: false, error: "Non connecté." }

  const body = (input.body ?? "").trim()
  const media = sanitizeMedia(input.media)

  const asAdmin =
    (await isAdminToken(token)) || (await isAdminAuthenticated())

  // Compte client (optionnel si admin pur)
  const [account] = await db.select().from(users).where(eq(users.token, token)).limit(1)
  if (!asAdmin) {
    if (!account) return { ok: false, error: "Compte introuvable." }
    const flags = Array.isArray(account.flags) ? account.flags : []
    if (flags.includes("banni")) {
      return { ok: false, error: "Ton compte est suspendu. Canal inaccessible." }
    }
  }

  // Historique récent pour anti-spam (admin : limites plus souples mais toujours filtrées)
  const since = new Date(Date.now() - 120_000)
  const recent = await db
    .select({
      body: communityMessages.body,
      createdAt: communityMessages.createdAt,
    })
    .from(communityMessages)
    .where(
      and(
        eq(communityMessages.userToken, token),
        isNull(communityMessages.deletedAt),
        gt(communityMessages.createdAt, since),
      ),
    )
    .orderBy(desc(communityMessages.createdAt))
    .limit(20)

  if (!asAdmin) {
    const check = validateCommunityPost({
      body,
      mediaCount: media.length,
      recentBodies: recent.map((r) => normalizeForFilter(r.body ?? "")),
      recentTimestamps: recent.map((r) => new Date(r.createdAt).getTime()),
    })
    if (!check.ok) return { ok: false, error: check.error }
  } else {
    // Admin : pas d'anti-spam strict, mais longueur + contenu de base
    if (!body && media.length === 0) {
      return { ok: false, error: "Écris un message ou ajoute un média." }
    }
    if (body.length > COMMUNITY_LIMITS.MAX_BODY) {
      return { ok: false, error: `Message trop long (max ${COMMUNITY_LIMITS.MAX_BODY} caractères).` }
    }
  }

  const favoriteShop = asAdmin ? null : normalizeFavorite(input.favoriteShop)
  const pseudo = asAdmin ? "Admin" : account?.pseudo || "Client"

  try {
    const [row] = await db
      .insert(communityMessages)
      .values({
        userToken: token,
        pseudo,
        favoriteShop,
        isAdmin: asAdmin,
        body,
        media,
      })
      .returning()

    if (!row) return { ok: false, error: "Échec de l'envoi." }

    return {
      ok: true,
      message: toDTO(row, token, asAdmin),
    }
  } catch (e) {
    console.error("[community] post:", e)
    return { ok: false, error: "Impossible d'envoyer le message." }
  }
}

/** Modération : soft-delete d'un message (admin uniquement). */
export async function deleteCommunityMessage(
  messageId: number,
  adminToken?: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await ensureCommunitySchema()
  if (!messageId) return { ok: false, error: "Message invalide." }

  const sessionAdmin = await isAdminAuthenticated()
  const tokenAdmin = adminToken ? await isAdminToken(adminToken.trim()) : false
  if (!sessionAdmin && !tokenAdmin) {
    return { ok: false, error: "Accès réservé à la modération." }
  }

  try {
    await db
      .update(communityMessages)
      .set({ deletedAt: sql`now()` })
      .where(and(eq(communityMessages.id, messageId), isNull(communityMessages.deletedAt)))
    return { ok: true }
  } catch (e) {
    console.error("[community] delete:", e)
    return { ok: false, error: "Suppression impossible." }
  }
}
