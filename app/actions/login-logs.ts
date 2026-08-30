"use server"

import { db } from "@/lib/db"
import { loginLogs, users } from "@/lib/db/schema"
import { desc, eq, or, sql } from "drizzle-orm"
import { headers } from "next/headers"
import { isAdminAuthenticated } from "@/app/actions/admin-auth"
import { isShopId, type ShopId } from "@/lib/shops"
import { ensureOrderThreadsColumns } from "@/lib/db/ensure"
import { orderThreads } from "@/lib/db/schema"
import { orderThreadShopEq } from "@/lib/shop-scope"

async function geolocate(ip: string): Promise<{
  city: string | null
  country: string | null
  countryCode: string | null
  lat: number | null
  lng: number | null
}> {
  const empty = { city: null, country: null, countryCode: null, lat: null, lng: null }
  if (
    !ip ||
    ip === "127.0.0.1" ||
    ip === "::1" ||
    ip.startsWith("10.") ||
    ip.startsWith("192.168.") ||
    ip.startsWith("172.")
  )
    return empty
  try {
    const res = await fetch(
      `http://ip-api.com/json/${ip}?fields=status,city,country,countryCode,lat,lon`,
      {
        cache: "no-store",
        signal: AbortSignal.timeout(3000),
      },
    )
    if (!res.ok) return empty
    const d = await res.json()
    if (d.status !== "success") return empty
    return {
      city: d.city ?? null,
      country: d.country ?? null,
      countryCode: d.countryCode ?? null,
      lat: d.lat ?? null,
      lng: d.lon ?? null,
    }
  } catch {
    return empty
  }
}

/**
 * Enregistre une connexion client sur une page boutique.
 * Fire-and-forget : ne doit jamais bloquer le login.
 */
export async function recordLogin(token: string, shop?: ShopId | null) {
  try {
    const t = token?.trim()
    if (!t) return
    await ensureOrderThreadsColumns()

    const h = await headers()
    const forwarded = h.get("x-forwarded-for")
    const ip = (forwarded ? forwarded.split(",")[0]?.trim() : h.get("x-real-ip")?.trim()) ?? null
    const userAgent = h.get("user-agent") ?? null

    const row = await db.select({ pseudo: users.pseudo }).from(users).where(eq(users.token, t)).limit(1)
    const pseudo = row[0]?.pseudo ?? "Inconnu"

    const geo = ip
      ? await geolocate(ip)
      : { city: null, country: null, countryCode: null, lat: null, lng: null }

    const shopVal = shop && isShopId(shop) ? shop : null

    await db.insert(loginLogs).values({
      userToken: t,
      pseudo,
      ip,
      city: geo.city,
      country: geo.country,
      countryCode: geo.countryCode,
      lat: geo.lat,
      lng: geo.lng,
      userAgent,
      shop: shopVal,
    })
  } catch {
    // Silencieux
  }
}

export type LoginLogRow = {
  id: number
  userToken: string
  pseudo: string
  ip: string | null
  city: string | null
  country: string | null
  countryCode: string | null
  lat: number | null
  lng: number | null
  userAgent: string | null
  shop: string | null
  createdAt: Date | string
}

/**
 * Connexions de la boutique :
 * - logs tagués `shop = X`
 * - OU (legacy sans shop) logs d'un client qui a un fil sur X
 */
export async function listLoginLogs(shop: ShopId, limit = 200): Promise<LoginLogRow[]> {
  if (!(await isAdminAuthenticated())) return []
  await ensureOrderThreadsColumns()
  const shopCond = orderThreadShopEq(shop)

  const rows = await db
    .select()
    .from(loginLogs)
    .where(
      or(
        eq(loginLogs.shop, shop),
        sql`(
          ${loginLogs.shop} IS NULL
          AND ${loginLogs.userToken} IN (
            SELECT DISTINCT ${orderThreads.customerToken}
            FROM ${orderThreads}
            WHERE ${orderThreads.customerToken} IS NOT NULL
              AND (${shopCond})
          )
        )`,
      ),
    )
    .orderBy(desc(loginLogs.createdAt))
    .limit(limit)

  return rows
}

export async function deleteLoginLogsByToken(token: string) {
  await db.delete(loginLogs).where(eq(loginLogs.userToken, token))
}
