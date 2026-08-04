"use server"

import { cookies } from "next/headers"
import { db } from "@/lib/db"
import { adminAccounts } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

export async function isAdminAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies()
  const token = cookieStore.get("admin_token")?.value
  if (!token) return false
  if (token === process.env.ADMIN_TOKEN) return true
  const rows = await db
    .select({ id: adminAccounts.id })
    .from(adminAccounts)
    .where(eq(adminAccounts.token, token))
    .limit(1)
  return rows.length > 0
}

export async function adminLogin(token: string): Promise<{ ok: boolean; error?: string }> {
  if (!token?.trim()) return { ok: false, error: "Token requis." }
  const isEnvToken = token.trim() === process.env.ADMIN_TOKEN
  let isDbToken = false
  if (!isEnvToken) {
    const rows = await db
      .select({ id: adminAccounts.id, active: adminAccounts.active })
      .from(adminAccounts)
      .where(eq(adminAccounts.token, token.trim()))
      .limit(1)
    isDbToken = rows.length > 0 && rows[0].active
  }
  if (!isEnvToken && !isDbToken) return { ok: false, error: "Token invalide." }
  const cookieStore = await cookies()
  cookieStore.set("admin_token", token.trim(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  })
  return { ok: true }
}

export async function adminLogout() {
  const cookieStore = await cookies()
  cookieStore.delete("admin_token")
}
