"use client"

import { useState, useEffect, useCallback } from "react"
import { ChevronLeft, Package, Send, Loader2, RefreshCw } from "lucide-react"
import { getOrdersByToken, getThreadMessages, sendClientMessage, updateClientLastSeen } from "@/app/actions/order"
import {
  notifyDeposit,
  confirmParcelReceived,
  reportParcelIssue,
} from "@/app/actions/messaging"
import type { OrderThread, ThreadMessage } from "@/lib/db/schema"
import { statusMeta, getParcelClientActions } from "@/lib/order-status"
import { MessageBody } from "@/components/message-body"
import { RateProductsModal } from "@/components/rate-products-modal"

interface Props {
  customerToken: string
  onBack: () => void
  accentColor: string
  cardBorder: string
}

export function OrderTracker({ customerToken, onBack, accentColor, cardBorder }: Props) {
  const [orders, setOrders] = useState<OrderThread[]>([])
  const [selected, setSelected] = useState<OrderThread | null>(null)
  const [messages, setMessages] = useState<ThreadMessage[]>([])
  const [newMsg, setNewMsg] = useState("")
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [rateThreadId, setRateThreadId] = useState<number | null>(null)
  const [depositSending, setDepositSending] = useState(false)
  const [receiveSending, setReceiveSending] = useState(false)
  const [issueSending, setIssueSending] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const list = await getOrdersByToken(customerToken)
      setOrders(list)
      setSelected((cur) => {
        if (!cur) return cur
        return list.find((o) => o.id === cur.id) ?? cur
      })
    } catch {
      /* ignore */
    } finally {
      setLoading(false)
    }
  }, [customerToken])

  useEffect(() => {
    load()
  }, [load])

  const openOrder = async (order: OrderThread) => {
    setSelected(order)
    const msgs = await getThreadMessages(order.id)
    setMessages(msgs)
    await updateClientLastSeen(order.trackingToken)
    // Rafraîchir la fiche (statut / suivi / shippedAt à jour)
    try {
      const list = await getOrdersByToken(customerToken)
      setOrders(list)
      const fresh = list.find((o) => o.id === order.id)
      if (fresh) setSelected(fresh)
    } catch {
      /* ignore */
    }
  }

  const refreshSelected = async (threadId: number) => {
    const [msgs, list] = await Promise.all([
      getThreadMessages(threadId),
      getOrdersByToken(customerToken),
    ])
    setMessages(msgs)
    setOrders(list)
    const fresh = list.find((o) => o.id === threadId)
    if (fresh) setSelected(fresh)
  }

  const sendMsg = async () => {
    if (!newMsg.trim() || !selected) return
    setSending(true)
    const res = await sendClientMessage(selected.id, newMsg.trim(), customerToken)
    if (res.ok) {
      setNewMsg("")
      await refreshSelected(selected.id)
    }
    setSending(false)
  }

  const handleDeposit = async () => {
    if (!selected || depositSending) return
    setDepositSending(true)
    try {
      await notifyDeposit(selected.id)
      await refreshSelected(selected.id)
    } finally {
      setDepositSending(false)
    }
  }

  const handleConfirmReceived = async () => {
    if (!selected || receiveSending) return
    setReceiveSending(true)
    try {
      const res = await confirmParcelReceived(selected.id, customerToken)
      if (res.ok) await refreshSelected(selected.id)
    } finally {
      setReceiveSending(false)
    }
  }

  const handleReportIssue = async () => {
    if (!selected || issueSending) return
    setIssueSending(true)
    try {
      const res = await reportParcelIssue(selected.id, customerToken)
      if (res.ok) await refreshSelected(selected.id)
    } finally {
      setIssueSending(false)
    }
  }

  const textMain = "#f5e8c7"
  const textMuted = "rgba(200,190,170,.7)"

  if (selected) {
    const actions = getParcelClientActions(selected)
    const {
      showDeposit,
      showPrepBanner,
      isShipped,
      showReceive,
      concernUnlock,
      concernEnabled,
      payLabel,
      wallet,
      depositNotified,
      tracking,
    } = actions

    return (
      <div style={{ maxWidth: 700, margin: "0 auto", padding: "20px 16px" }} className="shop-main-pad">
        <button
          type="button"
          onClick={() => setSelected(null)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            background: "none",
            border: "none",
            cursor: "pointer",
            color: accentColor,
            fontSize: 13,
            marginBottom: 16,
          }}
        >
          <ChevronLeft style={{ width: 16, height: 16 }} /> Retour
        </button>
        <div
          style={{
            borderRadius: 20,
            border: `1px solid ${cardBorder}`,
            background: "rgba(20,18,12,.88)",
            overflow: "hidden",
          }}
        >
          <div style={{ padding: "16px 20px", borderBottom: `1px solid ${cardBorder}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: textMain }}>
                Commande #{selected.id}
              </h2>
              <span
                style={{
                  fontSize: 11,
                  padding: "4px 12px",
                  borderRadius: 999,
                  background: "rgba(255,255,255,.08)",
                  color: textMain,
                  fontWeight: 600,
                  whiteSpace: "nowrap",
                }}
              >
                {statusMeta(selected.status).label}
              </span>
            </div>
            <p style={{ margin: "6px 0 0", fontSize: 12, color: textMuted, whiteSpace: "pre-wrap" }}>
              {selected.summary}
            </p>
            <p style={{ margin: "4px 0 0", fontSize: 14, fontWeight: 700, color: accentColor }}>
              {selected.total}€
              {selected.paymentCrypto ? ` · ${payLabel}` : ""}
              {selected.fulfillment ? ` · ${selected.fulfillment}` : ""}
            </p>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
              padding: 16,
              minHeight: 160,
              maxHeight: 320,
              overflowY: "auto",
            }}
          >
            {messages.length === 0 && (
              <p style={{ margin: "auto", fontSize: 13, color: "rgba(200,190,170,.5)", textAlign: "center" }}>
                Aucun message pour l&apos;instant
              </p>
            )}
            {messages.map((m) => (
              <div
                key={m.id}
                style={{ display: "flex", justifyContent: m.sender === "client" ? "flex-end" : "flex-start" }}
              >
                <div
                  style={{
                    maxWidth: "75%",
                    padding: "10px 14px",
                    borderRadius: m.sender === "client" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                    background:
                      m.sender === "client"
                        ? `rgba(${accentColor === "#00ff9d" ? "139,0,255" : "255,202,40"},.15)`
                        : "rgba(255,255,255,.06)",
                    border: `1px solid ${cardBorder}`,
                  }}
                >
                  <div style={{ margin: "0 0 4px", fontSize: 13, color: textMain, lineHeight: 1.5 }}>
                    <MessageBody body={m.body} onRate={(id) => setRateThreadId(id)} />
                  </div>
                  <p style={{ margin: 0, fontSize: 10, color: "rgba(200,190,170,.5)" }}>
                    {m.sender === "client" ? "Vous" : "LaCentral"} ·{" "}
                    {new Date(m.createdAt).toLocaleTimeString("fr-FR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Étape 1 : virement crypto */}
          {showDeposit && (
            <div style={{ padding: "12px 16px", borderTop: `1px solid ${cardBorder}`, display: "flex", flexDirection: "column", gap: 10 }}>
              {wallet && (
                <div
                  style={{
                    borderRadius: 14,
                    border: `1px solid ${accentColor}55`,
                    background: `${accentColor}12`,
                    padding: "12px 14px",
                  }}
                >
                  <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 800, color: accentColor, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                    Adresse {payLabel}
                  </p>
                  <p style={{ margin: 0, fontFamily: "monospace", fontSize: 12, color: textMain, wordBreak: "break-all" }}>
                    {wallet}
                  </p>
                </div>
              )}
              {!depositNotified ? (
                <button
                  type="button"
                  onClick={handleDeposit}
                  disabled={depositSending}
                  style={{
                    width: "100%",
                    padding: "13px 16px",
                    borderRadius: 999,
                    border: "none",
                    background: accentColor,
                    color: "#000",
                    fontWeight: 800,
                    fontSize: 13,
                    cursor: "pointer",
                    opacity: depositSending ? 0.6 : 1,
                  }}
                >
                  {depositSending ? "Envoi…" : "J'ai fait le virement"}
                </button>
              ) : (
                <p style={{ margin: 0, textAlign: "center", fontSize: 12, color: textMuted }}>
                  Virement signalé — en attente de confirmation vendeur.
                </p>
              )}
            </div>
          )}

          {/* Étape 2 : préparation */}
          {showPrepBanner && (
            <div style={{ padding: "12px 16px", borderTop: `1px solid ${cardBorder}`, textAlign: "center", fontSize: 13, fontWeight: 700, color: accentColor }}>
              Virement reçu — commande en préparation
            </div>
          )}

          {/* Étape 3 : réception / souci */}
          {isShipped && (
            <div style={{ padding: "12px 16px", borderTop: `1px solid ${cardBorder}`, display: "flex", flexDirection: "column", gap: 10 }}>
              {tracking && (
                <p style={{ margin: 0, fontSize: 12, color: textMuted }}>
                  N° de suivi :{" "}
                  <strong style={{ color: textMain, fontFamily: "monospace" }}>{tracking}</strong>
                </p>
              )}
              {showReceive && (
                <button
                  type="button"
                  onClick={handleConfirmReceived}
                  disabled={receiveSending}
                  style={{
                    width: "100%",
                    padding: "13px 16px",
                    borderRadius: 999,
                    border: "none",
                    background: accentColor,
                    color: "#000",
                    fontWeight: 800,
                    fontSize: 13,
                    cursor: "pointer",
                    opacity: receiveSending ? 0.6 : 1,
                  }}
                >
                  {receiveSending ? "Validation…" : "J'ai bien reçu mon colis"}
                </button>
              )}
              <button
                type="button"
                onClick={handleReportIssue}
                disabled={!concernEnabled || issueSending || selected.status === "souci_livraison"}
                title={
                  concernEnabled
                    ? "Signaler un problème"
                    : concernUnlock
                      ? `Disponible le ${concernUnlock.toLocaleDateString("fr-FR")}`
                      : "Disponible après le délai transporteur"
                }
                style={{
                  width: "100%",
                  padding: "12px 16px",
                  borderRadius: 999,
                  border: `1px solid ${cardBorder}`,
                  background: "transparent",
                  color: textMain,
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: concernEnabled ? "pointer" : "not-allowed",
                  opacity: !concernEnabled || selected.status === "souci_livraison" ? 0.4 : 1,
                }}
              >
                {selected.status === "souci_livraison"
                  ? "Souci déjà signalé — écris ci-dessous"
                  : "J'ai un souci avec ma livraison"}
              </button>
              {!concernEnabled && concernUnlock && selected.status === "locker_expedie" && (
                <p style={{ margin: 0, textAlign: "center", fontSize: 11, color: textMuted }}>
                  Bouton souci disponible le {concernUnlock.toLocaleDateString("fr-FR")}
                </p>
              )}
            </div>
          )}

          <div style={{ padding: "12px 16px", borderTop: `1px solid ${cardBorder}`, display: "flex", gap: 8 }}>
            <input
              value={newMsg}
              onChange={(e) => setNewMsg(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.nativeEvent.isComposing) sendMsg()
              }}
              placeholder="Envoyer un message..."
              style={{
                flex: 1,
                padding: "10px 14px",
                borderRadius: 999,
                border: `1px solid ${cardBorder}`,
                background: "rgba(0,0,0,.4)",
                color: textMain,
                fontSize: 13,
                outline: "none",
                fontFamily: "inherit",
              }}
            />
            <button
              type="button"
              onClick={sendMsg}
              disabled={sending || !newMsg.trim()}
              style={{
                borderRadius: 999,
                padding: "10px 14px",
                background: accentColor,
                border: "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                opacity: sending || !newMsg.trim() ? 0.5 : 1,
              }}
            >
              {sending ? (
                <Loader2 style={{ width: 16, height: 16, animation: "spin 1s linear infinite", color: "#000" }} />
              ) : (
                <Send style={{ width: 16, height: 16, color: "#000" }} />
              )}
            </button>
          </div>
        </div>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        {rateThreadId != null && (
          <RateProductsModal
            isOpen
            onClose={() => setRateThreadId(null)}
            threadId={rateThreadId}
            userToken={customerToken}
            accentColor={accentColor}
            cardBorder={cardBorder}
          />
        )}
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 700, margin: "0 auto", padding: "20px 16px" }} className="shop-main-pad">
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <button
          type="button"
          onClick={onBack}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: accentColor,
            display: "flex",
            alignItems: "center",
            gap: 4,
            fontSize: 13,
          }}
        >
          <ChevronLeft style={{ width: 16, height: 16 }} /> Retour
        </button>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: textMain }}>Mes commandes</h1>
        <button
          type="button"
          onClick={load}
          style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "rgba(200,190,170,.6)" }}
        >
          <RefreshCw style={{ width: 16, height: 16 }} />
        </button>
      </div>

      {loading && (
        <div style={{ textAlign: "center", padding: 60, color: "rgba(200,190,170,.5)" }}>
          <Loader2 style={{ width: 32, height: 32, margin: "0 auto", animation: "spin 1s linear infinite" }} />
        </div>
      )}

      {!loading && orders.length === 0 && (
        <div style={{ textAlign: "center", padding: 60, color: "rgba(200,190,170,.5)" }}>
          <Package style={{ width: 48, height: 48, margin: "0 auto 16px" }} />
          <p style={{ margin: 0 }}>Aucune commande pour l&apos;instant</p>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {orders
          .filter((o) => o.status !== "trk_token" && o.total > 0)
          .map((order) => (
            <button
              key={order.id}
              type="button"
              onClick={() => openOrder(order)}
              style={{
                width: "100%",
                textAlign: "left",
                padding: "16px 20px",
                borderRadius: 18,
                border: `1px solid ${cardBorder}`,
                background: "rgba(20,18,12,.82)",
                cursor: "pointer",
                transition: "all .2s",
              }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.borderColor = accentColor)}
              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.borderColor = cardBorder)}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, gap: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: textMain }}>
                  #{order.id}
                  {order.paymentCrypto ? ` · ${String(order.paymentCrypto).toUpperCase()}` : ""}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    padding: "3px 10px",
                    borderRadius: 999,
                    background: "rgba(255,255,255,.08)",
                    color: textMain,
                    fontWeight: 600,
                    whiteSpace: "nowrap",
                  }}
                >
                  {statusMeta(order.status).label}
                </span>
              </div>
              <div style={{ display: "flex", gap: 16, fontSize: 12, color: textMuted, flexWrap: "wrap" }}>
                <span style={{ color: accentColor, fontWeight: 700 }}>{order.total}€</span>
                <span>{order.fulfillment}</span>
                <span>{new Date(order.createdAt).toLocaleDateString("fr-FR")}</span>
              </div>
            </button>
          ))}
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
