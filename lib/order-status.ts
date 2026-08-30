// Statuts de commande partagés entre la messagerie vendeur et l'espace client.

export const ORDER_STATUS_DEFAULT = "en_attente"

// Options sélectionnables par le vendeur pour les commandes
export const VENDOR_STATUS_OPTIONS = [
  "en_attente",
  "validee",
  "preparation",
  "pret_meetup",
  "bientot_livraison",
  "livraison",
  "livree",
  "annulee",
] as const

// Options sélectionnables par le vendeur pour les discussions directes
export const VENDOR_DISCUSSION_STATUS_OPTIONS = [
  "pris_en_charge",
  "ouvert",
  "ferme",
] as const

/** Delivery colis : le flux avance par boutons ; le select ne sert qu'à l'annulation. */
export const VENDOR_LOCKER_STATUS_OPTIONS = [
  "annulee",
] as const

/** Délai (jours) avant activation du bouton « souci livraison », selon transporteur. */
export function parcelConcernDelayDays(fulfillment: string | null | undefined): number {
  const f = (fulfillment ?? "").toLowerCase()
  if (f.includes("chrono")) return 2
  if (f.includes("colissimo")) return 4
  if (f.includes("mondial") || f.includes("relay")) return 6
  if (f.includes("ups")) return 5
  return 4
}

export function parcelConcernUnlockAt(
  shippedAt: Date | string | null | undefined,
  fulfillment: string | null | undefined,
): Date | null {
  if (!shippedAt) return null
  const d = new Date(shippedAt)
  if (Number.isNaN(d.getTime())) return null
  d.setDate(d.getDate() + parcelConcernDelayDays(fulfillment))
  return d
}

/** Extrait la devise depuis le récap (« Paiement : BTC ») si la colonne est vide. */
export function paymentCryptoFromSummary(summary: string | null | undefined): string | null {
  if (!summary) return null
  const m = summary.match(/Paiement\s*:\s*([A-Za-z0-9]+)/i)
  return m?.[1]?.toLowerCase() || null
}

/**
 * Visibilité des actions client sur une commande colis.
 * Règles simples (une seule source de vérité) :
 *
 * 1. Réception / souci  → statut locker_expedie | souci_livraison
 * 2. Virement           → commande colis pas encore confirmée ni expédiée
 * 3. Préparation        → dépôt confirmé + statut preparation
 */
export function getParcelClientActions(order: {
  fulfillment?: string | null
  status?: string | null
  paymentCrypto?: string | null
  xmrWallet?: string | null
  depositNotified?: boolean | null
  depositConfirmed?: boolean | null
  shippedAt?: Date | string | null
  summary?: string | null
  colissimoNumber?: string | null
  shop?: string | null
}) {
  const fulfillment = (order.fulfillment ?? "").trim().toLowerCase()
  const statusRaw = (order.status ?? "").trim()
  const status = normalizeStatus(statusRaw)
  const pay =
    (order.paymentCrypto || paymentCryptoFromSummary(order.summary) || "").toLowerCase() || null
  const wallet = order.xmrWallet?.trim() || null
  const depositConfirmed = !!order.depositConfirmed
  const depositNotified = !!order.depositNotified

  const isLocalFulfillment = fulfillment === "meetup" || fulfillment === "livraison"
  const looksDelivery =
    (order.shop ?? "").toLowerCase() === "calidelivery" ||
    /\[calidelivery\]/i.test(order.summary ?? "") ||
    /\b(chronopost|colissimo|mondial\s*relay|ups|locker)\b/i.test(
      `${order.summary ?? ""} ${fulfillment}`,
    ) ||
    (!!fulfillment && !isLocalFulfillment) ||
    !!pay ||
    !!wallet ||
    !!order.colissimoNumber?.trim()

  const isParcel = !isLocalFulfillment && looksDelivery

  // —— Fin de cycle (réception) : statut seul ——
  const isShipped =
    status === "locker_expedie" ||
    status === "souci_livraison" ||
    statusRaw === "locker_expedie" ||
    statusRaw === "souci_livraison"

  const closed =
    status === "livree" ||
    status === "locker_livre" ||
    status === "annulee" ||
    status === "ferme"

  // —— Début de cycle (virement) ——
  // Afficher dès qu'on a une commande colis / crypto non confirmée, hors expédition / clôture.
  // Pas de dépendance fragile : crypto OU wallet OU shop delivery OU fulfillment colis.
  const showDeposit =
    !depositConfirmed &&
    !isShipped &&
    !closed &&
    status !== "preparation" &&
    (isParcel || !!pay || !!wallet || looksDelivery)

  const showPrepBanner = depositConfirmed && status === "preparation"

  const concernUnlock = order.shippedAt
    ? parcelConcernUnlockAt(order.shippedAt, order.fulfillment)
    : isShipped
      ? new Date(0)
      : null
  const concernEnabled = isShipped && (!concernUnlock || Date.now() >= concernUnlock.getTime())

  return {
    isParcel,
    payCrypto: pay,
    payLabel: (pay || "crypto").toUpperCase(),
    wallet,
    showDeposit,
    showPrepBanner,
    isShipped,
    showReceive:
      status === "locker_expedie" || statusRaw === "locker_expedie",
    showIssue: isShipped,
    concernUnlock: order.shippedAt ? concernUnlock : null,
    concernEnabled,
    tracking: order.colissimoNumber?.trim() || null,
    depositNotified,
    depositConfirmed,
  }
}

