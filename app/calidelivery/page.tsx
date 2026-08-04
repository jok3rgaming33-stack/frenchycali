export const dynamic = "force-dynamic"

export const dynamic = "force-dynamic"
import { db } from "@/lib/db"
import { products } from "@/lib/db/schema"
import { eq, asc } from "drizzle-orm"
import { ShopPage } from "@/components/shop-page"

export default async function CaliDeliveryPage() {
  const data = await db
    .select()
    .from(products)
    .where(eq(products.region, "delivery"))
    .orderBy(asc(products.sortOrder))
  return <ShopPage shop="calidelivery" initialProducts={data} />
}
