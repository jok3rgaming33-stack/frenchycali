"use server"

import { db } from "@/lib/db"
import {
  orderThreads,
  products,
  productRatings,
  users,
  type OrderItemSnapshot,
  type ProductRating,
} from "@/lib/db/schema"
import { and, avg, count, desc, eq, inArray, sql } from "drizzle-orm"
import { normalizeStatus } from "@/lib/order-status"
import { revalidatePath } from "next/cache"

const DELIVERED_STATUSES = new Set(["livree", "locker_livre"])

export type RateableProduct = {
  productId: number
  title: string
  image: string | null
  variant: string | null
  alreadyRated: boolean
}

export type ProductRatingInput = {
  productId: number
  quality: number
  quantity: number
  packaging: number
  delivery: number
  comment?: string
}

export type ProductRatingSummary = {
  productId: number
  average: number | null
  count: number
}

export type ProductRatingDetail = {
  id: number
  userPseudo: string
  quality: number
  quantity: number
  packaging: number
  delivery: number
  average: number
  comment: string | null
  createdAt: Date | string
}

function clampStar(n: number): number {
  const v = Math.round(Number(n))
  if (!Number.isFinite(v)) return 0
  return Math.max(0, Math.min(5, v))
}

function scoreAverage(q: number, qty: number, pack: number, deliv: number): number {
  return Math.round(((q + qty + pack + deliv) / 4) * 10) / 10
}

function isDelivered(status: string | null | undefined): boolean {
  if (!status) return false
  if (DELIVERED_STATUSES.has(status)) return true
  return normalizeStatus(status) === "livree"
}

/** Crée colonnes / tables manquantes (prod sans migration manuelle). */
export async function ensureRatingsSchema() {
  try {
    await db.execute(sql`
      ALTER TABLE order_threads
      ADD COLUMN IF NOT EXISTS items_json JSONB NOT NULL DEFAULT '[]'::jsonb
    `)
  } catch (e) {
    console.error("[ratings] items_json column:", e)
  }
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS product_ratings (
        id SERIAL PRIMARY KEY,
        product_id INTEGER NOT NULL,
        product_title TEXT NOT NULL,
        thread_id INTEGER NOT NULL,
        user_token TEXT NOT NULL,
        user_pseudo TEXT,
        quality INTEGER NOT NULL DEFAULT 0,
        quantity INTEGER NOT NULL DEFAULT 0,
        packaging INTEGER NOT NULL DEFAULT 0,
        delivery INTEGER NOT NULL DEFAULT 0,
        comment TEXT,
        average DOUBLE PRECISION NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `)
    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS product_ratings_thread_product_user_idx
      ON product_ratings (thread_id, product_id, user_token)
    `)
  } catch (e) {
    console.error("[ratings] product_ratings table:", e)
  }
}

