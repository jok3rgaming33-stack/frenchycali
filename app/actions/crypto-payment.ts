"use server"

import { db } from "@/lib/db"
import { orderThreads, threadMessages, appSettings } from "@/lib/db/schema"
import { eq, sql } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { isAdminAuthenticated } from "@/app/actions/admin-auth"
import { notifyCustomer, notifyVendor } from "@/lib/push"
import {
  createNowPaymentsInvoice,
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

const SETTINGS_KEY = "crypto_gateway"

type GatewaySettings = {
  /** Interrupteur admin (en plus des clés env) */
  enabled: boolean
}

const DEFAULT_SETTINGS: GatewaySettings = { enabled: true }

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
        : "Paiement multi-crypto NOWPayments actif.",
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
    return { ok: true as const, enabled }
  } catch (e) {
    console.error("[crypto] set enabled:", e)
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
 * Crée une invoice NOWPayments pour une commande.
 * Non bloquant pour placeOrder : en cas d'échec on renvoie ok:false sans casser la commande.
 */
export async function createCryptoInvoiceForOrder(input: {
  threadId: number
  totalEur: number
  customerToken: string
  customerName: string
  shop: string
}): Promise<
  | { ok: true; invoiceUrl: string; providerId: string; paymentStatus: string }
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

  // Message auto dans le fil (n'écrase pas les messages existants locker TRK)
  try {
    const body = [
      `💳 Paiement multi-crypto — Commande #${input.threadId}`,
      ``,
      `Total à régler : ${Math.round(input.totalEur)} €`,
      ``,
      `Clique le lien ci-dessous pour choisir ta crypto (BTC, ETH, XMR, USDT, etc.) et payer en toute sécurité :`,
      created.invoice.invoiceUrl,
      ``,
      `Le statut de ta commande sera mis à jour automatiquement après réception des fonds.`,
      `En cas de souci, réponds ici.`,
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
    // fallback : chercher par payment_provider_id
    const paymentId = String(payload.payment_id ?? payload.invoice_id ?? payload.id ?? "")
    if (!paymentId) return { ok: false, error: "order_id manquant" }
    try {
      const rows = await db.execute(sql`
        SELECT id FROM order_threads
        WHERE payment_provider_id = ${paymentId}
        LIMIT 1
      `)
      const id = (rows as { rows?: { id: number }[] }).rows?.[0]?.id
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

  // Message client + notifs uniquement sur confirmation
  if (mapped === "confirmed") {
    try {
      const [thread] = await db.select().from(orderThreads).where(eq(orderThreads.id, threadId)).limit(1)
      const asset = (payCurrency || "crypto").toUpperCase()
      await db.insert(threadMessages).values({
        threadId,
        sender: "vendeur",
        body: `✅ Paiement crypto reçu${payCurrency ? ` (${asset})` : ""}. Merci ! Ta commande va être traitée.`,
      })
      if (thread?.customerToken) {
        await notifyCustomer(thread.customerToken, {
          title: `Commande #${threadId} — Paiement reçu`,
          body: "Ton paiement crypto a été confirmé.",
          url: "/",
          tag: `crypto-paid-${threadId}`,
        })
      }
      await notifyVendor({
        title: `Paiement crypto #${threadId}`,
        body: `${asset} confirmé`,
        url: "/admin",
        tag: `crypto-${threadId}`,
      })
    } catch (e) {
      console.error("[crypto] IPN notify:", e)
    }
  }

  revalidatePath("/admin")
  revalidatePath("/messagerie")
  return { ok: true }
}

/** Client : récupère le lien de paiement d'une commande. */
export async function getOrderCryptoPayment(threadId: number, customerToken: string) {
  if (!threadId || !customerToken?.trim()) return { ok: false as const, error: "invalid" }
  try {
    await ensurePaymentColumns()
    const [row] = await db
      .select()
      .from(orderThreads)
      .where(eq(orderThreads.id, threadId))
      .limit(1)
    if (!row || row.customerToken !== customerToken.trim()) {
      return { ok: false as const, error: "Accès refusé." }
    }
    return {
      ok: true as const,
      payUrl: row.paymentPayUrl ?? null,
      paymentStatus: row.paymentStatus ?? null,
      paymentCrypto: row.paymentCrypto ?? null,
    }
  } catch {
    return { ok: false as const, error: "Erreur lecture." }
  }
}
