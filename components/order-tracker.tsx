"use client"

import { useState, useEffect, useCallback } from "react"
import { ChevronLeft, Package, MessageCircle, Send, Loader2, RefreshCw } from "lucide-react"
import { getOrdersByToken, getThreadMessages, sendClientMessage, updateClientLastSeen } from "@/app/actions/order"
import type { OrderThread, ThreadMessage } from "@/lib/db/schema"
import { STATUS_LABELS } from "@/lib/order-status"

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

  const load = useCallback(async () => {
    setLoading(true)
    try { setOrders(await getOrdersByToken(customerToken)) }
    catch {} finally { setLoading(false) }
  }, [customerToken])

  useEffect(() => { load() }, [load])

  const openOrder = async (order: OrderThread) => {
    setSelected(order)
    const msgs = await getThreadMessages(order.id)
    setMessages(msgs)
    await updateClientLastSeen(order.trackingToken)
  }

  const sendMsg = async () => {
    if (!newMsg.trim() || !selected) return
    setSending(true)
    const res = await sendClientMessage(selected.id, newMsg.trim(), customerToken)
    if (res.ok) {
      setNewMsg("")
      const msgs = await getThreadMessages(selected.id)
      setMessages(msgs)
    }
    setSending(false)
  }

  const statusBg: Record<string, string> = {
    nouveau: "rgba(234,179,8,.15)", confirme: "rgba(59,130,246,.15)", en_preparation: "rgba(168,85,247,.15)",
    expedie: "rgba(99,102,241,.15)", en_route: "rgba(59,130,246,.15)", livree: "rgba(34,197,94,.15)",
    annule: "rgba(239,68,68,.15)", annulee: "rgba(239,68,68,.15)",
  }
  const statusColor: Record<string, string> = {
    nouveau: "#eab308", confirme: "#3b82f6", en_preparation: "#a855f7",
    expedie: "#6366f1", en_route: "#3b82f6", livree: "#22c55e",
    annule: "#ef4444", annulee: "#ef4444",
  }

  if (selected) return (
    <div style={{ maxWidth:700, margin:"0 auto", padding:"20px 16px" }}>
      <button onClick={() => setSelected(null)} style={{ display:"flex", alignItems:"center", gap:6, background:"none", border:"none", cursor:"pointer", color:accentColor, fontSize:13, marginBottom:16 }}>
        <ChevronLeft style={{ width:16, height:16 }} /> Retour
      </button>
      <div style={{ borderRadius:20, border:`1px solid ${cardBorder}`, background:"rgba(20,18,12,.88)", overflow:"hidden" }}>
        <div style={{ padding:"16px 20px", borderBottom:`1px solid ${cardBorder}` }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <h2 style={{ margin:0, fontSize:16, fontWeight:700, color:"#f5e8c7" }}>Commande #{selected.id}</h2>
            <span style={{ fontSize:12, padding:"4px 12px", borderRadius:999, background:statusBg[selected.status]||"rgba(255,255,255,.08)", color:statusColor[selected.status]||"#f5e8c7", fontWeight:600 }}>
              {STATUS_LABELS[selected.status] || selected.status}
            </span>
          </div>
          <p style={{ margin:"6px 0 0", fontSize:12, color:"rgba(200,190,170,.7)" }}>{selected.summary}</p>
          <p style={{ margin:"4px 0 0", fontSize:14, fontWeight:700, color:accentColor }}>{selected.total}€</p>
        </div>
        {/* Messages */}
        <div style={{ display:"flex", flexDirection:"column", gap:8, padding:16, minHeight:200, maxHeight:350, overflowY:"auto" }}>
          {messages.length === 0 && <p style={{ margin:"auto", fontSize:13, color:"rgba(200,190,170,.5)", textAlign:"center" }}>Aucun message pour l&apos;instant</p>}
          {messages.map((m) => (
            <div key={m.id} style={{ display:"flex", justifyContent:m.sender==="client"?"flex-end":"flex-start" }}>
              <div style={{ maxWidth:"75%", padding:"10px 14px", borderRadius:m.sender==="client"?"16px 16px 4px 16px":"16px 16px 16px 4px",
                background:m.sender==="client"?`rgba(${accentColor==="#00ff9d"?"139,0,255":"255,202,40"},.15)`:"rgba(255,255,255,.06)", border:`1px solid ${cardBorder}` }}>
                <p style={{ margin:"0 0 4px", fontSize:13, color:"#f5e8c7", lineHeight:1.5 }}>{m.body}</p>
                <p style={{ margin:0, fontSize:10, color:"rgba(200,190,170,.5)" }}>
                  {m.sender === "client" ? "Vous" : "Vendeur"} · {new Date(m.createdAt).toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"})}
                </p>
              </div>
            </div>
          ))}
        </div>
        {/* Send */}
        <div style={{ padding:"12px 16px", borderTop:`1px solid ${cardBorder}`, display:"flex", gap:8 }}>
          <input value={newMsg} onChange={(e)=>setNewMsg(e.target.value)}
            onKeyDown={(e)=>{ if(e.key==="Enter"&&!e.nativeEvent.isComposing) sendMsg() }}
            placeholder="Envoyer un message..." style={{ flex:1, padding:"10px 14px", borderRadius:999, border:`1px solid ${cardBorder}`, background:"rgba(0,0,0,.4)", color:"#f5e8c7", fontSize:13, outline:"none", fontFamily:"inherit" }} />
          <button onClick={sendMsg} disabled={sending||!newMsg.trim()} style={{ borderRadius:999, padding:"10px 14px", background:accentColor, border:"none", cursor:"pointer", display:"flex", alignItems:"center", opacity:sending||!newMsg.trim()?.5:1 }}>
            {sending ? <Loader2 style={{ width:16, height:16, animation:"spin 1s linear infinite", color:"#000" }} /> : <Send style={{ width:16, height:16, color:"#000" }} />}
          </button>
        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  return (
    <div style={{ maxWidth:700, margin:"0 auto", padding:"20px 16px" }}>
      <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:24 }}>
        <button onClick={onBack} style={{ background:"none", border:"none", cursor:"pointer", color:accentColor, display:"flex", alignItems:"center", gap:4, fontSize:13 }}>
          <ChevronLeft style={{ width:16, height:16 }} /> Retour
        </button>
        <h1 style={{ margin:0, fontSize:20, fontWeight:700, color:"#f5e8c7" }}>Mes commandes</h1>
        <button onClick={load} style={{ marginLeft:"auto", background:"none", border:"none", cursor:"pointer", color:"rgba(200,190,170,.6)" }}>
          <RefreshCw style={{ width:16, height:16 }} />
        </button>
      </div>

      {loading && <div style={{ textAlign:"center", padding:60, color:"rgba(200,190,170,.5)" }}><Loader2 style={{ width:32, height:32, margin:"0 auto", animation:"spin 1s linear infinite" }} /></div>}

      {!loading && orders.length === 0 && (
        <div style={{ textAlign:"center", padding:60, color:"rgba(200,190,170,.5)" }}>
          <Package style={{ width:48, height:48, margin:"0 auto 16px" }} />
          <p style={{ margin:0 }}>Aucune commande pour l&apos;instant</p>
        </div>
      )}

      <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
        {orders.map((order) => (
          <button key={order.id} onClick={() => openOrder(order)} style={{ width:"100%", textAlign:"left", padding:"16px 20px", borderRadius:18, border:`1px solid ${cardBorder}`, background:"rgba(20,18,12,.82)", cursor:"pointer", transition:"all .2s" }}
            onMouseEnter={(e)=>(e.currentTarget as HTMLElement).style.borderColor=accentColor}
            onMouseLeave={(e)=>(e.currentTarget as HTMLElement).style.borderColor=cardBorder}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
              <span style={{ fontSize:14, fontWeight:700, color:"#f5e8c7" }}>#{order.id} — {order.summary.slice(0,40)}{order.summary.length>40?"...":""}</span>
              <span style={{ fontSize:11, padding:"3px 10px", borderRadius:999, background:statusBg[order.status]||"rgba(255,255,255,.08)", color:statusColor[order.status]||"#f5e8c7", fontWeight:600 }}>
                {STATUS_LABELS[order.status]||order.status}
              </span>
            </div>
            <div style={{ display:"flex", gap:16, fontSize:12, color:"rgba(200,190,170,.7)" }}>
              <span style={{ color:accentColor, fontWeight:700 }}>{order.total}€</span>
              <span>{order.fulfillment}</span>
              <span>{new Date(order.createdAt).toLocaleDateString("fr-FR")}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
