"use server"

import { db } from "@/lib/db"
import { products, categories, promoCodes } from "@/lib/db/schema"
import { eq, asc, and, inArray, sql } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { isAdminAuthenticated } from "@/app/actions/admin-auth"
import type { ProductVariant, ProductMedia } from "@/lib/db/schema"

export async function getProducts(region?: string) {
  const query = db.select().from(products)
  if (region && region !== "all") {
    if (region === "delivery") {
      return query.where(eq(products.region, "delivery")).orderBy(asc(products.sortOrder))
    }
    return query.where(
      sql`${products.region} = ${region} OR ${products.region} = 'both'`
    ).orderBy(asc(products.sortOrder))
  }
  return query.orderBy(asc(products.sortOrder))
}

export async function getCategories() {
  return db.select().from(categories).orderBy(asc(categories.sortOrder))
}

export async function createProduct(data: {
  title: string; section: string; region: string; image?: string
  media?: ProductMedia[]; description?: string; fullDescription?: string
  stock?: number; variants?: ProductVariant[]; badges?: string[]
  discountType?: string; discountValue?: number; sortOrder?: number
  symbol?: string; number?: string
}) {
  if (!(await isAdminAuthenticated())) return { ok: false as const }
  const [p] = await db.insert(products).values({
    title: data.title, section: data.section || "featured", region: data.region || "both",
    image: data.image || null, media: data.media || [], description: data.description || null,
    fullDescription: data.fullDescription || null, stock: data.stock ?? 0,
    variants: data.variants || [], badges: data.badges || [],
    discountType: data.discountType || null, discountValue: data.discountValue ?? null,
    sortOrder: data.sortOrder ?? 0, symbol: data.symbol || null, number: data.number || null,
  }).returning()
  revalidatePath("/caliboyz31"); revalidatePath("/caliboyz94"); revalidatePath("/calidelivery"); revalidatePath("/admin")
  return { ok: true as const, product: p }
}

export async function updateProduct(id: number, data: Partial<{
  title: string; section: string; region: string; image: string; media: ProductMedia[]
  description: string; fullDescription: string; stock: number; variants: ProductVariant[]
  badges: string[]; discountType: string; discountValue: number; sortOrder: number
  symbol: string; number: string
}>) {
  if (!(await isAdminAuthenticated())) return { ok: false as const }
  await db.update(products).set(data as any).where(eq(products.id, id))
  revalidatePath("/caliboyz31"); revalidatePath("/caliboyz94"); revalidatePath("/calidelivery"); revalidatePath("/admin")
  return { ok: true as const }
}

export async function deleteProduct(id: number) {
  if (!(await isAdminAuthenticated())) return { ok: false as const }
  await db.delete(products).where(eq(products.id, id))
  revalidatePath("/caliboyz31"); revalidatePath("/caliboyz94"); revalidatePath("/calidelivery"); revalidatePath("/admin")
  return { ok: true as const }
}

export async function createCategory(name: string) {
  if (!(await isAdminAuthenticated())) return { ok: false as const }
  const key = name.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "")
  await db.insert(categories).values({ key, name }).onConflictDoNothing()
  revalidatePath("/admin")
  return { ok: true as const }
}

export async function getPromoCodes() {
  if (!(await isAdminAuthenticated())) return []
  return db.select().from(promoCodes).orderBy(sql`created_at desc`)
}

export async function createPromoCode(data: { code: string; type: string; value: number; minAmount?: number }) {
  if (!(await isAdminAuthenticated())) return { ok: false as const }
  await db.insert(promoCodes).values({
    code: data.code.trim().toUpperCase(), type: data.type,
    value: data.value, minAmount: data.minAmount ?? 0,
  })
  revalidatePath("/admin")
  return { ok: true as const }
}

export async function deletePromoCode(id: number) {
  if (!(await isAdminAuthenticated())) return { ok: false as const }
  await db.delete(promoCodes).where(eq(promoCodes.id, id))
  revalidatePath("/admin")
  return { ok: true as const }
}

export async function validatePromoCode(code: string, userToken: string, subtotal: number) {
  if (!code?.trim()) return { ok: false as const, error: "Code vide." }
  const c = code.trim().toUpperCase()
  // Check global promo
  const promoRows = await db.select().from(promoCodes).where(and(eq(promoCodes.code, c), eq(promoCodes.active, true))).limit(1)
  if (promoRows[0]) {
    const p = promoRows[0]
    const discount = p.type === "percent" ? Math.round(subtotal * p.value / 100) : p.value
    return { ok: true as const, code: c, type: p.type, value: p.value, discount: subtotal >= p.minAmount ? discount : 0, minAmount: p.minAmount }
  }
  // Check loyalty
  const { loyaltyCodes } = await import("@/lib/db/schema")
  const loyaltyRows = await db.select().from(loyaltyCodes)
    .where(and(eq(loyaltyCodes.code, c), eq(loyaltyCodes.userToken, userToken), eq(loyaltyCodes.used, false))).limit(1)
  if (loyaltyRows[0]) {
    const lc = loyaltyRows[0]
    return { ok: true as const, code: c, type: "loyalty_fixed", value: lc.discount, discount: subtotal >= lc.minAmount ? lc.discount : 0, minAmount: lc.minAmount }
  }
  return { ok: false as const, error: "Code invalide ou déjà utilisé." }
}

export async function generateLoyaltyCode(userToken: string, reward: { points: number; discount: number; minAmount: number }) {
  if (!userToken) return { ok: false as const }
  const { loyaltyCodes, users } = await import("@/lib/db/schema")
  const { computeLoyaltyPoints } = await import("@/lib/loyalty")
  const { isClosedStatus, normalizeStatus } = await import("@/lib/order-status")
  const { orderThreads } = await import("@/lib/db/schema")
  // Compute current points
  const orders = await db.select().from(orderThreads).where(eq(orderThreads.customerToken, userToken))
  let points = 0
  for (const o of orders) { if (normalizeStatus(o.status) === "livree") points += computeLoyaltyPoints(o.total ?? 0) }
  const account = await db.select().from(users).where(eq(users.token, userToken)).limit(1)
  points = Math.max(0, points + (account[0]?.loyaltyAdjustment ?? 0) - (account[0]?.loyaltySpent ?? 0))
  if (points < reward.points) return { ok: false as const, error: "Points insuffisants." }
  const code = `FIDELITE-${Math.random().toString(36).slice(2, 8).toUpperCase()}`
  await db.insert(loyaltyCodes).values({ userToken, code, discount: reward.discount, pointsCost: reward.points, minAmount: reward.minAmount })
  await db.update(users).set({ loyaltySpent: (account[0]?.loyaltySpent ?? 0) + reward.points }).where(eq(users.token, userToken))
  return { ok: true as const, code }
}
