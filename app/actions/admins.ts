"use server"

import { db } from "@/lib/db"
import { adminAccounts } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { getAdminSession, isAdminAuthenticated } from "./admin-auth"
import { hashPassword } from "@/lib/admin-password"
import { ensureOrderThreadsColumns } from "@/lib/db/ensure"
import { isShopId, type ShopId, SHOP_LABELS } from "@/lib/shops"

export type AdminRow = {
  id: number
  pseudo: string
  token: string
  hasPassword: boolean
  shop: ShopId | null
  shopLabel: string | null
  active: boolean
  createdAt: string
}

function genToken() {
  // Token long et aléatoire (URL-safe).
  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")
}

export async function listAdmins(forShop?: ShopId): Promise<AdminRow[]> {
  if (!(await isAdminAuthenticated())) return []
  await ensureOrderThreadsColumns()
  const session = await getAdminSession()
  if (!session) return []

  const rows = await db.select().from(adminAccounts).orderBy(adminAccounts.createdAt)
  const scopeShop = forShop ?? (session.shop !== "all" ? session.shop : undefined)

  return rows
    .filter((r) => {
      if (!scopeShop) return true
      // Super-admin : inclure aussi les comptes legacy sans boutique (à assigner)
      if (session.shop === "all") return r.shop === scopeShop || !r.shop
      return r.shop === scopeShop
    })
    .map((r) => ({
      id: r.id,
      pseudo: r.pseudo,
      token: r.token,
      hasPassword: Boolean(r.passwordHash),
      shop: isShopId(r.shop) ? r.shop : null,
      shopLabel: isShopId(r.shop) ? SHOP_LABELS[r.shop] : null,
      active: r.active,
      createdAt: r.createdAt.toISOString(),
    }))
}

export async function createAdmin(input: {
  pseudo: string
  password?: string | null
  shop: ShopId
}) {
  const session = await getAdminSession()
  if (!session || session.needsShopAssignment) return { ok: false as const, error: "unauthorized" }
  if (!isShopId(input.shop)) return { ok: false as const, error: "Boutique invalide." }
  if (session.shop !== "all" && session.shop !== input.shop) {
    return { ok: false as const, error: "Tu ne peux créer des admins que pour ta boutique." }
  }

  const pseudo = input.pseudo?.trim()
  if (!pseudo) return { ok: false as const, error: "Pseudo requis." }

  await ensureOrderThreadsColumns()
  const existing = await db.select().from(adminAccounts).where(eq(adminAccounts.pseudo, pseudo)).limit(1)
  if (existing.length > 0) return { ok: false as const, error: "Ce pseudo admin existe déjà." }

  const token = genToken()
  const passwordHash = input.password?.trim() ? hashPassword(input.password.trim()) : null
  await db.insert(adminAccounts).values({
    pseudo,
    token,
    passwordHash,
    shop: input.shop,
    active: true,
  })
  revalidatePath("/admin")
  revalidatePath(`/admin/${input.shop}`)
  return { ok: true as const, token }
}

export async function setAdminActive(id: number, active: boolean) {
  if (!(await canManageAdmin(id))) return { ok: false as const, error: "unauthorized" }
  await db.update(adminAccounts).set({ active }).where(eq(adminAccounts.id, id))
  revalidatePath("/admin")
  return { ok: true as const }
}

export async function setAdminShop(id: number, shop: ShopId) {
  const session = await getAdminSession()
  if (!session || session.shop !== "all") return { ok: false as const, error: "Réservé au super-admin." }
  if (!isShopId(shop)) return { ok: false as const, error: "Boutique invalide." }
  await ensureOrderThreadsColumns()
  await db.update(adminAccounts).set({ shop }).where(eq(adminAccounts.id, id))
  revalidatePath("/admin")
  revalidatePath(`/admin/${shop}`)
  return { ok: true as const }
}

// Définit (ou retire si password vide) un mot de passe choisi pour un admin.
export async function setAdminPassword(id: number, password: string | null) {
  if (!(await canManageAdmin(id))) return { ok: false as const, error: "unauthorized" }
  const passwordHash = password?.trim() ? hashPassword(password.trim()) : null
  await db.update(adminAccounts).set({ passwordHash }).where(eq(adminAccounts.id, id))
  revalidatePath("/admin")
  return { ok: true as const }
}

export async function regenerateAdminToken(id: number) {
  if (!(await canManageAdmin(id))) return { ok: false as const, error: "unauthorized" }
  const token = genToken()
  await db.update(adminAccounts).set({ token }).where(eq(adminAccounts.id, id))
  revalidatePath("/admin")
  return { ok: true as const, token }
}

export async function deleteAdmin(id: number) {
  if (!(await canManageAdmin(id))) return { ok: false as const, error: "unauthorized" }
  await db.delete(adminAccounts).where(eq(adminAccounts.id, id))
  revalidatePath("/admin")
  return { ok: true as const }
}

async function canManageAdmin(id: number): Promise<boolean> {
  const session = await getAdminSession()
  if (!session || session.needsShopAssignment) return false
  await ensureOrderThreadsColumns()
  if (session.shop === "all") return true
  const rows = await db.select().from(adminAccounts).where(eq(adminAccounts.id, id)).limit(1)
  return rows[0]?.shop === session.shop
}
