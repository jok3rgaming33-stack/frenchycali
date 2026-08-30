import { notFound, redirect } from "next/navigation"
import { assertAdminCanAccessShop, getAdminSession } from "@/app/actions/admin-auth"
import { getThreads, getActiveOrders, getLockerOrders, getDiscussions, getPastOrders } from "@/app/actions/messaging"
import { listUsers } from "@/app/actions/account"
import { listVerifications } from "@/app/actions/verification"
import { listLoginLogs } from "@/app/actions/login-logs"
import { listBroadcastNotifications } from "@/app/actions/notifications"
import { listStaff } from "@/app/actions/staff"
import { AdminGate } from "@/components/admin-gate"
import { AdminPanel } from "@/components/admin-panel"
import { isShopId, shopLabel, type ShopId } from "@/lib/shops"

export const dynamic = "force-dynamic"

export async function generateMetadata({ params }: { params: Promise<{ shop: string }> }) {
  const p = await params
  const shop = p.shop
  return {
    title: isShopId(shop) ? `Admin — ${shopLabel(shop)}` : "Admin",
    robots: { index: false, follow: false },
  }
}

export default async function AdminShopPage({
  params,
}: {
  params: Promise<{ shop: string }>
}) {
  const p = await params
  if (!isShopId(p.shop)) notFound()
  const shop = p.shop as ShopId

  const session = await getAdminSession()
  if (!session) return <AdminGate />
  if (session.needsShopAssignment) redirect("/admin?needsShop=1")

  const allowed = await assertAdminCanAccessShop(shop)
  if (!allowed) {
    if (session.shop !== "all" && session.shop !== shop) {
      redirect(`/admin/${session.shop}`)
    }
    redirect("/admin")
  }

  const empty = {
    activeOrders: [] as Awaited<ReturnType<typeof getActiveOrders>>,
    lockerOrders: [] as Awaited<ReturnType<typeof getLockerOrders>>,
    discussions: [] as Awaited<ReturnType<typeof getDiscussions>>,
    threads: [] as Awaited<ReturnType<typeof getThreads>>,
    pastOrders: [] as Awaited<ReturnType<typeof getPastOrders>>,
    usersList: [] as Awaited<ReturnType<typeof listUsers>>,
    verifications: [] as Awaited<ReturnType<typeof listVerifications>>,
    loginLogs: [] as Awaited<ReturnType<typeof listLoginLogs>>,
    notifHistory: [] as Awaited<ReturnType<typeof listBroadcastNotifications>>,
    staffList: [] as Awaited<ReturnType<typeof listStaff>>,
  }

  let data = empty
  try {
    const [
      activeOrders,
      lockerOrders,
      discussions,
      threads,
      pastOrders,
      usersList,
      verifications,
      loginLogs,
      notifHistory,
      staffList,
    ] = await Promise.all([
      getActiveOrders(shop),
      getLockerOrders(shop),
      getDiscussions(shop),
      getThreads(shop),
      getPastOrders(shop),
      listUsers(),
      listVerifications(),
      listLoginLogs(200),
      listBroadcastNotifications(50),
      listStaff(),
    ])
    data = {
      activeOrders,
      lockerOrders,
      discussions,
      threads,
      pastOrders,
      usersList,
      verifications,
      loginLogs,
      notifHistory,
      staffList,
    }
  } catch {
    /* DB vide / non migrée — panel charge à vide */
  }

  return (
    <AdminPanel
      shop={shop}
      adminPseudo={session.pseudo}
      initialActiveOrders={data.activeOrders}
      initialLockerOrders={data.lockerOrders}
      initialDiscussions={data.discussions}
      initialThreads={data.threads}
      initialPastOrders={data.pastOrders}
      initialUsers={data.usersList}
      initialVerifications={data.verifications}
      initialLoginLogs={data.loginLogs}
      initialNotificationsHistory={data.notifHistory}
      initialStaff={data.staffList}
    />
  )
}
