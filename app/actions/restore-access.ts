"use server"

import { db } from "@/lib/db"
import { users, accountRecoveryClaims } from "@/lib/db/schema"
import { eq, desc } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { isAdminAuthenticated } from "@/app/actions/admin-auth"
import { randomBytes } from "crypto"

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

export async function submitRecoveryClaim(data: { claimedPseudo: string; clientMessage?: string }) {
  if (!data.claimedPseudo?.trim()) return { ok: false as const, error: "Pseudo requis." }
  const provisionalToken = randomBytes(24).toString("hex")
  await db.insert(accountRecoveryClaims).values({
    provisionalToken,
    claimedPseudo: data.claimedPseudo.trim(),
    clientMessage: data.clientMessage?.trim() || null,
    status: "pending_kyc",
  })
  return { ok: true as const, provisionalToken }
}

export async function listRecoveryClaims() {
  if (!(await isAdminAuthenticated())) return []
  return db.select().from(accountRecoveryClaims).orderBy(desc(accountRecoveryClaims.createdAt))
}

export async function resolveRecoveryClaim(id: number, action: "approve" | "reject") {
  if (!(await isAdminAuthenticated())) return { ok: false as const }
  const status = action === "approve" ? "approved" : "rejected"
  await db.update(accountRecoveryClaims)
    .set({ status, resolvedAt: new Date() })
    .where(eq(accountRecoveryClaims.id, id))
  revalidatePath("/admin")
  return { ok: true as const }
}
