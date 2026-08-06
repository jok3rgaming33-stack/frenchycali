export const dynamic = "force-dynamic"

import { db, hasDatabase } from "@/lib/db"
import { products } from "@/lib/db/schema"
import { asc } from "drizzle-orm"
import { ShopPage } from "@/components/shop-page"
import { productVisibleOnShop } from "@/lib/product-regions"

export default async function CaliBoyz31Page() {
  let data: (typeof products.$inferSelect)[] = []
  if (hasDatabase) {
    try {
      const all = await db.select().from(products).orderBy(asc(products.sortOrder))
      data = all.filter((p) => productVisibleOnShop(p.region, "caliboyz31"))
    } catch {
      data = []
    }
  }
  return <ShopPage shop="caliboyz31" initialProducts={data} />
}