/** Parse l'ancien format texte "1x Title, 2x Other ×3" → titres uniques. */
function parseProductTitles(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return []
  return raw
    .split(",")
    .map((s) => s.trim())
    .flatMap((segment) => {
      const m = segment.match(/^\d+x\s+(.+?)(?:\s+[×x]\d+)?$/)
      if (m) return [m[1].trim()]
      // Lignes résumé "• 1x Title (3g)"
      const m2 = segment.match(/^\d+x\s+(.+?)(?:\s*\(|$)/)
      if (m2) return [m2[1].trim()]
      return segment ? [segment] : []
    })
    .filter(Boolean)
}

function itemsFromThread(thread: {
  itemsJson?: OrderItemSnapshot[] | null
  products?: string | null
  summary?: string | null
}): OrderItemSnapshot[] {
  const json = thread.itemsJson
  if (Array.isArray(json) && json.length > 0) {
    return json
      .filter((i) => i && typeof i.productId === "number" && i.productId > 0)
      .map((i) => ({
        productId: i.productId,
        title: String(i.title || "Produit"),
        variant: i.variant,
        qty: Number(i.qty) || 1,
        price: Number(i.price) || 0,
      }))
  }
  return []
}

/**
 * Produits éligibles à la notation pour une commande livrée.
 * Uniquement les produits achetés, non déjà notés par ce client sur ce fil.
 */
export async function getRateableProducts(
  threadId: number,
  userToken: string,
): Promise<{ ok: true; products: RateableProduct[]; threadId: number } | { ok: false; error: string }> {
  await ensureRatingsSchema()
  if (!threadId || !userToken?.trim()) return { ok: false, error: "Données invalides." }

  const [thread] = await db
    .select()
    .from(orderThreads)
    .where(and(eq(orderThreads.id, threadId), eq(orderThreads.customerToken, userToken.trim())))
    .limit(1)

  if (!thread) return { ok: false, error: "Commande introuvable." }
  if (!isDelivered(thread.status)) {
    return { ok: false, error: "Tu pourras noter après la livraison de la commande." }
  }

  const existing = await db
    .select({ productId: productRatings.productId })
    .from(productRatings)
    .where(and(eq(productRatings.threadId, threadId), eq(productRatings.userToken, userToken.trim())))

  const ratedIds = new Set(existing.map((r) => r.productId))

  let snapshots = itemsFromThread(thread)

  // Fallback : matcher les titres du champ products / summary
  if (snapshots.length === 0) {
    const titles = [
      ...parseProductTitles(thread.products),
      ...parseProductTitles(
        (thread.summary || "")
          .split("\n")
          .filter((l) => l.trim().startsWith("•"))
          .map((l) => l.replace(/^•\s*/, "").replace(/\s*—\s*\d+€.*$/, "").trim())
          .join(", "),
      ),
    ]
    const uniqueTitles = Array.from(new Set(titles.map((t) => t.toLowerCase())))
    if (uniqueTitles.length) {
      const allProds = await db.select({ id: products.id, title: products.title, image: products.image }).from(products)
      for (const title of titles) {
        const prod = allProds.find((p) => p.title.toLowerCase() === title.toLowerCase())
        if (prod && !snapshots.some((s) => s.productId === prod.id)) {
          snapshots.push({ productId: prod.id, title: prod.title, qty: 1, price: 0 })
        }
      }
    }
  }

  // Dédupliquer par productId
  const byId = new Map<number, OrderItemSnapshot>()
  for (const s of snapshots) {
    if (!byId.has(s.productId)) byId.set(s.productId, s)
  }
  snapshots = Array.from(byId.values())

  if (snapshots.length === 0) {
    return { ok: false, error: "Aucun produit identifiable sur cette commande." }
  }

  const ids = snapshots.map((s) => s.productId)
  const catalog = await db
    .select({ id: products.id, title: products.title, image: products.image })
    .from(products)
    .where(inArray(products.id, ids))
  const catalogMap = new Map(catalog.map((p) => [p.id, p]))

  const list: RateableProduct[] = snapshots.map((s) => {
    const cat = catalogMap.get(s.productId)
    return {
      productId: s.productId,
      title: cat?.title ?? s.title,
      image: cat?.image ?? null,
      variant: s.variant ?? null,
      alreadyRated: ratedIds.has(s.productId),
    }
  })

  return { ok: true, products: list, threadId }
}

/** Soumet une note pour un produit d'une commande livrée. */
export async function submitProductRating(
  threadId: number,
  userToken: string,
  input: ProductRatingInput,
): Promise<{ ok: true; average: number } | { ok: false; error: string }> {
  await ensureRatingsSchema()
  if (!threadId || !userToken?.trim() || !input?.productId) {
    return { ok: false, error: "Données invalides." }
  }

  const quality = clampStar(input.quality)
  const quantity = clampStar(input.quantity)
  const packaging = clampStar(input.packaging)
  const delivery = clampStar(input.delivery)
  const comment = (input.comment ?? "").trim().slice(0, 200)
  const average = scoreAverage(quality, quantity, packaging, delivery)

  const [thread] = await db
    .select()
    .from(orderThreads)
    .where(and(eq(orderThreads.id, threadId), eq(orderThreads.customerToken, userToken.trim())))
    .limit(1)

  if (!thread) return { ok: false, error: "Commande introuvable." }
  if (!isDelivered(thread.status)) {
    return { ok: false, error: "Notation possible uniquement sur une commande livrée." }
  }

  // Vérifie que le produit appartient à la commande
  const rateable = await getRateableProducts(threadId, userToken)
  if (!rateable.ok) return { ok: false, error: rateable.error }
  const target = rateable.products.find((p) => p.productId === input.productId)
  if (!target) return { ok: false, error: "Ce produit ne fait pas partie de ta commande." }
  if (target.alreadyRated) return { ok: false, error: "Tu as déjà noté ce produit pour cette commande." }

  const [account] = await db
    .select({ pseudo: users.pseudo })
    .from(users)
    .where(eq(users.token, userToken.trim()))
    .limit(1)

  const pseudo = account?.pseudo || thread.customerName || "Client"

  try {
    await db.insert(productRatings).values({
      productId: input.productId,
      productTitle: target.title,
      threadId,
      userToken: userToken.trim(),
      userPseudo: pseudo,
      quality,
      quantity,
      packaging,
      delivery,
      comment: comment || null,
      average,
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg.includes("unique") || msg.includes("duplicate")) {
      return { ok: false, error: "Tu as déjà noté ce produit pour cette commande." }
    }
    console.error("[ratings] submit:", e)
    return { ok: false, error: "Impossible d'enregistrer la note." }
  }

  revalidatePath("/caliboyz31")
  revalidatePath("/caliboyz94")
  revalidatePath("/calidelivery")
  return { ok: true, average }
}

/** Synthèse moyenne + nombre d'avis pour une liste de produits (vignettes). */
export async function getProductRatingSummaries(
  productIds: number[],
): Promise<Record<number, ProductRatingSummary>> {
  await ensureRatingsSchema()
  const ids = Array.from(new Set(productIds.filter((id) => Number.isFinite(id) && id > 0)))
  if (!ids.length) return {}

  try {
    const rows = await db
      .select({
        productId: productRatings.productId,
        average: avg(productRatings.average),
        count: count(),
      })
      .from(productRatings)
      .where(inArray(productRatings.productId, ids))
      .groupBy(productRatings.productId)

    const out: Record<number, ProductRatingSummary> = {}
    for (const r of rows) {
      const c = Number(r.count) || 0
      const a = r.average != null ? Math.round(Number(r.average) * 10) / 10 : null
      out[r.productId] = { productId: r.productId, average: a, count: c }
    }
    return out
  } catch (e) {
    console.error("[ratings] summaries:", e)
    return {}
  }
}

/** Détail des avis d'un produit (modale synthèse). */
export async function getProductReviews(
  productId: number,
): Promise<{ ok: true; average: number | null; count: number; reviews: ProductRatingDetail[] } | { ok: false; error: string }> {
  await ensureRatingsSchema()
  if (!productId) return { ok: false, error: "Produit invalide." }

  try {
    const reviews = await db
      .select()
      .from(productRatings)
      .where(eq(productRatings.productId, productId))
      .orderBy(desc(productRatings.createdAt))
      .limit(50)

    if (!reviews.length) {
      return { ok: true, average: null, count: 0, reviews: [] }
    }

    const sum = reviews.reduce((s, r) => s + (r.average ?? 0), 0)
    const average = Math.round((sum / reviews.length) * 10) / 10

    return {
      ok: true,
      average,
      count: reviews.length,
      reviews: reviews.map((r: ProductRating) => ({
        id: r.id,
        userPseudo: r.userPseudo || "Client",
        quality: r.quality,
        quantity: r.quantity,
        packaging: r.packaging,
        delivery: r.delivery,
        average: r.average,
        comment: r.comment,
        createdAt: r.createdAt,
      })),
    }
  } catch (e) {
    console.error("[ratings] reviews:", e)
    return { ok: false, error: "Impossible de charger les avis." }
  }
}

/** Corps du message d'invitation à noter (séparé des points fidélité). */
export function buildRatingInviteMessage(threadId: number): string {
  return [
    "⭐ Ta commande est livrée — dis-nous ce que tu en as pensé !",
    "",
    "Tu peux noter uniquement les produits de cette commande.",
    "",
    `[rate:${threadId}]`,
  ].join("\n")
}

export function isDeliveredStatus(status: string | null | undefined): boolean {
  return isDelivered(status)
}
