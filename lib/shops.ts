/** Identité multi-boutiques FrenchyCali (clés techniques + labels affichés). */

export const SHOP_IDS = ["caliboyz31", "caliboyz94", "calidelivery"] as const
export type ShopId = (typeof SHOP_IDS)[number]

export const SHOP_LABELS: Record<ShopId, string> = {
  caliboyz31: "LaCentral 31",
  caliboyz94: "LaCentral IDF",
  calidelivery: "CaliDelivery",
}

export function isShopId(value: string | null | undefined): value is ShopId {
  return !!value && (SHOP_IDS as readonly string[]).includes(value)
}

export function shopLabel(shop: string | null | undefined): string {
  if (isShopId(shop)) return SHOP_LABELS[shop]
  return shop?.trim() || "Boutique"
}

/** Label boutique pour une commande / un fil (colonne shop, sinon tag [shop] du summary). */
export function threadShopLabel(thread: {
  shop?: string | null
  summary?: string | null
}): string {
  if (isShopId(thread.shop)) return SHOP_LABELS[thread.shop]
  const fromSummary = shopFromSummary(thread.summary)
  if (fromSummary) return SHOP_LABELS[fromSummary]
  return ""
}

/** Modes de récupération « locaux » (31 / IDF). */
export const LOCAL_FULFILLMENTS = ["meetup", "livraison"] as const
export type LocalFulfillment = (typeof LOCAL_FULFILLMENTS)[number]

/** Ancien mode locker — encore présent en base pour les commandes legacy. */
export const LEGACY_LOCKER_FULFILLMENT = "locker"

export function isLocalShop(shop: ShopId): boolean {
  return shop === "caliboyz31" || shop === "caliboyz94"
}

export function isDeliveryShop(shop: ShopId): boolean {
  return shop === "calidelivery"
}

/** Extrait le tag boutique depuis un summary historique « Nouvelle commande [shop] — … ». */
export function shopFromSummary(summary: string | null | undefined): ShopId | null {
  if (!summary) return null
  const m = summary.match(/\[(caliboyz31|caliboyz94|calidelivery)\]/i)
  if (!m) return null
  return m[1].toLowerCase() as ShopId
}

/** Fulfillment considéré comme colis (delivery), y compris legacy locker. */
export function isParcelFulfillment(fulfillment: string | null | undefined): boolean {
  if (!fulfillment) return false
  const f = fulfillment.trim().toLowerCase()
  if (f === LEGACY_LOCKER_FULFILLMENT) return true
  if ((LOCAL_FULFILLMENTS as readonly string[]).includes(f)) return false
  // Tout autre id (mondial_relay, chronopost, custom…) = service colis
  return true
}

export function allowsCryptoCheckout(shop: ShopId): boolean {
  return shop === "calidelivery"
}

export function allowsLocalFulfillment(shop: ShopId): boolean {
  return isLocalShop(shop)
}

export function allowsParcelFulfillment(shop: ShopId): boolean {
  return isDeliveryShop(shop)
}
