"use server"

import { db } from "@/lib/db"
import { loginLogs } from "@/lib/db/schema"
import { desc } from "drizzle-orm"
import { isAdminAuthenticated } from "@/app/actions/admin-auth"

export type LoginLogRow = typeof loginLogs.$inferSelect

export async function getLoginLogs(): Promise<LoginLogRow[]> {
  if (!(await isAdminAuthenticated())) return []
  return db.select().from(loginLogs).orderBy(desc(loginLogs.createdAt)).limit(500)
}
