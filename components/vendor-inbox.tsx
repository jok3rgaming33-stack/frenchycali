"use client"

import { useState, useEffect, useRef } from "react"
import type { OrderThread } from "@/lib/db/schema"
import {
  VENDOR_STATUS_OPTIONS,
  VENDOR_LOCKER_STATUS_OPTIONS,
  statusMeta,
  isClosedStatus,
  normalizeStatus,
} from "@/lib/order-status"
import { listAllOrders, updateOrderStatus, sendAdminMessage, getThreadMessages } from "@/app/actions/order"
import { MessageBody } from "@/components/message-body"
import { Send, RefreshCw } from "lucide-react"

interface Props {
  initialThreads: OrderThread[]
  mode: "orders" | "locker" | "past" | "messages"
  /** Ouvre automatiquement ce fil (ex. récupération clé perdue). */
  initialThreadId?: number | null
}

const ACCENT = "#ffca28"
const BORDER = "rgba(255,202,40,.16)"
const BG_CARD = "rgba(20,18,12,.88)"

const ORDER_STATUSES = [...VENDOR_STATUS_OPTIONS]
const LOCKER_STATUSES = [...VENDOR_LOCKER_STATUS_OPTIONS]

export function VendorInbox({ initialThreads, mode, initialThreadId = null }: Props) {
  const [threads, setThreads] = useState<OrderThread[]>(initialThreads)
  const [selected, setSelected] = useState<OrderThread | null>(() => {
    if (initialThreadId == null) return null
    return initialThreads.find((t) => t.id === initialThreadId) ?? null
  })
  const [messages, setMessages] = useState<{ id: number; sender: string; body: string; createdAt: Date | string }[]>([])
  const [newMsg, setNewMsg] = useState("")
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(false)
  const [statusLoading, setStatusLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const msgEndRef = useRef<HTMLDivElement>(null)

  const refresh = async () => {
    setLoading(true)
    try { setThreads(await listAllOrders()) } catch {} finally { setLoading(false) }
  }

  const loadMsgs = async (threadId: number) => {
    try {
      const msgs = await getThreadMessages(threadId)
      setMessages(msgs)
      setTimeout(() => msgEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100)
    } catch {}
  }

  useEffect(() => {
    if (initialThreadId == null) return
    const found = threads.find((t) => t.id === initialThreadId)
    if (found) setSelected(found)
  }, [initialThreadId, threads])

  useEffect(() => {
    if (!selected) return
    loadMsgs(selected.id)
    const iv = setInterval(() => loadMsgs(selected.id), 8000)
    return () => clearInterval(iv)
  }, [selected?.id])

  const handleSend = async () => {
    if (!newMsg.trim() || !selected) return
    setSending(true)
    try {
      await sendAdminMessage(selected.id, newMsg.trim())
      setNewMsg("")
      await loadMsgs(selected.id)
    } catch {} finally { setSending(false) }
  }

  const handleStatus = async (threadId: number, status: string) => {
    setStatusLoading(true)
    try {
      await updateOrderStatus(threadId, status)
      setThreads((prev) => prev.map((t) => t.id === threadId ? { ...t, status } : t))
      if (selected?.id === threadId) {
        setSelected((s) => s ? { ...s, status } : s)
        await loadMsgs(threadId)
      }
    } catch {} finally { setStatusLoading(false) }
  }

  const statusOptions =
    selected?.fulfillment === "locker" || mode === "locker" ? LOCKER_STATUSES : ORDER_STATUSES

  const filtered = threads.filter((t) => {
    const matchSearch = !searchTerm || t.customerName.toLowerCase().includes(searchTerm.toLowerCase()) || t.summary.toLowerCase().includes(searchTerm.toLowerCase()) || (t.products ?? "").toLowerCase().includes(searchTerm.toLowerCase()) || t.trackingToken.includes(searchTerm)
    if (!matchSearch) return false
    if (t.status === "trk_token") return mode === "messages"
    if (mode === "orders") return t.fulfillment !== "locker" && !isClosedStatus(t.status)
    if (mode === "locker") return t.fulfillment === "locker" && !isClosedStatus(t.status)
    if (mode === "past") return isClosedStatus(t.status)
    return true
  })

  if (selected) {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 20, minHeight: "70vh" }}>
        {/* Thread detail */}
        <div style={{ borderRadius: 20, border: `1px solid ${BORDER}`, background: BG_CARD, display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "16px 20px", borderBottom: `1px solid ${BORDER}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
              <div>
                <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", cursor: "pointer", color: ACCENT, fontSize: 12, marginBottom: 6, padding: 0 }}>← Retour</button>
                <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#f5e8c7" }}>{selected.customerName}</h2>
                <p style={{ margin: "3px 0 0", fontSize: 12, color: "rgba(200,190,170,.75)", whiteSpace: "pre-wrap", lineHeight: 1.45 }}>{selected.summary}</p>
                {selected.products && (
                  <p style={{ margin: "6px 0 0", fontSize: 12, color: "rgba(200,190,170,.65)" }}>{selected.products}</p>
                )}
                <p style={{ margin: "3px 0 0", fontSize: 11, color: ACCENT, fontWeight: 700 }}>{selected.total}€ · {selected.fulfillment} · #{selected.trackingToken.slice(0, 12)}</p>
                {selected.address && <p style={{ margin: "4px 0 0", fontSize: 11, color: "rgba(200,190,170,.6)" }}>📍 {selected.address}</p>}
                {(selected.paymentStatus || selected.paymentProvider) && (
                  <p style={{ margin: "6px 0 0", fontSize: 11, color: "rgba(200,190,170,.85)" }}>
                    💳 Paiement :{" "}
                    <strong style={{
                      color:
                        selected.paymentStatus === "confirmed" || selected.paymentStatus === "finished"
                          ? "#4ade80"
                          : selected.paymentStatus === "failed" || selected.paymentStatus === "expired"
                            ? "#f87171"
                            : "#7dd3fc",
                    }}>
                      {selected.paymentStatus === "confirmed" || selected.paymentStatus === "finished"
                        ? "Payé"
                        : selected.paymentStatus === "failed"
                          ? "Échoué"
                          : selected.paymentStatus === "expired"
                            ? "Expiré"
                            : selected.paymentStatus === "partial" || selected.paymentStatus === "partially_paid"
                              ? "Partiel"
                              : "En attente"}
                    </strong>
                    {selected.paymentCrypto ? ` · ${String(selected.paymentCrypto).toUpperCase()}` : ""}
                    {selected.paymentPayUrl && selected.paymentStatus !== "confirmed" && selected.paymentStatus !== "finished" ? (
                      <>
                        {" · "}
                        <a href={selected.paymentPayUrl} target="_blank" rel="noopener noreferrer" style={{ color: ACCENT }}>
                          Lien paiement
                        </a>
                      </>
                    ) : null}
                  </p>
                )}
              </div>
              <select
                value={statusOptions.includes(selected.status as typeof statusOptions[number]) ? selected.status : normalizeStatus(selected.status)}
                onChange={(e) => handleStatus(selected.id, e.target.value)}
                disabled={statusLoading}
                style={{ padding: "8px 12px", borderRadius: 12, border: `1px solid ${BORDER}`, background: "#1a1710", color: "#f5e8c7", fontSize: 12, cursor: "pointer" }}
              >
                {statusOptions.map((s) => (
                  <option key={s} value={s}>{statusMeta(s).label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 10, minHeight: 300 }}>
            {messages.map((m) => (
              <div key={m.id} style={{ display: "flex", justifyContent: m.sender === "vendeur" ? "flex-end" : "flex-start" }}>
                <div style={{ maxWidth: "75%", padding: "10px 14px", borderRadius: m.sender === "vendeur" ? "18px 18px 4px 18px" : "18px 18px 18px 4px", background: m.sender === "vendeur" ? "linear-gradient(135deg,#ffca28,#e65100)" : "rgba(40,38,30,.9)", border: m.sender === "vendeur" ? "none" : `1px solid ${BORDER}`, color: m.sender === "vendeur" ? "#0f0d07" : "#f5e8c7", fontSize: 13, whiteSpace: "pre-wrap" }}>
                  <MessageBody body={m.body} />
                  <p style={{ margin: "4px 0 0", fontSize: 10, opacity: 0.6 }}>{m.sender} · {new Date(m.createdAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</p>
                </div>
              </div>
            ))}
            <div ref={msgEndRef} />
          </div>

          {/* Send */}
          <div style={{ padding: "12px 16px", borderTop: `1px solid ${BORDER}`, display: "flex", gap: 8 }}>
            <input value={newMsg} onChange={(e) => setNewMsg(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) handleSend() }}
              placeholder="Répondre au client..." style={{ flex: 1, padding: "10px 14px", borderRadius: 999, border: `1px solid ${BORDER}`, background: "rgba(0,0,0,.5)", color: "#f5e8c7", fontSize: 13, outline: "none" }} />
            <button onClick={handleSend} disabled={sending || !newMsg.trim()}
              style={{ width: 42, height: 42, borderRadius: "50%", background: "linear-gradient(135deg,#ffca28,#e65100)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", opacity: sending ? 0.6 : 1 }}>
              <Send style={{ width: 16, height: 16, color: "#0f0d07" }} />
            </button>
          </div>
        </div>

        {/* Thread list sidebar */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8, overflowY: "auto", maxHeight: "70vh" }}>
          {filtered.map((t) => (
            <button key={t.id} onClick={() => setSelected(t)}
              style={{ textAlign: "left", padding: "12px 14px", borderRadius: 14, border: `1px solid ${t.id === selected.id ? ACCENT : BORDER}`, background: t.id === selected.id ? "rgba(255,202,40,.08)" : BG_CARD, cursor: "pointer" }}>
              <p style={{ margin: 0, fontWeight: 700, fontSize: 13, color: "#f5e8c7" }}>{t.customerName}</p>
              <p style={{ margin: "2px 0 0", fontSize: 11, color: "rgba(200,190,170,.6)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.summary}</p>
              <p style={{ margin: "2px 0 0", fontSize: 11, color: ACCENT }}>{t.total}€</p>
            </button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Rechercher client, produit..."
          style={{ flex: 1, minWidth: 200, padding: "9px 14px", borderRadius: 999, border: `1px solid ${BORDER}`, background: "rgba(0,0,0,.4)", color: "#f5e8c7", fontSize: 13, outline: "none" }} />
        <button onClick={refresh} disabled={loading}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 16px", borderRadius: 999, border: `1px solid ${BORDER}`, background: "transparent", color: "rgba(200,190,170,.7)", cursor: "pointer", fontSize: 13 }}>
          <RefreshCw style={{ width: 14, height: 14, animation: loading ? "spin 1s linear infinite" : "none" }} /> Actualiser
        </button>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>

      {filtered.length === 0 ? (
        <p style={{ textAlign: "center", padding: "60px 0", color: "rgba(200,190,170,.4)" }}>Aucune commande</p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(320px,1fr))", gap: 12 }}>
          {filtered.map((t) => {
            const st = statusMeta(t.status).label
            const isNew = normalizeStatus(t.status) === "en_attente"
            return (
              <button key={t.id} onClick={() => setSelected(t)}
                style={{ textAlign: "left", padding: "16px 18px", borderRadius: 16, border: `1px solid ${isNew ? ACCENT : BORDER}`, background: BG_CARD, cursor: "pointer", transition: "all .2s",
                  boxShadow: isNew ? `0 0 20px rgba(255,202,40,.15)` : "none" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                  <span style={{ fontWeight: 700, fontSize: 14, color: "#f5e8c7" }}>{t.customerName}</span>
                  <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 999, background: isNew ? "rgba(255,202,40,.15)" : "rgba(255,255,255,.06)", color: isNew ? ACCENT : "rgba(200,190,170,.7)", fontWeight: 600 }}>{st}</span>
                </div>
                <p style={{ margin: "0 0 6px", fontSize: 12, color: "rgba(200,190,170,.7)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.products || t.summary}</p>
                <div style={{ display: "flex", gap: 12, fontSize: 12 }}>
                  <span style={{ color: ACCENT, fontWeight: 700 }}>{t.total}€</span>
                  <span style={{ color: "rgba(200,190,170,.6)" }}>{t.fulfillment}</span>
                  <span style={{ color: "rgba(200,190,170,.5)", marginLeft: "auto" }}>{new Date(t.createdAt).toLocaleDateString("fr-FR")}</span>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
