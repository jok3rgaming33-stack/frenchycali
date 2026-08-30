"use server"

import { db } from "@/lib/db"
import { orderThreads, threadMessages, products } from "@/lib/db/schema"
import { and, desc, eq, gt, inArray, isNull, ne, notInArray, or, sql, type SQL } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { normalizeStatus, statusMeta } from "@/lib/order-status"
import { computeLoyaltyPoints } from "@/lib/loyalty"
import { notifyCustomer, notifyVendor } from "@/lib/push"
import { adjustStock } from "@/app/actions/products"
import { buildRatingInviteMessage } from "@/lib/order-items"
import { ensureOrderThreadsColumns } from "@/lib/db/ensure"
import { isParcelFulfillment, isShopId, type ShopId } from "@/lib/shops"

/**
 * Filtre SQL boutique.
 * Inclut aussi les commandes legacy sans colonne `shop` si le tag [shop] est dans le summary,
 * et pour CaliDelivery les colis sans shop (anciennes commandes locker).
 */
function shopEq(shop?: ShopId | null): SQL | undefined {
  if (!shop) return undefined
  const tagged = sql`${orderThreads.summary} ~* ${`\\[${shop}\\]`}`
  if (shop === "calidelivery") {
    return or(
      eq(orderThreads.shop, shop),
      and(isNull(orderThreads.shop), tagged),
      and(
        isNull(orderThreads.shop),
        notInArray(orderThreads.fulfillment, ["meetup", "livraison"]),
      ),
    )
  }
  return or(eq(orderThreads.shop, shop), and(isNull(orderThreads.shop), tagged))
}

export type NewOrderInput = {
  customerName: string
  customerToken?: string
  summary: string
  products?: string
  total: number
  // Montant de la remise appliquée (promo ou fidélité). Stocké pour calculer
  // les points sur le total net et informer le client dans le message de livraison.
  promoDiscount?: number
  fulfillment: string
  address?: string
  lat?: number | null
  lng?: number | null
  scheduledDate?: string
  scheduledSlot?: string
  shop?: ShopId
}

// Crée un fil de commande + génère le token de suivi + envoie le message initial au client
export async function createOrderThread(input: NewOrderInput) {
  const name = input.customerName?.trim() || "Client"
  // Génère un token de suivi unique : "TRK_" + 16 caractères aléatoires
  const trackingToken = `TRK_${crypto.randomUUID().replace(/-/g, "").slice(0, 16).toUpperCase()}`
  
  await ensureOrderThreadsColumns()
  const [thread] = await db
    .insert(orderThreads)
    .values({
      customerName: name,
      customerToken: input.customerToken?.trim() || null,
      trackingToken,
      summary: input.summary,
      products: input.products?.trim() || null,
      total: input.total,
      shop: input.shop && isShopId(input.shop) ? input.shop : null,
      fulfillment: input.fulfillment,
      address: input.address?.trim() || null,
      lat: input.lat ?? null,
      lng: input.lng ?? null,
      scheduledDate: input.scheduledDate ?? null,
      scheduledSlot: input.scheduledSlot ?? null,
      status: "en_attente",
    })
    .returning()

  // Message initial du client (résumé de la commande)
  await db.insert(threadMessages).values({
    threadId: thread.id,
    sender: "client",
    body: input.summary,
  })

  if (isParcelFulfillment(input.fulfillment)) {
    // Colis (CaliDelivery / legacy locker) : fil one-shot avec le token TRK
    const trkBody = [
      `⚠️ ATTENTION — LIS CE MESSAGE ATTENTIVEMENT ⚠️`,
      ``,
      `Ton token de suivi colis est :`,
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
        customerName: name,
        customerToken: input.customerToken?.trim() || null,
        trackingToken: `TRK_MSG_${crypto.randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase()}`,
        summary: `Token de suivi — Commande #${thread.id}`,
        total: 0,
        shop: input.shop && isShopId(input.shop) ? input.shop : null,
        fulfillment: input.fulfillment,
        status: "trk_token", // statut spécial : message TRK à lire une fois
      })
      .returning()

    await db.insert(threadMessages).values({
      threadId: trkThread.id,
      sender: "vendeur",
      body: trkBody,
    })

    await notifyCustomer(input.customerToken?.trim() || null, {
      title: "Token de suivi colis — À SAUVEGARDER",
      body: "Ouvre la messagerie maintenant pour récupérer ton token de suivi. Il sera supprimé après lecture.",
      url: "/",
      tag: `trk-${thread.id}`,
    })
  } else {
    await db.insert(threadMessages).values({
      threadId: thread.id,
      sender: "vendeur",
      body: `Merci pour ta commande ! Elle a bien été prise en compte. Tu recevras une mise à jour dès qu'elle sera traitée.`,
    })
  }

  await notifyVendor({
    title: "Nouvelle commande",
    body: `${name} vient de passer une commande (#${thread.id})${isParcelFulfillment(input.fulfillment) ? " — COLIS" : ""}.`,
    url: "/admin",
    tag: `order-${thread.id}`,
  })

  revalidatePath("/messagerie")
  revalidatePath("/admin")
  return { id: thread.id, trackingToken }
}

// Crée une discussion générale (sans commande) : le client contacte directement le support.
export async function createGeneralInquiryThread(input: {
  customerName: string
  customerToken?: string
  message: string
}) {
  const name = input.customerName?.trim() || "Client"
  const body = input.message?.trim()
  if (!body) return { ok: false as const }

  const [thread] = await db
    .insert(orderThreads)
    .values({
      customerName: name,
      customerToken: input.customerToken?.trim() || null,
      trackingToken: `MSG_${crypto.randomUUID().replace(/-/g, "").slice(0, 16).toUpperCase()}`,
      summary: "Discussion générale",
      total: 0,
      fulfillment: "livraison",
      status: "discussion",
    })
    .returning()

  await db.insert(threadMessages).values({ threadId: thread.id, sender: "client", body })

  await notifyVendor({
    title: `Message de ${name}`,
    body: body.length > 80 ? `${body.slice(0, 77)}…` : body,
    url: "/admin",
    tag: `thread-${thread.id}`,
  })

  revalidatePath("/messagerie")
  revalidatePath("/admin")
  return { ok: true as const, id: thread.id }
}

