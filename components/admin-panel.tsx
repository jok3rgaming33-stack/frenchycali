"use client"

import { useEffect, useState, useCallback } from "react"
import type { OrderThread } from "@/lib/db/schema"
import type { AdminUserRow } from "@/app/actions/account"
import type { VerificationRow } from "@/app/actions/verification"
import { VendorInbox } from "@/components/vendor-inbox"
import { AdminOrdersRecap } from "@/components/admin-orders-recap"
import { AdminUsers } from "@/components/admin-users"
import { AdminVerifications } from "@/components/admin-verifications"
import { AdminAdmins } from "@/components/admin-admins"
import { AdminStaff } from "@/components/admin-staff"
import type { StaffRow } from "@/app/actions/staff"
import { AdminRecovery } from "@/components/admin-recovery"
import { AdminMap } from "@/components/admin-map"
import { AdminNews } from "@/components/admin-news"
import { AdminProducts } from "@/components/admin-products"
import { AdminPromos } from "@/components/admin-promos"
import { AdminLogistics } from "@/components/admin-logistics"
import { AdminCartSettings } from "@/components/admin-cart-settings"
import { AdminLoginLogs } from "@/components/admin-login-logs"
import type { LoginLogRow } from "@/app/actions/login-logs"
import { AdminProfit } from "@/components/admin-profit"
import type { ProfitSummary } from "@/app/actions/profit"
import { AdminNotifications } from "@/components/admin-notifications"
import type { BroadcastNotificationRow } from "@/app/actions/notifications"
import { adminLogout, startAdminClientPreview } from "@/app/actions/admin-auth"
import { getAdminBadgeCounts } from "@/app/actions/messaging"
import { AdminAppBadgeSync } from "@/components/app-badge-sync"
import { MessageSquare, Map, ListOrdered, Users, TrendingUp, LogOut, Construction, Eye, Newspaper, Package, Ticket, ShieldCheck, UserCog, Truck, Inbox, Activity, Bell, CheckCheck, KeyRound, ChevronDown } from "lucide-react"
import { PushToggle } from "@/components/push-toggle"

const CLIENT_SHOPS = [
  { href: "/caliboyz31?preview=1", label: "Cali Boyz 31", hint: "Interface gold 31" },
  { href: "/caliboyz94?preview=1", label: "Cali Boyz 94", hint: "Interface gold 94" },
  { href: "/calidelivery?preview=1", label: "CaliDelivery", hint: "Interface néon delivery" },
] as const

type TabId = "commandes-en-cours" | "locker" | "cloturees" | "messagerie" | "carte" | "commandes" | "utilisateurs" | "verifications" | "recuperations" | "produits" | "promos" | "logistique" | "news" | "admins" | "profits" | "connexions" | "notifications" | "staff"

const TABS: { id: TabId; label: string; icon: typeof MessageSquare }[] = [
  { id: "commandes-en-cours", label: "Commandes en cours", icon: Inbox },
  { id: "locker", label: "Locker MR", icon: Package },
  { id: "cloturees", label: "Clôturées", icon: CheckCheck },
  { id: "messagerie", label: "Messagerie", icon: MessageSquare },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "produits", label: "Produits", icon: Package },
  { id: "promos", label: "Codes promo", icon: Ticket },
  { id: "carte", label: "Carte interactive", icon: Map },
  { id: "logistique", label: "Logistique", icon: Truck },
  { id: "commandes", label: "Récap commandes", icon: ListOrdered },
  { id: "utilisateurs", label: "Utilisateurs", icon: Users },
  { id: "verifications", label: "Vérifications", icon: ShieldCheck },
  { id: "recuperations", label: "Récupérations", icon: KeyRound },
  { id: "connexions", label: "Connexions", icon: Activity },
  { id: "news", label: "News", icon: Newspaper },
  { id: "staff", label: "Whitelist", icon: Users },
  { id: "admins", label: "Admins", icon: UserCog },
  { id: "profits", label: "Profits", icon: TrendingUp },
]

const COMING_SOON: Record<"profits", { title: string; desc: string }> = {
  profits: { title: "Récapitulatif des profits", desc: "Suivi des revenus, marges et statistiques de vente. En cours de développement." },
}