export type OrderStatusKey =
  | "discussion"
  | "pris_en_charge"
  | "ouvert"
  | "ferme"
  | "en_attente"
  | "validee"
  | "preparation"
  | "pret_meetup"
  | "bientot_livraison"
  | "livraison"
  | "livree"
  | "annulee"
  | "locker_en_attente_paiement"
  | "locker_paiement_recu"
  | "locker_expedie"
  | "locker_livre"
  | "souci_livraison"

type StatusMeta = {
  label: string
  // Classes Tailwind pour le badge (fond + texte)
  badge: string
  // Classe de texte/accent seule (ex. select)
  accent: string
}

export const STATUS_META: Record<string, StatusMeta> = {
  discussion: {
    label: "Discussion",
    badge: "bg-teal-500/15 text-teal-300 border border-teal-500/30",
    accent: "text-teal-300",
  },
  pris_en_charge: {
    label: "Pris en charge",
    badge: "bg-sky-500/15 text-sky-400 border border-sky-500/30",
    accent: "text-sky-400",
  },
  ouvert: {
    label: "Ouvert",
    badge: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30",
    accent: "text-emerald-400",
  },
  ferme: {
    label: "Fermé",
    badge: "bg-zinc-500/15 text-zinc-400 border border-zinc-500/30",
    accent: "text-zinc-400",
  },
  en_attente: {
    label: "En attente de validation",
    badge: "bg-amber-500/15 text-amber-400 border border-amber-500/30",
    accent: "text-amber-400",
  },
  validee: {
    label: "Validée",
    badge: "bg-sky-500/15 text-sky-400 border border-sky-500/30",
    accent: "text-sky-400",
  },
  preparation: {
    label: "En cours de préparation",
    badge: "bg-orange-500/15 text-orange-400 border border-orange-500/30",
    accent: "text-orange-400",
  },
  pret_meetup: {
    label: "Colis prêt à récupérer",
    badge: "bg-violet-500/15 text-violet-400 border border-violet-500/30",
    accent: "text-violet-400",
  },
  bientot_livraison: {
    label: "Bientôt en livraison",
    badge: "bg-blue-500/15 text-blue-300 border border-blue-500/30",
    accent: "text-blue-300",
  },
  livraison: {
    label: "En livraison",
    badge: "bg-indigo-500/15 text-indigo-300 border border-indigo-500/30",
    accent: "text-indigo-300",
  },
  livree: {
    label: "Livrée",
    badge: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30",
    accent: "text-emerald-400",
  },
  annulee: {
    label: "Annulée",
    badge: "bg-red-500/15 text-red-400 border border-red-500/30",
    accent: "text-red-400",
  },
  locker_en_attente_paiement: {
    label: "Locker — attente paiement",
    badge: "bg-amber-500/15 text-amber-400 border border-amber-500/30",
    accent: "text-amber-400",
  },
  locker_paiement_recu: {
    label: "Locker — paiement reçu",
    badge: "bg-sky-500/15 text-sky-400 border border-sky-500/30",
    accent: "text-sky-400",
  },
  locker_expedie: {
    label: "Colis expédié",
    badge: "bg-indigo-500/15 text-indigo-300 border border-indigo-500/30",
    accent: "text-indigo-300",
  },
  locker_livre: {
    label: "Colis reçu",
    badge: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30",
    accent: "text-emerald-400",
  },
  souci_livraison: {
    label: "Souci livraison",
    badge: "bg-rose-500/15 text-rose-300 border border-rose-500/30",
    accent: "text-rose-300",
  },
}

// Normalise un statut stocké (gère les anciens libellés) vers une clé connue
export function normalizeStatus(raw: string | null | undefined): OrderStatusKey {
  if (!raw) return "en_attente"
  const key = raw.trim().toLowerCase()
  if (key in STATUS_META) return key as OrderStatusKey
  // Compat anciens libellés
  if (key === "nouveau" || key === "en cours" || key === "en_cours") return "en_attente"
  if (key === "confirme" || key === "confirmée" || key === "confirmee") return "validee"
  if (key === "en_preparation") return "preparation"
  if (key === "en_route") return "livraison"
  if (key === "traité" || key === "traite") return "livree"
  // Discussion statuses passés directement
  if (key === "pris_en_charge" || key === "ouvert" || key === "ferme") return key as OrderStatusKey
  return "en_attente"
}

export function statusMeta(raw: string | null | undefined): StatusMeta {
  return STATUS_META[normalizeStatus(raw)]
}

/** Compat FrenchyCali order-tracker / vendor-inbox */
export const STATUS_LABELS: Record<string, string> = Object.fromEntries(
  Object.entries(STATUS_META).map(([k, v]) => [k, v.label]),
)

// Statuts considérés comme "terminés" (commandes passées)
export const CLOSED_STATUSES: OrderStatusKey[] = ["livree", "annulee", "locker_livre"]

/** Texte inséré dans le fil client/vendeur à chaque changement de statut. */
export function statusThreadMessage(raw: string | null | undefined): string {
  return `📦 Statut mis à jour : ${statusMeta(raw).label}`
}

export function isClosedStatus(raw: string | null | undefined): boolean {
  return CLOSED_STATUSES.includes(normalizeStatus(raw))
}

// Statuts discussion (fils directs entre client et admin)
export const DISCUSSION_STATUSES: OrderStatusKey[] = ["discussion", "pris_en_charge", "ouvert", "ferme"]

export function isDiscussionStatus(raw: string | null | undefined): boolean {
  const k = normalizeStatus(raw)
  return DISCUSSION_STATUSES.includes(k) || raw === "discussion" || raw === "pris_en_charge" || raw === "ouvert" || raw === "ferme"
}
