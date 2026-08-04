"use server"

import { db } from "@/lib/db"
import {
  users, orderThreads, threadMessages, accountCreations,
  userVerifications, loyaltyCodes, promoUsages, userNewsReads,
  pushSubscriptions, restockAlerts, reservedPseudos,
} from "@/lib/db/schema"
import { eq, desc, sql, and, gte, inArray } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { isClosedStatus, normalizeStatus } from "@/lib/order-status"
import { computeLoyaltyPoints } from "@/lib/loyalty"
import { notifyVendor } from "@/lib/push"
import { getClientIp, isVpnOrProxy } from "@/lib/ip-check"
import { isAdminAuthenticated } from "@/app/actions/admin-auth"
import { USER_FLAGS } from "@/lib/user-flags"

async function recordLogin(userToken: string) {
  try {
    const { headers } = await import("next/headers")
    const h = await headers()
    const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null
    const ua = h.get("user-agent") || null
    const pseudo = (await db.select({ pseudo: users.pseudo }).from(users).where(eq(users.token, userToken)).limit(1))[0]?.pseudo
    if (!pseudo) return
    await db.insert(
      (await import("@/lib/db/schema")).loginLogs
    ).values({ userToken, pseudo, ip, userAgent: ua })
  } catch { /* fire-and-forget */ }
}

export async function createAccount(token: string, pseudo: string) {
  const t = token?.trim()
  const p = pseudo?.trim()
  if (!t || t.length < 20 || !p) return { ok: false as const, error: "Paramètres invalides." }

  const existing = await db.select().from(users).where(eq(users.token, t)).limit(1)
  if (existing.length > 0) return { ok: true as const, pseudo: existing[0].pseudo }

  const taken = await db.select({ id: reservedPseudos.id }).from(reservedPseudos).where(eq(reservedPseudos.pseudo, p)).limit(1)
  if (taken.length > 0) return { ok: false as const, error: "Ce pseudo est déjà pris. Choisis-en un autre." }

  const ip = await getClientIp()
  if (await isVpnOrProxy(ip)) {
    return { ok: false as const, error: "La création de compte via VPN ou proxy n'est pas autorisée. Désactive-le puis réessaie." }
  }
  if (ip) {
    const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const recent = await db.select({ id: accountCreations.id }).from(accountCreations)
      .where(and(eq(accountCreations.ip, ip), gte(accountCreations.createdAt, monthAgo))).limit(1)
    if (recent.length > 0) return { ok: false as const, error: "Un compte a déjà été créé depuis cette connexion ce mois-ci." }
  }

  await db.insert(reservedPseudos).values({ pseudo: p }).onConflictDoNothing()
  await db.insert(users).values({ token: t, pseudo: p })
  if (ip) await db.insert(accountCreations).values({ ip })

  await notifyVendor({ title: "Nouveau membre", body: `${p} vient de créer un compte.`, url: "/admin", tag: "new-member" })
  return { ok: true as const, pseudo: p }
}

export async function getAccount(token: string) {
  const t = token?.trim()
  if (!t) return null
  const rows = await db.select().from(users).where(eq(users.token, t)).limit(1)
  const account = rows[0] ?? null
  if (account) recordLogin(t).catch(() => {})
  return account
}

export async function ensureAccount(token: string, fallbackPseudo: string) {
  const account = await getAccount(token)
  if (account) return { ok: true as const, pseudo: account.pseudo, created: false }
  const res = await createAccount(token, fallbackPseudo)
  if (!res.ok) return { ok: false as const, error: res.error }
  return { ok: true as const, pseudo: res.pseudo, created: true }
}

export async function getCustomerStats(token: string) {
  const t = token?.trim()
  if (!t) return { points: 0, active: 0, past: 0 }
  const rows = await db.select().from(orderThreads).where(eq(orderThreads.customerToken, t))
  let points = 0, active = 0, past = 0
  for (const row of rows) {
    if (normalizeStatus(row.status) === "livree") points += computeLoyaltyPoints(row.total ?? 0)
    if (isClosedStatus(row.status)) past += 1
    else active += 1
  }
  const account = await db.select().from(users).where(eq(users.token, t)).limit(1)
  points = Math.max(0, points + (account[0]?.loyaltyAdjustment ?? 0) - (account[0]?.loyaltySpent ?? 0))
  return { points, active, past }
}

