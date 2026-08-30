/**
 * Client NOWPayments (multi-crypto clé en main).
 * Désactivé si NOWPAYMENTS_API_KEY absent → le site continue sans gateway.
 */

import { createHmac } from "crypto"

const API_BASE = (process.env.NOWPAYMENTS_API_URL || "https://api.nowpayments.io/v1").replace(/\/$/, "")

export function isNowPaymentsConfigured(): boolean {
  return Boolean(process.env.NOWPAYMENTS_API_KEY?.trim())
}

function apiKey(): string {
  return process.env.NOWPAYMENTS_API_KEY?.trim() || ""
}

function ipnSecret(): string {
  return process.env.NOWPAYMENTS_IPN_SECRET?.trim() || ""
}

export type NowPaymentsInvoice = {
  id: string
  invoiceUrl: string
  orderId: string
  priceAmount: number
  priceCurrency: string
}

export type NowPaymentsCreateInvoiceInput = {
  priceAmount: number
  orderId: string
  description?: string
  successUrl?: string
  cancelUrl?: string
  ipnCallbackUrl: string
}

export type NowPaymentsPayment = {
  id: string
  invoiceUrl: string | null
  payAddress: string | null
  payAmount: string | null
  payCurrency: string
  orderId: string
  priceAmount: number
  priceCurrency: string
}

export type NowPaymentsCreatePaymentInput = NowPaymentsCreateInvoiceInput & {
  /** Code NOWPayments (btc, eth, xmr, usdttrc20…) — choisi par le client. */
  payCurrency: string
}

/** Crée une invoice hosted (fallback si pas de crypto choisie). */
export async function createNowPaymentsInvoice(
  input: NowPaymentsCreateInvoiceInput,
): Promise<{ ok: true; invoice: NowPaymentsInvoice } | { ok: false; error: string }> {
  if (!isNowPaymentsConfigured()) {
    return { ok: false, error: "NOWPayments non configuré." }
  }
  const amount = Number(input.priceAmount)
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, error: "Montant invalide." }
  }

  try {
    const body: Record<string, unknown> = {
      price_amount: Math.round(amount * 100) / 100,
      price_currency: "eur",
      order_id: String(input.orderId),
      order_description: (input.description || `Commande ${input.orderId}`).slice(0, 200),
      ipn_callback_url: input.ipnCallbackUrl,
    }
    if (input.successUrl) body.success_url = input.successUrl
    if (input.cancelUrl) body.cancel_url = input.cancelUrl

    const res = await fetch(`${API_BASE}/invoice`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey(),
      },
      body: JSON.stringify(body),
      // Ne jamais bloquer la création de commande (mobile / Vercel timeout).
      signal: AbortSignal.timeout(6_000),
    })
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
    if (!res.ok) {
      const msg =
        typeof data.message === "string"
          ? data.message
          : typeof data.error === "string"
            ? data.error
            : `NOWPayments HTTP ${res.status}`
      console.error("[nowpayments] invoice error:", res.status, data)
      return { ok: false, error: msg }
    }

    const id = String(data.id ?? data.invoice_id ?? "")
    const invoiceUrl = String(data.invoice_url ?? data.invoiceUrl ?? "")
    if (!id || !invoiceUrl) {
      console.error("[nowpayments] unexpected invoice payload:", data)
      return { ok: false, error: "Réponse invoice incomplète." }
    }

    return {
      ok: true,
      invoice: {
        id,
        invoiceUrl,
        orderId: String(input.orderId),
        priceAmount: amount,
        priceCurrency: "eur",
      },
    }
  } catch (e) {
    console.error("[nowpayments] createInvoice:", e)
    return { ok: false, error: e instanceof Error ? e.message : "Erreur réseau NOWPayments." }
  }
}

/**
 * Crée un paiement pour une crypto précise (choisie dans le panier).
 * Utilise /v1/payment — pas de ChangeNOW.
 */
