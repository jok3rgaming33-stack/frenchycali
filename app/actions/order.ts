"use server"

import { db, hasDatabase } from "@/lib/db"
import { ensureOrderThreadsColumns } from "@/lib/db/ensure"
import { orderThreads, threadMessages, users, promoCodes, loyaltyCodes, promoUsages } from "@/lib/db/schema"
import { eq, desc, and, sql } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { notifyVendor, notifyCustomer } from "@/lib/push"
import { isAdminAuthenticated } from "@/app/actions/admin-auth"
import { computeLoyaltyPoints } from "@/lib/loyalty"
import { ensureRatingsSchema } from "@/app/actions/ratings"
import { buildRatingInviteMessage } from "@/lib/order-items"
import { createCryptoInvoiceForOrder } from "@/app/actions/crypto-payment"

export type CartItem = { productId?: number; title: string; variant: string; price: number; qty: number }

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
  /** Frais livraison société (distance) ou locker MR — 0 pour meetup */
  deliveryFee?: number
  shop: "caliboyz31" | "caliboyz94" | "calidelivery"
}

/**
 * Place une commande (aligné BB33) :
 * - livraison = par la société (frais distance)
 * - meetup = en main propre
 * - locker = Mondial Relay + token TRK_ one-shot
 */
export async function placeOrder(input: PlaceOrderInput) {
  try {
    return await placeOrderInner(input)
  } catch (e) {
    console.error("[placeOrder]", e)
    return { ok: false as const, error: "Impossible d'enregistrer la commande. Réessaie dans un instant." }
  }
}

