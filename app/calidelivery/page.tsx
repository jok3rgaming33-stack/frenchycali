export const dynamic = "force-dynamic"
import { db, hasDatabase } from "@/lib/db"
import { products } from "@/lib/db/schema"
import { eq, or, asc } from "drizzle-orm"
import { ShopPage } from "@/components/shop-page"

export default async function CaliDeliveryPage() {
  let data: (typeof products.$inferSelect)[] = []
  if (hasDatabase) {
    try {
      data = await db
        .select()
        .from(products)
        .where(or(eq(products.region, "delivery"), eq(products.region, "both"), eq(products.region, "calidelivery")))
        .orderBy(asc(products.sortOrder))
    } catch {
      data = []
    }
  }
  return <ShopPage shop="calidelivery" initialProducts={data} />
}
