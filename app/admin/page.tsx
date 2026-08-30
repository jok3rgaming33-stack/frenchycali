import Link from "next/link"
import { redirect } from "next/navigation"
import { getAdminSession } from "@/app/actions/admin-auth"
import { AdminGate } from "@/components/admin-gate"
import { SHOP_IDS, SHOP_LABELS, type ShopId } from "@/lib/shops"

export const dynamic = "force-dynamic"

export const metadata = {
  title: "Panel Admin — LaCentral",
  robots: { index: false, follow: false },
}

const HINTS: Record<ShopId, string> = {
  caliboyz31: "Meet-up & livraison locale — Toulouse",
  caliboyz94: "Meet-up & livraison locale — Île-de-France",
  calidelivery: "Colis (Mondial Relay, Chronopost, Colissimo, UPS) + crypto",
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams?: Promise<{ needsShop?: string }>
}) {
  const session = await getAdminSession()
  const params = searchParams ? await searchParams : undefined
  const needsShopQuery = params?.needsShop === "1"

  if (!session) {
    return <AdminGate />
  }

  if (session.needsShopAssignment || needsShopQuery) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6 text-foreground">
        <div className="w-full max-w-md rounded-3xl border border-border bg-card p-8 text-center">
          <h1 className="text-2xl font-bold">Boutique non assignée</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Ton compte admin n&apos;est pas encore rattaché à une boutique (LaCentral 31, LaCentral IDF
            ou CaliDelivery). Demande au super-admin d&apos;assigner ta boutique, puis reconnecte-toi.
          </p>
        </div>
      </div>
    )
  }

  if (session.shop !== "all") {
    redirect(`/admin/${session.shop}`)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 py-10 text-foreground">
      <div className="w-full max-w-2xl">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold">Panels indépendants</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Super-admin : choisis le panel à ouvrir. Chaque boutique est gérée séparément.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {SHOP_IDS.map((id) => (
            <Link
              key={id}
              href={`/admin/${id}`}
              className="rounded-2xl border border-border bg-card p-5 transition-colors hover:border-accent hover:bg-accent/5"
            >
              <div className="text-lg font-semibold">{SHOP_LABELS[id]}</div>
              <p className="mt-2 text-xs text-muted-foreground">{HINTS[id]}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
