import { hasDatabase, pool } from "@/lib/db"

/** Colonnes ajoutées au fil des PRs — la prod Neon n'a pas toujours été migrée. */
const ORDER_THREAD_COLUMNS = [
  `ALTER TABLE order_threads ADD COLUMN IF NOT EXISTS products TEXT`,
  `ALTER TABLE order_threads ADD COLUMN IF NOT EXISTS items_json JSONB DEFAULT '[]'::jsonb`,
  `ALTER TABLE order_threads ADD COLUMN IF NOT EXISTS fulfillment TEXT NOT NULL DEFAULT 'livraison'`,
  `ALTER TABLE order_threads ADD COLUMN IF NOT EXISTS address TEXT`,
  `ALTER TABLE order_threads ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION`,
  `ALTER TABLE order_threads ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION`,
  `ALTER TABLE order_threads ADD COLUMN IF NOT EXISTS scheduled_date TEXT`,
  `ALTER TABLE order_threads ADD COLUMN IF NOT EXISTS scheduled_slot TEXT`,
  `ALTER TABLE order_threads ADD COLUMN IF NOT EXISTS colissimo_number TEXT`,
  `ALTER TABLE order_threads ADD COLUMN IF NOT EXISTS xmr_wallet TEXT`,
  `ALTER TABLE order_threads ADD COLUMN IF NOT EXISTS deposit_notified BOOLEAN NOT NULL DEFAULT false`,
  `ALTER TABLE order_threads ADD COLUMN IF NOT EXISTS deposit_confirmed BOOLEAN NOT NULL DEFAULT false`,
  `ALTER TABLE order_threads ADD COLUMN IF NOT EXISTS client_last_seen TIMESTAMPTZ`,
  `ALTER TABLE order_threads ADD COLUMN IF NOT EXISTS payment_provider TEXT`,
  `ALTER TABLE order_threads ADD COLUMN IF NOT EXISTS payment_provider_id TEXT`,
  `ALTER TABLE order_threads ADD COLUMN IF NOT EXISTS payment_status TEXT`,
  `ALTER TABLE order_threads ADD COLUMN IF NOT EXISTS payment_crypto TEXT`,
  `ALTER TABLE order_threads ADD COLUMN IF NOT EXISTS payment_amount_crypto TEXT`,
  `ALTER TABLE order_threads ADD COLUMN IF NOT EXISTS payment_amount_eur INTEGER`,
  `ALTER TABLE order_threads ADD COLUMN IF NOT EXISTS payment_pay_url TEXT`,
  `ALTER TABLE order_threads ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`,
  `ALTER TABLE order_threads ADD COLUMN IF NOT EXISTS shop TEXT`,
  `ALTER TABLE order_threads ADD COLUMN IF NOT EXISTS shipped_at TIMESTAMPTZ`,
] as const

const ADMIN_ACCOUNT_COLUMNS = [
  `ALTER TABLE admin_accounts ADD COLUMN IF NOT EXISTS shop TEXT`,
  `ALTER TABLE admin_accounts ADD COLUMN IF NOT EXISTS shops TEXT`,
] as const

const STAFF_COLUMNS = [
  `ALTER TABLE staff_members ADD COLUMN IF NOT EXISTS shop TEXT`,
] as const

const BROADCAST_COLUMNS = [
  `ALTER TABLE broadcast_notifications ADD COLUMN IF NOT EXISTS shop TEXT`,
] as const

const LOGIN_LOG_COLUMNS = [
  `ALTER TABLE login_logs ADD COLUMN IF NOT EXISTS shop TEXT`,
] as const

/** Remplit shops depuis shop pour les comptes créés avant le multi-pages. */
const BACKFILL_ADMIN_SHOPS = `
  UPDATE admin_accounts
  SET shops = shop
  WHERE shops IS NULL
    AND shop IS NOT NULL
    AND shop <> ''
`

const THREAD_MESSAGE_COLUMNS = [
  `ALTER TABLE thread_messages ADD COLUMN IF NOT EXISTS client_read_at TIMESTAMPTZ`,
] as const

/** Backfill shop depuis le tag [shop] dans summary (commandes historiques). */
const BACKFILL_ORDER_SHOP = `
  UPDATE order_threads
  SET shop = CASE
    WHEN summary ~* '\\[caliboyz31\\]' THEN 'caliboyz31'
    WHEN summary ~* '\\[caliboyz94\\]' THEN 'caliboyz94'
    WHEN summary ~* '\\[calidelivery\\]' THEN 'calidelivery'
    ELSE shop
  END
  WHERE shop IS NULL
    AND summary ~* '\\[(caliboyz31|caliboyz94|calidelivery)\\]'
`

let ready = false
let inflight: Promise<void> | null = null

export async function ensureOrderThreadsColumns(): Promise<void> {
  if (!hasDatabase || !pool || ready) return
  if (inflight) return inflight
  inflight = (async () => {
    for (const stmt of [
      ...ORDER_THREAD_COLUMNS,
      ...THREAD_MESSAGE_COLUMNS,
      ...ADMIN_ACCOUNT_COLUMNS,
      ...STAFF_COLUMNS,
      ...BROADCAST_COLUMNS,
      ...LOGIN_LOG_COLUMNS,
    ]) {
      try {
        await pool!.query(stmt)
      } catch (e) {
        console.error("[ensureOrderThreadsColumns]", stmt, e)
      }
    }
    try {
      await pool!.query(BACKFILL_ORDER_SHOP)
    } catch (e) {
      console.error("[ensureOrderThreadsColumns] backfill shop", e)
    }
    try {
      await pool!.query(BACKFILL_ADMIN_SHOPS)
    } catch (e) {
      console.error("[ensureOrderThreadsColumns] backfill admin shops", e)
    }
    ready = true
  })()
  try {
    await inflight
  } finally {
    inflight = null
  }
}
