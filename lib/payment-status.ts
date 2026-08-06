/** Libellés / styles pour le statut de paiement crypto (NOWPayments). */

export type PaymentStatusKey =
  | "awaiting"
  | "waiting"
  | "confirming"
  | "sending"
  | "partial"
  | "confirmed"
  | "failed"
  | "expired"
  | string

export function paymentStatusMeta(raw: string | null | undefined): {
  key: string
  label: string
  badge: string
} {
  const key = (raw || "").toLowerCase().trim()
  if (!key) {
    return {
      key: "none",
      label: "—",
      badge: "bg-zinc-500/15 text-zinc-400 border border-zinc-500/25",
    }
  }
  if (key === "confirmed" || key === "finished") {
    return {
      key: "confirmed",
      label: "Payé",
      badge: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30",
    }
  }
  if (key === "partial" || key === "partially_paid") {
    return {
      key: "partial",
      label: "Partiel",
      badge: "bg-amber-500/15 text-amber-400 border border-amber-500/30",
    }
  }
  if (key === "failed" || key === "refunded" || key === "expired") {
    return {
      key: "failed",
      label: key === "expired" ? "Expiré" : "Échoué",
      badge: "bg-red-500/15 text-red-400 border border-red-500/30",
    }
  }
  if (key === "awaiting" || key === "waiting" || key === "confirming" || key === "sending") {
    return {
      key: "awaiting",
      label: "En attente",
      badge: "bg-sky-500/15 text-sky-300 border border-sky-500/30",
    }
  }
  return {
    key,
    label: key,
    badge: "bg-zinc-500/15 text-zinc-300 border border-zinc-500/25",
  }
}

export function formatPaymentCrypto(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null
  return raw.trim().toUpperCase()
}
