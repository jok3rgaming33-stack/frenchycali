import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"
import * as schema from "./schema"

// Neon PostgreSQL connection — SSL required for neon.tech hosts
const isNeon = (process.env.DATABASE_URL ?? "").includes("neon.tech")

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isNeon ? true : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
})

export const db = drizzle(pool, { schema })
