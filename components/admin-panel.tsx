"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
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
import { AdminCryptoSettings } from "@/components/admin-crypto-settings"
import { AdminParcelSettings } from "@/components/admin-parcel-settings"
import { AdminLoginLogs } from "@/components/admin-login-logs"
import type { LoginLogRow } from "@/app/actions/login-logs"
import { AdminNotifications } from "@/components/admin-notifications"
import type { BroadcastNotificationRow } from "@/app/actions/notifications"
import { adminLogout, startAdminClientPreview } from "@/app/actions/admin-auth"
import { getAdminBadgeCounts } from "@/app/actions/messaging"
import { AdminAppBadgeSync } from "@/components/app-badge-sync"
import { MessageSquare, Map, ListOrdered, Users, LogOut, Eye, Newspaper, Package, Ticket, ShieldCheck, UserCog, Truck, Inbox, Activity, Bell, CheckCheck, KeyRound, ChevronDown, Wallet } from "lucide-react"
import { PushToggle } from "@/components/push-toggle"
import { isDeliveryShop, shopLabel, type ShopId, SHOP_LABELS } from "@/lib/shops"

const CLIENT_SHOPS = [
  { key: "caliboyz31" as const, href: "/caliboyz31?preview=1", label: SHOP_LABELS.caliboyz31, hint: "Interface gold 31" },
  { key: "caliboyz94" as const, href: "/caliboyz94?preview=1", label: SHOP_LABELS.caliboyz94, hint: "Interface gold IDF" },
  { key: "calidelivery" as const, href: "/calidelivery?preview=1", label: SHOP_LABELS.calidelivery, hint: "Interface néon delivery" },
] as const

type TabId = "commandes-en-cours" | "locker" | "cloturees" | "messagerie" | "carte" | "commandes" | "utilisateurs" | "verifications" | "recuperations" | "produits" | "promos" | "logistique" | "crypto" | "news" | "admins" | "connexions" | "notifications" | "staff"

function buildTabs(shop: ShopId): { id: TabId; label: string; icon: typeof MessageSquare }[] {
  const delivery = isDeliveryShop(shop)
  const tabs: { id: TabId; label: string; icon: typeof MessageSquare }[] = [
    { id: "commandes-en-cours", label: "Commandes en cours", icon: Inbox },
  ]
  if (delivery) {
    tabs.push({ id: "locker", label: "Colis", icon: Package })
  }
  tabs.push(
    { id: "cloturees", label: "Clôturées", icon: CheckCheck },
    { id: "messagerie", label: "Messagerie", icon: MessageSquare },
    { id: "notifications", label: "Notifications", icon: Bell },
    { id: "produits", label: "Produits", icon: Package },
    { id: "promos", label: "Codes promo", icon: Ticket },
    { id: "carte", label: "Carte interactive", icon: Map },
    { id: "logistique", label: "Logistique", icon: Truck },
  )
  if (delivery) {
    tabs.push({ id: "crypto", label: "Devises", icon: Wallet })
  }
  tabs.push(
    { id: "commandes", label: "Récap commandes", icon: ListOrdered },
    { id: "utilisateurs", label: "Utilisateurs", icon: Users },
    { id: "verifications", label: "Vérifications", icon: ShieldCheck },
    { id: "recuperations", label: "Récupérations", icon: KeyRound },
    { id: "connexions", label: "Connexions", icon: Activity },
    { id: "news", label: "News", icon: Newspaper },
    { id: "staff", label: "Whitelist", icon: Users },
    { id: "admins", label: "Admins", icon: UserCog },
  )
  return tabs
}

