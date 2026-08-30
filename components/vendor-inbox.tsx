"use client"

import { useState, useEffect, useRef } from "react"
import type { OrderThread } from "@/lib/db/schema"
import {
  VENDOR_STATUS_OPTIONS,
  VENDOR_LOCKER_STATUS_OPTIONS,
  statusMeta,
  isClosedStatus,
  normalizeStatus,
  isDiscussionStatus,
} from "@/lib/order-status"
import { listAllOrders, updateOrderStatus, sendAdminMessage, getThreadMessages } from "@/app/actions/order"
import { confirmDeposit, markParcelShipped, deleteOrderThread, deleteOrderThreads } from "@/app/actions/messaging"
import { MessageBody } from "@/components/message-body"
import { Send, RefreshCw, CheckCircle2, Loader2, Truck, Trash2 } from "lucide-react"
import { isParcelFulfillment, type ShopId } from "@/lib/shops"

interface Props {
  initialThreads: OrderThread[]
  mode: "orders" | "locker" | "past" | "messages"
  /** Ouvre automatiquement ce fil (ex. récupération clé perdue). */
  initialThreadId?: number | null
  /** Filtre boutique (panels indépendants). */
  shop?: ShopId
}

const ACCENT = "#ffca28"
const BORDER = "rgba(255,202,40,.16)"
const BG_CARD = "rgba(20,18,12,.88)"

const ORDER_STATUSES = [...VENDOR_STATUS_OPTIONS]
const LOCKER_STATUSES = [...VENDOR_LOCKER_STATUS_OPTIONS]

