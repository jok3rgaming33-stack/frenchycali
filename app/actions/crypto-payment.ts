"use server"

import { db } from "@/lib/db"
import { orderThreads, threadMessages, appSettings } from "@/lib/db/schema"
import { eq, sql } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { isAdminAuthenticated } from "@/app/actions/admin-auth"
import { notifyCustomer, notifyVendor } from "@/lib/push"
import {
  createNowPaymentsInvoice,
  createNowPaymentsPayment,
  isNowPaymentsConfigured,
  mapNowPaymentsStatus,
} from "@/lib/nowpayments"
import { ensureOrderThreadsColumns } from "@/lib/db/ensure"

export type CryptoGatewayPublicStatus = {
  enabled: boolean
  provider: "nowpayments" | null
  /** true si les clés serveur sont présentes */
  configured: boolean
  /** message UI admin / client */
  message: string
}

/** Crypto proposée au checkout CaliDelivery (codes NOWPayments). */
export type CryptoCurrencyOption = {
  id: string
  /** Code API NOWPayments : btc, eth, xmr, usdttrc20… */
  code: string
  name: string
  enabled: boolean
}

const SETTINGS_KEY = "crypto_gateway"
const CURRENCIES_KEY = "crypto_currencies"

type GatewaySettings = {
  /** Interrupteur admin (en plus des clés env) */
  enabled: boolean
}

const DEFAULT_SETTINGS: GatewaySettings = { enabled: true }

const DEFAULT_CURRENCIES: CryptoCurrencyOption[] = [
  { id: "btc", code: "btc", name: "Bitcoin (BTC)", enabled: true },
  { id: "eth", code: "eth", name: "Ethereum (ETH)", enabled: true },
  { id: "xmr", code: "xmr", name: "Monero (XMR)", enabled: true },
  { id: "usdttrc20", code: "usdttrc20", name: "USDT (TRC20)", enabled: true },
  { id: "usdterc20", code: "usdterc20", name: "USDT (ERC20)", enabled: true },
  { id: "ltc", code: "ltc", name: "Litecoin (LTC)", enabled: true },
  { id: "sol", code: "sol", name: "Solana (SOL)", enabled: false },
  { id: "bnbbsc", code: "bnbbsc", name: "BNB (BSC)", enabled: false },
]

async function ensurePaymentColumns() {
  await ensureOrderThreadsColumns()
}

