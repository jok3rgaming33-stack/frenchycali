/** Filtres SQL multi-boutiques (admin compartimenté). */
import { orderThreads } from "@/lib/db/schema"
import { and, eq, isNull, notInArray, or, sql, type SQL } from "drizzle-orm"
import type { ShopId } from "@/lib/shops"

/**
 * Condition « cette commande appartient à la boutique ».
 * - shop colonne = id
 * - legacy : tag [shop] dans summary si shop NULL
 * - calidelivery : aussi anciens colis sans shop (fulfillment hors meetup/livraison)
 */
export function orderThreadShopEq(shop: ShopId): SQL {
  const tagged = sql`${orderThreads.summary} ~* ${`\\[${shop}\\]`}`
  if (shop === "calidelivery") {
    return or(
      eq(orderThreads.shop, shop),
      and(isNull(orderThreads.shop), tagged),
      and(
        isNull(orderThreads.shop),
        notInArray(orderThreads.fulfillment, ["meetup", "livraison"]),
      ),
    )!
  }
  return or(eq(orderThreads.shop, shop), and(isNull(orderThreads.shop), tagged))!
}

/** Sous-requête : tokens clients ayant au moins un fil sur cette boutique. */
export function customerTokensForShopSql(shop: ShopId): SQL {
  return sql`(
    SELECT DISTINCT ${orderThreads.customerToken}
    FROM ${orderThreads}
    WHERE ${orderThreads.customerToken} IS NOT NULL
      AND (${orderThreadShopEq(shop)})
  )`
}