export function VendorInbox({ initialThreads, mode, initialThreadId = null, shop }: Props) {
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
  const [confirmPayLoading, setConfirmPayLoading] = useState(false)
  const [shipLoading, setShipLoading] = useState(false)
  const [shipTracking, setShipTracking] = useState("")
  const [shipError, setShipError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const msgEndRef = useRef<HTMLDivElement>(null)

  const canDeleteThreads = mode === "past" || mode === "messages"

  // Sync si le serveur renvoie de nouvelles commandes (navigation / revalidate)
  useEffect(() => {
    setThreads(initialThreads)
  }, [initialThreads])

  const refresh = async () => {
    setLoading(true)
    try { setThreads(await listAllOrders(shop)) } catch {} finally { setLoading(false) }
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

  const handleConfirmVirement = async () => {
    if (!selected || confirmPayLoading) return
    setConfirmPayLoading(true)
    try {
      await confirmDeposit(selected.id)
      setThreads((prev) =>
        prev.map((t) =>
          t.id === selected.id
            ? { ...t, depositConfirmed: true, depositNotified: true, status: "preparation", paymentStatus: "confirmed" }
            : t,
        ),
      )
      setSelected((s) =>
        s
          ? {
              ...s,
              depositConfirmed: true,
              depositNotified: true,
              status: "preparation",
              paymentStatus: "confirmed",
            }
          : s,
      )
      await loadMsgs(selected.id)
    } catch {
      /* ignore */
    } finally {
      setConfirmPayLoading(false)
    }
  }

  const handleDeleteThread = async (threadId: number) => {
    const label = mode === "messages" ? "ce fil de messagerie" : "cette commande clôturée"
    if (!window.confirm(`Supprimer définitivement ${label} #${threadId} ?\nCette action est irréversible.`)) return
    setDeletingId(threadId)
    try {
      const res = await deleteOrderThread(threadId)
      if (!res.ok) {
        window.alert(res.error ?? "Suppression impossible.")
        return
      }
      setThreads((prev) => prev.filter((t) => t.id !== threadId))
      setSelectedIds((prev) => {
        const next = new Set(prev)
        next.delete(threadId)
        return next
      })
      if (selected?.id === threadId) {
        setSelected(null)
        setMessages([])
      }
    } finally {
      setDeletingId(null)
    }
  }

  const toggleSelect = (id: number, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) return
    const label = mode === "messages" ? "fils" : "commandes"
    if (!window.confirm(`Supprimer définitivement ${ids.length} ${label} ?\nIrréversible.`)) return
    setBulkDeleting(true)
    try {
      const res = await deleteOrderThreads(ids)
      if (res.ok) {
        setThreads((prev) => prev.filter((t) => !selectedIds.has(t.id)))
        if (selected && selectedIds.has(selected.id)) {
          setSelected(null)
          setMessages([])
        }
        setSelectedIds(new Set())
      } else {
        window.alert(res.error ?? "Suppression impossible.")
      }
    } finally {
      setBulkDeleting(false)
    }
  }

  const handleMarkShipped = async () => {
    if (!selected || shipLoading) return
    setShipError(null)
    setShipLoading(true)
    try {
      const res = await markParcelShipped(selected.id, shipTracking)
      if (!res.ok) {
        setShipError(res.error ?? "Erreur")
        return
      }
      setThreads((prev) =>
        prev.map((t) =>
          t.id === selected.id
            ? {
                ...t,
                status: "locker_expedie",
                colissimoNumber: shipTracking.trim(),
                shippedAt: new Date(),
              }
            : t,
        ),
      )
      setSelected((s) =>
        s
          ? {
              ...s,
              status: "locker_expedie",
              colissimoNumber: shipTracking.trim(),
              shippedAt: new Date(),
            }
          : s,
      )
      setShipTracking("")
      await loadMsgs(selected.id)
    } catch {
      setShipError("Impossible d'enregistrer l'expédition.")
    } finally {
      setShipLoading(false)
    }
  }

  const isParcelThread = isParcelFulfillment(selected?.fulfillment) || mode === "locker"
  // Delivery : le select ne sert qu'à l'annulation ; le statut courant reste visible
  const statusOptions = isParcelThread
    ? Array.from(new Set([selected?.status, ...LOCKER_STATUSES].filter(Boolean) as string[]))
    : ORDER_STATUSES

  const filtered = threads.filter((t) => {
    const matchSearch = !searchTerm || t.customerName.toLowerCase().includes(searchTerm.toLowerCase()) || t.summary.toLowerCase().includes(searchTerm.toLowerCase()) || (t.products ?? "").toLowerCase().includes(searchTerm.toLowerCase()) || t.trackingToken.includes(searchTerm)
    if (!matchSearch) return false
    if (t.status === "trk_token") return mode === "messages"
    // mode locker = tous les colis (mondial_relay, chronopost, legacy locker…)
    if (mode === "orders") return !isParcelFulfillment(t.fulfillment) && !isClosedStatus(t.status)
    if (mode === "locker") return isParcelFulfillment(t.fulfillment) && !isClosedStatus(t.status)
    if (mode === "past") return isClosedStatus(t.status)
    if (mode === "messages") return isDiscussionStatus(t.status) || t.status === "trk_token"
    return true
  })

  if (selected) {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 20, minHeight: "70vh" }}>
        {/* Thread detail */}
        <div style={{ borderRadius: 20, border: `1px solid ${BORDER}`, background: BG_CARD, display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "16px 20px", borderBottom: `1px solid ${BORDER}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
              <div className="min-w-0 flex-1">
                <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", cursor: "pointer", color: ACCENT, fontSize: 12, marginBottom: 6, padding: 0 }}>← Retour</button>
                <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#f5e8c7" }}>{selected.customerName}</h2>
                <p style={{ margin: "3px 0 0", fontSize: 12, color: "rgba(200,190,170,.75)", whiteSpace: "pre-wrap", lineHeight: 1.45 }}>{selected.summary}</p>
                {selected.products && (
                  <p style={{ margin: "6px 0 0", fontSize: 12, color: "rgba(200,190,170,.65)" }}>{selected.products}</p>
                )}
                <p style={{ margin: "3px 0 0", fontSize: 11, color: ACCENT, fontWeight: 700 }}>
                  {selected.total}€ · {selected.fulfillment}
                  {selected.paymentCrypto ? ` · Paiement ${String(selected.paymentCrypto).toUpperCase()}` : ""}
                </p>
                {selected.address && <p style={{ margin: "4px 0 0", fontSize: 11, color: "rgba(200,190,170,.6)" }}>📍 {selected.address}</p>}
                {selected.colissimoNumber && (
                  <p style={{ margin: "4px 0 0", fontSize: 11, color: "rgba(200,190,170,.85)" }}>
                    🚚 Suivi : <strong>{selected.colissimoNumber}</strong>
                  </p>
                )}
                {selected.paymentCrypto && (
                  <p style={{ margin: "6px 0 0", fontSize: 11, color: "rgba(200,190,170,.85)" }}>
                    💳 {String(selected.paymentCrypto).toUpperCase()} —{" "}
                    <strong style={{ color: selected.depositConfirmed ? "#4ade80" : selected.depositNotified ? "#fbbf24" : "#7dd3fc" }}>
                      {selected.depositConfirmed ? "Virement reçu" : selected.depositNotified ? "Virement signalé" : "En attente de paiement"}
                    </strong>
                  </p>
                )}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
                {!canDeleteThreads && (
                  <select
                    value={statusOptions.includes(selected.status) ? selected.status : normalizeStatus(selected.status)}
                    onChange={(e) => handleStatus(selected.id, e.target.value)}
                    disabled={statusLoading}
                    title={isParcelThread ? "Annulation uniquement — le reste du flux passe par les boutons" : undefined}
                    style={{ padding: "8px 12px", borderRadius: 12, border: `1px solid ${BORDER}`, background: "#1a1710", color: "#f5e8c7", fontSize: 12, cursor: "pointer", maxWidth: 180 }}
                  >
                    {statusOptions.map((s) => (
                      <option key={s} value={s}>{statusMeta(s).label}</option>
                    ))}
                  </select>
                )}
                {canDeleteThreads && (
                  <button
                    type="button"
                    onClick={() => handleDeleteThread(selected.id)}
                    disabled={deletingId === selected.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "8px 12px",
                      borderRadius: 12,
                      border: "1px solid rgba(239,68,68,.45)",
                      background: "rgba(239,68,68,.12)",
                      color: "#f87171",
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: "pointer",
                      opacity: deletingId === selected.id ? 0.6 : 1,
                    }}
                  >
                    {deletingId === selected.id ? (
                      <Loader2 style={{ width: 14, height: 14, animation: "spin 1s linear infinite" }} />
                    ) : (
                      <Trash2 style={{ width: 14, height: 14 }} />
                    )}
                    Supprimer
                  </button>
                )}
              </div>
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

          {/* Virement crypto signalé par le client */}
          {selected.depositNotified && !selected.depositConfirmed && (
            <div style={{ padding: "12px 16px", borderTop: `1px solid ${BORDER}` }}>
              <p style={{ margin: "0 0 10px", fontSize: 12, color: "rgba(200,190,170,.85)" }}>
                Le client a signalé un virement
                {selected.paymentCrypto ? ` en ${String(selected.paymentCrypto).toUpperCase()}` : ""}.
                Vérifie puis confirme.
              </p>
              <button
                type="button"
                onClick={handleConfirmVirement}
                disabled={confirmPayLoading}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  padding: "12px 14px",
                  borderRadius: 14,
                  border: "none",
                  background: "linear-gradient(135deg,#22c55e,#16a34a)",
                  color: "#052e16",
                  fontWeight: 800,
                  fontSize: 13,
                  cursor: "pointer",
                  opacity: confirmPayLoading ? 0.7 : 1,
                }}
              >
                {confirmPayLoading ? (
                  <Loader2 style={{ width: 16, height: 16, animation: "spin 1s linear infinite" }} />
                ) : (
                  <CheckCircle2 style={{ width: 16, height: 16 }} />
                )}
                Virement reçu
              </button>
            </div>
          )}
          {selected.depositConfirmed && selected.status === "preparation" && (
            <div style={{ padding: "12px 16px", borderTop: `1px solid ${BORDER}`, display: "flex", flexDirection: "column", gap: 8 }}>
              <p style={{ margin: 0, fontSize: 12, color: "#4ade80", fontWeight: 600 }}>
                ✓ Virement confirmé — en préparation
              </p>
              <input
                value={shipTracking}
                onChange={(e) => setShipTracking(e.target.value)}
                placeholder="N° de suivi transporteur"
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: `1px solid ${BORDER}`,
                  background: "rgba(0,0,0,.45)",
                  color: "#f5e8c7",
                  fontSize: 13,
                  outline: "none",
                }}
              />
              {shipError && <p style={{ margin: 0, fontSize: 12, color: "#f87171" }}>{shipError}</p>}
              <button
                type="button"
                onClick={handleMarkShipped}
                disabled={shipLoading || !shipTracking.trim()}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  padding: "12px 14px",
                  borderRadius: 14,
                  border: "none",
                  background: "linear-gradient(135deg,#6366f1,#4f46e5)",
                  color: "#eef2ff",
                  fontWeight: 800,
                  fontSize: 13,
                  cursor: "pointer",
                  opacity: shipLoading || !shipTracking.trim() ? 0.6 : 1,
                }}
              >
                {shipLoading ? (
                  <Loader2 style={{ width: 16, height: 16, animation: "spin 1s linear infinite" }} />
                ) : (
                  <Truck style={{ width: 16, height: 16 }} />
                )}
                Colis expédié
              </button>
            </div>
          )}
          {selected.status === "locker_expedie" && (
            <div style={{ padding: "10px 16px", borderTop: `1px solid ${BORDER}`, fontSize: 12, color: "#a5b4fc", fontWeight: 600 }}>
              📦 Expédié — en attente de confirmation de réception client
              {selected.colissimoNumber ? ` · ${selected.colissimoNumber}` : ""}
            </div>
          )}

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
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Rechercher client, produit..."
          style={{ flex: 1, minWidth: 200, padding: "9px 14px", borderRadius: 999, border: `1px solid ${BORDER}`, background: "rgba(0,0,0,.4)", color: "#f5e8c7", fontSize: 13, outline: "none" }} />
        <button onClick={refresh} disabled={loading}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 16px", borderRadius: 999, border: `1px solid ${BORDER}`, background: "transparent", color: "rgba(200,190,170,.7)", cursor: "pointer", fontSize: 13 }}>
          <RefreshCw style={{ width: 14, height: 14, animation: loading ? "spin 1s linear infinite" : "none" }} /> Actualiser
        </button>
        {canDeleteThreads && selectedIds.size > 0 && (
          <button
            type="button"
            onClick={handleBulkDelete}
            disabled={bulkDeleting}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "9px 16px",
              borderRadius: 999,
              border: "1px solid rgba(239,68,68,.45)",
              background: "rgba(239,68,68,.15)",
              color: "#f87171",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 700,
              opacity: bulkDeleting ? 0.6 : 1,
            }}
          >
            {bulkDeleting ? <Loader2 style={{ width: 14, height: 14, animation: "spin 1s linear infinite" }} /> : <Trash2 style={{ width: 14, height: 14 }} />}
            Supprimer ({selectedIds.size})
          </button>
        )}
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>

      {filtered.length === 0 ? (
        <p style={{ textAlign: "center", padding: "60px 0", color: "rgba(200,190,170,.4)" }}>
          {mode === "messages" ? "Aucun fil de messagerie" : "Aucune commande"}
        </p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(320px,1fr))", gap: 12 }}>
          {filtered.map((t) => {
            const st = statusMeta(t.status).label
            const isNew = normalizeStatus(t.status) === "en_attente"
            const checked = selectedIds.has(t.id)
            return (
              <div
                key={t.id}
                style={{
                  position: "relative",
                  textAlign: "left",
                  padding: "16px 18px",
                  borderRadius: 16,
                  border: `1px solid ${checked ? "#f87171" : isNew ? ACCENT : BORDER}`,
                  background: BG_CARD,
                  transition: "all .2s",
                  boxShadow: isNew ? `0 0 20px rgba(255,202,40,.15)` : "none",
                }}
              >
                {canDeleteThreads && (
                  <label
                    style={{ position: "absolute", top: 12, left: 12, zIndex: 2, cursor: "pointer" }}
                    onClick={(e) => toggleSelect(t.id, e)}
                  >
                    <input type="checkbox" checked={checked} readOnly style={{ width: 16, height: 16, accentColor: "#ef4444" }} />
                  </label>
                )}
                <button
                  type="button"
                  onClick={() => setSelected(t)}
                  style={{
                    width: "100%",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    textAlign: "left",
                    padding: canDeleteThreads ? "0 0 0 22px" : 0,
                    color: "inherit",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8, gap: 8 }}>
                    <span style={{ fontWeight: 700, fontSize: 14, color: "#f5e8c7" }}>{t.customerName}</span>
                    <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 999, background: isNew ? "rgba(255,202,40,.15)" : "rgba(255,255,255,.06)", color: isNew ? ACCENT : "rgba(200,190,170,.7)", fontWeight: 600 }}>{st}</span>
                  </div>
                  <p style={{ margin: "0 0 6px", fontSize: 12, color: "rgba(200,190,170,.7)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.products || t.summary}</p>
                  <div style={{ display: "flex", gap: 12, fontSize: 12, flexWrap: "wrap", alignItems: "center" }}>
                    {mode !== "messages" && <span style={{ color: ACCENT, fontWeight: 700 }}>{t.total}€</span>}
                    {mode !== "messages" && <span style={{ color: "rgba(200,190,170,.6)" }}>{t.fulfillment}</span>}
                    {t.depositNotified && !t.depositConfirmed && (
                      <span style={{ color: "#4ade80", fontWeight: 700 }}>Virement signalé</span>
                    )}
                    <span style={{ color: "rgba(200,190,170,.5)", marginLeft: "auto" }}>{new Date(t.createdAt).toLocaleDateString("fr-FR")}</span>
                  </div>
                </button>
                {canDeleteThreads && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      void handleDeleteThread(t.id)
                    }}
                    disabled={deletingId === t.id}
                    title="Supprimer"
                    style={{
                      position: "absolute",
                      top: 10,
                      right: 10,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: 32,
                      height: 32,
                      borderRadius: 10,
                      border: "1px solid rgba(239,68,68,.35)",
                      background: "rgba(239,68,68,.1)",
                      color: "#f87171",
                      cursor: "pointer",
                      opacity: deletingId === t.id ? 0.5 : 1,
                    }}
                  >
                    {deletingId === t.id ? (
                      <Loader2 style={{ width: 14, height: 14, animation: "spin 1s linear infinite" }} />
                    ) : (
                      <Trash2 style={{ width: 14, height: 14 }} />
                    )}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
