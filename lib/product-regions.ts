/** Disponibilité multi-boutiques d'un produit. */

import { SHOP_LABELS } from "@/lib/shops"

export const SHOP_REGION_OPTIONS = [
  { value: "caliboyz31" as const, label: SHOP_LABELS.caliboyz31 },
  { value: "caliboyz94" as const, label: SHOP_LABELS.caliboyz94 },
  { value: "calidelivery" as const, label: SHOP_LABELS.calidelivery },
]

export type ShopRegionKey = (typeof SHOP_REGION_OPTIONS)[number]["value"]

const ALL_KEYS: ShopRegionKey[] = ["caliboyz31", "caliboyz94", "calidelivery"]

/** Normalise une clé boutique / alias historique. */
export function normalizeShopKey(raw: string | null | undefined): ShopRegionKey | null {
  const r = (raw ?? "").trim().toLowerCase()
  if (!r || r === "both" || r === "all") return null
  if (r === "31" || r === "caliboyz31") return "caliboyz31"
  if (r === "94" || r === "caliboyz94") return "caliboyz94"
  if (r === "delivery" || r === "calidelivery") return "calidelivery"
  return null
}

/**
 * Parse le champ `region` stocké en base :
 * - "both" / vide → les 3 pages
 * - "caliboyz31" → une seule
 * - "caliboyz31,calidelivery" → multi
 * - JSON `["caliboyz31","caliboyz94"]` accepté
 */
export function parseProductRegions(raw: string | null | undefined): ShopRegionKey[] {
  if (raw == null || !String(raw).trim()) return [...ALL_KEYS]
  const s = String(raw).trim()

  if (s === "both" || s === "all" || s === "*") return [...ALL_KEYS]

  if (s.startsWith("[")) {
    try {
      const arr = JSON.parse(s) as unknown
      if (Array.isArray(arr)) {
        const keys = arr
          .map((x) => normalizeShopKey(String(x)))
          .filter((k): k is ShopRegionKey => !!k)
        const unique = Array.from(new Set(keys))
        return unique.length ? unique : [...ALL_KEYS]
      }
    } catch {
      /* fall through */
    }
  }

  const parts = s.split(/[,|;]+/).map((p) => p.trim()).filter(Boolean)
  const keys: ShopRegionKey[] = []
  for (const p of parts) {
    if (p === "both" || p === "all") return [...ALL_KEYS]
    const k = normalizeShopKey(p)
    if (k && !keys.includes(k)) keys.push(k)
  }
  return keys.length ? keys : [...ALL_KEYS]
}

/** Sérialise pour la colonne text `region` (rétrocompat). */
export function serializeProductRegions(list: string[] | null | undefined): string {
  const keys = Array.from(
    new Set(
      (list ?? [])
        .map((x) => normalizeShopKey(x))
        .filter((k): k is ShopRegionKey => !!k),
    ),
  )
  if (keys.length === 0 || keys.length === ALL_KEYS.length) return "both"
  if (keys.length === 1) return keys[0]
  // Ordre stable : 31, 94, delivery
  return ALL_KEYS.filter((k) => keys.includes(k)).join(",")
}

/** Le produit est-il visible sur cette boutique ? */
export function productVisibleOnShop(
  regionField: string | null | undefined,
  shop: string,
): boolean {
  const shopKey = normalizeShopKey(shop)
  if (!shopKey) return true
  return parseProductRegions(regionField).includes(shopKey)
}

export function isAllShops(regions: string[]): boolean {
  const keys = parseProductRegions(serializeProductRegions(regions))
  return keys.length === ALL_KEYS.length
}
