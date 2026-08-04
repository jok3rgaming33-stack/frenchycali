"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Package, Users, ShoppingBag, Bell, MessageCircle, Tag, Star,
  Plus, Trash2, Edit2, Save, X, Loader2, RefreshCw, Shield,
  LogOut, ChevronDown, ChevronUp, Send, Eye, CheckCircle2,
  BarChart2, FileText, Key, AlertTriangle,
} from "lucide-react"
import {
  listAllOrders, sendAdminMessage, updateOrderStatus,
} from "@/app/actions/order"
import { listUsers, setUserNickname, setUserFlags, setLoyaltyAdjustment, deleteUserAccount } from "@/app/actions/account"
import {
  getProducts as getAdminProducts, createProduct, updateProduct, deleteProduct,
} from "@/app/actions/products"
import { listNews, createNews, updateNewsActive, deleteNews } from "@/app/actions/news"
import { listStaff, createStaffInvite, deleteStaffMember } from "@/app/actions/staff"
import { listVerifications, approveVerification, rejectVerification } from "@/app/actions/verification"
import { listRecoveryClaims, resolveRecoveryClaim } from "@/app/actions/restore-access"
import { getThreadMessages } from "@/app/actions/order"
import { STATUS_LABELS } from "@/lib/order-status"
import type { OrderThread, Product, User as AppUser } from "@/lib/db/schema"

const ACCENT = "#ffca28"
const BORDER = "rgba(255,202,40,0.14)"
const CARD = "rgba(20,18,12,0.88)"

const STATUS_OPTIONS = [
  "nouveau","confirme","en_preparation","expedie","en_route","livree","annule",
]

type Tab = "orders" | "products" | "clients" | "verifications" | "staff" | "news" | "recovery" | "stats"