async function readGatewaySettings(): Promise<GatewaySettings> {
  try {
    const rows = await db.select().from(appSettings).where(eq(appSettings.key, SETTINGS_KEY)).limit(1)
    if (!rows[0]) return { ...DEFAULT_SETTINGS }
    const v = rows[0].value as Partial<GatewaySettings>
    return { enabled: v.enabled !== false }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

function normalizeCurrencies(raw: unknown): CryptoCurrencyOption[] {
  const list = Array.isArray(raw) ? raw : []
  const out: CryptoCurrencyOption[] = []
  for (const item of list) {
    if (!item || typeof item !== "object") continue
    const o = item as Record<string, unknown>
    const code = String(o.code ?? o.id ?? "")
      .trim()
      .toLowerCase()
    const name = String(o.name ?? code).trim()
    if (!code || !name) continue
    const id = String(o.id ?? code).trim().toLowerCase() || code
    out.push({ id, code, name, enabled: o.enabled !== false })
  }
  return out
}

/** Statut public (admin + client) — n'expose jamais les secrets. */
export async function getCryptoGatewayStatus(): Promise<CryptoGatewayPublicStatus> {
  const configured = isNowPaymentsConfigured()
  const settings = await readGatewaySettings()
  const enabled = configured && settings.enabled
  return {
    enabled,
    provider: configured ? "nowpayments" : null,
    configured,
    message: !configured
      ? "NOWPayments non configuré (variables d'env manquantes). Le site fonctionne sans gateway."
      : !settings.enabled
        ? "Gateway configuré mais désactivé dans l'admin."
        : "Paiement multi-crypto NOWPayments actif — le client choisit sa crypto au panier.",
  }
}

/** Admin : activer / couper le gateway sans toucher aux clés. */
export async function setCryptoGatewayEnabled(enabled: boolean) {
  if (!(await isAdminAuthenticated())) return { ok: false as const, error: "unauthorized" }
  try {
    await db
      .insert(appSettings)
      .values({ key: SETTINGS_KEY, value: { enabled }, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: appSettings.key,
        set: { value: { enabled }, updatedAt: new Date() },
      })
    revalidatePath("/admin")
    revalidatePath("/admin/calidelivery")
    return { ok: true as const, enabled }
  } catch (e) {
    console.error("[crypto] set enabled:", e)
    return { ok: false as const, error: "Impossible d'enregistrer." }
  }
}

/** Liste complète des cryptos (admin). */
export async function getCryptoCurrencies(): Promise<CryptoCurrencyOption[]> {
  try {
    const rows = await db.select().from(appSettings).where(eq(appSettings.key, CURRENCIES_KEY)).limit(1)
    const services = normalizeCurrencies((rows[0]?.value as { currencies?: unknown } | undefined)?.currencies)
    return services.length > 0 ? services : DEFAULT_CURRENCIES
  } catch {
    return DEFAULT_CURRENCIES
  }
}

/** Cryptos activées pour le checkout client. */
export async function getEnabledCryptoCurrencies(): Promise<CryptoCurrencyOption[]> {
  const all = await getCryptoCurrencies()
  return all.filter((c) => c.enabled)
}

/** Admin : enregistrer la liste des cryptos (activer / désactiver / ajouter / supprimer). */
export async function setCryptoCurrencies(currencies: CryptoCurrencyOption[]) {
  if (!(await isAdminAuthenticated())) return { ok: false as const, error: "unauthorized" }
  const normalized = normalizeCurrencies(currencies)
  if (normalized.length === 0) return { ok: false as const, error: "Ajoute au moins une crypto." }
  const codes = new Set<string>()
  for (const c of normalized) {
    if (codes.has(c.code)) return { ok: false as const, error: `Code en double : ${c.code}` }
    codes.add(c.code)
  }
  try {
    await db
      .insert(appSettings)
      .values({ key: CURRENCIES_KEY, value: { currencies: normalized }, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: appSettings.key,
        set: { value: { currencies: normalized }, updatedAt: new Date() },
      })
    revalidatePath("/admin")
    revalidatePath("/admin/calidelivery")
    revalidatePath("/calidelivery")
    return { ok: true as const }
  } catch (e) {
    console.error("[crypto] set currencies:", e)
    return { ok: false as const, error: "Impossible d'enregistrer." }
  }
}

function siteBaseUrl(): string {
  const fromEnv =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL?.replace(/\/$/, "")
  if (fromEnv) return fromEnv.startsWith("http") ? fromEnv : `https://${fromEnv}`
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL.replace(/\/$/, "")}`
  return "https://frenchycali-full.vercel.app"
}

/**
 * Crée un paiement NOWPayments pour une commande.
 * Si `payCurrency` est fourni → paiement ciblé ; sinon invoice hosted (fallback).
 */
export async function createCryptoInvoiceForOrder(input: {
  threadId: number
  totalEur: number
  customerToken: string
  customerName: string
  shop: string
  /** Code crypto choisi au panier (obligatoire côté CaliDelivery). */
  payCurrency?: string
}): Promise<
  | {
      ok: true
      invoiceUrl: string
      providerId: string
      paymentStatus: string
      payCurrency?: string
      payAddress?: string | null
      payAmount?: string | null
    }
  | { ok: false; error: string; skipped?: boolean }
> {
  const status = await getCryptoGatewayStatus()
  if (!status.enabled) {
    return { ok: false, error: "Gateway inactif.", skipped: true }
  }

  await ensurePaymentColumns()

  const base = siteBaseUrl()
  const ipnCallbackUrl = `${base}/api/crypto/ipn`
  const successUrl = `${base}/?paid=1&order=${input.threadId}`
  const cancelUrl = `${base}/?paid=0&order=${input.threadId}`
  const payCurrency = input.payCurrency?.trim().toLowerCase()

  if (payCurrency) {
    const enabled = await getEnabledCryptoCurrencies()
    if (!enabled.some((c) => c.code === payCurrency)) {
      return { ok: false, error: `Crypto non autorisée : ${payCurrency}` }
    }

    const created = await createNowPaymentsPayment({
      priceAmount: input.totalEur,
      payCurrency,
      orderId: `fc-${input.threadId}`,
      description: `FrenchyCali #${input.threadId} — ${input.customerName} [${input.shop}]`,
      ipnCallbackUrl,
      successUrl,
      cancelUrl,
    })

    if (!created.ok) return { ok: false, error: created.error }

    const p = created.payment
    const payUrl =
      p.invoiceUrl ||
      (p.payAddress
        ? `${base}/calidelivery?pay=${input.threadId}`
        : `https://nowpayments.io/payment/?iid=${encodeURIComponent(p.id)}`)

    try {
      await db.execute(sql`
        UPDATE order_threads SET
          payment_provider = 'nowpayments',
          payment_provider_id = ${p.id},
          payment_status = 'awaiting',
          payment_crypto = ${p.payCurrency},
          payment_amount_crypto = ${p.payAmount},
          payment_amount_eur = ${Math.round(input.totalEur)},
          payment_pay_url = ${payUrl},
          updated_at = NOW()
        WHERE id = ${input.threadId}
      `)
    } catch (e) {
      console.error("[crypto] update order payment fields:", e)
    }

    try {
      const body = [
        `💳 Paiement crypto — Commande #${input.threadId}`,
        ``,
        `Total : ${Math.round(input.totalEur)} €`,
        `Crypto choisie : ${p.payCurrency.toUpperCase()}`,
        p.payAmount ? `Montant à envoyer : ${p.payAmount} ${p.payCurrency.toUpperCase()}` : null,
        p.payAddress ? `` : null,
        p.payAddress ? `Adresse de paiement :` : null,
        p.payAddress ? p.payAddress : null,
        ``,
        payUrl ? `Lien de paiement :` : null,
        payUrl || null,
        ``,
        `Envoie UNIQUEMENT la crypto indiquée sur cette adresse.`,
        `Le statut de ta commande sera mis à jour automatiquement après réception.`,
      ]
        .filter(Boolean)
        .join("\n")
      await db.insert(threadMessages).values({
        threadId: input.threadId,
        sender: "vendeur",
        body,
      })
    } catch (e) {
      console.error("[crypto] payment message:", e)
    }

    return {
      ok: true,
      invoiceUrl: payUrl,
      providerId: p.id,
      paymentStatus: "awaiting",
      payCurrency: p.payCurrency,
      payAddress: p.payAddress,
      payAmount: p.payAmount,
    }
  }

  // Fallback invoice hosted (pas de crypto pré-choisie)
  const created = await createNowPaymentsInvoice({
    priceAmount: input.totalEur,
    orderId: `fc-${input.threadId}`,
    description: `FrenchyCali #${input.threadId} — ${input.customerName} [${input.shop}]`,
    ipnCallbackUrl,
    successUrl,
    cancelUrl,
  })

  if (!created.ok) return { ok: false, error: created.error }

  try {
    await db.execute(sql`
      UPDATE order_threads SET
        payment_provider = 'nowpayments',
        payment_provider_id = ${created.invoice.id},
        payment_status = 'awaiting',
        payment_amount_eur = ${Math.round(input.totalEur)},
        payment_pay_url = ${created.invoice.invoiceUrl},
        updated_at = NOW()
      WHERE id = ${input.threadId}
    `)
  } catch (e) {
    console.error("[crypto] update order payment fields:", e)
  }

  try {
    const body = [
      `💳 Paiement multi-crypto — Commande #${input.threadId}`,
      ``,
      `Total à régler : ${Math.round(input.totalEur)} €`,
      ``,
      `Clique le lien ci-dessous pour payer :`,
      created.invoice.invoiceUrl,
      ``,
      `Le statut de ta commande sera mis à jour automatiquement après réception des fonds.`,
    ].join("\n")
    await db.insert(threadMessages).values({
      threadId: input.threadId,
      sender: "vendeur",
      body,
    })
  } catch (e) {
    console.error("[crypto] payment message:", e)
  }

  return {
    ok: true,
    invoiceUrl: created.invoice.invoiceUrl,
    providerId: created.invoice.id,
    paymentStatus: "awaiting",
  }
}