export type AdminUserRow = {
  id: number; pseudo: string; token: string; nickname: string | null
  createdAt: Date | string; orderCount: number; totalSpent: number
  loyaltyAdjustment: number; flags: string[]; mustSetPassword: boolean
}

export async function listUsers(): Promise<AdminUserRow[]> {
  const rows = await db.select({
    id: users.id, pseudo: users.pseudo, token: users.token, nickname: users.nickname,
    createdAt: users.createdAt, loyaltyAdjustment: users.loyaltyAdjustment,
    flags: users.flags, mustSetPassword: users.mustSetPassword,
    orderCount: sql<number>`count(${orderThreads.id})::int`,
    totalSpent: sql<number>`coalesce(sum(${orderThreads.total}), 0)::int`,
  })
    .from(users)
    .leftJoin(orderThreads, eq(orderThreads.customerToken, users.token))
    .groupBy(users.id, users.pseudo, users.token, users.nickname, users.createdAt, users.loyaltyAdjustment, users.flags, users.mustSetPassword)
    .orderBy(desc(users.createdAt))
  return rows
}

export async function setUserNickname(id: number, nickname: string) {
  if (!id) return { ok: false as const }
  if (!(await isAdminAuthenticated())) return { ok: false as const, error: "unauthorized" }
  const value = nickname.trim().slice(0, 60) || null
  await db.update(users).set({ nickname: value }).where(eq(users.id, id))
  revalidatePath("/admin")
  return { ok: true as const, nickname: value }
}

export async function setUserFlags(id: number, flags: string[]) {
  if (!(await isAdminAuthenticated())) return { ok: false as const, error: "unauthorized" }
  const clean = Array.from(new Set(flags.filter((f) => (USER_FLAGS as readonly string[]).includes(f))))
  await db.update(users).set({ flags: clean }).where(eq(users.id, id))
  revalidatePath("/admin")
  return { ok: true as const, flags: clean }
}

export async function setLoyaltyAdjustment(id: number, adjustment: number) {
  if (!id || !Number.isFinite(adjustment)) return { ok: false as const }
  const value = Math.trunc(adjustment)
  await db.update(users).set({ loyaltyAdjustment: value }).where(eq(users.id, id))
  revalidatePath("/admin")
  return { ok: true as const, loyaltyAdjustment: value }
}

export async function deleteUserAccount(id: number) {
  if (!id) return { ok: false as const }
  if (!(await isAdminAuthenticated())) return { ok: false as const, error: "unauthorized" }
  const row = await db.select().from(users).where(eq(users.id, id)).limit(1)
  if (!row[0]) return { ok: false as const, error: "Introuvable." }
  await purgeUserData(row[0].token)
  revalidatePath("/admin")
  return { ok: true as const }
}

export async function purgeUserData(token: string) {
  const t = token?.trim()
  if (!t) return
  const verifs = await db.select().from(userVerifications).where(eq(userVerifications.userToken, t))
  for (const v of verifs) {
    for (const path of [v.photoPathname, v.videoPathname]) {
      if (path) { try { const { del } = await import("@vercel/blob"); await del(path) } catch { /* best-effort */ } }
    }
  }
  const threads = await db.select({ id: orderThreads.id }).from(orderThreads).where(eq(orderThreads.customerToken, t))
  if (threads.length > 0) {
    const ids = threads.map((x) => x.id)
    await db.delete(threadMessages).where(inArray(threadMessages.threadId, ids))
    await db.delete(orderThreads).where(eq(orderThreads.customerToken, t))
  }
  await db.delete(userVerifications).where(eq(userVerifications.userToken, t))
  await db.delete(loyaltyCodes).where(eq(loyaltyCodes.userToken, t))
  await db.delete(promoUsages).where(eq(promoUsages.userToken, t))
  await db.delete(userNewsReads).where(eq(userNewsReads.userToken, t))
  await db.delete(pushSubscriptions).where(eq(pushSubscriptions.customerToken, t))
  await db.delete(restockAlerts).where(eq(restockAlerts.userToken, t))
  try {
    const { purgeWebAuthnForToken } = await import("@/app/actions/webauthn")
    await purgeWebAuthnForToken(t)
  } catch { /* best-effort */ }
  const userRow = await db.select({ pseudo: users.pseudo }).from(users).where(eq(users.token, t)).limit(1)
  if (userRow[0]) {
    await db.update(reservedPseudos).set({ deletedAt: sql`now()` }).where(eq(reservedPseudos.pseudo, userRow[0].pseudo))
  }
  await db.delete(users).where(eq(users.token, t))
}
