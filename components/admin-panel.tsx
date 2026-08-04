"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import dynamic from "next/dynamic"
import {
  Package, Users, ShoppingBag, Bell, MessageCircle,
  Plus, Trash2, Edit2, Save, X, Loader2, RefreshCw, Shield,
  LogOut, Send, CheckCircle2, Key, AlertTriangle,
  Lock, Archive, TrendingUp, Map, Truck, List, Wifi, FileText,
  UserCheck, Megaphone, Gift,
} from "lucide-react"
import {
  listAllOrders, sendAdminMessage, updateOrderStatus, getThreadMessages,
} from "@/app/actions/order"
import { listUsers, setUserNickname, setUserFlags, setLoyaltyAdjustment, deleteUserAccount } from "@/app/actions/account"
import { getProducts as getAdminProducts, createProduct, updateProduct, deleteProduct } from "@/app/actions/products"
import { listNews, createNews, updateNewsActive, deleteNews } from "@/app/actions/news"
import { listStaff, createStaffInvite, deleteStaffMember } from "@/app/actions/staff"
import { listVerifications, approveVerification, rejectVerification } from "@/app/actions/verification"
import { listRecoveryClaims, resolveRecoveryClaim } from "@/app/actions/restore-access"
import { listLoginLogs } from "@/app/actions/login-logs"
import { listBroadcasts, sendBroadcast } from "@/app/actions/notifications"
import { getProfitSummary } from "@/app/actions/profit"
import { STATUS_LABELS } from "@/lib/order-status"
import type { OrderThread, Product } from "@/lib/db/schema"
import { db } from "@/lib/db"

const ACCENT = "#ffca28"
const ACCENT2 = "#e65100"
const BORDER = "rgba(255,202,40,0.14)"
const CARD = "rgba(20,18,12,0.88)"
const BG = "#0f0d07"
const TEXT = "#f5e8c7"
const MUTED = "rgba(200,190,170,.6)"

const STATUS_OPTIONS = ["nouveau","confirme","en_preparation","expedie","en_route","livree","annule"]

const statusColor: Record<string, string> = {
  nouveau: "#eab308", confirme: "#3b82f6", en_preparation: "#a855f7",
  expedie: "#6366f1", en_route: "#3b82f6", livree: "#22c55e",
  annule: "#ef4444", annulee: "#ef4444",
}

type Tab =
  | "orders" | "locker" | "closed" | "messaging" | "notifications"
  | "products" | "promos" | "map" | "logistics" | "recap"
  | "clients" | "verifications" | "recovery" | "connections"
  | "news" | "whitelist" | "staff" | "profits"

const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: "orders",        label: "Commandes en cours", icon: <ShoppingBag size={14}/> },
  { key: "locker",        label: "Locker MR",          icon: <Lock size={14}/> },
  { key: "closed",        label: "Clôturées",          icon: <Archive size={14}/> },
  { key: "messaging",     label: "Messagerie",         icon: <MessageCircle size={14}/> },
  { key: "notifications", label: "Notifications",      icon: <Bell size={14}/> },
  { key: "products",      label: "Produits",           icon: <Package size={14}/> },
  { key: "promos",        label: "Codes promo",        icon: <Gift size={14}/> },
  { key: "map",           label: "Carte interactive",  icon: <Map size={14}/> },
  { key: "logistics",     label: "Logistique",         icon: <Truck size={14}/> },
  { key: "recap",         label: "Récap commandes",    icon: <List size={14}/> },
  { key: "clients",       label: "Utilisateurs",       icon: <Users size={14}/> },
  { key: "verifications", label: "Vérifications",      icon: <Shield size={14}/> },
  { key: "recovery",      label: "Récupérations",      icon: <AlertTriangle size={14}/> },
  { key: "connections",   label: "Connexions",         icon: <Wifi size={14}/> },
  { key: "news",          label: "News",               icon: <FileText size={14}/> },
  { key: "whitelist",     label: "Whitelist",          icon: <UserCheck size={14}/> },
  { key: "staff",         label: "Admins",             icon: <Key size={14}/> },
  { key: "profits",       label: "Profits",            icon: <TrendingUp size={14}/> },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────
function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ borderRadius: 16, border: `1px solid ${BORDER}`, background: CARD, padding: "14px 18px", ...style }}>
      {children}
    </div>
  )
}

function Btn({ children, onClick, variant = "default", disabled, style }: {
  children: React.ReactNode; onClick?: () => void; variant?: "default"|"primary"|"danger"|"ghost"
  disabled?: boolean; style?: React.CSSProperties
}) {
  const bg: Record<string, string> = {
    default: "rgba(255,202,40,.08)", primary: `linear-gradient(120deg,${ACCENT},${ACCENT2})`,
    danger: "rgba(239,68,68,.1)", ghost: "transparent",
  }
  const border: Record<string, string> = {
    default: `1px solid ${BORDER}`, primary: "none",
    danger: "1px solid rgba(239,68,68,.25)", ghost: `1px solid ${BORDER}`,
  }
  const color: Record<string, string> = {
    default: ACCENT, primary: "#000", danger: "#f87171", ghost: MUTED,
  }
  return (
    <button onClick={onClick} disabled={disabled}
      style={{ display:"inline-flex", alignItems:"center", gap:6, padding:"7px 14px", borderRadius:10,
        background: bg[variant], border: border[variant], color: color[variant],
        fontSize:13, fontWeight: variant==="primary"?700:500, cursor:"pointer",
        opacity: disabled ? 0.5 : 1, ...style }}>
      {children}
    </button>
  )
}

function Input({ value, onChange, placeholder, type = "text", rows, style }: {
  value: string; onChange: (v: string) => void; placeholder?: string
  type?: string; rows?: number; style?: React.CSSProperties
}) {
  const base: React.CSSProperties = { width:"100%", padding:"9px 12px", borderRadius:10, border:`1px solid ${BORDER}`, background:"#1a1810", color:TEXT, fontSize:13, outline:"none", fontFamily:"inherit", boxSizing:"border-box", ...style }
  if (rows) return <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={rows} style={{ ...base, resize:"vertical" }} />
  return <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={base} />
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display:"block", fontSize:10, textTransform:"uppercase", letterSpacing:"0.1em", color:MUTED, marginBottom:4 }}>{label}</label>
      {children}
    </div>
  )
}

function EmptyState({ msg }: { msg: string }) {
  return <p style={{ color:"rgba(200,190,170,.35)", textAlign:"center", padding:"48px 0", fontSize:13 }}>{msg}</p>
}

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span style={{ fontSize:10, padding:"2px 8px", borderRadius:999, background:`${color}22`, color, fontWeight:600 }}>{label}</span>
  )
}

