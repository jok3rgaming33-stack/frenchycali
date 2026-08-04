import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"
import * as schema from "./schema"

const url = process.env.DATABASE_URL
if (!url) throw new Error("DATABASE_URL is not set — check .env.development.local")

export const pool = new Pool({
  connectionString: url,
  ssl: url.includes("neon.tech") ? true : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 8000,
})

export const db = drizzle(pool, { schema })
