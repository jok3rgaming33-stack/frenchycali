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
] as const

const THREAD_MESSAGE_COLUMNS = [
  `ALTER TABLE thread_messages ADD COLUMN IF NOT EXISTS client_read_at TIMESTAMPTZ`,
] as const

let ready = false
let inflight: Promise<void> | null = null

export async function ensureOrderThreadsColumns(): Promise<void> {
  if (!hasDatabase || !pool || ready) return
  if (inflight) return inflight
  inflight = (async () => {
    for (const stmt of [...ORDER_THREAD_COLUMNS, ...THREAD_MESSAGE_COLUMNS]) {
      try {
        await pool!.query(stmt)
      } catch (e) {
        console.error("[ensureOrderThreadsColumns]", stmt, e)
      }
    }
    ready = true
  })()
  try {
    await inflight
  } finally {
    inflight = null
  }
}