export async function createNowPaymentsPayment(
  input: NowPaymentsCreatePaymentInput,
): Promise<{ ok: true; payment: NowPaymentsPayment } | { ok: false; error: string }> {
  if (!isNowPaymentsConfigured()) {
    return { ok: false, error: "NOWPayments non configuré." }
  }
  const amount = Number(input.priceAmount)
  const payCurrency = input.payCurrency?.trim().toLowerCase()
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, error: "Montant invalide." }
  }
  if (!payCurrency) {
    return { ok: false, error: "Crypto manquante." }
  }

  try {
    const body: Record<string, unknown> = {
      price_amount: Math.round(amount * 100) / 100,
      price_currency: "eur",
      pay_currency: payCurrency,
      order_id: String(input.orderId),
      order_description: (input.description || `Commande ${input.orderId}`).slice(0, 200),
      ipn_callback_url: input.ipnCallbackUrl,
    }
    if (input.successUrl) body.success_url = input.successUrl
    if (input.cancelUrl) body.cancel_url = input.cancelUrl

    const res = await fetch(`${API_BASE}/payment`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey(),
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8_000),
    })
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
    if (!res.ok) {
      const msg =
        typeof data.message === "string"
          ? data.message
          : typeof data.error === "string"
            ? data.error
            : `NOWPayments HTTP ${res.status}`
      console.error("[nowpayments] payment error:", res.status, data)
      return { ok: false, error: msg }
    }

    const id = String(data.payment_id ?? data.id ?? "")
    const payAddress = data.pay_address != null ? String(data.pay_address) : null
    const payAmount = data.pay_amount != null ? String(data.pay_amount) : null
    const invoiceUrl =
      data.invoice_url != null
        ? String(data.invoice_url)
        : id
          ? `https://nowpayments.io/payment/?iid=${encodeURIComponent(id)}`
          : null

    if (!id) {
      console.error("[nowpayments] unexpected payment payload:", data)
      return { ok: false, error: "Réponse paiement incomplète." }
    }

    return {
      ok: true,
      payment: {
        id,
        invoiceUrl,
        payAddress,
        payAmount,
        payCurrency,
        orderId: String(input.orderId),
        priceAmount: amount,
        priceCurrency: "eur",
      },
    }
  } catch (e) {
    console.error("[nowpayments] createPayment:", e)
    return { ok: false, error: e instanceof Error ? e.message : "Erreur réseau NOWPayments." }
  }
}

/** Tri récursif des clés (requis pour signature IPN NOWPayments). */
function sortObject(obj: unknown): unknown {
  if (obj === null || typeof obj !== "object" || Array.isArray(obj)) return obj
  const rec = obj as Record<string, unknown>
  const sorted: Record<string, unknown> = {}
  for (const key of Object.keys(rec).sort()) {
    sorted[key] = sortObject(rec[key])
  }
  return sorted
}

/** Vérifie le header x-nowpayments-sig (HMAC-SHA512). */
export function verifyNowPaymentsIpn(
  rawBody: string,
  signatureHeader: string | null,
): boolean {
  const secret = ipnSecret()
  if (!secret) {
    // Sans secret : on refuse en prod pour éviter les faux IPN
    console.error("[nowpayments] IPN secret manquant — IPN rejeté")
    return false
  }
  if (!signatureHeader) return false
  try {
    const parsed = JSON.parse(rawBody) as unknown
    const sorted = sortObject(parsed)
    const payload = JSON.stringify(sorted)
    const hmac = createHmac("sha512", secret).update(payload).digest("hex")
    return hmac === signatureHeader
  } catch (e) {
    console.error("[nowpayments] IPN verify parse error:", e)
    return false
  }
}

/** Mappe le statut NOWPayments vers un statut interne stable. */
export function mapNowPaymentsStatus(raw: string | undefined | null): string {
  const s = (raw || "").toLowerCase()
  if (s === "finished" || s === "confirmed") return "confirmed"
  if (s === "partially_paid") return "partial"
  if (s === "failed" || s === "refunded" || s === "expired") return "failed"
  if (s === "waiting" || s === "sending" || s === "confirming") return "awaiting"
  return s || "awaiting"
}
