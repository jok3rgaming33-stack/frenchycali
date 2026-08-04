"use server"

import { db } from "@/lib/db"
import { staffMembers, users } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { isAdminAuthenticated } from "@/app/actions/admin-auth"
import { randomBytes } from "crypto"

export type StaffRow = typeof staffMembers.$inferSelect

export async function listStaff(): Promise<StaffRow[]> {
  if (!(await isAdminAuthenticated())) return []
  return db.select().from(staffMembers).orderBy(staffMembers.createdAt)
}

export async function createStaffInvite(opts: { canAdmin?: boolean; permissions?: string[] }) {
  if (!(await isAdminAuthenticated())) return { ok: false as const }
  const inviteToken = randomBytes(32).toString("hex")
  await db.insert(staffMembers).values({
    inviteToken,
    canAdmin: opts.canAdmin ?? false,
    permissions: opts.permissions ?? [],
  })
  revalidatePath("/admin")
  return { ok: true as const, inviteToken }
}

export async function deleteStaffMember(id: number) {
  if (!(await isAdminAuthenticated())) return { ok: false as const }
  await db.delete(staffMembers).where(eq(staffMembers.id, id))
  revalidatePath("/admin")
  return { ok: true as const }
}

export async function resolveClientLogin(token: string): Promise<{ ok: boolean; pseudo?: string; token?: string }> {
  if (!token?.trim()) return { ok: false }
  const t = token.trim()
  // Check staff whitelist by customerToken
  const staffRow = await db.select().from(staffMembers)
    .where(eq(staffMembers.customerToken, t)).limit(1)
  if (staffRow[0]) {
    const userRow = await db.select().from(users).where(eq(users.token, t)).limit(1)
    if (userRow[0]) return { ok: true, pseudo: userRow[0].pseudo, token: t }
  }
  // Check normal user
  const userRow = await db.select().from(users).where(eq(users.token, t)).limit(1)
  if (userRow[0]) return { ok: true, pseudo: userRow[0].pseudo, token: t }
  return { ok: false }
}
