import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"
import * as schema from "./schema"

// Dev fallback: used only when env vars are missing (v0 preview sandbox)
const DEV_FALLBACK_URL =
  "postgresql://neondb_owner:npg_JxqjUd94veDV@ep-holy-water-as9oxju8-pooler.c-4.eu-central-1.aws.neon.tech/neondb?sslmode=verify-full"

const configuredUrl =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.POSTGRES_PRISMA_URL ||
  process.env.POSTGRES_URL_NON_POOLING ||
  (process.env.NODE_ENV !== "production" ? DEV_FALLBACK_URL : undefined)

// Vercel can evaluate route modules during `next build` without exposing
// runtime integration variables. Pool construction is lazy, so use a
// non-routable placeholder during that phase instead of crashing the build.
// Real requests still require DATABASE_URL (or a supported POSTGRES_* alias).
const url = configuredUrl || "postgresql://build-only.invalid:5432/build"

export const pool = new Pool({
  connectionString: url,
  ssl: url.includes("neon.tech"),
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 8000,
})

export const db = drizzle(pool, { schema })
