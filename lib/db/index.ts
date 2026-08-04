import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"
import * as schema from "./schema"

const connectionString = process.env.DATABASE_URL

export const hasDatabase = Boolean(connectionString)

export const pool = connectionString
  ? new Pool({
      connectionString,
      max: 10,
      idleTimeoutMillis: 20_000,
      connectionTimeoutMillis: 10_000,
    })
  : null

export const db = pool
  ? drizzle(pool, { schema })
  : (null as unknown as ReturnType<typeof drizzle<typeof schema>>)
