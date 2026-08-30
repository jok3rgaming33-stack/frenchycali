"use server"

import { db } from "@/lib/db"
import { adminAccounts } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { getAdminSession, isAdminAuthenticated } from "./admin-auth"
import { hashPassword } from "@/lib/admin-password"
import { ensureOrderThreadsColumns } from "@/lib/db/ensure"
import {
  isShopId,
  parseAdminShops,
  serializeAdminShops,
  type ShopId,
  SHOP_LABELS,
  SHOP_IDS,
} from "@/lib/shops"

export type AdminRow = {
  id: number
  pseudo: string
  token: string
  hasPassword: boolean
  shop: ShopId | null
  shops: ShopId[]
  shopLabels: string[]
  active: boolean
  createdAt: string
}

function genToken() {
  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")
}

function normalizeShopsInput(shops: ShopId[]): ShopId[] {
  return Array.from(new Set(shops.filter(isShopId)))
}

function adminHasShop(shops: ShopId[], shop: ShopId) {
  return shops.includes(shop)
}

export async function listAdmins(forShop?: ShopId): Promise<AdminRow[]> {
  if (!(await isAdminAuthenticated())) return []
  await ensureOrderThreadsColumns()
  const session = await getAdminSession()
  if (!session) return []

  const rows = await db.select().from(adminAccounts).orderBy(adminAccounts.createdAt)
  const scopeShop = forShop ?? (session.shop !== "all" && session.shops !== "all" ? (Array.isArray(session.shops) ? session.shops[0] : session.shop) : undefined)

  return rows
    .map((r) => {
      const shops = parseAdminShops(r.shops, r.shop)
      return {
        id: r.id,
        pseudo: r.pseudo,
        token: r.token,
        hasPassword: Boolean(r.passwordHash),
        shop: shops[0] ?? (isShopId(r.shop) ? r.shop : null),
        shops,
        shopLabels: shops.map((s) => SHOP_LABELS[s]),
        active: r.active,
        createdAt: r.createdAt.toISOString(),
      }
    })
    .filter((r) => {
      if (!scopeShop || !isShopId(scopeShop)) return true
      // Super-admin : afficher aussi les comptes sans boutique (à assigner)
      if (session.shops === "all" || session.shop === "all") {
        return r.shops.length === 0 || adminHasShop(r.shops, scopeShop)
      }
      return adminHasShop(r.shops, scopeShop)
    })
}

export async function createAdmin(input: {
  pseudo: string
  password?: string | null
  /** Une ou plusieurs pages accessibles. */
  shops: ShopId[]
}) {
  const session = await getAdminSession()
  if (!session || session.needsShopAssignment) return { ok: false as const, error: "unauthorized" }

  const shops = normalizeShopsInput(input.shops)
  if (shops.length === 0) return { ok: false as const, error: "Choisis au moins une page (boutique)." }

  if (session.shops !== "all" && session.shop !== "all") {
    const allowed = Array.isArray(session.shops) ? session.shops : isShopId(session.shop) ? [session.shop] : []
    if (!shops.every((s) => allowed.includes(s))) {
      return { ok: false as const, error: "Tu ne peux créer des admins que pour tes boutiques." }
    }
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
    shop: shops[0],
    shops: serializeAdminShops(shops),
    active: true,
  })
  revalidatePath("/admin")
  for (const s of shops) revalidatePath(`/admin/${s}`)
  return { ok: true as const, token }
}

export async function setAdminActive(id: number, active: boolean) {
  if (!(await canManageAdmin(id))) return { ok: false as const, error: "unauthorized" }
  await db.update(adminAccounts).set({ active }).where(eq(adminAccounts.id, id))
  revalidatePath("/admin")
  return { ok: true as const }
}

/** Super-admin (ou gestionnaire) : définit les pages accessibles (1 à 3). */
export async function setAdminShops(id: number, shopsInput: ShopId[]) {
  const session = await getAdminSession()
  if (!session || session.needsShopAssignment) return { ok: false as const, error: "unauthorized" }

  const shops = normalizeShopsInput(shopsInput)
  if (shops.length === 0) return { ok: false as const, error: "Choisis au moins une boutique." }

  const isSuper = session.shops === "all" || session.shop === "all"
  if (!isSuper) {
    if (!(await canManageAdmin(id))) return { ok: false as const, error: "unauthorized" }
    const allowed = Array.isArray(session.shops) ? session.shops : isShopId(session.shop) ? [session.shop] : []
    if (!shops.every((s) => allowed.includes(s))) {
      return { ok: false as const, error: "Tu ne peux assigner que tes boutiques." }
    }
  }

  await ensureOrderThreadsColumns()
  await db
    .update(adminAccounts)
    .set({ shop: shops[0], shops: serializeAdminShops(shops) })
    .where(eq(adminAccounts.id, id))
  revalidatePath("/admin")
  for (const s of SHOP_IDS) revalidatePath(`/admin/${s}`)
  return { ok: true as const }
}

/** @deprecated Prefer setAdminShops — conserve compat bouton « Assigner à X ». */
export async function setAdminShop(id: number, shop: ShopId) {
  return setAdminShops(id, [shop])
}

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
  if (session.shops === "all" || session.shop === "all") return true
  const rows = await db.select().from(adminAccounts).where(eq(adminAccounts.id, id)).limit(1)
  const target = rows[0]
  if (!target) return false
  const targetShops = parseAdminShops(target.shops, target.shop)
  const allowed = Array.isArray(session.shops) ? session.shops : isShopId(session.shop) ? [session.shop] : []
  // Peut gérer si au moins une boutique en commun
  return targetShops.some((s) => allowed.includes(s)) || targetShops.length === 0
}