// Fils affichés dans le récap commandes :
// - exclut les notifications broadcast
// - exclut les discussions directes (status discussion/pris_en_charge/ouvert/ferme)
// - exclut les fils sans article (total = 0 ou null) → ils vont dans Messagerie
export async function getThreads(shop?: ShopId) {
  await ensureOrderThreadsColumns()
  const threads = await db
    .select()
    .from(orderThreads)
    .where(
      and(
        ne(orderThreads.status, "notification"),
        notInArray(orderThreads.status, ["discussion", "pris_en_charge", "ouvert", "ferme"]),
        gt(orderThreads.total, 0),
        shopEq(shop),
      )
    )
    .orderBy(desc(orderThreads.updatedAt))
  return threads
}

// Statuts réservés à la Messagerie — exclus de toutes les vues Commandes
const DISCUSSION_STATUSES = ["discussion", "pris_en_charge", "ouvert", "ferme"] as const

/**
 * Commandes actives pour un panel boutique.
 * - LaCentral 31/IDF : meetup + livraison main
 * - CaliDelivery : commandes colis (hors meetup/livraison)
 */
export async function getActiveOrders(shop?: ShopId) {
  await ensureOrderThreadsColumns()
  const fulfillmentFilter =
    shop === "calidelivery"
      ? notInArray(orderThreads.fulfillment, ["meetup", "livraison"])
      : shop
        ? inArray(orderThreads.fulfillment, ["meetup", "livraison"])
        : undefined

  const threads = await db
    .select()
    .from(orderThreads)
    .where(
      and(
        notInArray(orderThreads.status, ["livree", "annulee", "notification", ...DISCUSSION_STATUSES]),
        fulfillmentFilter,
        shopEq(shop),
      )
    )
    .orderBy(desc(orderThreads.updatedAt))
  return threads
}

/**
 * Commandes colis actives (CaliDelivery + legacy locker).
 * Alias historique : getLockerOrders.
 */
export async function getParcelOrders(shop?: ShopId) {
  await ensureOrderThreadsColumns()
  const threads = await db
    .select()
    .from(orderThreads)
    .where(
      and(
        notInArray(orderThreads.status, ["livree", "annulee", "trk_token", ...DISCUSSION_STATUSES]),
        notInArray(orderThreads.fulfillment, ["meetup", "livraison"]),
        shopEq(shop),
      )
    )
    .orderBy(desc(orderThreads.updatedAt))
  return threads
}

/** @deprecated Préférer getParcelOrders */
export async function getLockerOrders(shop?: ShopId) {
  return getParcelOrders(shop)
}

// Commandes clôturées (livree ou annulee), toutes livraisons confondues, sans discussions
export async function getPastOrders(shop?: ShopId) {
  await ensureOrderThreadsColumns()
  return db
    .select()
    .from(orderThreads)
    .where(
      and(
        or(
          eq(orderThreads.status, "livree"),
          eq(orderThreads.status, "annulee"),
        ),
        notInArray(orderThreads.status, ["trk_token", ...DISCUSSION_STATUSES]),
        shopEq(shop),
      )
    )
    .orderBy(desc(orderThreads.updatedAt))
}

// Discussions directes — tous les statuts discussion (discussion, pris_en_charge, ouvert, ferme)
export async function getDiscussions(shop?: ShopId) {
  await ensureOrderThreadsColumns()
  const threads = await db
    .select()
    .from(orderThreads)
    .where(
      and(
        inArray(orderThreads.status, ["discussion", "pris_en_charge", "ouvert", "ferme"]),
        shopEq(shop),
      ),
    )
    .orderBy(desc(orderThreads.updatedAt))
  return threads
}

// Détail d'un fil avec tous ses messages (ordre chronologique)
export async function getThread(id: number) {
  const [thread] = await db.select().from(orderThreads).where(eq(orderThreads.id, id))
  if (!thread) return null
  const messages = await db
    .select()
    .from(threadMessages)
    .where(eq(threadMessages.threadId, id))
    .orderBy(threadMessages.createdAt)
  return { thread, messages }
}

// Supprime un message unique d'un fil (admin uniquement, sans impact sur le statut ou le total).
export async function deleteMessage(messageId: number) {
  if (!messageId) return { ok: false as const }
  await db.delete(threadMessages).where(eq(threadMessages.id, messageId))
  revalidatePath("/admin")
  return { ok: true as const }
}

// Ajoute un message dans un fil (vendeur ou client)
export async function addMessage(threadId: number, sender: "client" | "vendeur", body: string) {
  const text = body?.trim()
  if (!text) return { ok: false }

  await db.insert(threadMessages).values({ threadId, sender, body: text })
  // Le statut reste un choix délibéré du vendeur : on ne met à jour que la date.
  await db
    .update(orderThreads)
    .set({ updatedAt: sql`now()` })
    .where(eq(orderThreads.id, threadId))

  // Notification push à l'autre partie.
  const [thread] = await db.select().from(orderThreads).where(eq(orderThreads.id, threadId))
  if (thread) {
    // Nettoie les balises média pour le preview push (ex: [image]url[/image] → "Photo jointe")
    const cleanPreview = text
      .replace(/\[image\][^\]]*\[\/image\]/gi, "📷 Photo jointe")
      .replace(/\[video\][^\]]*\[\/video\]/gi, "🎥 Video jointe")
      .replace(/\[audio\][^\]]*\[\/audio\]/gi, "🎤 Message vocal")
      .trim()
    const preview = cleanPreview.length > 80 ? `${cleanPreview.slice(0, 77)}…` : cleanPreview
    if (sender === "vendeur") {
      // Message du vendeur → on prévient le client.
      await notifyCustomer(thread.customerToken, {
        title: "Nouveau message du vendeur",
        body: preview,
        url: "/",
        tag: `thread-${threadId}`,
      })
    } else {
      // Message du client → on prévient le vendeur.
      await notifyVendor({
        title: `Message de ${thread.customerName}`,
        body: preview,
        url: "/admin",
        tag: `thread-${threadId}`,
      })
    }
  }

  revalidatePath("/messagerie")
  revalidatePath(`/messagerie/${threadId}`)
  return { ok: true }
}