/** Applique un IPN NOWPayments (appelé par la route webhook). */
export async function applyCryptoIpnPayload(payload: Record<string, unknown>): Promise<{ ok: boolean; error?: string }> {
  await ensurePaymentColumns()

  const orderIdRaw = String(payload.order_id ?? "")
  const match = orderIdRaw.match(/fc-(\d+)/i)
  const threadId = match ? parseInt(match[1], 10) : NaN
  if (!Number.isFinite(threadId)) {
    const paymentId = String(payload.payment_id ?? payload.invoice_id ?? payload.id ?? "")
    if (!paymentId) return { ok: false, error: "order_id manquant" }
    try {
      const rows = await db.execute(sql`
        SELECT id FROM order_threads
        WHERE payment_provider_id = ${paymentId}
        LIMIT 1
      `)
      const id = (rows as unknown as { rows?: { id: number }[] }).rows?.[0]?.id
      if (!id) return { ok: false, error: "commande introuvable" }
      return applyStatusToThread(id, payload)
    } catch {
      return { ok: false, error: "lookup failed" }
    }
  }

  return applyStatusToThread(threadId, payload)
}

async function applyStatusToThread(
  threadId: number,
  payload: Record<string, unknown>,
): Promise<{ ok: boolean; error?: string }> {
  const npStatus = String(payload.payment_status ?? payload.status ?? "")
  const mapped = mapNowPaymentsStatus(npStatus)
  const payCurrency = payload.pay_currency ? String(payload.pay_currency).toLowerCase() : null
  const payAmount = payload.pay_amount != null ? String(payload.pay_amount) : null
  const providerPaymentId = payload.payment_id != null ? String(payload.payment_id) : null

  try {
    await db.execute(sql`
      UPDATE order_threads SET
        payment_status = ${mapped},
        payment_crypto = COALESCE(${payCurrency}, payment_crypto),
        payment_amount_crypto = COALESCE(${payAmount}, payment_amount_crypto),
        payment_provider_id = COALESCE(${providerPaymentId}, payment_provider_id),
        updated_at = NOW()
      WHERE id = ${threadId}
    `)
  } catch (e) {
    console.error("[crypto] IPN update:", e)
    return { ok: false, error: "update failed" }
  }

  if (mapped === "confirmed") {
    try {
      await db.insert(threadMessages).values({
        threadId,
        sender: "vendeur",
        body: `✅ Paiement crypto reçu. Merci ! Ta commande va être traitée.`,
      })
      const [thread] = await db.select().from(orderThreads).where(eq(orderThreads.id, threadId)).limit(1)
      if (thread?.customerToken) {
        await notifyCustomer(thread.customerToken, {
          title: `Commande #${threadId} — Paiement reçu`,
          body: "Ton paiement crypto a été confirmé.",
          url: "/",
          tag: `pay-${threadId}`,
        })
      }
      await notifyVendor({
        title: `Paiement crypto #${threadId}`,
        body: "Paiement confirmé.",
        url: "/admin/calidelivery",
        tag: `pay-admin-${threadId}`,
      })
    } catch (e) {
      console.error("[crypto] confirm notify:", e)
    }
  }

  return { ok: true }
}
