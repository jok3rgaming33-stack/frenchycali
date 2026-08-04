import { isAdminAuthenticated } from "@/app/actions/admin-auth"
import { getThreads, getActiveOrders, getLockerOrders, getDiscussions, getPastOrders } from "@/app/actions/messaging"
import { listUsers } from "@/app/actions/account"
import { listVerifications } from "@/app/actions/verification"
import { listLoginLogs } from "@/app/actions/login-logs"
import { getProfitData } from "@/app/actions/profit"
import { listBroadcastNotifications } from "@/app/actions/notifications"
import { listStaff } from "@/app/actions/staff"
import { AdminGate } from "@/components/admin-gate"
import { AdminPanel } from "@/components/admin-panel"

export const dynamic = "force-dynamic"

export const metadata = {
  title: "Panel Admin — FrenchyCali",
  robots: { index: false, follow: false },
}

export default async function AdminPage() {
  const authed = await isAdminAuthenticated()

  if (!authed) {
    return <AdminGate />
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
    profitData: null as Awaited<ReturnType<typeof getProfitData>> | null,
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
      profitData,
      notifHistory,
      staffList,
    ] = await Promise.all([
      getActiveOrders(),
      getLockerOrders(),
      getDiscussions(),
      getThreads(),
      getPastOrders(),
      listUsers(),
      listVerifications(),
      listLoginLogs(200),
      getProfitData(),
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
      profitData,
      notifHistory,
      staffList,
    }
  } catch {
    /* DB vide / non migrée — panel charge à vide */
  }

  return (
    <AdminPanel
      initialActiveOrders={data.activeOrders}
      initialLockerOrders={data.lockerOrders}
      initialDiscussions={data.discussions}
      initialThreads={data.threads}
      initialPastOrders={data.pastOrders}
      initialUsers={data.usersList}
      initialVerifications={data.verifications}
      initialLoginLogs={data.loginLogs}
      initialProfitData={data.profitData!}
      initialNotificationsHistory={data.notifHistory}
      initialStaff={data.staffList}
    />
  )
}