// Met à jour le statut d'un fil et envoie automatiquement un message au client avec les infos à jour.
// Optionnellement met à jour le numéro Colissimo quand la commande est expédiée.
// Pour "livree", c'est aussi le moment où les points de fidélité sont crédités (voir getCustomerStats).
// Pour "annulee", un motif facultatif saisi par l'admin est inclus dans le message.
export async function updateThreadStatus(
  threadId: number,
  status: string,
  reason?: string,
  colissimoNumber?: string
) {
  const [current] = await db.select().from(orderThreads).where(eq(orderThreads.id, threadId))
  if (!current) return { ok: false }

  const prevKey = normalizeStatus(current.status)
  const nextKey = normalizeStatus(status)

  // Mise à jour du statut et optionnellement du numéro Colissimo
  const updateData: any = { status, updatedAt: sql`now()` }
  if (colissimoNumber?.trim()) {
    updateData.colissimoNumber = colissimoNumber.trim()
  }

  await db
    .update(orderThreads)
    .set(updateData)
    .where(eq(orderThreads.id, threadId))

  // Message automatique au client, uniquement quand le statut change réellement.
  if (nextKey !== prevKey) {
    let body: string | null = null
    switch (nextKey) {
      case "pris_en_charge":
        body = "Ta demande a bien été reçue et est en cours de traitement."
        break
      case "ouvert":
        body = "Ta discussion est ouverte. Tu peux continuer à échanger."
        break
      case "ferme":
        body = "Cette discussion a été clôturée. Tu peux toujours la consulter ici."
        break
      case "validee":
        body = "✅ Ta commande a été validée et prise en charge."
        break
      case "preparation":
        body = "⚙️ Nous sommes en train de préparer tes articles."
        break
      case "pret_meetup":
        body = "Ton colis est prêt. Tu peux venir le récupérer lors de notre rendez-vous."
        break
      case "bientot_livraison":
        body = "🚚 Ton colis sera bientôt pris en charge par le livreur. Reste joignable, la livraison approche !"
        break
      case "livraison": {
        // Inclure le numéro de suivi Colissimo s'il existe
        const colNum = current.colissimoNumber || colissimoNumber
        body = colNum
          ? `📦 C'est parti ! Le livreur est en route.\nNuméro de suivi : ${colNum}\nReste joignable.`
          : "📦 Le livreur est en route. Reste joignable."
        break
      }
      case "livree": {
        const mode = current.fulfillment === "meetup" ? "en meet-up" : current.fulfillment === "locker" ? "en Locker Mondial Relay" : "en livraison"
        const points = computeLoyaltyPoints(current.total ?? 0)
        // Message 1 : livraison + points fidélité (séparé de l'invitation à noter)
        body =
          `✨ Ta commande t'a bien été livrée (${mode}). Merci pour ta confiance !` +
          (points > 0 ? `\n${points} point${points > 1 ? "s" : ""} de fidélité viennent d'être crédités.` : "")
        break
      }
      case "annulee": {
        const motif = reason?.trim()
        body = motif
          ? `❌ Ta commande a été annulée.\nMotif : ${motif}`
          : "❌ Ta commande a été annulée."
        break
      }
    }
    if (body) {
      await db.insert(threadMessages).values({ threadId, sender: "vendeur", body })
      // Notifie le client du changement de statut de sa commande.
      await notifyCustomer(current.customerToken, {
        title: `Commande #${threadId} — ${statusMeta(nextKey).label}`,
        body,
        url: "/",
        tag: `status-${threadId}`,
      })
    }
    // Message 2 (livrée uniquement) : invitation à noter les produits achetés
    if (nextKey === "livree") {
      const rateBody = buildRatingInviteMessage(threadId)
      await db.insert(threadMessages).values({ threadId, sender: "vendeur", body: rateBody })
      await notifyCustomer(current.customerToken, {
        title: `Commande #${threadId} — Note tes produits`,
        body: "Dis-nous ce que tu as pensé de ta commande !",
        url: "/",
        tag: `rate-${threadId}`,
      })
    }
  }

  revalidatePath("/messagerie")
  revalidatePath(`/messagerie/${threadId}`)
  revalidatePath("/admin")
  return { ok: true }
}

// Vue client : ses fils filtrés par pseudo (compat héritée)
export async function getThreadsForCustomer(customerName: string) {
  const name = customerName?.trim()
  if (!name) return []
  return db
    .select()
    .from(orderThreads)
    .where(eq(orderThreads.customerName, name))
    .orderBy(desc(orderThreads.updatedAt))
}

// Vue client onglet "En locker" : commandes locker du client, identifiées par son customerToken
export async function getLockerOrdersForToken(customerToken: string) {
  const token = customerToken?.trim()
  if (!token) return []
  return db
    .select()
    .from(orderThreads)
    .where(
      and(
        eq(orderThreads.customerToken, token),
        eq(orderThreads.fulfillment, "locker"),
        ne(orderThreads.status, "trk_token"), // exclure les fils TRK — ils s'affichent dans "En cours"
      )
    )
    .orderBy(desc(orderThreads.updatedAt))
}

