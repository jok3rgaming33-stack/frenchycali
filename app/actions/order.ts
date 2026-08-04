"use server"

import { db } from "@/lib/db"
import { orderThreads, threadMessages, users, promoCodes, loyaltyCodes, promoUsages } from "@/lib/db/schema"
import { eq, desc, and, sql } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { randomBytes } from "crypto"
import { notifyVendor, notifyCustomer } from "@/lib/push"
import { isAdminAuthenticated } from "@/app/actions/admin-auth"

export type CartItem = { title: string; variant: string; price: number; qty: number }

export type PlaceOrderInput = {
  customerToken: string
  customerName: string
  items: CartItem[]
  fulfillment: "livraison" | "meetup" | "locker"
  address?: string
  lat?: number | null
  lng?: number | null
  scheduledDate?: string
  scheduledSlot?: string
  promoCode?: string
  shop: "caliboyz31" | "caliboyz94" | "calidelivery"
}

export async function placeOrder(input: PlaceOrderInput) {
  const { customerToken, customerName, items, fulfillment, address, lat, lng, scheduledDate, scheduledSlot, promoCode, shop } = input
  if (!customerToken || !items?.length) return { ok: false as const, error: "Données invalides." }

  const trackingToken = randomBytes(20).toString("hex")
  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0)

  // Apply promo
  let discount = 0
  let promoCodeUsed: string | null = null
  if (promoCode) {
    const code = promoCode.trim().toUpperCase()
    const promoRows = await db.select().from(promoCodes).where(and(eq(promoCodes.code, code), eq(promoCodes.active, true))).limit(1)
    if (promoRows[0]) {
      const p = promoRows[0]
      if (subtotal >= p.minAmount) {
        if (p.type === "fixed") discount = p.value
        if (p.type === "percent") discount = Math.round(subtotal * p.value / 100)
        promoCodeUsed = code
        await db.insert(promoUsages).values({ promoCode: code, userToken: customerToken })
      }
    } else {
      // Check loyalty code
      const loyaltyRows = await db.select().from(loyaltyCodes)
        .where(and(eq(loyaltyCodes.code, code), eq(loyaltyCodes.userToken, customerToken), eq(loyaltyCodes.used, false))).limit(1)
      if (loyaltyRows[0]) {
        const lc = loyaltyRows[0]
        if (subtotal >= lc.minAmount) {
          discount = lc.discount
          promoCodeUsed = code
          await db.update(loyaltyCodes).set({ used: true }).where(eq(loyaltyCodes.id, lc.id))
          // Deduct points
          const userRow = await db.select().from(users).where(eq(users.token, customerToken)).limit(1)
          if (userRow[0]) {
            await db.update(users).set({ loyaltySpent: (userRow[0].loyaltySpent ?? 0) + lc.pointsCost }).where(eq(users.token, customerToken))
          }
        }
      }
    }
  }

  const total = Math.max(0, subtotal - discount)
  const summary = items.map((i) => `${i.title} (${i.variant}) x${i.qty}`).join(", ")
  const productsJson = JSON.stringify(items)

  const [thread] = await db.insert(orderThreads).values({
    customerName, customerToken, trackingToken, summary, products: productsJson, total,
    fulfillment, address: address || null, lat: lat ?? null, lng: lng ?? null,
    scheduledDate: scheduledDate || null, scheduledSlot: scheduledSlot || null,
    shop, status: "nouveau",
  }).returning()

  if (!thread) return { ok: false as const, error: "Erreur lors de la création de la commande." }

  await notifyVendor({
    title: `Nouvelle commande ${shop}`,
    body: `${customerName} — ${total}€ — ${fulfillment}`,
    url: `/admin`,
    tag: "new-order",
  })

  revalidatePath("/admin")
  return { ok: true as const, trackingToken, threadId: thread.id }
}

export async function getOrdersByToken(customerToken: string) {
  if (!customerToken) return []
  return db.select().from(orderThreads).where(eq(orderThreads.customerToken, customerToken)).orderBy(desc(orderThreads.createdAt))
}

export async function getOrderByTracking(trackingToken: string) {
  if (!trackingToken) return null
  const rows = await db.select().from(orderThreads).where(eq(orderThreads.trackingToken, trackingToken)).limit(1)
  return rows[0] ?? null
}

export async function getThreadMessages(threadId: number) {
  return db.select().from(threadMessages).where(eq(threadMessages.threadId, threadId)).orderBy(threadMessages.createdAt)
}

export async function sendClientMessage(threadId: number, body: string, customerToken: string) {
  if (!threadId || !body?.trim() || !customerToken) return { ok: false as const }
  const thread = await db.select().from(orderThreads).where(and(eq(orderThreads.id, threadId), eq(orderThreads.customerToken, customerToken))).limit(1)
  if (!thread[0]) return { ok: false as const, error: "Accès refusé." }
  await db.insert(threadMessages).values({ threadId, sender: "client", body: body.trim() })
  await db.update(orderThreads).set({ updatedAt: sql`now()` }).where(eq(orderThreads.id, threadId))
  await notifyVendor({ title: "Nouveau message client", body: `${thread[0].customerName}: ${body.slice(0, 80)}`, url: "/admin", tag: "client-message" })
  return { ok: true as const }
}

export async function sendAdminMessage(threadId: number, body: string) {
  if (!threadId || !body?.trim()) return { ok: false as const }
  if (!(await isAdminAuthenticated())) return { ok: false as const, error: "unauthorized" }
  const thread = await db.select().from(orderThreads).where(eq(orderThreads.id, threadId)).limit(1)
  if (!thread[0]) return { ok: false as const }
  await db.insert(threadMessages).values({ threadId, sender: "vendeur", body: body.trim() })
  await db.update(orderThreads).set({ updatedAt: sql`now()` }).where(eq(orderThreads.id, threadId))
  if (thread[0].customerToken) {
    await notifyCustomer(thread[0].customerToken, { title: "Nouveau message", body: body.slice(0, 80), url: `/suivi?token=${thread[0].trackingToken}`, tag: "vendor-message" })
  }
  revalidatePath("/admin")
  return { ok: true as const }
}

export async function updateOrderStatus(threadId: number, status: string) {
  if (!(await isAdminAuthenticated())) return { ok: false as const }
  const thread = await db.select().from(orderThreads).where(eq(orderThreads.id, threadId)).limit(1)
  if (!thread[0]) return { ok: false as const }
  await db.update(orderThreads).set({ status, updatedAt: sql`now()` }).where(eq(orderThreads.id, threadId))
  if (thread[0].customerToken) {
    const label = status.replace(/_/g, " ")
    await notifyCustomer(thread[0].customerToken, { title: "Commande mise à jour", body: `Statut : ${label}`, url: `/suivi?token=${thread[0].trackingToken}`, tag: "order-status" })
  }
  revalidatePath("/admin")
  return { ok: true as const }
}

export async function listAllOrders() {
  if (!(await isAdminAuthenticated())) return []
  return db.select().from(orderThreads).orderBy(desc(orderThreads.createdAt))
}

export async function updateClientLastSeen(trackingToken: string) {
  if (!trackingToken) return
  await db.update(orderThreads).set({ clientLastSeen: sql`now()` }).where(eq(orderThreads.trackingToken, trackingToken))
}