async function placeOrderInner(input: PlaceOrderInput) {
  if (!hasDatabase) return { ok: false as const, error: "Service temporairement indisponible." }
  await ensureOrderThreadsColumns()
  const {
    customerToken,
    customerName,
    items,
    fulfillment,
    address,
    lat,
    lng,
    scheduledDate,
    scheduledSlot,
    promoCode,
    shop,
  } = input
  if (!customerToken || !items?.length) return { ok: false as const, error: "Données invalides." }

  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0)
  const deliveryFee = Math.max(0, Math.round(Number(input.deliveryFee) || 0))

  let discount = 0
  let promoCodeUsed: string | null = null
  if (promoCode) {
    const code = promoCode.trim().toUpperCase()
    const promoRows = await db
      .select()
      .from(promoCodes)
      .where(and(eq(promoCodes.code, code), eq(promoCodes.active, true)))
      .limit(1)
    if (promoRows[0]) {
      const p = promoRows[0]
      if (subtotal >= p.minAmount) {
        if (p.type === "fixed") discount = p.value
        if (p.type === "percent") discount = Math.round((subtotal * p.value) / 100)
        promoCodeUsed = code
        await db.insert(promoUsages).values({ promoCode: code, userToken: customerToken })
      }
    } else {
      const loyaltyRows = await db
        .select()
        .from(loyaltyCodes)
        .where(
          and(
            eq(loyaltyCodes.code, code),
            eq(loyaltyCodes.userToken, customerToken),
            eq(loyaltyCodes.used, false),
          ),
        )
        .limit(1)
      if (loyaltyRows[0]) {
        const lc = loyaltyRows[0]
        if (subtotal >= lc.minAmount) {
          discount = lc.discount
          promoCodeUsed = code
          await db.update(loyaltyCodes).set({ used: true }).where(eq(loyaltyCodes.id, lc.id))
          const userRow = await db.select().from(users).where(eq(users.token, customerToken)).limit(1)
          if (userRow[0]) {
            await db
              .update(users)
              .set({ loyaltySpent: (userRow[0].loyaltySpent ?? 0) + lc.pointsCost })
              .where(eq(users.token, customerToken))
          }
        }
      }
    }
  }

  const total = Math.max(0, subtotal - discount + deliveryFee)
  const lines = items.map((i) => `• ${i.qty}x ${i.title} (${i.variant}) — ${i.price * i.qty}€`).join("\n")
  const productsShort = items.map((i) => `${i.qty}x ${i.title}`).join(", ")
  const itemsJson = items
    .filter((i) => i.productId && i.productId > 0)
    .map((i) => ({
      productId: i.productId as number,
      title: i.title,
      variant: i.variant,
      qty: i.qty,
      price: i.price,
    }))

  try {
    await ensureRatingsSchema()
  } catch { /* schema best-effort */ }

  const modeLabel =
    fulfillment === "meetup"
      ? `Meet-up / en main propre — ${scheduledSlot || "créneau à confirmer"}`
      : fulfillment === "locker"
        ? `Locker Mondial Relay — ${address || "point à confirmer"} (frais ${deliveryFee}€)`
        : `Livraison par nos soins — ${address || "adresse"} — ${scheduledSlot || "créneau"} (frais ${deliveryFee}€)`

  const summary = [
    `Nouvelle commande [${shop}] — ${customerName}`,
    ``,
    lines,
    ``,
    fulfillment !== "locker" && scheduledDate ? `Date : ${scheduledDate}` : null,
    modeLabel,
    promoCodeUsed && discount > 0 ? `Code ${promoCodeUsed} : -${discount}€` : null,
    ``,
    `Sous-total : ${subtotal}€`,
    deliveryFee > 0 ? `${fulfillment === "locker" ? "Locker MR" : "Livraison"} : ${deliveryFee}€` : null,
    discount > 0 ? `Réduction : -${discount}€` : null,
    `TOTAL : ${total}€`,
  ]
    .filter(Boolean)
    .join("\n")

  const trackingToken =
    fulfillment === "locker"
      ? `TRK_${crypto.randomUUID().replace(/-/g, "").slice(0, 16).toUpperCase()}`
      : `ORD_${crypto.randomUUID().replace(/-/g, "").slice(0, 16).toUpperCase()}`

  const baseValues = {
    customerName: customerName || "Client",
    customerToken,
    trackingToken,
    summary: summary.slice(0, 4000),
    products: productsShort,
    total,
    fulfillment,
    address: address?.trim() || null,
    lat: lat ?? null,
    lng: lng ?? null,
    scheduledDate: scheduledDate || null,
    scheduledSlot: scheduledSlot || null,
    status: "en_attente" as const,
  }

  let thread: typeof orderThreads.$inferSelect | undefined
  try {
    const [row] = await db
      .insert(orderThreads)
      .values({ ...baseValues, itemsJson })
      .returning()
    thread = row
  } catch {
    // Colonne items_json absente : commande sans snapshot structuré (fallback titres)
    const [row] = await db.insert(orderThreads).values(baseValues as typeof baseValues & { itemsJson?: never }).returning()
    thread = row
  }

  if (!thread) return { ok: false as const, error: "Erreur lors de la création de la commande." }

  await db.insert(threadMessages).values({
    threadId: thread.id,
    sender: "client",
    body: summary,
  })

  if (fulfillment === "locker") {
    const trkBody = [
      `⚠️ ATTENTION — LIS CE MESSAGE ATTENTIVEMENT ⚠️`,
      ``,
      `Ton token de suivi Locker est :`,
      ``,
      `${trackingToken}`,
      ``,
      `SAUVEGARDE CE TOKEN MAINTENANT.`,
      `Ce message sera automatiquement supprimé une fois que tu l'auras ouvert, pour des raisons de sécurité.`,
      `Sans ce token tu ne pourras plus accéder au suivi de ta commande.`,
    ].join("\n")

    const [trkThread] = await db
      .insert(orderThreads)
      .values({
        customerName: customerName || "Client",
        customerToken,
        trackingToken: `TRK_MSG_${crypto.randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase()}`,
        summary: `Token de suivi — Commande #${thread.id}`,
        total: 0,
        fulfillment: "locker",
        status: "trk_token",
      })
      .returning()

    await db.insert(threadMessages).values({
      threadId: trkThread.id,
      sender: "vendeur",
      body: trkBody,
    })

    await notifyCustomer(customerToken, {
      title: "Token de suivi Locker — A SAUVEGARDER",
      body: "Ouvre la messagerie maintenant pour récupérer ton token de suivi. Il sera supprimé après lecture.",
      url: "/",
      tag: `trk-${thread.id}`,
    })
  } else {
    await db.insert(threadMessages).values({
      threadId: thread.id,
      sender: "vendeur",
      body: `Merci pour ta commande ! Elle a bien été prise en compte (livraison par nos soins ou meet-up selon ton choix). Tu recevras une mise à jour dès qu'elle sera traitée.`,
    })
  }

  try {
    await notifyVendor({
      title: `Nouvelle commande ${shop}`,
      body: `${customerName} — ${total}€ — ${fulfillment}${fulfillment === "locker" ? " LOCKER" : ""}`,
      url: `/admin`,
      tag: "new-order",
    })
  } catch {
    /* push optionnel */
  }

  // Paiement multi-crypto (NOWPayments) — optionnel, ne bloque jamais la commande
  let cryptoPayment: {
    enabled: boolean
    invoiceUrl?: string
    paymentStatus?: string
    error?: string
  } = { enabled: false }

  try {
    const inv = await createCryptoInvoiceForOrder({
      threadId: thread.id,
      totalEur: total,
      customerToken,
      customerName: customerName || "Client",
      shop,
    })
    if (inv.ok) {
      cryptoPayment = {
        enabled: true,
        invoiceUrl: inv.invoiceUrl,
        paymentStatus: inv.paymentStatus,
      }
    } else if (!inv.skipped) {
      cryptoPayment = { enabled: false, error: inv.error }
      console.error("[placeOrder] crypto invoice skipped:", inv.error)
    }
  } catch (e) {
    console.error("[placeOrder] crypto invoice error:", e)
  }

  revalidatePath("/admin")
  revalidatePath("/messagerie")
  return {
    ok: true as const,
    trackingToken,
    threadId: thread.id,
    total,
    deliveryFee,
    discount,
    cryptoPayment,
  }
}