// Vue client "Mes commandes" onglet "En cours" :
// - commandes non-locker (toutes)
// - fils trk_token (locker) : alerte ambre "token à sauvegarder"
// Les vraies commandes locker (non-trk) sont dans getLockerOrdersForToken.
export async function getThreadsForToken(customerToken: string) {
  const token = customerToken?.trim()
  if (!token) return []
  return db
    .select()
    .from(orderThreads)
    .where(
      and(
        eq(orderThreads.customerToken, token),
        ne(orderThreads.status, "notification"),            // les notifs broadcast passent par la cloche, pas la messagerie
        or(
          ne(orderThreads.fulfillment, "locker"),            // commandes normales
          eq(orderThreads.status, "trk_token"),             // fils TRK locker à afficher en ambre
        ),
      )
    )
    .orderBy(desc(orderThreads.updatedAt))
}

// Marque un fil comme lu par le client :
// - met à jour clientLastSeen sur le thread
// - horodate clientReadAt sur tous les messages vendeur non encore lus (visible admin uniquement)
export async function markThreadRead(threadId: number) {
  if (!threadId) return
  await db
    .update(orderThreads)
    .set({ clientLastSeen: sql`now()` })
    .where(eq(orderThreads.id, threadId))
  await db
    .update(threadMessages)
    .set({ clientReadAt: sql`now()` })
    .where(
      and(
        eq(threadMessages.threadId, threadId),
        eq(threadMessages.sender, "vendeur"),
        isNull(threadMessages.clientReadAt),
      )
    )
}

function tsMs(d: Date | string | null | undefined): number {
  if (!d) return 0
  const t = new Date(d).getTime()
  return Number.isFinite(t) ? t : 0
}

/**
 * Non-lus client par section (badges menu + icône app).
 *
 * Un fil est non lu UNIQUEMENT s'il y a de l'activité vendeur non vue :
 * - au moins un message vendeur après clientLastSeen, ou
 * - jamais ouvert (clientLastSeen null) + au moins un message vendeur, ou
 * - statut trk_token jamais ouvert (message auto à lire)
 *
 * Ne compte plus les réponses du client lui-même (bug qui re-badgeait après envoi).
 *
 * - messaging : discussions (status discussion / pris_en_charge / ouvert / ferme)
 * - orders    : commandes réelles + locker + trk
 */
export async function getUnreadCounts(
  customerToken: string,
): Promise<{ messaging: number; orders: number; total: number }> {
  const token = customerToken?.trim()
  if (!token) return { messaging: 0, orders: 0, total: 0 }

  const rows = await db
    .select({
      id: orderThreads.id,
      fulfillment: orderThreads.fulfillment,
      status: orderThreads.status,
      total: orderThreads.total,
      clientLastSeen: orderThreads.clientLastSeen,
      lastVendorAt: sql<Date | string | null>`(
        SELECT MAX(${threadMessages.createdAt})
        FROM ${threadMessages}
        WHERE ${threadMessages.threadId} = ${orderThreads.id}
          AND ${threadMessages.sender} = 'vendeur'
      )`,
    })
    .from(orderThreads)
    .where(
      and(eq(orderThreads.customerToken, token), ne(orderThreads.status, "notification")),
    )

  let messaging = 0
  let orders = 0
  const DISCUSSION = new Set(["discussion", "pris_en_charge", "ouvert", "ferme"])

  for (const r of rows) {
    const seenMs = tsMs(r.clientLastSeen)
    const vendorMs = tsMs(r.lastVendorAt)
    const isTrk = r.status === "trk_token"
    // Non lu = message vendeur plus récent que la dernière ouverture, ou TRK jamais ouvert
    const isUnread =
      (vendorMs > 0 && vendorMs > seenMs) || (isTrk && seenMs === 0)
    if (!isUnread) continue

    if (DISCUSSION.has(r.status)) {
      messaging++
    } else {
      orders++
    }
  }

  return { messaging, orders, total: messaging + orders }
}

/**
 * Compteurs admin pour pastilles rouges (panel + icône PWA vendeur).
 * - orders : nouvelles commandes + commandes en attente de réponse client
 * - locker : nouvelles commandes locker
 * - messaging : discussions dont le dernier message est du client
 * - verifications : KYC en attente
 * - recovery : dossiers récupération ouverts
 */
export async function getAdminBadgeCounts(shop?: ShopId): Promise<{
  orders: number
  locker: number
  messaging: number
  verifications: number
  recovery: number
  total: number
}> {
  const empty = { orders: 0, locker: 0, messaging: 0, verifications: 0, recovery: 0, total: 0 }
  try {
    const { isAdminAuthenticated } = await import("@/app/actions/admin-auth")
    if (!(await isAdminAuthenticated())) return empty
  } catch {
    return empty
  }

  await ensureOrderThreadsColumns()
  const DISCUSSION = new Set(["discussion", "pris_en_charge", "ouvert", "ferme"])

  const threads = await db
    .select({
      id: orderThreads.id,
      fulfillment: orderThreads.fulfillment,
      status: orderThreads.status,
      lastSender: sql<string | null>`(
        SELECT m.sender
        FROM ${threadMessages} m
        WHERE m.thread_id = ${orderThreads.id}
        ORDER BY m.created_at DESC
        LIMIT 1
      )`,
    })
    .from(orderThreads)
    .where(
      and(
        notInArray(orderThreads.status, ["notification", "livree", "annulee", "trk_token"]),
        shopEq(shop),
      ),
    )

  let orders = 0
  let locker = 0
  let messaging = 0

  for (const t of threads) {
    const isDiscussion = DISCUSSION.has(t.status)
    const waitingClient = t.lastSender === "client"
    const isNew = t.status === "en_attente" || t.status === "nouveau"

    if (isDiscussion) {
      if (waitingClient || t.status === "discussion") messaging++
      continue
    }

    if (isParcelFulfillment(t.fulfillment)) {
      if (isNew || waitingClient) locker++
    } else {
      if (isNew || waitingClient) orders++
    }
  }

  let verifications = 0
  try {
    const { userVerifications } = await import("@/lib/db/schema")
    const [v] = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(userVerifications)
      .where(eq(userVerifications.status, "pending"))
    verifications = v?.c ?? 0
  } catch {
    /* ignore */
  }

  let recovery = 0
  try {
    const rec = await db.execute(sql`
      SELECT COUNT(*)::int AS c FROM account_recovery_claims
      WHERE status IN ('pending_kyc', 'kyc_submitted')
    `)
    const raw = rec as unknown as { rows?: { c: number }[]; rowCount?: number } | { c: number }[]
    if (Array.isArray(raw)) {
      recovery = Number(raw[0]?.c) || 0
    } else if (raw?.rows) {
      recovery = Number(raw.rows[0]?.c) || 0
    }
  } catch {
    recovery = 0
  }

  const total = orders + locker + messaging + verifications + recovery
  return { orders, locker, messaging, verifications, recovery, total }
}

