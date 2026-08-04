export const ORDER_STATUSES = [
  "nouveau",
  "confirme",
  "en_preparation",
  "en_route",
  "livree",
  "annulee",
  "locker_en_attente_paiement",
  "locker_paiement_recu",
  "locker_expedie",
  "locker_livre",
] as const

export type OrderStatus = (typeof ORDER_STATUSES)[number]

const CLOSED_STATUSES = new Set(["livree", "annulee", "locker_livre"])

export function isClosedStatus(status: string): boolean {
  return CLOSED_STATUSES.has(status)
}

export function normalizeStatus(status: string): string {
  return status?.toLowerCase().trim() ?? "nouveau"
}

export const STATUS_LABELS: Record<string, string> = {
  nouveau: "Nouveau",
  confirme: "Confirmé",
  en_preparation: "En préparation",
  en_route: "En route",
  livree: "Livrée",
  annulee: "Annulée",
  locker_en_attente_paiement: "Locker — En attente paiement",
  locker_paiement_recu: "Locker — Paiement reçu",
  locker_expedie: "Locker — Expédié",
  locker_livre: "Locker — Livré",
}