export async function getOrdersByToken(customerToken: string) {
  if (!customerToken) return []
  await ensureOrderThreadsColumns()
  return db
    .select()
    .from(orderThreads)
    .where(eq(orderThreads.customerToken, customerToken))
    .orderBy(desc(orderThreads.createdAt))
}

export async function getOrderByTracking(trackingToken: string) {
  if (!trackingToken) return null
  await ensureOrderThreadsColumns()
  const rows = await db.select().from(orderThreads).where(eq(orderThreads.trackingToken, trackingToken)).limit(1)
  return rows[0] ?? null
}

export async function getThreadMessages(threadId: number) {
  return db.select().from(threadMessages).where(eq(threadMessages.threadId, threadId)).orderBy(threadMessages.createdAt)
}

export async function sendClientMessage(threadId: number, body: string, customerToken: string) {
  if (!threadId || !body?.trim() || !customerToken) return { ok: false as const }
  const thread = await db
    .select()
    .from(orderThreads)
    .where(and(eq(orderThreads.id, threadId), eq(orderThreads.customerToken, customerToken)))
    .limit(1)
  if (!thread[0]) return { ok: false as const, error: "Accès refusé." }
  await db.insert(threadMessages).values({ threadId, sender: "client", body: body.trim() })
  await db.update(orderThreads).set({ updatedAt: sql`now()` }).where(eq(orderThreads.id, threadId))
  await notifyVendor({
    title: "Nouveau message client",
    body: `${thread[0].customerName}: ${body.slice(0, 80)}`,
    url: "/admin",
    tag: "client-message",
  })
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
    await notifyCustomer(thread[0].customerToken, {
      title: "Nouveau message",
      body: body.slice(0, 80),
      url: `/suivi?token=${thread[0].trackingToken}`,
      tag: "vendor-message",
    })
  }
  revalidatePath("/admin")
  return { ok: true as const }
}

export async function updateOrderStatus(threadId: number, status: string) {
  if (!(await isAdminAuthenticated())) return { ok: false as const }
  const thread = await db.select().from(orderThreads).where(eq(orderThreads.id, threadId)).limit(1)
  if (!thread[0]) return { ok: false as const }

  const prev = thread[0].status
  await db.update(orderThreads).set({ status, updatedAt: sql`now()` }).where(eq(orderThreads.id, threadId))

  const becameDelivered =
    prev !== status &&
    (status === "livree" || status === "locker_livre") &&
    prev !== "livree" &&
    prev !== "locker_livre"

  if (thread[0].customerToken) {
    if (becameDelivered) {
      const mode =
        thread[0].fulfillment === "meetup"
          ? "en meet-up"
          : thread[0].fulfillment === "locker"
            ? "en Locker Mondial Relay"
            : "en livraison"
      const points = computeLoyaltyPoints(thread[0].total ?? 0)
      // Message 1 : livraison + points (séparé de la notation)
      const body1 =
        `✨ Ta commande t'a bien été livrée (${mode}). Merci pour ta confiance !` +
        (points > 0 ? `\n${points} point${points > 1 ? "s" : ""} de fidélité viennent d'être crédités.` : "")
      await db.insert(threadMessages).values({ threadId, sender: "vendeur", body: body1 })
      // Message 2 : invitation à noter
      const body2 = buildRatingInviteMessage(threadId)
      await db.insert(threadMessages).values({ threadId, sender: "vendeur", body: body2 })
      await notifyCustomer(thread[0].customerToken, {
        title: "Commande livrée",
        body: body1.slice(0, 120),
        url: "/",
        tag: `status-${threadId}`,
      })
      await notifyCustomer(thread[0].customerToken, {
        title: "Note tes produits",
        body: "Dis-nous ce que tu as pensé de ta commande !",
        url: "/",
        tag: `rate-${threadId}`,
      })
    } else {
      const label = status.replace(/_/g, " ")
      await notifyCustomer(thread[0].customerToken, {
        title: "Commande mise à jour",
        body: `Statut : ${label}`,
        url: `/suivi?token=${thread[0].trackingToken}`,
        tag: "order-status",
      })
    }
  }
  revalidatePath("/admin")
  revalidatePath("/messagerie")
  return { ok: true as const }
}

export async function listAllOrders() {
  if (!(await isAdminAuthenticated())) return []
  await ensureOrderThreadsColumns()
  return db.select().from(orderThreads).orderBy(desc(orderThreads.createdAt))
}

export async function updateClientLastSeen(trackingToken: string) {
  if (!trackingToken) return
  await db
    .update(orderThreads)
    .set({ clientLastSeen: sql`now()` })
    .where(eq(orderThreads.trackingToken, trackingToken))
}