// Aperçu léger pour les notifications client : statut + nombre de messages du vendeur.
// Permet de détecter à la fois un changement de statut ET un nouveau message vendeur.
export async function getCustomerThreadsOverview(customerToken: string) {
  const token = customerToken?.trim()
  if (!token) return []
  const rows = await db
    .select({
      id: orderThreads.id,
      status: orderThreads.status,
      vendorCount: sql<number>`count(*) filter (where ${threadMessages.sender} = 'vendeur')::int`,
    })
    .from(orderThreads)
    .leftJoin(threadMessages, eq(threadMessages.threadId, orderThreads.id))
    .where(
      and(
        eq(orderThreads.customerToken, token),
        ne(orderThreads.status, "notification"),
      )
    )
    .groupBy(orderThreads.id, orderThreads.status)
  return rows
}

// Suivi public par token TRK_ : retourne le thread + messages sans authentification client.
// Seules les infos non-sensibles sont exposées (pas d'adresse, pas de coords).
export async function getThreadByTrackingToken(trackingToken: string) {
  const token = trackingToken?.trim().toUpperCase()
  if (!token || (!token.startsWith("TRK_") && !token.startsWith("MSG_"))) return null
  const [thread] = await db
    .select()
    .from(orderThreads)
    .where(eq(orderThreads.trackingToken, token))
  if (!thread) return null
  const messages = await db
    .select()
    .from(threadMessages)
    .where(eq(threadMessages.threadId, thread.id))
    .orderBy(threadMessages.createdAt)
  // Ne retourner que les messages du vendeur (notifications statut) — pas ceux du client
  const statusMessages = messages.filter((m) => m.sender === "vendeur")
  return {
    id: thread.id,
    status: thread.status,
    fulfillment: thread.fulfillment,
    scheduledDate: thread.scheduledDate,
    scheduledSlot: thread.scheduledSlot,
    colissimoNumber: thread.colissimoNumber,
    createdAt: thread.createdAt,
    updatedAt: thread.updatedAt,
    messages: statusMessages,
  }
}

// Retourne les fils TRK_MSG en attente de lecture pour un token client donné.
export async function getTrkThreadsForToken(customerToken: string) {
  const token = customerToken?.trim()
  if (!token) return []
  return db
    .select()
    .from(orderThreads)
    .where(
      and(
        eq(orderThreads.customerToken, token),
        eq(orderThreads.status, "trk_token"),
      )
    )
    .orderBy(desc(orderThreads.updatedAt))
}

// Supprime le fil TRK_MSG après que le client l'a lu (sécurité : message auto-détruit).
export async function consumeTrkThread(threadId: number) {
  if (!threadId) return { ok: false as const }
  const [t] = await db.select().from(orderThreads).where(eq(orderThreads.id, threadId))
  if (!t || t.status !== "trk_token") return { ok: false as const }
  await db.delete(threadMessages).where(eq(threadMessages.threadId, threadId))
  await db.delete(orderThreads).where(eq(orderThreads.id, threadId))
  revalidatePath("/messagerie")
  return { ok: true as const }
}

// Admin : enregistre l'adresse wallet XMR et envoie un message au client dans son fil locker.
export async function sendXmrWallet(threadId: number, wallet: string) {
  const w = wallet.trim()
  if (!w || !threadId) return { ok: false as const }
  const [thread] = await db.select().from(orderThreads).where(eq(orderThreads.id, threadId))
  if (!thread) return { ok: false as const }

  await db.update(orderThreads).set({ xmrWallet: w, updatedAt: sql`now()` }).where(eq(orderThreads.id, threadId))

  // Récupérer le taux XMR/EUR en temps réel pour indiquer le montant exact au client
  let xmrAmount: string | null = null
  try {
    const res = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=monero&vs_currencies=eur", { next: { revalidate: 60 } })
    const data = await res.json()
    const rate: number = data?.monero?.eur
    if (rate && thread.total) {
      const amount = (thread.total / rate).toFixed(6)
      xmrAmount = amount
    }
  } catch { /* taux indisponible — on n'affiche pas */ }

  const walletMsg = [
    `Commande validee ! Voici l'adresse du wallet Monero (XMR) ou effectuer ton depot :`,
    ``,
    `[ ${w} ]`,
    ``,
    xmrAmount
      ? `Montant a envoyer : ${xmrAmount} XMR (= ${thread.total}€ au taux actuel)`
      : `Montant a envoyer : l'equivalent de ${thread.total}€ en XMR (verifie le taux sur Kraken ou Binance).`,
    ``,
    `IMPORTANT : recopie cette adresse avec la plus grande attention, caractere par caractere.`,
    `Une seule erreur de saisie et le depot sera perdu definitivement — Monero est une crypto intraçable.`,
    ``,
    `Une fois le depot effectue, clique sur le bouton "J'ai effectue mon depot" dans ton suivi locker.`,
    `La preparation de ta commande demarrera a reception de la confirmation.`,
  ].join("\n")

  await db.insert(threadMessages).values({ threadId, sender: "vendeur", body: walletMsg })
  await db.update(orderThreads).set({ status: "validee", updatedAt: sql`now()` }).where(eq(orderThreads.id, threadId))

  await notifyCustomer(thread.customerToken, {
    title: "Adresse de paiement XMR disponible",
    body: "Ouvre ton suivi locker pour voir l'adresse de depot Monero.",
    url: "/",
    tag: `xmr-${threadId}`,
  })

  revalidatePath("/admin")
  return { ok: true as const }
}