export function AdminPanel({
  initialActiveOrders,
  initialLockerOrders,
  initialDiscussions,
  initialThreads,
  initialUsers,
  initialVerifications,
  initialLoginLogs,
  initialProfitData,
  initialNotificationsHistory,
  initialPastOrders,
  initialStaff,
}: {
  initialActiveOrders: OrderThread[]
  initialLockerOrders: OrderThread[]
  initialDiscussions: OrderThread[]
  initialThreads: OrderThread[]
  initialPastOrders: OrderThread[]
  initialUsers: AdminUserRow[]
  initialVerifications: VerificationRow[]
  initialLoginLogs: LoginLogRow[]
  initialProfitData: ProfitSummary
  initialNotificationsHistory: BroadcastNotificationRow[]
  initialStaff: StaffRow[]
}) {
  const [tab, setTab] = useState<TabId>("commandes-en-cours")
  const [vueClientOpen, setVueClientOpen] = useState(false)
  const [vueClientBusy, setVueClientBusy] = useState(false)
  const [vueClientError, setVueClientError] = useState<string | null>(null)
  const [badges, setBadges] = useState({
    orders: 0,
    locker: 0,
    messaging: 0,
    verifications: 0,
    recovery: 0,
    total: 0,
  })

  const openClientPreview = async (href: string) => {
    setVueClientBusy(true)
    setVueClientError(null)
    try {
      const res = await startAdminClientPreview()
      if (!res.ok) {
        setVueClientError(res.error)
        return
      }
      localStorage.setItem("authToken", res.token)
      localStorage.setItem("userPseudo", res.pseudo)
      localStorage.setItem("isAdmin", "1")
      localStorage.setItem("adminPreview", "1")
      setVueClientOpen(false)
      window.open(href, "_blank", "noopener,noreferrer")
    } catch {
      setVueClientError("Impossible d'ouvrir l'aperçu. Réessaie.")
    } finally {
      setVueClientBusy(false)
    }
  }

  const refreshBadges = useCallback(async () => {
    try {
      const c = await getAdminBadgeCounts()
      setBadges(c)
    } catch {
      /* silencieux */
    }
  }, [])

  useEffect(() => {
    refreshBadges()
    const interval = setInterval(refreshBadges, 12000)
    const onVis = () => {
      if (document.visibilityState === "visible") refreshBadges()
    }
    document.addEventListener("visibilitychange", onVis)
    return () => {
      clearInterval(interval)
      document.removeEventListener("visibilitychange", onVis)
    }
  }, [refreshBadges])

  // Pastille rouge par onglet
  const tabBadge = (id: TabId): number => {
    switch (id) {
      case "commandes-en-cours":
        return badges.orders
      case "locker":
        return badges.locker
      case "messagerie":
        return badges.messaging
      case "verifications":
        return badges.verifications
      case "recuperations":
        return badges.recovery
      default:
        return 0
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AdminAppBadgeSync total={badges.total} />
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div>
            <h1 className="text-xl font-bold">Panel Administrateur</h1>
            <p className="text-xs text-muted-foreground">
              Connecté en tant que Heisenberg
              {badges.total > 0 && (
                <span className="ml-2 inline-flex items-center rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold text-white">
                  {badges.total > 9 ? "9+" : badges.total} en attente
                </span>
              )}
            </p>
          </div>
          <div className="relative flex items-center gap-2">
            <div className="relative">
              <button
                type="button"
                onClick={() => setVueClientOpen((v) => !v)}
                disabled={vueClientBusy}
                className="flex items-center gap-2 rounded-xl border border-accent/40 bg-accent/10 px-4 py-2 text-sm font-medium text-accent transition-colors hover:bg-accent/20 disabled:opacity-60"
              >
                <Eye className="h-4 w-4" aria-hidden="true" />
                {vueClientBusy ? "Ouverture…" : "Vue Client"}
                <ChevronDown className="h-3.5 w-3.5 opacity-70" aria-hidden="true" />
              </button>
              {vueClientOpen && (
                <>
                  <button
                    type="button"
                    aria-label="Fermer le menu"
                    className="fixed inset-0 z-40 cursor-default bg-transparent"
                    onClick={() => setVueClientOpen(false)}
                  />
                  <div className="absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
                    <p className="border-b border-border px-3 py-2 text-[11px] text-muted-foreground">
                      Aperçu live des 3 interfaces (sans page login)
                    </p>
                    {CLIENT_SHOPS.map((s) => (
                      <button
                        key={s.href}
                        type="button"
                        disabled={vueClientBusy}
                        onClick={() => openClientPreview(s.href)}
                        className="flex w-full flex-col items-start gap-0.5 border-b border-border/60 px-3 py-2.5 text-left text-sm transition-colors last:border-0 hover:bg-secondary"
                      >
                        <span className="font-medium text-foreground">{s.label}</span>
                        <span className="text-[11px] text-muted-foreground">{s.hint}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
            {vueClientError && (
              <span className="hidden max-w-[160px] text-[11px] text-red-400 sm:inline">{vueClientError}</span>
            )}
            <form action={adminLogout}>
              <button
                type="submit"
                className="flex items-center gap-2 rounded-xl border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
                Déconnexion
              </button>
            </form>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        {/* Activation des notifications push vendeur (nouvelles commandes + messages clients) */}
        <div className="mb-6 flex flex-col gap-2 rounded-2xl border border-border bg-card p-4 sm:max-w-md">
          <p className="text-sm font-medium">Notifications vendeur</p>
          <p className="text-xs text-muted-foreground">
            Sois alerté des nouvelles commandes et des nouveaux messages clients, même panel fermé.
            Active aussi le badge rouge sur l&apos;icône de l&apos;app.
          </p>
          <PushToggle role="vendeur" className="mt-1" />
        </div>

        {/* Tabs */}
        <nav className="mb-6 flex flex-wrap gap-2" aria-label="Sections admin">
          {TABS.map(({ id, label, icon: Icon }) => {
            const count = tabBadge(id)
            return (
              <button
                key={id}
                onClick={() => setTab(id)}
                aria-current={tab === id ? "page" : undefined}
                className={`relative flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ${
                  tab === id
                    ? "bg-accent text-accent-foreground"
                    : "border border-border bg-card text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {label}
                {count > 0 && (
                  <span
                    className={`ml-0.5 flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-bold leading-none ${
                      tab === id ? "bg-white text-red-600" : "bg-red-500 text-white"
                    }`}
                    aria-label={`${count} non traité${count > 1 ? "s" : ""}`}
                  >
                    {count > 9 ? "9+" : count}
                  </span>
                )}
              </button>
            )
          })}
        </nav>

        {/* Content */}
        {tab === "commandes-en-cours" ? (
          <VendorInbox initialThreads={initialActiveOrders} mode="orders" />
        ) : tab === "locker" ? (
          <VendorInbox initialThreads={initialLockerOrders} mode="locker" />
        ) : tab === "cloturees" ? (
          <VendorInbox initialThreads={initialPastOrders} mode="past" />
        ) : tab === "messagerie" ? (
          <VendorInbox initialThreads={initialDiscussions} mode="messages" />
        ) : tab === "commandes" ? (
          <AdminOrdersRecap threads={initialThreads} />
        ) : tab === "utilisateurs" ? (
          <AdminUsers initialUsers={initialUsers} />
        ) : tab === "verifications" ? (
          <AdminVerifications initialVerifications={initialVerifications} />
        ) : tab === "recuperations" ? (
          <AdminRecovery />
        ) : tab === "notifications" ? (
          <AdminNotifications initialHistory={initialNotificationsHistory} users={initialUsers} />
        ) : tab === "produits" ? (
          <AdminProducts />
        ) : tab === "promos" ? (
          <AdminPromos />
        ) : tab === "carte" ? (
          <AdminMap threads={initialThreads} />
        ) : tab === "logistique" ? (
          <div className="space-y-8">
            <AdminCartSettings />
            <AdminLogistics />
          </div>
        ) : tab === "news" ? (
          <AdminNews />
        ) : tab === "connexions" ? (
          <AdminLoginLogs initialLogs={initialLoginLogs} />
        ) : tab === "profits" ? (
          <AdminProfit initialData={initialProfitData} />
        ) : tab === "staff" ? (
          <AdminStaff initialStaff={initialStaff} />
        ) : tab === "admins" ? (
          <AdminAdmins />
        ) : null}
      </div>
    </div>
  )
}
