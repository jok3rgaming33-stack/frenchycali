/** Helpers partagés pour les lignes de commande (notation, affichage). */

export type OrderItemLine = {
  productId: number
  title: string
  variant?: string
  qty: number
  price: number
}

/** Tag dans un message vendeur : bouton « Noter » côté client. */
export const RATE_TAG_RE = /\[rate:(\d+)\]/i

export function extractRateThreadId(body: string): number | null {
  const m = body.match(RATE_TAG_RE)
  if (!m) return null
  const id = parseInt(m[1], 10)
  return Number.isFinite(id) && id > 0 ? id : null
}

export function stripRateTag(body: string): string {
  return body.replace(RATE_TAG_RE, "").replace(/\n{3,}/g, "\n\n").trim()
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