// Client : signale que le virement crypto / dépôt est effectué.
export async function notifyDeposit(threadId: number) {
  if (!threadId) return { ok: false as const }
  const [thread] = await db.select().from(orderThreads).where(eq(orderThreads.id, threadId))
  if (!thread) return { ok: false as const }
  if (thread.depositNotified) return { ok: true as const }

  const crypto = (thread.paymentCrypto || "crypto").toUpperCase()
  await db.update(orderThreads).set({ depositNotified: true, updatedAt: sql`now()` }).where(eq(orderThreads.id, threadId))
  await db.insert(threadMessages).values({
    threadId,
    sender: "client",
    body: `✅ J'ai fait le virement en ${crypto}. Merci de vérifier la réception.`,
  })

  const shopPath = thread.shop && isShopId(thread.shop) ? `/admin/${thread.shop}` : "/admin"
  await notifyVendor({
    title: `Virement ${crypto} signalé — #${threadId}`,
    body: `${thread.customerName} indique avoir envoyé le paiement (${crypto} · ${thread.total}€).`,
    url: shopPath,
    tag: `deposit-${threadId}`,
  })

  revalidatePath("/admin")
  if (thread.shop && isShopId(thread.shop)) revalidatePath(`/admin/${thread.shop}`)
  return { ok: true as const }
}

// Représente un article dans la commande (envoyé depuis le panneau de gestion)
export type OrderProductItem = {
  productId: number
  title: string
  qty: number        // quantité choisie (0 = suppression)
  price: number      // prix unitaire pour cette quantité (variant)
  prevQty: number    // quantité précédente avant modification (pour l'ajustement stock)
}

// Admin : met à jour les articles d'une commande existante.
// - Recalcule le total
// - Ajuste le stock de chaque produit (delta = prevQty - newQty)
// - Envoie un message récapitulatif au client + push
export async function updateOrderProducts(threadId: number, items: OrderProductItem[]) {
  if (!threadId || !items.length) return { ok: false as const }
  const [thread] = await db.select().from(orderThreads).where(eq(orderThreads.id, threadId))
  if (!thread) return { ok: false as const }

  // Calcul du nouveau total et des lignes de changement
  const changes: string[] = []
  let newTotal = 0

  for (const item of items) {
    const lineTotal = item.qty * item.price
    newTotal += lineTotal

    const delta = item.prevQty - item.qty // positif = stock rendu, négatif = stock consommé
    if (delta !== 0) {
      await adjustStock(item.productId, delta)
    }

    if (item.qty === 0) {
      changes.push(`- ${item.title} retiré de la commande (rupture de stock ou annulation de l'article).`)
    } else if (item.qty !== item.prevQty) {
      const diff = item.qty - item.prevQty
      const sign = diff > 0 ? `+${diff}` : `${diff}`
      changes.push(`- ${item.title} : quantité ${sign} (nouvelle qté : ${item.qty} × ${item.price}€ = ${lineTotal}€)`)
    }
  }

  // Reconstruit la colonne products (texte)
  const activeItems = items.filter((i) => i.qty > 0)
  const newProducts = activeItems.map((i) => `${i.title} ×${i.qty}`).join(", ")

  // Reconstruit le summary complet (même format que la commande initiale)
  const lines: string[] = []
  for (const item of activeItems) {
    lines.push(`• ${item.qty}x ${item.title} — ${item.qty * item.price}€`)
  }
  const dateStr = thread.scheduledDate
    ? new Date(thread.scheduledDate).toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10)

  let deliveryLine = ""
  if (thread.fulfillment === "meetup") {
    deliveryLine = `Retrait sur place (meet-up)${thread.scheduledSlot ? ` à ${thread.scheduledSlot}` : ""}`
  } else if (thread.fulfillment === "locker") {
    deliveryLine = `Mondial Relay${thread.scheduledSlot ? ` — ${thread.scheduledSlot}` : ""}`
  } else {
    deliveryLine = `Livraison${thread.address ? ` à ${thread.address}` : ""}${thread.scheduledSlot ? ` — créneau ${thread.scheduledSlot}` : ""}`
  }

  // Calcul sous-total (hors frais de livraison potentiels déjà dans l'ancien total)
  const subTotal = activeItems.reduce((s, i) => s + i.qty * i.price, 0)

  const newSummary = [
    `Commande mise à jour`,
    ...lines,
    `Date : ${dateStr}`,
    deliveryLine,
    `Sous-total : ${subTotal}€`,
    `TOTAL : ${newTotal}€`,
  ].join("\n")

  await db
    .update(orderThreads)
    .set({ products: newProducts, total: newTotal, summary: newSummary, updatedAt: sql`now()` })
    .where(eq(orderThreads.id, threadId))

  // Message récapitulatif au client avec détail complet
  if (changes.length > 0) {
    const body = [
      `Mise à jour de ta commande #${threadId} :`,
      ``,
      ...changes,
      ``,
      // Récap complet des articles après modification
      ...activeItems.map((i) => `• ${i.qty}x ${i.title} — ${i.qty * i.price}€`),
      ``,
      deliveryLine,
      ``,
      `Nouveau total : ${newTotal}€`,
    ].join("\n")

    await db.insert(threadMessages).values({ threadId, sender: "vendeur", body })
    await notifyCustomer(thread.customerToken, {
      title: `Commande #${threadId} modifiée`,
      body: `Total mis à jour : ${newTotal}€`,
      url: "/",
      tag: `order-update-${threadId}`,
    })
  }

  revalidatePath("/admin")
  return { ok: true as const, newTotal, newSummary }
}

