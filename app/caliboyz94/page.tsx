export const dynamic = "force-dynamic"

import { db, hasDatabase } from "@/lib/db"
import { products } from "@/lib/db/schema"
import { or, eq, asc } from "drizzle-orm"
import { ShopPage } from "@/components/shop-page"

export default async function CaliBoyz94Page() {
  let data: (typeof products.$inferSelect)[] = []
  if (hasDatabase) {
    try {
      data = await db
        .select()
        .from(products)
        .where(or(eq(products.region, "94"), eq(products.region, "both"), eq(products.region, "caliboyz94")))
        .orderBy(asc(products.sortOrder))
    } catch {
      data = []
    }
  }
  return <ShopPage shop="caliboyz94" initialProducts={data} />
}