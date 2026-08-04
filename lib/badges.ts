// Définition des bandeaux produits Frenchycali
// Un produit peut porter plusieurs badges simultanément.

export const BADGE_OPTIONS = [
  { key: "best_seller",   label: "Best-seller",    bg: "#3e6757", color: "#fff" },
  { key: "arrivage",      label: "Arrivage",        bg: "#38bdf8", color: "#000", blink: true },
  { key: "nouveau",       label: "Nouveau",         bg: "#38bdf8", color: "#000" },
  { key: "promo",         label: "Promo",           bg: "#dc2626", color: "#fff" },
  { key: "bientot_epuise",label: "Bientôt épuisé",  bg: "#6366f1", color: "#fff" },
  { key: "reappro",       label: "En réappro",      bg: "#f59e0b", color: "#000" },
  { key: "fin_de_stock",  label: "Fin de stock",    bg: "#ea580c", color: "#fff" },
  { key: "rupture",       label: "Rupture",         bg: "#52525b", color: "#fff" },
  { key: "bientot_dispo", label: "Bientôt dispo",   bg: "#0d9488", color: "#fff" },
] as const

export type BadgeKey = (typeof BADGE_OPTIONS)[number]["key"]

export const LOW_STOCK_THRESHOLD = 5

export function badgeMeta(key: string | null | undefined) {
  return BADGE_OPTIONS.find((b) => b.key === key) ?? null
}

export function resolveBadges(manual: string[] | null | undefined, stock: number): string[] {
  const list = Array.isArray(manual) ? [...manual] : []
  if (stock <= LOW_STOCK_THRESHOLD && stock > 0 && !list.includes("reappro")) {
    list.push("reappro")
  }
  if (stock <= 0 && !list.includes("rupture")) {
    list.push("rupture")
  }
  return list
}