// Admin : confirme la réception du virement et passe en préparation.
export async function confirmDeposit(threadId: number) {
  if (!threadId) return { ok: false as const }
  const [thread] = await db.select().from(orderThreads).where(eq(orderThreads.id, threadId))
  if (!thread) return { ok: false as const }
  if (thread.depositConfirmed) return { ok: true as const }

  const crypto = (thread.paymentCrypto || "crypto").toUpperCase()
  await db
    .update(orderThreads)
    .set({
      depositConfirmed: true,
      depositNotified: true,
      status: "preparation",
      paymentStatus: "confirmed",
      updatedAt: sql`now()`,
    })
    .where(eq(orderThreads.id, threadId))
  await db.insert(threadMessages).values({
    threadId,
    sender: "vendeur",
    body: `✅ Virement ${crypto} reçu. Ta commande passe en préparation — tu seras tenu informé de la suite.`,
  })

  if (thread.customerToken) {
    await notifyCustomer(thread.customerToken, {
      title: "Virement reçu — préparation",
      body: `Ton paiement ${crypto} est confirmé. Commande #${threadId} en cours de préparation.`,
      url: "/",
      tag: `prep-${threadId}`,
    })
  }

  revalidatePath("/admin")
  if (thread.shop && isShopId(thread.shop)) revalidatePath(`/admin/${thread.shop}`)
  return { ok: true as const }
}

/** Admin : colis expédié + n° de suivi → message client + bouton réception. */
export async function markParcelShipped(threadId: number, trackingNumber: string) {
  if (!threadId) return { ok: false as const, error: "Commande invalide." }
  const tracking = trackingNumber?.trim()
  if (!tracking) return { ok: false as const, error: "Saisis le numéro de suivi." }

  const [thread] = await db.select().from(orderThreads).where(eq(orderThreads.id, threadId))
  if (!thread) return { ok: false as const, error: "Commande introuvable." }

  await ensureOrderThreadsColumns()
  const now = new Date()
  await db
    .update(orderThreads)
    .set({
      status: "locker_expedie",
      colissimoNumber: tracking,
      shippedAt: now,
      updatedAt: sql`now()`,
    })
    .where(eq(orderThreads.id, threadId))

  const carrier = thread.fulfillment || "transporteur"
  await db.insert(threadMessages).values({
    threadId,
    sender: "vendeur",
    body: [
      `📦 Colis expédié (${carrier})`,
      ``,
      `Numéro de suivi :`,
      tracking,
      ``,
      `Quand tu auras reçu ton colis, ouvre Mes commandes et clique sur « J'ai bien reçu mon colis ».`,
      `Sans cette validation, la commande reste en suspens et les points fidélité ne seront pas crédités.`,
    ].join("\n"),
  })

  if (thread.customerToken) {
    await notifyCustomer(thread.customerToken, {
      title: `Colis expédié — #${threadId}`,
      body: `Suivi : ${tracking}`,
      url: "/",
      tag: `ship-${threadId}`,
    })
  }

  revalidatePath("/admin")
  if (thread.shop && isShopId(thread.shop)) revalidatePath(`/admin/${thread.shop}`)
  return { ok: true as const }
}

/**
 * Client : confirme la réception du colis.
 * → statut livree + crédit fidélité (uniquement à cette étape).
 */
export async function confirmParcelReceived(threadId: number, customerToken: string) {
  const token = customerToken?.trim()
  if (!threadId || !token) return { ok: false as const, error: "Session invalide." }

  const [thread] = await db.select().from(orderThreads).where(eq(orderThreads.id, threadId))
  if (!thread || thread.customerToken !== token) {
    return { ok: false as const, error: "Commande introuvable." }
  }
  if (thread.status === "livree" || thread.status === "locker_livre") {
    return { ok: true as const }
  }
  if (thread.status !== "locker_expedie") {
    return { ok: false as const, error: "Le colis n'est pas encore marqué comme expédié." }
  }

  await db
    .update(orderThreads)
    .set({ status: "livree", updatedAt: sql`now()` })
    .where(eq(orderThreads.id, threadId))

  const points = computeLoyaltyPoints(thread.total ?? 0)
  const body1 =
    `✨ Merci ! Tu as confirmé la réception de ton colis.` +
    (points > 0 ? `\n${points} point${points > 1 ? "s" : ""} de fidélité viennent d'être crédités.` : "")
  await db.insert(threadMessages).values({ threadId, sender: "vendeur", body: body1 })
  await db.insert(threadMessages).values({
    threadId,
    sender: "vendeur",
    body: buildRatingInviteMessage(threadId),
  })

  await notifyCustomer(token, {
    title: "Colis reçu — merci !",
    body: body1.slice(0, 120),
    url: "/",
    tag: `received-${threadId}`,
  })

  await notifyVendor({
    title: `Colis reçu — #${threadId}`,
    body: `${thread.customerName} a confirmé la réception.`,
    url: thread.shop && isShopId(thread.shop) ? `/admin/${thread.shop}` : "/admin",
    tag: `received-admin-${threadId}`,
  })

  revalidatePath("/admin")
  revalidatePath("/messagerie")
  return { ok: true as const, points }
}

