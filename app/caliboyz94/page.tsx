export const dynamic = "force-dynamic"

import { db } from "@/lib/db"
import { products } from "@/lib/db/schema"
import { or, eq, asc } from "drizzle-orm"
import { ShopPage } from "@/components/shop-page"

export default async function CaliBoyz94Page() {
  const data = await db
    .select()
    .from(products)
    .where(or(eq(products.region, "94"), eq(products.region, "both")))
    .orderBy(asc(products.sortOrder))
  return <ShopPage shop="caliboyz94" initialProducts={data} />
}
