import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"
import * as schema from "./schema"

// Dev fallback: used only when env vars are missing (v0 preview sandbox)
const DEV_FALLBACK_URL =
  "postgresql://neondb_owner:npg_JxqjUd94veDV@ep-holy-water-as9oxju8-pooler.c-4.eu-central-1.aws.neon.tech/neondb?sslmode=verify-full"

const url =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.POSTGRES_PRISMA_URL ||
  process.env.POSTGRES_URL_NON_POOLING ||
  (process.env.NODE_ENV !== "production" ? DEV_FALLBACK_URL : undefined)

if (!url) throw new Error("No database URL found in environment (DATABASE_URL)")

export const pool = new Pool({
  connectionString: url,
  ssl: url.includes("neon.tech") ? true : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 8000,
})

export const db = drizzle(pool, { schema })
