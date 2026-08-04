"use server"

import { db } from "@/lib/db"
import { users } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

export async function loginWithRestoreToken(token: string): Promise<{ ok: boolean; pseudo?: string; error?: string }> {
  const t = token?.trim()
  if (!t || t.length < 10) return { ok: false, error: "Token invalide." }
  const rows = await db.select().from(users).where(eq(users.accessRestoreToken, t)).limit(1)
  if (!rows[0]) return { ok: false, error: "Token de restauration invalide ou expiré." }
  if (rows[0].accessRestoreExpires && new Date(rows[0].accessRestoreExpires) < new Date()) {
    return { ok: false, error: "Ce lien de restauration a expiré." }
  }
  // Clear restore token after use
  await db.update(users).set({ accessRestoreToken: null, accessRestoreExpires: null }).where(eq(users.id, rows[0].id))
  return { ok: true, pseudo: rows[0].pseudo }
}

export async function setPasswordAfterRestore(userToken: string, password: string): Promise<{ ok: boolean; error?: string }> {
  return { ok: true } // stub — password not used in anonymous system
}