// ─── Main Panel ──────────────────────────────────────────────────────────────
export function AdminPanel() {
  const [tab, setTab] = useState<Tab>("orders")
  const [orders, setOrders] = useState<OrderThread[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [verifications, setVerifications] = useState<any[]>([])
  const [staffList, setStaffList] = useState<any[]>([])
  const [newsList, setNewsList] = useState<any[]>([])
  const [recoveryClaims, setRecoveryClaims] = useState<any[]>([])
  const [loginLogs, setLoginLogs] = useState<any[]>([])
  const [broadcasts, setBroadcasts] = useState<any[]>([])
  const [profit, setProfit] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<OrderThread | null>(null)
  const [orderMessages, setOrderMessages] = useState<any[]>([])
  const [adminMsg, setAdminMsg] = useState("")
  const [sendingMsg, setSendingMsg] = useState(false)

  const loadTab = useCallback(async (t: Tab) => {
    setLoading(true)
    try {
      const allOrders = async () => { const o = await listAllOrders(); setOrders(o) }
      if (t === "orders")        { await allOrders() }
      if (t === "locker")        { await allOrders() }
      if (t === "closed")        { await allOrders() }
      if (t === "messaging")     { await allOrders() }
      if (t === "logistics")     { await allOrders() }
      if (t === "recap")         { await allOrders() }
      if (t === "map")           { await allOrders() }
      if (t === "products")      { setProducts(await getAdminProducts()) }
      if (t === "clients")       { setUsers(await listUsers()) }
      if (t === "verifications") { setVerifications(await listVerifications()) }
      if (t === "staff")         { setStaffList(await listStaff()) }
      if (t === "news")          { setNewsList(await listNews()) }
      if (t === "recovery")      { setRecoveryClaims(await listRecoveryClaims()) }
      if (t === "connections")   { setLoginLogs(await listLoginLogs()) }
      if (t === "notifications") { setBroadcasts(await listBroadcasts()) }
      if (t === "profits")       { setProfit(await getProfitSummary()) }
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { loadTab(tab) }, [tab, loadTab])

  const openOrder = async (order: OrderThread) => {
    setSelectedOrder(order)
    setOrderMessages(await getThreadMessages(order.id))
  }

  const sendMsg = async () => {
    if (!adminMsg.trim() || !selectedOrder) return
    setSendingMsg(true)
    await sendAdminMessage(selectedOrder.id, adminMsg.trim())
    setAdminMsg("")
    setOrderMessages(await getThreadMessages(selectedOrder.id))
    setSendingMsg(false)
  }

  const changeStatus = async (order: OrderThread, status: string) => {
    await updateOrderStatus(order.id, status)
    setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status } : o))
    if (selectedOrder?.id === order.id) setSelectedOrder({ ...order, status })
  }

  // Derived order lists
  const activeOrders = orders.filter(o => !["livree","annule","annulee"].includes(o.status))
  const closedOrders = orders.filter(o => ["livree","annule","annulee"].includes(o.status))
  const lockerOrders = orders.filter(o => o.fulfillment === "locker" || o.fulfillment === "meetup")

  return (
    <div style={{ minHeight:"100vh", background:BG, color:TEXT }}>
      {/* Header */}
      <header style={{ position:"sticky", top:0, zIndex:20, borderBottom:`1px solid ${BORDER}`, background:"rgba(15,13,7,.97)", backdropFilter:"blur(12px)", padding:"11px 20px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <h1 style={{ margin:0, fontFamily:"Orbitron,sans-serif", fontSize:15, fontWeight:900, letterSpacing:"0.15em", background:`linear-gradient(90deg,${ACCENT},${ACCENT2})`, WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>
          ADMIN — FRENCHYCALI
        </h1>
        <div style={{ display:"flex", gap:8 }}>
          <Btn variant="ghost" onClick={() => loadTab(tab)}><RefreshCw size={14}/></Btn>
          <Btn variant="danger" onClick={() => { localStorage.removeItem("authToken"); localStorage.removeItem("userPseudo"); localStorage.removeItem("isAdmin"); window.location.href = "/choix" }}>
            <LogOut size={13}/> Quitter
          </Btn>
        </div>
      </header>

      {/* Tab nav — 2 rows */}
      <nav style={{ padding:"10px 16px 0", borderBottom:`1px solid ${BORDER}`, background:"rgba(15,13,7,.6)" }}>
        <div style={{ display:"flex", flexWrap:"wrap", gap:4, maxWidth:1400, margin:"0 auto" }}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => { setTab(t.key); setSelectedOrder(null) }}
              style={{ display:"flex", alignItems:"center", gap:5, padding:"7px 13px", marginBottom:8, borderRadius:10,
                border:`1px solid ${tab===t.key ? ACCENT : "rgba(255,202,40,.06)"}`,
                background: tab===t.key ? "rgba(255,202,40,.1)" : "transparent",
                color: tab===t.key ? ACCENT : MUTED,
                fontSize:12, fontWeight: tab===t.key ? 700 : 400, cursor:"pointer", whiteSpace:"nowrap", transition:"all .15s" }}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </nav>

      <main style={{ maxWidth:1400, margin:"0 auto", padding:"20px 16px 40px" }}>
        {loading && (
          <div style={{ textAlign:"center", padding:60 }}>
            <Loader2 style={{ width:32, height:32, margin:"0 auto", animation:"spin 1s linear infinite", color:ACCENT }}/>
          </div>
        )}

        {/* ── COMMANDES EN COURS ── */}
        {!loading && tab === "orders" && (
          <OrdersPanel orders={activeOrders} selectedOrder={selectedOrder}
            orderMessages={orderMessages} adminMsg={adminMsg} sendingMsg={sendingMsg}
            onOpen={openOrder} onBack={() => setSelectedOrder(null)}
            onStatusChange={changeStatus} onMsgChange={setAdminMsg} onSend={sendMsg}
            title="Commandes en cours" emptyMsg="Aucune commande en cours." />
        )}

        {/* ── LOCKER MR ── */}
        {!loading && tab === "locker" && (
          <OrdersPanel orders={lockerOrders} selectedOrder={selectedOrder}
            orderMessages={orderMessages} adminMsg={adminMsg} sendingMsg={sendingMsg}
            onOpen={openOrder} onBack={() => setSelectedOrder(null)}
            onStatusChange={changeStatus} onMsgChange={setAdminMsg} onSend={sendMsg}
            title="Locker / Meet-up" emptyMsg="Aucune commande locker/meet-up." />
        )}

        {/* ── CLÔTURÉES ── */}
        {!loading && tab === "closed" && (
          <OrdersPanel orders={closedOrders} selectedOrder={selectedOrder}
            orderMessages={orderMessages} adminMsg={adminMsg} sendingMsg={sendingMsg}
            onOpen={openOrder} onBack={() => setSelectedOrder(null)}
            onStatusChange={changeStatus} onMsgChange={setAdminMsg} onSend={sendMsg}
            title="Commandes clôturées" emptyMsg="Aucune commande clôturée." />
        )}

        {/* ── MESSAGERIE GLOBALE ── */}
        {!loading && tab === "messaging" && (
          <MessagingTab orders={orders} onOpen={openOrder}
            selectedOrder={selectedOrder} orderMessages={orderMessages}
            adminMsg={adminMsg} sendingMsg={sendingMsg}
            onBack={() => setSelectedOrder(null)}
            onMsgChange={setAdminMsg} onSend={sendMsg} />
        )}

        {/* ── NOTIFICATIONS ── */}
        {!loading && tab === "notifications" && (
          <NotificationsTab broadcasts={broadcasts} onRefresh={() => loadTab("notifications")} />
        )}

        {/* ── PRODUITS ── */}
        {!loading && tab === "products" && (
          <ProductsTab products={products} onRefresh={() => loadTab("products")} />
        )}

        {/* ── CODES PROMO ── */}
        {!loading && tab === "promos" && (
          <PromosTab onRefresh={() => loadTab("promos")} />
        )}

        {/* ── CARTE INTERACTIVE ── */}
        {!loading && tab === "map" && (
          <MapTab orders={orders} />
        )}

        {/* ── LOGISTIQUE ── */}
        {!loading && tab === "logistics" && (
          <LogisticsTab orders={activeOrders} onStatusChange={changeStatus} />
        )}

        {/* ─��� RÉCAP COMMANDES ── */}
        {!loading && tab === "recap" && (
          <RecapTab orders={orders} />
        )}

        {/* ── UTILISATEURS ── */}
        {!loading && tab === "clients" && (
          <ClientsTab users={users} onRefresh={() => loadTab("clients")} />
        )}

        {/* ── VÉRIFICATIONS KYC ── */}
        {!loading && tab === "verifications" && (
          <VerificationsTab verifications={verifications} onRefresh={() => loadTab("verifications")} />
        )}

        {/* ── RÉCUPÉRATIONS ── */}
        {!loading && tab === "recovery" && (
          <RecoveryTab claims={recoveryClaims} onRefresh={() => loadTab("recovery")} />
        )}

        {/* ── CONNEXIONS ── */}
        {!loading && tab === "connections" && (
          <ConnectionsTab logs={loginLogs} />
        )}

        {/* ── NEWS ── */}
        {!loading && tab === "news" && (
          <NewsTab newsList={newsList} onRefresh={() => loadTab("news")} />
        )}

        {/* ── WHITELIST ── */}
        {!loading && tab === "whitelist" && (
          <WhitelistTab />
        )}

        {/* ── ADMINS (staff) ── */}
        {!loading && tab === "staff" && (
          <StaffTab staffList={staffList} onRefresh={() => loadTab("staff")} />
        )}

        {/* ── PROFITS ── */}
        {!loading && tab === "profits" && (
          <ProfitsTab profit={profit} orders={orders} users={users} />
        )}
      </main>

      <style>{`
        @keyframes spin { to { transform:rotate(360deg) } }
        ::-webkit-scrollbar { width:4px; height:4px }
        ::-webkit-scrollbar-track { background:transparent }
        ::-webkit-scrollbar-thumb { background:rgba(255,202,40,.2); border-radius:2px }
      `}</style>
    </div>
  )
}

// ─── Orders Panel (réutilisable pour en cours / locker / clôturées) ──────────
function OrdersPanel({ orders, selectedOrder, orderMessages, adminMsg, sendingMsg,
  onOpen, onBack, onStatusChange, onMsgChange, onSend, title, emptyMsg }: {
  orders: OrderThread[]; selectedOrder: OrderThread | null; orderMessages: any[]
  adminMsg: string; sendingMsg: boolean; title: string; emptyMsg: string
  onOpen: (o: OrderThread) => void; onBack: () => void
  onStatusChange: (o: OrderThread, s: string) => void
  onMsgChange: (v: string) => void; onSend: () => void
}) {
  if (selectedOrder) {
    return <OrderDetail order={selectedOrder} messages={orderMessages} adminMsg={adminMsg}
      sendingMsg={sendingMsg} onBack={onBack} onStatusChange={onStatusChange}
      onMsgChange={onMsgChange} onSend={onSend} />
  }
  return (
    <div>
      <p style={{ margin:"0 0 14px", fontSize:13, color:MUTED }}>{title} — {orders.length} commande(s)</p>
      {orders.length === 0 && <EmptyState msg={emptyMsg} />}
      <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
        {orders.map(order => (
          <button key={order.id} onClick={() => onOpen(order)}
            style={{ width:"100%", textAlign:"left", padding:"14px 18px", borderRadius:16, border:`1px solid ${BORDER}`, background:CARD, cursor:"pointer", transition:"border-color .15s" }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,202,40,.35)"}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = BORDER}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:12 }}>
              <div style={{ flex:1 }}>
                <span style={{ fontSize:14, fontWeight:600, color:TEXT }}>#{order.id} — {order.customerName}</span>
                <Badge label={STATUS_LABELS[order.status] || order.status} color={statusColor[order.status] || "#f5e8c7"} />
                <Badge label={order.shop} color="rgba(255,202,40,.5)" />
                <Badge label={order.fulfillment} color="#6366f1" />
              </div>
              <span style={{ color:ACCENT, fontWeight:700, fontSize:15, flexShrink:0 }}>{order.total}€</span>
            </div>
            <p style={{ margin:"5px 0 0", fontSize:12, color:MUTED }}>{order.summary.slice(0,90)}</p>
            <p style={{ margin:"2px 0 0", fontSize:10, color:"rgba(200,190,170,.35)" }}>{new Date(order.createdAt).toLocaleString("fr-FR")}</p>
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Order Detail ────────────────────────────────────────────────────────────
function OrderDetail({ order, messages, adminMsg, sendingMsg, onBack, onStatusChange, onMsgChange, onSend }: {
  order: OrderThread; messages: any[]; adminMsg: string; sendingMsg: boolean
  onBack: () => void; onStatusChange: (o: OrderThread, s: string) => void
  onMsgChange: (v: string) => void; onSend: () => void
}) {
  return (
    <div>
      <button onClick={onBack} style={{ display:"flex", alignItems:"center", gap:4, background:"none", border:"none", cursor:"pointer", color:ACCENT, fontSize:13, marginBottom:16 }}>
        ← Retour
      </button>
      <div style={{ display:"grid", gridTemplateColumns:"minmax(0,1fr) minmax(0,1fr)", gap:20 }}>
        <Card>
          <h3 style={{ margin:"0 0 14px", fontSize:15, fontWeight:700 }}>Commande #{order.id}</h3>
          <div style={{ fontSize:13, color:"rgba(200,190,170,.85)", display:"flex", flexDirection:"column", gap:5 }}>
            <span><strong style={{ color:TEXT }}>Client :</strong> {order.customerName}</span>
            <span><strong style={{ color:TEXT }}>Total :</strong> <span style={{ color:ACCENT, fontWeight:700 }}>{order.total}€</span></span>
            <span><strong style={{ color:TEXT }}>Mode :</strong> {order.fulfillment}</span>
            <span><strong style={{ color:TEXT }}>Shop :</strong> {order.shop}</span>
            {order.address && <span><strong style={{ color:TEXT }}>Adresse :</strong> {order.address}</span>}
            {order.scheduledDate && <span><strong style={{ color:TEXT }}>Date :</strong> {order.scheduledDate} {order.scheduledSlot}</span>}
            {order.colissimoNumber && <span><strong style={{ color:TEXT }}>Colissimo :</strong> {order.colissimoNumber}</span>}
          </div>
          <div style={{ marginTop:14 }}>
            <p style={{ margin:"0 0 5px", fontSize:10, textTransform:"uppercase", letterSpacing:"0.1em", color:MUTED }}>Produits</p>
            <p style={{ margin:0, fontSize:13, color:"rgba(200,190,170,.85)", lineHeight:1.6 }}>{order.summary}</p>
          </div>
          <div style={{ marginTop:14 }}>
            <p style={{ margin:"0 0 5px", fontSize:10, textTransform:"uppercase", letterSpacing:"0.1em", color:MUTED }}>Statut</p>
            <select value={order.status} onChange={e => onStatusChange(order, e.target.value)}
              style={{ width:"100%", padding:"9px 12px", borderRadius:10, border:`1px solid ${BORDER}`, background:"#1a1810", color:TEXT, fontSize:13, cursor:"pointer", outline:"none" }}>
              {STATUS_OPTIONS.map(s => <option key={s} value={s}>{STATUS_LABELS[s] || s}</option>)}
            </select>
          </div>
        </Card>

        <div style={{ borderRadius:16, border:`1px solid ${BORDER}`, background:CARD, overflow:"hidden", display:"flex", flexDirection:"column" }}>
          <div style={{ padding:"12px 16px", borderBottom:`1px solid ${BORDER}`, fontSize:13, fontWeight:600, display:"flex", alignItems:"center", gap:6 }}>
            <MessageCircle size={14}/> Messages
          </div>
          <div style={{ flex:1, overflowY:"auto", padding:12, display:"flex", flexDirection:"column", gap:8, minHeight:220, maxHeight:340 }}>
            {messages.length === 0 && <p style={{ margin:"auto", fontSize:12, color:"rgba(200,190,170,.4)", textAlign:"center" }}>Aucun message</p>}
            {messages.map(m => (
              <div key={m.id} style={{ display:"flex", justifyContent: m.sender === "vendeur" ? "flex-end" : "flex-start" }}>
                <div style={{ maxWidth:"75%", padding:"8px 12px", borderRadius:12, background: m.sender === "vendeur" ? "rgba(255,202,40,.12)" : "rgba(255,255,255,.05)", border:`1px solid ${BORDER}` }}>
                  <p style={{ margin:"0 0 2px", fontSize:13, color:TEXT }}>{m.body}</p>
                  <p style={{ margin:0, fontSize:10, color:"rgba(200,190,170,.4)" }}>{m.sender} · {new Date(m.createdAt).toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"})}</p>
                </div>
              </div>
            ))}
          </div>
          <div style={{ padding:"10px 12px", borderTop:`1px solid ${BORDER}`, display:"flex", gap:8 }}>
            <input value={adminMsg} onChange={e => onMsgChange(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.nativeEvent.isComposing) onSend() }}
              placeholder="Répondre..."
              style={{ flex:1, padding:"9px 12px", borderRadius:999, border:`1px solid ${BORDER}`, background:"rgba(0,0,0,.4)", color:TEXT, fontSize:13, outline:"none", fontFamily:"inherit" }} />
            <button onClick={onSend} disabled={sendingMsg || !adminMsg.trim()}
              style={{ borderRadius:999, padding:"9px 14px", background:ACCENT, border:"none", cursor:"pointer", opacity: sendingMsg || !adminMsg.trim() ? 0.5 : 1 }}>
              {sendingMsg ? <Loader2 size={14} style={{ animation:"spin 1s linear infinite", color:"#000" }}/> : <Send size={14} color="#000"/>}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Messagerie globale ──────────────────────────────────────────────────────
function MessagingTab({ orders, onOpen, selectedOrder, orderMessages, adminMsg, sendingMsg, onBack, onMsgChange, onSend }: {
  orders: OrderThread[]; onOpen: (o: OrderThread) => void
  selectedOrder: OrderThread | null; orderMessages: any[]
  adminMsg: string; sendingMsg: boolean
  onBack: () => void; onMsgChange: (v: string) => void; onSend: () => void
}) {
  const withMessages = orders.filter(o => true) // all threads = messagerie
  if (selectedOrder) {
    return <OrderDetail order={selectedOrder} messages={orderMessages} adminMsg={adminMsg}
      sendingMsg={sendingMsg} onBack={onBack} onStatusChange={() => {}}
      onMsgChange={onMsgChange} onSend={onSend} />
  }
  return (
    <div>
      <p style={{ margin:"0 0 14px", fontSize:13, color:MUTED }}>{orders.length} conversations</p>
      {orders.length === 0 && <EmptyState msg="Aucune conversation." />}
      <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
        {orders.map(o => (
          <button key={o.id} onClick={() => onOpen(o)}
            style={{ width:"100%", textAlign:"left", padding:"12px 16px", borderRadius:14, border:`1px solid ${BORDER}`, background:CARD, cursor:"pointer", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <div>
              <span style={{ fontSize:13, fontWeight:600, color:TEXT }}>#{o.id} {o.customerName}</span>
              <p style={{ margin:"3px 0 0", fontSize:11, color:MUTED }}>{o.summary.slice(0,60)}…</p>
            </div>
            <Badge label={STATUS_LABELS[o.status] || o.status} color={statusColor[o.status] || TEXT} />
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Notifications broadcast ─────────────────────────────────────────────────
function NotificationsTab({ broadcasts, onRefresh }: { broadcasts: any[]; onRefresh: () => void }) {
  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")
  const [sending, setSending] = useState(false)

  const send = async () => {
    if (!title.trim() || !body.trim()) return
    setSending(true)
    await sendBroadcast({ title: title.trim(), body: body.trim() })
    setTitle(""); setBody("")
    onRefresh()
    setSending(false)
  }

  return (
    <div>
      <Card style={{ marginBottom:20 }}>
        <h3 style={{ margin:"0 0 14px", fontSize:14, color:TEXT, display:"flex", alignItems:"center", gap:6 }}>
          <Megaphone size={15} color={ACCENT}/> Envoyer une notification broadcast
        </h3>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:12 }}>
          <Field label="Titre">
            <Input value={title} onChange={setTitle} placeholder="Titre de la notif" />
          </Field>
          <Field label="Message">
            <Input value={body} onChange={setBody} placeholder="Corps du message" />
          </Field>
        </div>
        <Btn variant="primary" onClick={send} disabled={sending || !title.trim() || !body.trim()}>
          {sending ? <Loader2 size={13} style={{ animation:"spin 1s linear infinite" }}/> : <Send size={13}/>}
          Envoyer à tous
        </Btn>
      </Card>

      <p style={{ margin:"0 0 12px", fontSize:13, color:MUTED }}>{broadcasts.length} notification(s) envoyée(s)</p>
      <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
        {broadcasts.map(b => (
          <Card key={b.id}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
              <div>
                <p style={{ margin:"0 0 3px", fontSize:14, fontWeight:600, color:TEXT }}>{b.title}</p>
                <p style={{ margin:0, fontSize:12, color:MUTED }}>{b.body}</p>
              </div>
              <div style={{ textAlign:"right", flexShrink:0, marginLeft:12 }}>
                <p style={{ margin:0, fontSize:11, color:MUTED }}>{new Date(b.createdAt).toLocaleString("fr-FR")}</p>
                <p style={{ margin:"2px 0 0", fontSize:11, color:ACCENT }}>{b.sentCount} envoyé(s)</p>
              </div>
            </div>
          </Card>
        ))}
        {broadcasts.length === 0 && <EmptyState msg="Aucune notification envoyée." />}
      </div>
    </div>
  )
}

// ─── Products Tab ─────────────────────────────────────────────────────────────
function ProductsTab({ products, onRefresh }: { products: Product[]; onRefresh: () => void }) {
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ title:"", section:"featured", region:"both", description:"", fullDescription:"", image:"", stock:"10", variants:"[]", badges:"[]", discountType:"", discountValue:"", sortOrder:"0" })
  const [saving, setSaving] = useState(false)
  const [editId, setEditId] = useState<number|null>(null)

  const save = async () => {
    setSaving(true)
    try {
      let variants = []; try { variants = JSON.parse(form.variants) } catch {}
      let badges = []; try { badges = JSON.parse(form.badges) } catch {}
      await createProduct({ title:form.title, section:form.section, region:form.region,
        description:form.description, fullDescription:form.fullDescription,
        image:form.image||undefined, stock:Number(form.stock), variants, badges,
        discountType:form.discountType||undefined, discountValue:form.discountValue?Number(form.discountValue):undefined,
        sortOrder:Number(form.sortOrder) })
      setCreating(false)
      setForm({ title:"", section:"featured", region:"both", description:"", fullDescription:"", image:"", stock:"10", variants:"[]", badges:"[]", discountType:"", discountValue:"", sortOrder:"0" })
      onRefresh()
    } finally { setSaving(false) }
  }

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
        <p style={{ margin:0, fontSize:13, color:MUTED }}>{products.length} produit(s)</p>
        <Btn onClick={() => setCreating(!creating)}><Plus size={14}/> Nouveau produit</Btn>
      </div>

      {creating && (
        <Card style={{ marginBottom:20 }}>
          <h3 style={{ margin:"0 0 16px", fontSize:14 }}>Nouveau produit</h3>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
            <Field label="Nom"><Input value={form.title} onChange={v => setForm(f=>({...f,title:v}))} placeholder="Nom du produit"/></Field>
            <Field label="Section"><Input value={form.section} onChange={v => setForm(f=>({...f,section:v}))} placeholder="featured, weed..."/></Field>
            <Field label="Région">
              <select value={form.region} onChange={e => setForm(f=>({...f,region:e.target.value}))}
                style={{ width:"100%", padding:"9px 12px", borderRadius:10, border:`1px solid ${BORDER}`, background:"#1a1810", color:TEXT, fontSize:13, outline:"none" }}>
                <option value="both">31 + 94</option>
                <option value="31">31 seulement</option>
                <option value="94">94 seulement</option>
                <option value="delivery">CaliDelivery</option>
              </select>
            </Field>
            <Field label="Stock"><Input value={form.stock} onChange={v => setForm(f=>({...f,stock:v}))} type="number"/></Field>
            <Field label="Image URL"><Input value={form.image} onChange={v => setForm(f=>({...f,image:v}))} placeholder="https://..."/></Field>
            <Field label="Ordre tri"><Input value={form.sortOrder} onChange={v => setForm(f=>({...f,sortOrder:v}))} type="number"/></Field>
          </div>
          <div style={{ marginTop:12 }}>
            <Field label="Description courte"><Input value={form.description} onChange={v => setForm(f=>({...f,description:v}))} placeholder="Description affichée sur la card"/></Field>
          </div>
          <div style={{ marginTop:12 }}>
            <Field label={`Variantes JSON — ex: [{"qty":5,"price":30}]`}>
              <Input value={form.variants} onChange={v => setForm(f=>({...f,variants:v}))} rows={2}/>
            </Field>
          </div>
          <div style={{ marginTop:16, display:"flex", gap:10 }}>
            <Btn variant="primary" onClick={save} disabled={saving}>
              {saving ? <Loader2 size={13} style={{ animation:"spin 1s linear infinite" }}/> : <Save size={13}/>} Enregistrer
            </Btn>
            <Btn variant="ghost" onClick={() => setCreating(false)}>Annuler</Btn>
          </div>
        </Card>
      )}

      <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
        {products.map(p => (
          <Card key={p.id} style={{ display:"flex", alignItems:"center", gap:14, padding:"12px 16px" }}>
            {p.image && <img src={p.image} alt={p.title} style={{ width:46, height:46, borderRadius:10, objectFit:"cover", flexShrink:0 }}/>}
            <div style={{ flex:1 }}>
              <p style={{ margin:"0 0 2px", fontSize:14, fontWeight:600, color:TEXT }}>{p.title}</p>
              <p style={{ margin:0, fontSize:11, color:MUTED }}>{p.section} · région: {p.region} · stock: {p.stock}</p>
            </div>
            <div style={{ display:"flex", gap:8, alignItems:"center" }}>
              <Badge label={`${p.stock} stock`} color={p.stock > 0 ? "#22c55e" : "#ef4444"}/>
              <Btn variant="danger" onClick={async () => { if (confirm("Supprimer ?")) { await deleteProduct(p.id); onRefresh() } }}>
                <Trash2 size={13}/>
              </Btn>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}

// ─── Codes Promo Tab ──────────────────────────────────────────────────────────
function PromosTab({ onRefresh }: { onRefresh: () => void }) {
  const [promos, setPromos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ code:"", type:"fixed", value:"10", minAmount:"0", productName:"" })
  const [saving, setSaving] = useState(false)

  const fetchPromos = async () => {
    setLoading(true)
    fetch("/api/admin/promos", { credentials: "include" }).then(r => r.json()).then(d => { setPromos(d.promos || []); setLoading(false) }).catch(() => setLoading(false))
  }

  useEffect(() => { fetchPromos() }, [])

  const save = async () => {
    setSaving(true)
    try {
      await fetch("/api/admin/promos", { method:"POST", credentials:"include", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ code:form.code.trim().toUpperCase(), type:form.type, value:Number(form.value), minAmount:Number(form.minAmount), productName:form.productName||undefined }) })
      setCreating(false)
      setForm({ code:"", type:"fixed", value:"10", minAmount:"0", productName:"" })
      const d = await fetch("/api/admin/promos", { credentials:"include" }).then(r=>r.json())
      setPromos(d.promos || [])
    } finally { setSaving(false) }
  }

  if (loading) return <div style={{ textAlign:"center", padding:40 }}><Loader2 size={24} style={{ animation:"spin 1s linear infinite", color:ACCENT }}/></div>

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
        <p style={{ margin:0, fontSize:13, color:MUTED }}>{promos.length} code(s) promo</p>
        <Btn onClick={() => setCreating(!creating)}><Plus size={14}/> Nouveau code</Btn>
      </div>

      {creating && (
        <Card style={{ marginBottom:20 }}>
          <h3 style={{ margin:"0 0 14px", fontSize:14 }}>Nouveau code promo</h3>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
            <Field label="Code"><Input value={form.code} onChange={v=>setForm(f=>({...f,code:v}))} placeholder="FRENCHY20"/></Field>
            <Field label="Type">
              <select value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value}))}
                style={{ width:"100%", padding:"9px 12px", borderRadius:10, border:`1px solid ${BORDER}`, background:"#1a1810", color:TEXT, fontSize:13, outline:"none" }}>
                <option value="fixed">Montant fixe (€)</option>
                <option value="percent">Pourcentage (%)</option>
              </select>
            </Field>
            <Field label="Valeur"><Input value={form.value} onChange={v=>setForm(f=>({...f,value:v}))} type="number"/></Field>
            <Field label="Montant min (€)"><Input value={form.minAmount} onChange={v=>setForm(f=>({...f,minAmount:v}))} type="number"/></Field>
            <Field label="Produit spécifique (optionnel)"><Input value={form.productName} onChange={v=>setForm(f=>({...f,productName:v}))} placeholder="Laisse vide = tous produits"/></Field>
          </div>
          <div style={{ marginTop:16, display:"flex", gap:10 }}>
            <Btn variant="primary" onClick={save} disabled={saving || !form.code.trim()}>
              {saving ? <Loader2 size={13} style={{ animation:"spin 1s linear infinite" }}/> : <Save size={13}/>} Créer
            </Btn>
            <Btn variant="ghost" onClick={() => setCreating(false)}>Annuler</Btn>
          </div>
        </Card>
      )}

      <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
        {promos.map((p: any) => (
          <Card key={p.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <div>
              <span style={{ fontSize:14, fontWeight:700, color:ACCENT, fontFamily:"monospace" }}>{p.code}</span>
              <span style={{ marginLeft:10, fontSize:12, color:MUTED }}>
                {p.type === "percent" ? `${p.value}%` : `${p.value}€`} de réduction
                {p.minAmount > 0 && ` · min ${p.minAmount}€`}
                {p.productName && ` · ${p.productName}`}
              </span>
            </div>
            <div style={{ display:"flex", gap:8, alignItems:"center" }}>
              <Badge label={p.active ? "Actif" : "Inactif"} color={p.active ? "#22c55e" : "#ef4444"}/>
              <Btn variant="danger" onClick={async () => { if (confirm("Supprimer ?")) { await fetch(`/api/admin/promos?id=${p.id}`, {method:"DELETE", credentials:"include"}); const d = await fetch("/api/admin/promos", {credentials:"include"}).then(r=>r.json()); setPromos(d.promos||[]) } }}>
                <Trash2 size={13}/>
              </Btn>
            </div>
          </Card>
        ))}
        {promos.length === 0 && <EmptyState msg="Aucun code promo."/>}
      </div>
    </div>
  )
}

// ─── Carte interactive ────────────────────────────────────────────────────────
function MapTab({ orders }: { orders: OrderThread[] }) {
  const withCoords = orders.filter(o => o.lat && o.lng)
  const mapRef = useRef<HTMLDivElement>(null)
  const [mapReady, setMapReady] = useState(false)
  const [mapInstance, setMapInstance] = useState<any>(null)

  useEffect(() => {
    if (typeof window === "undefined" || !mapRef.current || mapInstance) return
    let L: any
    let map: any
    ;(async () => {
      try {
        L = (await import("leaflet")).default
        await import("leaflet/dist/leaflet.css")

        // Fix default icon paths in Next.js
        delete (L.Icon.Default.prototype as any)._getIconUrl
        L.Icon.Default.mergeOptions({
          iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
          iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
          shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
        })

        map = L.map(mapRef.current!, { zoomControl: true })
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "© OpenStreetMap contributors",
          maxZoom: 18,
        }).addTo(map)

        if (withCoords.length > 0) {
          const bounds: [number, number][] = []
          withCoords.forEach(o => {
            const lat = o.lat!; const lng = o.lng!
            bounds.push([lat, lng])
            const icon = L.divIcon({
              className: "",
              html: `<div style="background:${ACCENT};color:#000;border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;border:2px solid rgba(255,202,40,.4);box-shadow:0 0 8px rgba(255,202,40,.5)">${o.total}€</div>`,
              iconSize: [28, 28],
              iconAnchor: [14, 14],
            })
            L.marker([lat, lng], { icon })
              .addTo(map)
              .bindPopup(`<b>#${o.id} — ${o.customerName}</b><br>${o.summary.slice(0,60)}<br><b style="color:#e65100">${o.total}€</b>`)
          })
          map.fitBounds(bounds, { padding: [40, 40] })
        } else {
          map.setView([46.6034, 1.8883], 6) // France
        }

        setMapInstance(map)
        setMapReady(true)
      } catch (err) {
        console.error("[v0] Leaflet init error:", err)
      }
    })()

    return () => { if (map) { map.remove(); setMapInstance(null); setMapReady(false) } }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Add markers when orders change after initial load
  useEffect(() => {
    if (!mapInstance || !mapReady) return
    // Markers are already added in init; this handles re-renders
  }, [orders, mapInstance, mapReady])

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
        <p style={{ margin:0, fontSize:13, color:MUTED }}>
          {withCoords.length} commande(s) géolocalisées sur {orders.length} totales
        </p>
        {withCoords.length === 0 && (
          <span style={{ fontSize:12, color:"rgba(255,202,40,.5)" }}>Aucune commande avec coordonnées GPS</span>
        )}
      </div>

      {/* Map container */}
      <div style={{ borderRadius:16, border:`1px solid ${BORDER}`, overflow:"hidden", position:"relative" }}>
        <div ref={mapRef} style={{ width:"100%", height:500 }} />
        {!mapReady && (
          <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", background:"rgba(15,13,7,.8)", flexDirection:"column", gap:12 }}>
            <Loader2 size={28} color={ACCENT} style={{ animation:"spin 1s linear infinite" }}/>
            <p style={{ margin:0, fontSize:12, color:MUTED }}>Chargement de la carte...</p>
          </div>
        )}
      </div>

      {/* Orders list below map */}
      {withCoords.length > 0 && (
        <div style={{ marginTop:14, display:"flex", flexDirection:"column", gap:6 }}>
          <p style={{ margin:"0 0 8px", fontSize:11, textTransform:"uppercase", letterSpacing:"0.1em", color:MUTED }}>Détail des livraisons géolocalisées</p>
          {withCoords.map(o => (
            <Card key={o.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 16px" }}>
              <div>
                <span style={{ fontSize:13, fontWeight:600, color:TEXT }}>#{o.id} {o.customerName}</span>
                <span style={{ marginLeft:8, fontSize:11, color:MUTED }}>📍 {o.lat?.toFixed(5)}, {o.lng?.toFixed(5)}</span>
              </div>
              <span style={{ color:ACCENT, fontWeight:700 }}>{o.total}€</span>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Logistique ──────────────────────────────────────────────────────────────
function LogisticsTab({ orders, onStatusChange }: { orders: OrderThread[]; onStatusChange: (o: OrderThread, s: string) => void }) {
  const expedié = orders.filter(o => ["expedie","en_route"].includes(o.status))
  const preparation = orders.filter(o => o.status === "en_preparation")
  const nouveaux = orders.filter(o => ["nouveau","confirme"].includes(o.status))

  const Section = ({ title, items, color }: { title: string; items: OrderThread[]; color: string }) => (
    <div style={{ marginBottom:24 }}>
      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
        <span style={{ width:8, height:8, borderRadius:"50%", background:color, display:"inline-block" }}/>
        <h3 style={{ margin:0, fontSize:13, fontWeight:700, color:TEXT }}>{title}</h3>
        <Badge label={String(items.length)} color={color}/>
      </div>
      {items.length === 0 && <p style={{ fontSize:12, color:MUTED, paddingLeft:16 }}>Aucune commande.</p>}
      <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
        {items.map(o => (
          <Card key={o.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 16px" }}>
            <div>
              <span style={{ fontSize:13, fontWeight:600, color:TEXT }}>#{o.id} {o.customerName}</span>
              <span style={{ marginLeft:8, fontSize:11, color:MUTED }}>{o.fulfillment} · {o.shop}</span>
              {o.colissimoNumber && <span style={{ marginLeft:8, fontSize:11, color:ACCENT }}>Colissimo: {o.colissimoNumber}</span>}
            </div>
            <select value={o.status} onChange={e => onStatusChange(o, e.target.value)}
              style={{ padding:"5px 10px", borderRadius:8, border:`1px solid ${BORDER}`, background:"#1a1810", color:TEXT, fontSize:12, cursor:"pointer", outline:"none" }}>
              {STATUS_OPTIONS.map(s => <option key={s} value={s}>{STATUS_LABELS[s] || s}</option>)}
            </select>
          </Card>
        ))}
      </div>
    </div>
  )

  return (
    <div>
      <Section title="Nouveaux / Confirmés" items={nouveaux} color="#eab308"/>
      <Section title="En préparation" items={preparation} color="#a855f7"/>
      <Section title="Expédiés / En route" items={expedié} color="#22c55e"/>
    </div>
  )
}

// ─── Récap commandes ──────────────────────────────────────────────────────────
function RecapTab({ orders }: { orders: OrderThread[] }) {
  const byShop = orders.reduce((acc: Record<string, { count: number; total: number }>, o) => {
    if (!acc[o.shop]) acc[o.shop] = { count:0, total:0 }
    acc[o.shop].count++
    acc[o.shop].total += o.total || 0
    return acc
  }, {})
  const byStatus = orders.reduce((acc: Record<string, number>, o) => { acc[o.status]=(acc[o.status]||0)+1; return acc }, {})
  const byFulfillment = orders.reduce((acc: Record<string, number>, o) => { acc[o.fulfillment]=(acc[o.fulfillment]||0)+1; return acc }, {})
  const totalRevenue = orders.filter(o=>o.status==="livree").reduce((s,o)=>s+(o.total||0),0)

  return (
    <div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))", gap:14, marginBottom:28 }}>
        {[
          { label:"Commandes totales", value:orders.length, color:ACCENT },
          { label:"CA livré", value:`${totalRevenue}€`, color:"#22c55e" },
          { label:"En attente", value:orders.filter(o=>["nouveau","confirme"].includes(o.status)).length, color:"#eab308" },
          { label:"En cours", value:orders.filter(o=>["en_preparation","expedie","en_route"].includes(o.status)).length, color:"#a855f7" },
          { label:"Clôturées", value:orders.filter(o=>["livree","annule","annulee"].includes(o.status)).length, color:MUTED },
        ].map(s => (
          <Card key={s.label} style={{ textAlign:"center" }}>
            <p style={{ margin:"0 0 4px", fontSize:22, fontWeight:900, color:s.color as string }}>{s.value}</p>
            <p style={{ margin:0, fontSize:11, color:MUTED }}>{s.label}</p>
          </Card>
        ))}
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:16 }}>
        <Card>
          <h3 style={{ margin:"0 0 12px", fontSize:13, color:TEXT }}>Par shop</h3>
          {Object.entries(byShop).map(([shop, d]) => (
            <div key={shop} style={{ display:"flex", justifyContent:"space-between", padding:"6px 0", borderBottom:`1px solid ${BORDER}`, fontSize:13 }}>
              <span style={{ color:TEXT }}>{shop}</span>
              <span style={{ color:ACCENT, fontWeight:600 }}>{d.count} · {d.total}€</span>
            </div>
          ))}
        </Card>
        <Card>
          <h3 style={{ margin:"0 0 12px", fontSize:13, color:TEXT }}>Par statut</h3>
          {Object.entries(byStatus).map(([status, count]) => (
            <div key={status} style={{ display:"flex", justifyContent:"space-between", padding:"6px 0", borderBottom:`1px solid ${BORDER}`, fontSize:13 }}>
              <span style={{ color:statusColor[status]||TEXT }}>{STATUS_LABELS[status]||status}</span>
              <span style={{ color:ACCENT, fontWeight:600 }}>{count as number}</span>
            </div>
          ))}
        </Card>
        <Card>
          <h3 style={{ margin:"0 0 12px", fontSize:13, color:TEXT }}>Par mode livraison</h3>
          {Object.entries(byFulfillment).map(([mode, count]) => (
            <div key={mode} style={{ display:"flex", justifyContent:"space-between", padding:"6px 0", borderBottom:`1px solid ${BORDER}`, fontSize:13 }}>
              <span style={{ color:TEXT }}>{mode}</span>
              <span style={{ color:ACCENT, fontWeight:600 }}>{count as number}</span>
            </div>
          ))}
        </Card>
      </div>
    </div>
  )
}

// ─── Clients Tab ──────────────────────────────────────────────────────────────
function ClientsTab({ users, onRefresh }: { users: any[]; onRefresh: () => void }) {
  const [editId, setEditId] = useState<number|null>(null)
  const [nickInput, setNickInput] = useState("")
  const [loyaltyInput, setLoyaltyInput] = useState("")
  const [search, setSearch] = useState("")

  const filtered = users.filter(u => u.pseudo?.toLowerCase().includes(search.toLowerCase()) || u.nickname?.toLowerCase().includes(search.toLowerCase()))

  return (
    <div>
      <div style={{ display:"flex", gap:12, marginBottom:16, alignItems:"center" }}>
        <p style={{ margin:0, fontSize:13, color:MUTED, flexShrink:0 }}>{users.length} client(s)</p>
        <Input value={search} onChange={setSearch} placeholder="Rechercher un pseudo..." style={{ maxWidth:300 }}/>
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
        {filtered.map(u => (
          <Card key={u.id}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
              <div>
                <span style={{ fontSize:14, fontWeight:600, color:TEXT }}>{u.pseudo}</span>
                {u.nickname && <span style={{ marginLeft:8, fontSize:12, color:ACCENT }}>({u.nickname})</span>}
                <p style={{ margin:"3px 0 0", fontSize:11, color:"rgba(200,190,170,.4)", wordBreak:"break-all" }}>Token: {u.token?.slice(0,24)}...</p>
              </div>
              <div style={{ display:"flex", gap:6 }}>
                <Btn onClick={() => { setEditId(editId===u.id?null:u.id); setNickInput(u.nickname||""); setLoyaltyInput(String(u.loyaltyAdjustment||0)) }}>
                  <Edit2 size={13}/>
                </Btn>
                <Btn variant="danger" onClick={async () => { if(confirm("Supprimer ?")) { await deleteUserAccount(u.id); onRefresh() } }}>
                  <Trash2 size={13}/>
                </Btn>
              </div>
            </div>
            <div style={{ display:"flex", gap:16, marginTop:6, fontSize:12, color:MUTED, flexWrap:"wrap" }}>
              <span>{u.orderCount} commandes</span>
              <span style={{ color:ACCENT }}>{u.totalSpent}€ dépensés</span>
              <span>Points: {u.loyaltyAdjustment||0}</span>
              {u.flags?.length > 0 && <span style={{ color:"#f87171" }}>Flags: {u.flags.join(", ")}</span>}
            </div>
            {editId === u.id && (
              <div style={{ marginTop:12, display:"flex", flexDirection:"column", gap:8 }}>
                <div style={{ display:"flex", gap:8 }}>
                  <Input value={nickInput} onChange={setNickInput} placeholder="Surnom admin" style={{ flex:1 }}/>
                  <Btn variant="primary" onClick={async () => { await setUserNickname(u.id, nickInput); setEditId(null); onRefresh() }}>Surnom</Btn>
                </div>
                <div style={{ display:"flex", gap:8 }}>
                  <Input value={loyaltyInput} onChange={setLoyaltyInput} type="number" placeholder="Ajustement points" style={{ flex:1 }}/>
                  <Btn variant="primary" onClick={async () => { await setLoyaltyAdjustment(u.id, Number(loyaltyInput)); setEditId(null); onRefresh() }}>Points</Btn>
                </div>
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  )
}

// ─── Verifications Tab ────────────────────────────────────────────────────────
function VerificationsTab({ verifications, onRefresh }: { verifications: any[]; onRefresh: () => void }) {
  return (
    <div>
      <p style={{ margin:"0 0 12px", fontSize:13, color:MUTED }}>{verifications.length} vérification(s)</p>
      {verifications.length === 0 && <EmptyState msg="Aucune vérification en attente."/>}
      <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
        {verifications.map(v => (
          <Card key={v.id}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                <span style={{ fontSize:14, fontWeight:600, color:TEXT }}>{v.pseudo}</span>
                <Badge label={v.status} color={v.status==="pending"?"#eab308":v.status==="approved"?"#22c55e":"#ef4444"}/>
              </div>
              {v.status === "pending" && (
                <div style={{ display:"flex", gap:8 }}>
                  <Btn onClick={async () => { await approveVerification(v.userToken); onRefresh() }}>
                    <CheckCircle2 size={12}/> Approuver
                  </Btn>
                  <Btn variant="danger" onClick={async () => { await rejectVerification(v.userToken); onRefresh() }}>
                    <X size={12}/> Rejeter
                  </Btn>
                </div>
              )}
            </div>
            <div style={{ display:"flex", gap:12, flexWrap:"wrap" }}>
              {v.photoPathname && <a href={v.photoPathname} target="_blank" rel="noopener noreferrer" style={{ fontSize:12, color:ACCENT }}>Voir photo KYC</a>}
              {v.videoPathname && <a href={v.videoPathname} target="_blank" rel="noopener noreferrer" style={{ fontSize:12, color:ACCENT }}>Voir vidéo KYC</a>}
              <span style={{ fontSize:11, color:MUTED }}>{v.siteName} · {new Date(v.createdAt).toLocaleDateString("fr-FR")}</span>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}

// ─── Recovery Tab ─────────────────────────────────────────────────────────────
function RecoveryTab({ claims, onRefresh }: { claims: any[]; onRefresh: () => void }) {
  return (
    <div>
      <p style={{ margin:"0 0 12px", fontSize:13, color:MUTED }}>{claims.length} demande(s)</p>
      {claims.length === 0 && <EmptyState msg="Aucune demande de récupération."/>}
      <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
        {claims.map(c => (
          <Card key={c.id}>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8 }}>
              <span style={{ fontSize:14, fontWeight:600, color:TEXT }}>Pseudo : {c.claimedPseudo}</span>
              <Badge label={c.status} color="#eab308"/>
            </div>
            {c.clientMessage && <p style={{ margin:"0 0 12px", fontSize:12, color:"rgba(200,190,170,.8)", lineHeight:1.5 }}>{c.clientMessage}</p>}
            {c.status === "pending_kyc" && (
              <div style={{ display:"flex", gap:8 }}>
                <Btn onClick={async () => { await resolveRecoveryClaim(c.id,"approve"); onRefresh() }}>
                  <CheckCircle2 size={12}/> Approuver
                </Btn>
                <Btn variant="danger" onClick={async () => { await resolveRecoveryClaim(c.id,"reject"); onRefresh() }}>
                  <X size={12}/> Rejeter
                </Btn>
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  )
}

// ─── Connexions Tab ───────────────────────────────────────────────────────────
function ConnectionsTab({ logs }: { logs: any[] }) {
  const [search, setSearch] = useState("")
  const filtered = logs.filter(l => l.pseudo?.toLowerCase().includes(search.toLowerCase()) || l.city?.toLowerCase().includes(search.toLowerCase()) || l.country?.toLowerCase().includes(search.toLowerCase()))

  return (
    <div>
      <div style={{ display:"flex", gap:12, marginBottom:16, alignItems:"center" }}>
        <p style={{ margin:0, fontSize:13, color:MUTED, flexShrink:0 }}>{logs.length} connexion(s)</p>
        <Input value={search} onChange={setSearch} placeholder="Filtrer par pseudo, ville, pays..." style={{ maxWidth:360 }}/>
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
        {filtered.slice(0,200).map(l => (
          <Card key={l.id} style={{ padding:"10px 16px" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:8 }}>
              <div>
                <span style={{ fontSize:13, fontWeight:600, color:TEXT }}>{l.pseudo}</span>
                {l.city && <span style={{ marginLeft:8, fontSize:12, color:MUTED }}>📍 {l.city}, {l.country}</span>}
              </div>
              <div style={{ display:"flex", gap:10, fontSize:11, color:MUTED }}>
                {l.ip && <span>IP: {l.ip}</span>}
                <span>{new Date(l.createdAt).toLocaleString("fr-FR")}</span>
              </div>
            </div>
            {l.userAgent && <p style={{ margin:"3px 0 0", fontSize:10, color:"rgba(200,190,170,.3)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{l.userAgent}</p>}
          </Card>
        ))}
        {filtered.length === 0 && <EmptyState msg="Aucune connexion."/>}
      </div>
    </div>
  )
}

// ─── News Tab ─────────────────────────────────────────────────────────────────
function NewsTab({ newsList, onRefresh }: { newsList: any[]; onRefresh: () => void }) {
  const [creating, setCreating] = useState(false)
  const [titleInput, setTitleInput] = useState("")
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (!titleInput.trim()) return
    setSaving(true)
    await createNews(titleInput.trim())
    setTitleInput(""); setCreating(false); onRefresh()
    setSaving(false)
  }

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
        <p style={{ margin:0, fontSize:13, color:MUTED }}>{newsList.length} news</p>
        <Btn onClick={() => setCreating(!creating)}><Plus size={14}/> Nouvelle news</Btn>
      </div>
      {creating && (
        <Card style={{ marginBottom:16, display:"flex", gap:8 }}>
          <Input value={titleInput} onChange={setTitleInput} placeholder="Titre de la news" style={{ flex:1 }}/>
          <Btn variant="primary" onClick={save} disabled={saving}>{saving?"...":"Créer"}</Btn>
          <Btn variant="ghost" onClick={() => setCreating(false)}>Annuler</Btn>
        </Card>
      )}
      <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
        {newsList.map(n => (
          <Card key={n.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <span style={{ fontSize:14, color:TEXT }}>{n.title}</span>
            <div style={{ display:"flex", gap:8, alignItems:"center" }}>
              <button onClick={async () => { await updateNewsActive(n.id, !n.isActive); onRefresh() }}
                style={{ padding:"4px 12px", borderRadius:8, border:`1px solid ${n.isActive?"rgba(34,197,94,.3)":BORDER}`, background:n.isActive?"rgba(34,197,94,.1)":"transparent", color:n.isActive?"#22c55e":MUTED, fontSize:12, cursor:"pointer" }}>
                {n.isActive ? "Actif" : "Inactif"}
              </button>
              <Btn variant="danger" onClick={async () => { if(confirm("Supprimer ?")) { await deleteNews(n.id); onRefresh() } }}>
                <Trash2 size={13}/>
              </Btn>
            </div>
          </Card>
        ))}
        {newsList.length === 0 && <EmptyState msg="Aucune news."/>}
      </div>
    </div>
  )
}

// ─── Whitelist Tab ────────────────────────────────────────────────────────────
function WhitelistTab() {
  const [pseudos, setPseudos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [input, setInput] = useState("")
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    const r = await fetch("/api/admin/whitelist", { credentials: "include" }).then(r=>r.json()).catch(()=>({pseudos:[]}))
    setPseudos(r.pseudos || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const add = async () => {
    if (!input.trim()) return
    setSaving(true)
    await fetch("/api/admin/whitelist", { method:"POST", credentials:"include", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ pseudo:input.trim() }) })
    setInput("")
    await load()
    setSaving(false)
  }

  const remove = async (id: number) => {
    await fetch(`/api/admin/whitelist?id=${id}`, { method:"DELETE", credentials:"include" })
    await load()
  }

  if (loading) return <div style={{ textAlign:"center", padding:40 }}><Loader2 size={24} style={{ animation:"spin 1s linear infinite", color:ACCENT }}/></div>

  return (
    <div>
      <Card style={{ marginBottom:20, display:"flex", gap:8 }}>
        <Input value={input} onChange={setInput} placeholder="Ajouter un pseudo à la whitelist" style={{ flex:1 }}/>
        <Btn variant="primary" onClick={add} disabled={saving || !input.trim()}>
          {saving ? <Loader2 size={13} style={{ animation:"spin 1s linear infinite" }}/> : <Plus size={13}/>} Ajouter
        </Btn>
      </Card>
      <p style={{ margin:"0 0 12px", fontSize:13, color:MUTED }}>{pseudos.length} pseudo(s) réservé(s)</p>
      <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
        {pseudos.map((p: any) => (
          <Card key={p.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 16px" }}>
            <span style={{ fontSize:14, fontWeight:600, color:TEXT }}>{p.pseudo}</span>
            <div style={{ display:"flex", gap:8, alignItems:"center" }}>
              <span style={{ fontSize:11, color:MUTED }}>{new Date(p.createdAt).toLocaleDateString("fr-FR")}</span>
              <Btn variant="danger" onClick={() => remove(p.id)}><Trash2 size={13}/></Btn>
            </div>
          </Card>
        ))}
        {pseudos.length === 0 && <EmptyState msg="Aucun pseudo en whitelist."/>}
      </div>
    </div>
  )
}

// ─── Staff / Admins Tab ───────────────────────────────────────────────────────
function StaffTab({ staffList, onRefresh }: { staffList: any[]; onRefresh: () => void }) {
  const [creating, setCreating] = useState(false)
  const [canAdmin, setCanAdmin] = useState(false)
  const [saving, setSaving] = useState(false)
  const [newInvite, setNewInvite] = useState("")

  const create = async () => {
    setSaving(true)
    const res = await createStaffInvite({ canAdmin })
    if (res.ok) { setNewInvite(res.inviteToken!); setCreating(false); onRefresh() }
    setSaving(false)
  }

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
        <p style={{ margin:0, fontSize:13, color:MUTED }}>{staffList.length} membre(s)</p>
        <Btn onClick={() => setCreating(!creating)}><Plus size={14}/> Inviter un admin</Btn>
      </div>
      {newInvite && (
        <Card style={{ marginBottom:16, border:"1px solid rgba(74,222,128,.25)", background:"rgba(74,222,128,.06)" }}>
          <p style={{ margin:"0 0 6px", fontSize:12, color:"#4ade80" }}>Token d&apos;invitation créé :</p>
          <code style={{ fontSize:11, wordBreak:"break-all", color:TEXT }}>{newInvite}</code>
        </Card>
      )}
      {creating && (
        <Card style={{ marginBottom:16 }}>
          <label style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12, cursor:"pointer", fontSize:13, color:TEXT }}>
            <input type="checkbox" checked={canAdmin} onChange={e => setCanAdmin(e.target.checked)}/>
            Droits admin complets
          </label>
          <Btn variant="primary" onClick={create} disabled={saving}>
            {saving ? "Création..." : "Créer l'invitation"}
          </Btn>
        </Card>
      )}
      <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
        {staffList.map(s => (
          <Card key={s.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <div>
              <span style={{ fontSize:14, color:TEXT }}>{s.pseudo || "Invitation en attente"}</span>
              <Badge label={s.canAdmin ? "Admin" : "Staff"} color={s.canAdmin ? ACCENT : MUTED}/>
              {!s.inviteUsed && <span style={{ marginLeft:8, fontSize:10, color:"rgba(200,190,170,.35)" }}>invite: {s.inviteToken?.slice(0,16)}...</span>}
            </div>
            <Btn variant="danger" onClick={async () => { await deleteStaffMember(s.id); onRefresh() }}>Révoquer</Btn>
          </Card>
        ))}
        {staffList.length === 0 && <EmptyState msg="Aucun admin/staff."/>}
      </div>
    </div>
  )
}

// ─── Profits Tab ─────────────────────────────────────────────────────────────
function ProfitsTab({ profit, orders, users }: { profit: any; orders: OrderThread[]; users: any[] }) {
  const totalRevenue = orders.filter(o=>o.status==="livree").reduce((s,o)=>s+(o.total||0),0)
  const pending = orders.filter(o=>!["livree","annule","annulee"].includes(o.status)).length
  const avgOrder = orders.length > 0 ? (orders.reduce((s,o)=>s+(o.total||0),0) / orders.length).toFixed(0) : 0
  const topShop = Object.entries(orders.reduce((acc: Record<string,number>,o)=>{ acc[o.shop]=(acc[o.shop]||0)+(o.total||0); return acc },{})).sort((a,b)=>(b[1] as number)-(a[1] as number))[0]

  return (
    <div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))", gap:16, marginBottom:28 }}>
        {[
          { label:"CA total livré", value:`${totalRevenue}€`, color:"#22c55e" },
          { label:"Commandes totales", value:orders.length, color:ACCENT },
          { label:"En cours", value:pending, color:"#a855f7" },
          { label:"Panier moyen", value:`${avgOrder}€`, color:"#3b82f6" },
          { label:"Clients", value:users.length, color:"#f97316" },
          { label:"Top shop", value:topShop?.[0]||"—", color:ACCENT },
        ].map(s => (
          <Card key={s.label} style={{ textAlign:"center", padding:"20px 16px" }}>
            <p style={{ margin:"0 0 6px", fontSize:26, fontWeight:900, color:s.color as string }}>{s.value}</p>
            <p style={{ margin:0, fontSize:11, color:MUTED, textTransform:"uppercase", letterSpacing:"0.08em" }}>{s.label}</p>
          </Card>
        ))}
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
        <Card>
          <h3 style={{ margin:"0 0 14px", fontSize:14, color:TEXT }}>CA par shop</h3>
          {Object.entries(orders.reduce((acc: Record<string,{revenue:number;count:number}>,o)=>{ if(!acc[o.shop]) acc[o.shop]={revenue:0,count:0}; acc[o.shop].revenue+=(o.total||0); acc[o.shop].count++; return acc },{}))
            .sort((a,b)=>b[1].revenue-a[1].revenue)
            .map(([shop, d]) => (
              <div key={shop} style={{ marginBottom:12 }}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4, fontSize:13 }}>
                  <span style={{ color:TEXT }}>{shop}</span>
                  <span style={{ color:ACCENT, fontWeight:700 }}>{d.revenue}€ · {d.count} cmd</span>
                </div>
                <div style={{ height:6, borderRadius:999, background:"rgba(255,202,40,.1)", overflow:"hidden" }}>
                  <div style={{ height:"100%", background:`linear-gradient(90deg,${ACCENT},${ACCENT2})`, borderRadius:999, width:`${Math.min(100,(d.revenue/Math.max(1,totalRevenue))*100)}%` }}/>
                </div>
              </div>
            ))}
        </Card>

        <Card>
          <h3 style={{ margin:"0 0 14px", fontSize:14, color:TEXT }}>Répartition par statut</h3>
          {Object.entries(orders.reduce((acc: Record<string,number>,o)=>{ acc[o.status]=(acc[o.status]||0)+1; return acc },{}))
            .sort((a,b)=>b[1]-a[1])
            .map(([status, count]) => (
              <div key={status} style={{ display:"flex", justifyContent:"space-between", padding:"7px 0", borderBottom:`1px solid ${BORDER}`, fontSize:13 }}>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <span style={{ width:8, height:8, borderRadius:"50%", background:statusColor[status]||TEXT, display:"inline-block" }}/>
                  <span style={{ color:TEXT }}>{STATUS_LABELS[status]||status}</span>
                </div>
                <span style={{ color:ACCENT, fontWeight:600 }}>{count as number}</span>
              </div>
            ))}
        </Card>
      </div>
    </div>
  )
}