export function AdminPanel({
  shop,
  adminPseudo,
  initialActiveOrders,
  initialLockerOrders,
  initialDiscussions,
  initialThreads,
  initialUsers,
  initialVerifications,
  initialLoginLogs,
  initialNotificationsHistory,
  initialPastOrders,
  initialStaff,
}: {
  shop: ShopId
  adminPseudo?: string
  initialActiveOrders: OrderThread[]
  initialLockerOrders: OrderThread[]
  initialDiscussions: OrderThread[]
  initialThreads: OrderThread[]
  initialPastOrders: OrderThread[]
  initialUsers: AdminUserRow[]
  initialVerifications: VerificationRow[]
  initialLoginLogs: LoginLogRow[]
  initialNotificationsHistory: BroadcastNotificationRow[]
  initialStaff: StaffRow[]
}) {
  const tabs = useMemo(() => buildTabs(shop), [shop])
  const [tab, setTab] = useState<TabId>("commandes-en-cours")
  const [focusThreadId, setFocusThreadId] = useState<number | null>(null)
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

  const previewShops = CLIENT_SHOPS.filter((s) => s.key === shop)

  // Deep-link : /admin/[shop]?tab=messagerie&thread=123
  useEffect(() => {
    if (typeof window === "undefined") return
    const params = new URLSearchParams(window.location.search)
    const t = params.get("tab") as TabId | null
    if (t && tabs.some((x) => x.id === t)) setTab(t)
    const thread = params.get("thread")
    if (thread && /^\d+$/.test(thread)) {
      setFocusThreadId(Number(thread))
      if (!t) setTab("messagerie")
    }
    if (t || thread) {
      const url = new URL(window.location.href)
      url.searchParams.delete("tab")
      url.searchParams.delete("thread")
      window.history.replaceState({}, "", url.pathname)
    }
  }, [tabs])

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
      const c = await getAdminBadgeCounts(shop)
      setBadges(c)
    } catch {
      /* silencieux */
    }
  }, [shop])

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

  const tabBadge = (id: TabId): number => {
    switch (id) {
      case "commandes-en-cours":
        // Delivery : pastille colis sur « Commandes en cours »
        return isDeliveryShop(shop) ? badges.locker : badges.orders
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

  const label = shopLabel(shop)

  return (
    <div className="admin-panel-root min-h-screen bg-background text-foreground pb-safe">
      <AdminAppBadgeSync total={badges.total} />
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:gap-4 sm:px-6">
          <div className="min-w-0">
            <h1 className="text-lg font-bold sm:text-xl">Panel — {label}</h1>
            <p className="text-xs text-muted-foreground">
              {adminPseudo ? `Connecté : ${adminPseudo}` : "Administrateur"}
              <span className="mx-1.5 text-border">·</span>
              Boutique indépendante
              {badges.total > 0 && (
                <span className="ml-2 inline-flex items-center rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold text-white">
                  {badges.total > 9 ? "9+" : badges.total} en attente
                </span>
              )}
            </p>
          </div>
          <div className="relative flex shrink-0 flex-wrap items-center gap-2">
            <div className="relative">
              <button
                type="button"
                onClick={() => setVueClientOpen((v) => !v)}
                disabled={vueClientBusy}
                className="flex items-center gap-1.5 rounded-xl border border-accent/40 bg-accent/10 px-3 py-2 text-xs font-medium text-accent transition-colors hover:bg-accent/20 disabled:opacity-60 sm:gap-2 sm:px-4 sm:text-sm"
              >
                <Eye className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="whitespace-nowrap">{vueClientBusy ? "Ouverture…" : "Vue Client"}</span>
                <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden="true" />
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
                      Aperçu live de {label}
                    </p>
                    {previewShops.map((s) => (
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
        <div className="mb-6 flex flex-col gap-2 rounded-2xl border border-border bg-card p-4 sm:max-w-md">
          <p className="text-sm font-medium">Notifications vendeur</p>
          <p className="text-xs text-muted-foreground">
            Alertes commandes / messages pour {label}, même panel fermé.
          </p>
          <PushToggle role="vendeur" className="mt-1" />
        </div>

        <nav className="mb-6 flex flex-wrap gap-1.5 sm:gap-2" aria-label="Sections admin">
          {tabs.map(({ id, label: tabLabel, icon: Icon }) => {
            const count = tabBadge(id)
            return (
              <button
                key={id}
                onClick={() => setTab(id)}
                aria-current={tab === id ? "page" : undefined}
                className={`relative flex max-w-full items-center gap-1.5 rounded-xl px-2.5 py-2 text-[11px] font-medium transition-colors sm:gap-2 sm:px-4 sm:py-2.5 sm:text-sm ${
                  tab === id
                    ? "bg-accent text-accent-foreground"
                    : "border border-border bg-card text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" aria-hidden="true" />
                <span className="whitespace-nowrap">{tabLabel}</span>
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

        {tab === "commandes-en-cours" ? (
          <VendorInbox
            shop={shop}
            initialThreads={
              isDeliveryShop(shop)
                ? (initialLockerOrders.length ? initialLockerOrders : initialActiveOrders)
                : initialActiveOrders
            }
            mode={isDeliveryShop(shop) ? "locker" : "orders"}
          />
        ) : tab === "locker" ? (
          <div className="space-y-8">
            <AdminParcelSettings />
            <p className="text-sm text-muted-foreground">
              Configure ici les transporteurs proposés au checkout. Les commandes colis actives
              sont dans l&apos;onglet <strong>Commandes en cours</strong>.
            </p>
          </div>
        ) : tab === "cloturees" ? (
          <VendorInbox shop={shop} initialThreads={initialPastOrders} mode="past" />
        ) : tab === "messagerie" ? (
          <VendorInbox shop={shop} initialThreads={initialDiscussions} mode="messages" initialThreadId={focusThreadId} />
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
          <AdminMap threads={initialThreads} lockedRegion={shop} />
        ) : tab === "logistique" ? (
          <div className="space-y-8">
            {!isDeliveryShop(shop) && <AdminCartSettings shop={shop} />}
            <AdminLogistics shop={shop} />
          </div>
        ) : tab === "crypto" ? (
          <AdminCryptoSettings />
        ) : tab === "news" ? (
          <AdminNews />
        ) : tab === "connexions" ? (
          <AdminLoginLogs initialLogs={initialLoginLogs} />
        ) : tab === "staff" ? (
          <AdminStaff initialStaff={initialStaff} />
        ) : tab === "admins" ? (
          <AdminAdmins shop={shop} />
        ) : null}
      </div>
    </div>
  )
}