export function AdminPanel() {
  const [tab, setTab] = useState<Tab>("orders")
  const [orders, setOrders] = useState<OrderThread[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [verifications, setVerifications] = useState<any[]>([])
  const [staffList, setStaffList] = useState<any[]>([])
  const [newsList, setNewsList] = useState<any[]>([])
  const [recoveryClaims, setRecoveryClaims] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<OrderThread | null>(null)
  const [orderMessages, setOrderMessages] = useState<any[]>([])
  const [adminMsg, setAdminMsg] = useState("")
  const [sendingMsg, setSendingMsg] = useState(false)

  const loadTab = useCallback(async (t: Tab) => {
    setLoading(true)
    try {
      if (t === "orders") setOrders(await listAllOrders())
      if (t === "products") setProducts(await getAdminProducts())
      if (t === "clients") setUsers(await listUsers())
      if (t === "verifications") setVerifications(await listVerifications())
      if (t === "staff") setStaffList(await listStaff())
      if (t === "news") setNewsList(await listNews())
      if (t === "recovery") setRecoveryClaims(await listRecoveryClaims())
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
    setOrders((prev) => prev.map((o) => o.id === order.id ? { ...o, status } : o))
    if (selectedOrder?.id === order.id) setSelectedOrder({ ...order, status })
  }

  const statusColor: Record<string, string> = {
    nouveau: "#eab308", confirme: "#3b82f6", en_preparation: "#a855f7",
    expedie: "#6366f1", en_route: "#3b82f6", livree: "#22c55e",
    annule: "#ef4444", annulee: "#ef4444",
  }

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: "orders", label: "Commandes", icon: <ShoppingBag size={15} /> },
    { key: "products", label: "Produits", icon: <Package size={15} /> },
    { key: "clients", label: "Clients", icon: <Users size={15} /> },
    { key: "verifications", label: "KYC", icon: <Shield size={15} /> },
    { key: "staff", label: "Staff", icon: <Key size={15} /> },
    { key: "news", label: "News", icon: <Bell size={15} /> },
    { key: "recovery", label: "Récupération", icon: <AlertTriangle size={15} /> },
    { key: "stats", label: "Stats", icon: <BarChart2 size={15} /> },
  ]

  return (
    <div style={{ minHeight: "100vh", background: "#0f0d07", color: "#f5e8c7" }}>
      {/* Header */}
      <header style={{ position: "sticky", top: 0, zIndex: 20, borderBottom: `1px solid ${BORDER}`, background: "rgba(15,13,7,.95)", backdropFilter: "blur(12px)", padding: "12px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h1 style={{ margin: 0, fontFamily: "Orbitron,sans-serif", fontSize: 16, fontWeight: 900, letterSpacing: "0.15em", background: "linear-gradient(90deg,#ffca28,#e65100)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
          ADMIN — FRENCHYCALI
        </h1>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => loadTab(tab)} style={{ background: "none", border: `1px solid ${BORDER}`, borderRadius: 8, padding: "6px 10px", cursor: "pointer", color: "rgba(200,190,170,.7)" }}>
            <RefreshCw size={14} />
          </button>
          <button onClick={() => { localStorage.removeItem("authToken"); localStorage.removeItem("userPseudo"); localStorage.removeItem("isAdmin"); window.location.href = "/choix" }}
            style={{ background: "rgba(239,68,68,.1)", border: "1px solid rgba(239,68,68,.25)", borderRadius: 8, padding: "6px 12px", cursor: "pointer", color: "#f87171", fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}>
            <LogOut size={13} /> Quitter
          </button>
        </div>
      </header>

      {/* Tab nav */}
      <nav style={{ display: "flex", gap: 4, padding: "12px 16px", borderBottom: `1px solid ${BORDER}`, flexWrap: "wrap" }}>
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 10, border: `1px solid ${tab === t.key ? ACCENT : "transparent"}`, background: tab === t.key ? "rgba(255,202,40,.1)" : "transparent",
              color: tab === t.key ? ACCENT : "rgba(200,190,170,.7)", fontSize: 13, cursor: "pointer", fontWeight: tab === t.key ? 600 : 400 }}>
            {t.icon} {t.label}
          </button>
        ))}
      </nav>

      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "20px 16px" }}>
        {loading && (
          <div style={{ textAlign: "center", padding: 60 }}>
            <Loader2 style={{ width: 32, height: 32, margin: "0 auto", animation: "spin 1s linear infinite", color: ACCENT }} />
          </div>
        )}

        {/* ORDERS */}
        {!loading && tab === "orders" && !selectedOrder && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <p style={{ margin: "0 0 12px", fontSize: 13, color: "rgba(200,190,170,.6)" }}>{orders.length} commande(s)</p>
            {orders.map((order) => (
              <button key={order.id} onClick={() => openOrder(order)}
                style={{ width: "100%", textAlign: "left", padding: "14px 18px", borderRadius: 16, border: `1px solid ${BORDER}`, background: CARD, cursor: "pointer" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: "#f5e8c7" }}>#{order.id} — {order.customerName}</span>
                    <span style={{ marginLeft: 8, fontSize: 11, padding: "2px 8px", borderRadius: 999, background: `${statusColor[order.status]}22`, color: statusColor[order.status] || "#f5e8c7" }}>
                      {STATUS_LABELS[order.status] || order.status}
                    </span>
                    <span style={{ marginLeft: 8, fontSize: 11, padding: "2px 8px", borderRadius: 999, background: "rgba(255,202,40,.06)", color: "rgba(200,190,170,.6)" }}>{order.shop}</span>
                  </div>
                  <span style={{ color: ACCENT, fontWeight: 700, fontSize: 14 }}>{order.total}€</span>
                </div>
                <p style={{ margin: "4px 0 0", fontSize: 12, color: "rgba(200,190,170,.6)" }}>{order.summary.slice(0, 80)}</p>
              </button>
            ))}
          </div>
        )}

        {/* ORDER DETAIL */}
        {!loading && tab === "orders" && selectedOrder && (
          <div>
            <button onClick={() => setSelectedOrder(null)} style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer", color: ACCENT, fontSize: 13, marginBottom: 16 }}>
              ← Retour
            </button>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
              {/* Left — info + status */}
              <div style={{ borderRadius: 18, border: `1px solid ${BORDER}`, background: CARD, padding: 18, display: "flex", flexDirection: "column", gap: 14 }}>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#f5e8c7" }}>Commande #{selectedOrder.id}</h3>
                <div style={{ fontSize: 13, color: "rgba(200,190,170,.8)", display: "flex", flexDirection: "column", gap: 4 }}>
                  <span><strong style={{ color: "#f5e8c7" }}>Client :</strong> {selectedOrder.customerName}</span>
                  <span><strong style={{ color: "#f5e8c7" }}>Total :</strong> <span style={{ color: ACCENT, fontWeight: 700 }}>{selectedOrder.total}€</span></span>
                  <span><strong style={{ color: "#f5e8c7" }}>Mode :</strong> {selectedOrder.fulfillment}</span>
                  {selectedOrder.address && <span><strong style={{ color: "#f5e8c7" }}>Adresse :</strong> {selectedOrder.address}</span>}
                  {selectedOrder.scheduledDate && <span><strong style={{ color: "#f5e8c7" }}>Date :</strong> {selectedOrder.scheduledDate} {selectedOrder.scheduledSlot}</span>}
                  <span><strong style={{ color: "#f5e8c7" }}>Shop :</strong> {selectedOrder.shop}</span>
                </div>
                <div>
                  <p style={{ margin: "0 0 6px", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(200,190,170,.6)" }}>Produits</p>
                  <p style={{ margin: 0, fontSize: 13, color: "rgba(200,190,170,.85)", lineHeight: 1.6 }}>{selectedOrder.summary}</p>
                </div>
                <div>
                  <p style={{ margin: "0 0 6px", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(200,190,170,.6)" }}>Statut</p>
                  <select value={selectedOrder.status} onChange={(e) => changeStatus(selectedOrder, e.target.value)}
                    style={{ width: "100%", padding: "9px 12px", borderRadius: 10, border: `1px solid ${BORDER}`, background: "#1a1810", color: "#f5e8c7", fontSize: 13, cursor: "pointer", outline: "none" }}>
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>{STATUS_LABELS[s] || s}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Right — messages */}
              <div style={{ borderRadius: 18, border: `1px solid ${BORDER}`, background: CARD, overflow: "hidden", display: "flex", flexDirection: "column" }}>
                <div style={{ padding: "12px 16px", borderBottom: `1px solid ${BORDER}`, fontSize: 13, fontWeight: 600, color: "#f5e8c7", display: "flex", alignItems: "center", gap: 6 }}>
                  <MessageCircle size={14} /> Messages
                </div>
                <div style={{ flex: 1, overflowY: "auto", padding: 12, display: "flex", flexDirection: "column", gap: 8, minHeight: 200, maxHeight: 320 }}>
                  {orderMessages.length === 0 && <p style={{ margin: "auto", fontSize: 12, color: "rgba(200,190,170,.4)", textAlign: "center" }}>Aucun message</p>}
                  {orderMessages.map((m) => (
                    <div key={m.id} style={{ display: "flex", justifyContent: m.sender === "vendeur" ? "flex-end" : "flex-start" }}>
                      <div style={{ maxWidth: "75%", padding: "8px 12px", borderRadius: 12, background: m.sender === "vendeur" ? "rgba(255,202,40,.12)" : "rgba(255,255,255,.06)", border: `1px solid ${BORDER}` }}>
                        <p style={{ margin: "0 0 2px", fontSize: 13, color: "#f5e8c7" }}>{m.body}</p>
                        <p style={{ margin: 0, fontSize: 10, color: "rgba(200,190,170,.4)" }}>{m.sender} · {new Date(m.createdAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ padding: "10px 12px", borderTop: `1px solid ${BORDER}`, display: "flex", gap: 8 }}>
                  <input value={adminMsg} onChange={(e) => setAdminMsg(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) sendMsg() }}
                    placeholder="Répondre..." style={{ flex: 1, padding: "9px 12px", borderRadius: 999, border: `1px solid ${BORDER}`, background: "rgba(0,0,0,.4)", color: "#f5e8c7", fontSize: 13, outline: "none", fontFamily: "inherit" }} />
                  <button onClick={sendMsg} disabled={sendingMsg || !adminMsg.trim()}
                    style={{ borderRadius: 999, padding: "9px 14px", background: ACCENT, border: "none", cursor: "pointer", opacity: sendingMsg || !adminMsg.trim() ? 0.5 : 1 }}>
                    {sendingMsg ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite", color: "#000" }} /> : <Send size={14} color="#000" />}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* PRODUCTS */}
        {!loading && tab === "products" && (
          <ProductsTab products={products} onRefresh={() => loadTab("products")} />
        )}

        {/* CLIENTS */}
        {!loading && tab === "clients" && (
          <ClientsTab users={users} onRefresh={() => loadTab("clients")} />
        )}

        {/* KYC VERIFICATIONS */}
        {!loading && tab === "verifications" && (
          <VerificationsTab verifications={verifications} onRefresh={() => loadTab("verifications")} />
        )}

        {/* STAFF */}
        {!loading && tab === "staff" && (
          <StaffTab staffList={staffList} onRefresh={() => loadTab("staff")} />
        )}

        {/* NEWS */}
        {!loading && tab === "news" && (
          <NewsTab newsList={newsList} onRefresh={() => loadTab("news")} />
        )}

        {/* RECOVERY CLAIMS */}
        {!loading && tab === "recovery" && (
          <RecoveryTab claims={recoveryClaims} onRefresh={() => loadTab("recovery")} />
        )}

        {/* STATS */}
        {!loading && tab === "stats" && (
          <StatsTab orders={orders} users={users} />
        )}
      </main>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

// ─── Products Tab ───────────────────────────────────────────────────────────
function ProductsTab({ products, onRefresh }: { products: Product[]; onRefresh: () => void }) {
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ title: "", section: "featured", region: "both", description: "", fullDescription: "", image: "", stock: 10, variants: "[]", badges: "[]", discountType: "", discountValue: "", sortOrder: 0 })
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    try {
      let variants = []
      try { variants = JSON.parse(form.variants) } catch { variants = [] }
      let badges = []
      try { badges = JSON.parse(form.badges) } catch { badges = [] }
      await createProduct({
        title: form.title, section: form.section, region: form.region,
        description: form.description, fullDescription: form.fullDescription,
        image: form.image || undefined, stock: Number(form.stock),
        variants, badges,
        discountType: form.discountType || undefined, discountValue: form.discountValue ? Number(form.discountValue) : undefined,
        sortOrder: Number(form.sortOrder),
      })
      setCreating(false)
      setForm({ title: "", section: "featured", region: "both", description: "", fullDescription: "", image: "", stock: 10, variants: "[]", badges: "[]", discountType: "", discountValue: "", sortOrder: 0 })
      onRefresh()
    } finally { setSaving(false) }
  }

  const del = async (id: number) => {
    if (!confirm("Supprimer ce produit ?")) return
    await deleteProduct(id); onRefresh()
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <p style={{ margin: 0, fontSize: 13, color: "rgba(200,190,170,.6)" }}>{products.length} produit(s)</p>
        <button onClick={() => setCreating(!creating)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 10, border: `1px solid ${ACCENT}`, background: "rgba(255,202,40,.08)", color: ACCENT, fontSize: 13, cursor: "pointer" }}>
          <Plus size={14} /> Nouveau produit
        </button>
      </div>

      {creating && (
        <div style={{ borderRadius: 18, border: `1px solid ${BORDER}`, background: CARD, padding: 20, marginBottom: 20 }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 14, color: "#f5e8c7" }}>Nouveau produit</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {[
              { key: "title", label: "Nom" },
              { key: "section", label: "Section" },
              { key: "image", label: "Image URL" },
              { key: "stock", label: "Stock" },
              { key: "sortOrder", label: "Ordre tri" },
            ].map(({ key, label }) => (
              <div key={key}>
                <label style={{ display: "block", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(200,190,170,.6)", marginBottom: 4 }}>{label}</label>
                <input value={(form as any)[key]} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  style={{ width: "100%", padding: "9px 12px", borderRadius: 10, border: `1px solid ${BORDER}`, background: "#1a1810", color: "#f5e8c7", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
              </div>
            ))}
            <div>
              <label style={{ display: "block", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(200,190,170,.6)", marginBottom: 4 }}>Région</label>
              <select value={form.region} onChange={(e) => setForm((f) => ({ ...f, region: e.target.value }))}
                style={{ width: "100%", padding: "9px 12px", borderRadius: 10, border: `1px solid ${BORDER}`, background: "#1a1810", color: "#f5e8c7", fontSize: 13, outline: "none" }}>
                <option value="both">31 + 94</option>
                <option value="31">31 seulement</option>
                <option value="94">94 seulement</option>
                <option value="delivery">CaliDelivery</option>
              </select>
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            <label style={{ display: "block", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(200,190,170,.6)", marginBottom: 4 }}>Description courte</label>
            <input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              style={{ width: "100%", padding: "9px 12px", borderRadius: 10, border: `1px solid ${BORDER}`, background: "#1a1810", color: "#f5e8c7", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
          </div>
          <div style={{ marginTop: 12 }}>
            <label style={{ display: "block", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(200,190,170,.6)", marginBottom: 4 }}>Variantes JSON — ex: [{`{"qty":5,"price":30}`}]</label>
            <textarea value={form.variants} onChange={(e) => setForm((f) => ({ ...f, variants: e.target.value }))} rows={2}
              style={{ width: "100%", padding: "9px 12px", borderRadius: 10, border: `1px solid ${BORDER}`, background: "#1a1810", color: "#f5e8c7", fontSize: 12, outline: "none", resize: "vertical", fontFamily: "monospace", boxSizing: "border-box" }} />
          </div>
          <div style={{ marginTop: 16, display: "flex", gap: 10 }}>
            <button onClick={save} disabled={saving} style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 20px", borderRadius: 10, background: "linear-gradient(120deg,#ffca28,#e65100)", border: "none", color: "#000", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
              {saving ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Save size={14} />} Enregistrer
            </button>
            <button onClick={() => setCreating(false)} style={{ padding: "10px 20px", borderRadius: 10, border: `1px solid ${BORDER}`, background: "transparent", color: "rgba(200,190,170,.7)", fontSize: 13, cursor: "pointer" }}>
              Annuler
            </button>
          </div>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {products.map((p) => (
          <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderRadius: 14, border: `1px solid ${BORDER}`, background: CARD }}>
            {p.image && <img src={p.image} alt={p.title} style={{ width: 44, height: 44, borderRadius: 10, objectFit: "cover", flexShrink: 0 }} />}
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "#f5e8c7" }}>{p.title}</p>
              <p style={{ margin: "2px 0 0", fontSize: 11, color: "rgba(200,190,170,.6)" }}>{p.section} — région: {p.region} — stock: {p.stock}</p>
            </div>
            <button onClick={() => del(p.id)} style={{ background: "rgba(239,68,68,.1)", border: "1px solid rgba(239,68,68,.2)", borderRadius: 8, padding: "5px 10px", cursor: "pointer", color: "#f87171" }}>
              <Trash2 size={13} />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Clients Tab ────────────────────────────────────────────────────────────
function ClientsTab({ users, onRefresh }: { users: any[]; onRefresh: () => void }) {
  const [editId, setEditId] = useState<number | null>(null)
  const [nickInput, setNickInput] = useState("")
  const [loyaltyInput, setLoyaltyInput] = useState("")

  const saveNick = async (id: number) => {
    await setUserNickname(id, nickInput)
    setEditId(null); onRefresh()
  }
  const saveLoyalty = async (id: number) => {
    await setLoyaltyAdjustment(id, Number(loyaltyInput))
    setEditId(null); onRefresh()
  }
  const delUser = async (id: number) => {
    if (!confirm("Supprimer ce client ?")) return
    await deleteUserAccount(id); onRefresh()
  }

  return (
    <div>
      <p style={{ margin: "0 0 12px", fontSize: 13, color: "rgba(200,190,170,.6)" }}>{users.length} client(s)</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {users.map((u) => (
          <div key={u.id} style={{ borderRadius: 14, border: `1px solid ${BORDER}`, background: CARD, padding: "12px 16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <span style={{ fontSize: 14, fontWeight: 600, color: "#f5e8c7" }}>{u.pseudo}</span>
                {u.nickname && <span style={{ marginLeft: 8, fontSize: 12, color: ACCENT }}>({u.nickname})</span>}
                <p style={{ margin: "3px 0 0", fontSize: 11, color: "rgba(200,190,170,.5)", wordBreak: "break-all" }}>Token: {u.token.slice(0, 20)}...</p>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => { setEditId(editId === u.id ? null : u.id); setNickInput(u.nickname || ""); setLoyaltyInput(String(u.loyaltyAdjustment || 0)) }}
                  style={{ background: "rgba(255,202,40,.08)", border: `1px solid ${BORDER}`, borderRadius: 8, padding: "4px 8px", cursor: "pointer", color: ACCENT }}>
                  <Edit2 size={13} />
                </button>
                <button onClick={() => delUser(u.id)} style={{ background: "rgba(239,68,68,.08)", border: "1px solid rgba(239,68,68,.2)", borderRadius: 8, padding: "4px 8px", cursor: "pointer", color: "#f87171" }}>
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
            <div style={{ display: "flex", gap: 16, marginTop: 6, fontSize: 12, color: "rgba(200,190,170,.6)" }}>
              <span>{u.orderCount} commandes</span>
              <span>{u.totalSpent}€ dépensés</span>
              <span style={{ color: ACCENT }}>Ajustement points: {u.loyaltyAdjustment}</span>
            </div>
            {editId === u.id && (
              <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", gap: 8 }}>
                  <input value={nickInput} onChange={(e) => setNickInput(e.target.value)} placeholder="Surnom admin"
                    style={{ flex: 1, padding: "8px 12px", borderRadius: 9, border: `1px solid ${BORDER}`, background: "#1a1810", color: "#f5e8c7", fontSize: 12, outline: "none" }} />
                  <button onClick={() => saveNick(u.id)} style={{ padding: "8px 12px", borderRadius: 9, background: "rgba(255,202,40,.12)", border: `1px solid ${BORDER}`, color: ACCENT, cursor: "pointer", fontSize: 12 }}>Sauvegarder surnom</button>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <input type="number" value={loyaltyInput} onChange={(e) => setLoyaltyInput(e.target.value)} placeholder="Ajustement points"
                    style={{ flex: 1, padding: "8px 12px", borderRadius: 9, border: `1px solid ${BORDER}`, background: "#1a1810", color: "#f5e8c7", fontSize: 12, outline: "none" }} />
                  <button onClick={() => saveLoyalty(u.id)} style={{ padding: "8px 12px", borderRadius: 9, background: "rgba(255,202,40,.12)", border: `1px solid ${BORDER}`, color: ACCENT, cursor: "pointer", fontSize: 12 }}>Sauvegarder points</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Verifications Tab ──────────────────────────────────────────────────────
function VerificationsTab({ verifications, onRefresh }: { verifications: any[]; onRefresh: () => void }) {
  const approve = async (userToken: string) => { await approveVerification(userToken); onRefresh() }
  const reject = async (userToken: string) => { await rejectVerification(userToken); onRefresh() }

  return (
    <div>
      <p style={{ margin: "0 0 12px", fontSize: 13, color: "rgba(200,190,170,.6)" }}>{verifications.length} vérification(s)</p>
      {verifications.length === 0 && <p style={{ color: "rgba(200,190,170,.4)", textAlign: "center", padding: 40 }}>Aucune vérification en attente</p>}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {verifications.map((v) => (
          <div key={v.id} style={{ borderRadius: 16, border: `1px solid ${BORDER}`, background: CARD, padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div>
                <span style={{ fontSize: 14, fontWeight: 600, color: "#f5e8c7" }}>{v.pseudo}</span>
                <span style={{ marginLeft: 8, fontSize: 11, padding: "2px 8px", borderRadius: 999, background: v.status === "pending" ? "rgba(234,179,8,.15)" : v.status === "approved" ? "rgba(34,197,94,.15)" : "rgba(239,68,68,.15)", color: v.status === "pending" ? "#eab308" : v.status === "approved" ? "#22c55e" : "#ef4444" }}>
                  {v.status}
                </span>
              </div>
              {v.status === "pending" && (
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => approve(v.userToken)} style={{ display: "flex", alignItems: "center", gap: 4, padding: "6px 12px", borderRadius: 9, background: "rgba(34,197,94,.1)", border: "1px solid rgba(34,197,94,.25)", color: "#22c55e", cursor: "pointer", fontSize: 12 }}>
                    <CheckCircle2 size={12} /> Approuver
                  </button>
                  <button onClick={() => reject(v.userToken)} style={{ display: "flex", alignItems: "center", gap: 4, padding: "6px 12px", borderRadius: 9, background: "rgba(239,68,68,.1)", border: "1px solid rgba(239,68,68,.25)", color: "#f87171", cursor: "pointer", fontSize: 12 }}>
                    <X size={12} /> Rejeter
                  </button>
                </div>
              )}
            </div>
            <div style={{ display: "flex", gap: 12 }}>
              {v.photoPathname && <a href={v.photoPathname} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: ACCENT, textDecoration: "none" }}>Voir photo KYC</a>}
              {v.videoPathname && <a href={v.videoPathname} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: ACCENT, textDecoration: "none" }}>Voir vidéo KYC</a>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Staff Tab ──────────────────────────────────────────────────────────────
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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <p style={{ margin: 0, fontSize: 13, color: "rgba(200,190,170,.6)" }}>{staffList.length} membre(s) staff</p>
        <button onClick={() => setCreating(!creating)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 10, border: `1px solid ${ACCENT}`, background: "rgba(255,202,40,.08)", color: ACCENT, fontSize: 13, cursor: "pointer" }}>
          <Plus size={14} /> Inviter staff
        </button>
      </div>
      {newInvite && (
        <div style={{ marginBottom: 16, padding: "14px 16px", borderRadius: 14, border: "1px solid rgba(74,222,128,.25)", background: "rgba(74,222,128,.08)" }}>
          <p style={{ margin: "0 0 6px", fontSize: 12, color: "#4ade80" }}>Token d&apos;invitation créé :</p>
          <code style={{ fontSize: 11, wordBreak: "break-all", color: "#f5e8c7" }}>{newInvite}</code>
        </div>
      )}
      {creating && (
        <div style={{ borderRadius: 14, border: `1px solid ${BORDER}`, background: CARD, padding: 16, marginBottom: 16 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, cursor: "pointer", fontSize: 13, color: "#f5e8c7" }}>
            <input type="checkbox" checked={canAdmin} onChange={(e) => setCanAdmin(e.target.checked)} />
            Droits admin complets
          </label>
          <button onClick={create} disabled={saving} style={{ padding: "9px 18px", borderRadius: 10, background: "linear-gradient(120deg,#ffca28,#e65100)", border: "none", color: "#000", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
            {saving ? "Création..." : "Créer l'invitation"}
          </button>
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {staffList.map((s) => (
          <div key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderRadius: 14, border: `1px solid ${BORDER}`, background: CARD }}>
            <div>
              <span style={{ fontSize: 14, color: "#f5e8c7" }}>{s.pseudo || "Invitation en attente"}</span>
              <span style={{ marginLeft: 8, fontSize: 11, color: s.canAdmin ? ACCENT : "rgba(200,190,170,.6)" }}>{s.canAdmin ? "Admin" : "Staff"}</span>
              {!s.inviteUsed && <span style={{ marginLeft: 8, fontSize: 10, color: "rgba(200,190,170,.4)" }}>invite: {s.inviteToken?.slice(0, 16)}...</span>}
            </div>
            <button onClick={async () => { await deleteStaffMember(s.id); onRefresh() }} style={{ padding: "5px 10px", borderRadius: 8, background: "rgba(239,68,68,.08)", border: "1px solid rgba(239,68,68,.2)", color: "#f87171", cursor: "pointer", fontSize: 12 }}>
              Révoquer
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── News Tab ────────────────────────────────────────────────────────────────
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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <p style={{ margin: 0, fontSize: 13, color: "rgba(200,190,170,.6)" }}>{newsList.length} news</p>
        <button onClick={() => setCreating(!creating)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 10, border: `1px solid ${ACCENT}`, background: "rgba(255,202,40,.08)", color: ACCENT, fontSize: 13, cursor: "pointer" }}>
          <Plus size={14} /> Nouvelle news
        </button>
      </div>
      {creating && (
        <div style={{ borderRadius: 14, border: `1px solid ${BORDER}`, background: CARD, padding: 16, marginBottom: 16, display: "flex", gap: 8 }}>
          <input value={titleInput} onChange={(e) => setTitleInput(e.target.value)} placeholder="Titre de la news"
            style={{ flex: 1, padding: "9px 12px", borderRadius: 10, border: `1px solid ${BORDER}`, background: "#1a1810", color: "#f5e8c7", fontSize: 13, outline: "none" }} />
          <button onClick={save} disabled={saving} style={{ padding: "9px 16px", borderRadius: 10, background: "linear-gradient(120deg,#ffca28,#e65100)", border: "none", color: "#000", fontWeight: 700, cursor: "pointer" }}>
            {saving ? "..." : "Créer"}
          </button>
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {newsList.map((n) => (
          <div key={n.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderRadius: 14, border: `1px solid ${BORDER}`, background: CARD }}>
            <span style={{ fontSize: 14, color: "#f5e8c7" }}>{n.title}</span>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button onClick={async () => { await updateNewsActive(n.id, !n.isActive); onRefresh() }}
                style={{ padding: "4px 12px", borderRadius: 8, border: `1px solid ${n.isActive ? "rgba(34,197,94,.3)" : BORDER}`, background: n.isActive ? "rgba(34,197,94,.1)" : "transparent", color: n.isActive ? "#22c55e" : "rgba(200,190,170,.6)", fontSize: 12, cursor: "pointer" }}>
                {n.isActive ? "Actif" : "Inactif"}
              </button>
              <button onClick={async () => { if (confirm("Supprimer ?")) { await deleteNews(n.id); onRefresh() } }}
                style={{ padding: "4px 8px", borderRadius: 8, background: "rgba(239,68,68,.08)", border: "1px solid rgba(239,68,68,.2)", color: "#f87171", cursor: "pointer" }}>
                <Trash2 size={12} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Recovery Tab ────────────────────────────────────────────────────────────
function RecoveryTab({ claims, onRefresh }: { claims: any[]; onRefresh: () => void }) {
  const resolve = async (id: number, action: "approve" | "reject") => {
    await resolveRecoveryClaim(id, action)
    onRefresh()
  }

  return (
    <div>
      <p style={{ margin: "0 0 12px", fontSize: 13, color: "rgba(200,190,170,.6)" }}>{claims.length} demande(s)</p>
      {claims.length === 0 && <p style={{ color: "rgba(200,190,170,.4)", textAlign: "center", padding: 40 }}>Aucune demande de récupération</p>}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {claims.map((c) => (
          <div key={c.id} style={{ borderRadius: 16, border: `1px solid ${BORDER}`, background: CARD, padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: "#f5e8c7" }}>Pseudo : {c.claimedPseudo}</span>
              <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 999, background: "rgba(234,179,8,.12)", color: "#eab308" }}>{c.status}</span>
            </div>
            {c.clientMessage && <p style={{ margin: "0 0 12px", fontSize: 12, color: "rgba(200,190,170,.8)", lineHeight: 1.5 }}>{c.clientMessage}</p>}
            {c.status === "pending_kyc" && (
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => resolve(c.id, "approve")} style={{ display: "flex", alignItems: "center", gap: 4, padding: "6px 12px", borderRadius: 9, background: "rgba(34,197,94,.1)", border: "1px solid rgba(34,197,94,.25)", color: "#22c55e", cursor: "pointer", fontSize: 12 }}>
                  <CheckCircle2 size={12} /> Approuver
                </button>
                <button onClick={() => resolve(c.id, "reject")} style={{ display: "flex", alignItems: "center", gap: 4, padding: "6px 12px", borderRadius: 9, background: "rgba(239,68,68,.1)", border: "1px solid rgba(239,68,68,.25)", color: "#f87171", cursor: "pointer", fontSize: 12 }}>
                  <X size={12} /> Rejeter
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Stats Tab ───────────────────────────────────────────────────────────────
function StatsTab({ orders, users }: { orders: OrderThread[]; users: any[] }) {
  const totalRevenue = orders.filter((o) => o.status === "livree").reduce((s, o) => s + (o.total ?? 0), 0)
  const pending = orders.filter((o) => !["livree", "annule", "annulee"].includes(o.status)).length
  const shops = orders.reduce((acc: Record<string, number>, o) => { acc[o.shop] = (acc[o.shop] || 0) + 1; return acc }, {})

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: 16, marginBottom: 24 }}>
        {[
          { label: "CA livré", value: `${totalRevenue}€`, accent: true },
          { label: "Commandes totales", value: orders.length },
          { label: "En cours", value: pending },
          { label: "Clients", value: users.length },
        ].map((s) => (
          <div key={s.label} style={{ borderRadius: 18, border: `1px solid ${BORDER}`, background: CARD, padding: "20px 18px", textAlign: "center" }}>
            <p style={{ margin: "0 0 6px", fontSize: 28, fontWeight: 900, color: s.accent ? ACCENT : "#f5e8c7" }}>{s.value}</p>
            <p style={{ margin: 0, fontSize: 12, color: "rgba(200,190,170,.6)" }}>{s.label}</p>
          </div>
        ))}
      </div>
      <div style={{ borderRadius: 18, border: `1px solid ${BORDER}`, background: CARD, padding: 18 }}>
        <h3 style={{ margin: "0 0 12px", fontSize: 14, color: "#f5e8c7" }}>Commandes par shop</h3>
        {Object.entries(shops).map(([shop, count]) => (
          <div key={shop} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${BORDER}`, fontSize: 13 }}>
            <span style={{ color: "rgba(200,190,170,.8)" }}>{shop}</span>
            <span style={{ color: ACCENT, fontWeight: 700 }}>{count}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