/** Client : ouvre un souci livraison (après délai transporteur) — message + notif admin. */
export async function reportParcelIssue(threadId: number, customerToken: string) {
  const token = customerToken?.trim()
  if (!threadId || !token) return { ok: false as const, error: "Session invalide." }

  const [thread] = await db.select().from(orderThreads).where(eq(orderThreads.id, threadId))
  if (!thread || thread.customerToken !== token) {
    return { ok: false as const, error: "Commande introuvable." }
  }
  if (thread.status !== "locker_expedie") {
    return { ok: false as const, error: "Action indisponible pour cette commande." }
  }

  const { parcelConcernUnlockAt } = await import("@/lib/order-status")
  const unlock = parcelConcernUnlockAt(thread.shippedAt, thread.fulfillment)
  if (!unlock || Date.now() < unlock.getTime()) {
    return { ok: false as const, error: "Ce bouton sera disponible après le délai du transporteur." }
  }

  await db.insert(threadMessages).values({
    threadId,
    sender: "client",
    body: "⚠️ J'ai un souci avec ma livraison. Merci de m'aider.",
  })
  await db
    .update(orderThreads)
    .set({ status: "souci_livraison", updatedAt: sql`now()` })
    .where(eq(orderThreads.id, threadId))

  await notifyVendor({
    title: `Souci livraison — #${threadId}`,
    body: `${thread.customerName} signale un problème de livraison.`,
    url: thread.shop && isShopId(thread.shop) ? `/admin/${thread.shop}` : "/admin",
    tag: `issue-${threadId}`,
  })

  revalidatePath("/admin")
  return { ok: true as const }
}

// Supprime définitivement une commande (et ses messages, via cascade applicative).
export async function deleteOrderThread(threadId: number) {
  if (!threadId) return { ok: false as const }
  await db.delete(threadMessages).where(eq(threadMessages.threadId, threadId))
  await db.delete(orderThreads).where(eq(orderThreads.id, threadId))
  revalidatePath("/admin")
  revalidatePath("/messagerie")
  return { ok: true as const }
}

// ─── Génération de commande par l'admin depuis la messagerie ────────────────
export type AdminOrderItem = {
  productId: number
  title: string
  qty: number      // nombre de packs commandés
  price: number    // prix unitaire du conditionnement choisi
}

export type AdminOrderInput = {
  // Contexte client (issu du fil de discussion sélectionné)
  customerName: string
  customerToken: string | null
  // Articles
  items: AdminOrderItem[]
  // Mode : meetup | livraison (local) ou id service colis (CaliDelivery)
  fulfillment: string
  // Livraison domicile / colis
  address?: string
  deliveryFee?: number
  // Meetup
  meetupDate?: string    // "2026-07-19"
  meetupSlot?: string    // "Dimanche 22h"
  /** Adresse point relais / colis (alias address pour colis) */
  lockerAddress?: string
  /** Boutique cible — défaut caliboyz31 */
  shop?: ShopId
}

export async function adminCreateOrder(input: AdminOrderInput) {
  if (!input.items.length) return { ok: false as const, error: "Aucun article." }

  const shop: ShopId = input.shop && isShopId(input.shop) ? input.shop : "caliboyz31"
  const fulfillment = (input.fulfillment ?? "").trim()
  if (!fulfillment) return { ok: false as const, error: "Mode de récupération manquant." }

  const { getEnabledParcelServices } = await import("@/app/actions/settings")
  const parcelServices = await getEnabledParcelServices()
  const parcelSvc = parcelServices.find((s) => s.id === fulfillment)
  const isParcel = isParcelFulfillment(fulfillment) && fulfillment !== "livraison"

  if (shop === "calidelivery") {
    if (!parcelSvc) return { ok: false as const, error: "Service colis invalide ou désactivé." }
  } else if (fulfillment !== "meetup" && fulfillment !== "livraison") {
    return { ok: false as const, error: "Mode invalide pour cette boutique." }
  }

  const subtotal = input.items.reduce((s, i) => s + i.qty * i.price, 0)
  const fee =
    fulfillment === "meetup"
      ? 0
      : parcelSvc
        ? (input.deliveryFee ?? parcelSvc.costEur ?? 0)
        : (input.deliveryFee ?? 0)
  const total = subtotal + fee

  const lines = input.items.map((i) => `• ${i.qty}x ${i.title} — ${i.qty * i.price}€`).join("\n")
  const productsShort = input.items.map((i) => `${i.qty}x ${i.title}`).join(", ")

  let modeLine = ""
  let scheduledDate: string | null = null
  let scheduledSlot: string | null = null
  let address: string | null = null

  if (fulfillment === "meetup") {
    scheduledDate = input.meetupDate ?? null
    scheduledSlot = input.meetupSlot ?? null
    modeLine = `Retrait sur place (meet-up)${scheduledSlot ? ` à ${scheduledSlot}` : ""}`
  } else if (isParcel || parcelSvc) {
    address = input.lockerAddress ?? input.address ?? null
    const name = parcelSvc?.name ?? fulfillment
    modeLine = `${name}${address ? ` — ${address}` : ""}${fee > 0 ? ` (frais ${fee}€)` : " (gratuit)"}`
  } else {
    address = input.address ?? null
    scheduledSlot = null
    modeLine = `Livraison à ${address ?? "adresse non précisée"}${fee > 0 ? ` (frais ${fee}€)` : ""}`
  }

  const feeLabel = parcelSvc?.name ?? (isParcel ? fulfillment : "Livraison")

  const summary = [
    `Nouvelle commande [${shop}] — ${input.customerName}`,
    ``,
    lines,
    ``,
    scheduledDate ? `Date : ${scheduledDate}` : null,
    modeLine,
    ``,
    `Sous-total : ${subtotal}€`,
    fee > 0 ? `${feeLabel} : ${fee}€` : null,
    `TOTAL : ${total}€`,
  ].filter(Boolean).join("\n")

  // Décrémente le stock de chaque article
  for (const item of input.items) {
    await adjustStock(item.productId, -item.qty)
  }

  // Crée le fil de commande exactement comme si le client l'avait passé
  const result = await createOrderThread({
    customerName: input.customerName,
    customerToken: input.customerToken ?? undefined,
    summary,
    products: productsShort,
    total,
    fulfillment,
    address: address ?? undefined,
    scheduledDate: scheduledDate ?? undefined,
    scheduledSlot: scheduledSlot ?? undefined,
    shop,
  })

  return { ok: true as const, ...result, total }
}

// Compte les fils "nouveau" (badge boîte de réception)
export async function countNewThreads() {
  const [row] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(orderThreads)
    .where(and(eq(orderThreads.status, "en_attente")))
  return row?.c ?? 0
}
