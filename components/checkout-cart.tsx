"use client"

import { useState } from "react"
import { ChevronLeft, Trash2, Tag, Loader2, CheckCircle2, MapPin, Calendar } from "lucide-react"
import { placeOrder } from "@/app/actions/order"

type CartItem = { productId: number; title: string; variant: string; price: number; qty: number }

interface Props {
  cart: CartItem[]
  setCart: (cart: CartItem[]) => void
  customerToken: string
  customerName: string
  shop: "caliboyz31" | "caliboyz94" | "calidelivery"
  onBack: () => void
  onOrderPlaced: () => void
  accentColor: string
  primaryColor: string
  cardBorder: string
}

export function CheckoutCart({ cart, setCart, customerToken, customerName, shop, onBack, onOrderPlaced, accentColor, primaryColor, cardBorder }: Props) {
  const isDelivery = shop === "calidelivery"
  const btnStyle: React.CSSProperties = isDelivery
    ? { background: "linear-gradient(120deg,#8b00ff,#00ff9d)", color: "#000814" }
    : { background: "linear-gradient(120deg,#ffca28,#e65100)", color: "#0f0d07" }

  const [fulfillment, setFulfillment] = useState<"livraison" | "meetup" | "locker">(isDelivery ? "livraison" : "meetup")
  const [address, setAddress] = useState("")
  const [scheduledDate, setScheduledDate] = useState("")
  const [scheduledSlot, setScheduledSlot] = useState("")
  const [promoCode, setPromoCode] = useState("")
  const [promoApplied, setPromoApplied] = useState(false)
  const [placing, setPlacing] = useState(false)
  const [done, setDone] = useState<{ trackingToken: string; threadId: number } | null>(null)
  const [error, setError] = useState("")

  const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0)

  const removeItem = (idx: number) => setCart(cart.filter((_, i) => i !== idx))
  const changeQty = (idx: number, delta: number) => {
    const updated = cart.map((item, i) => i === idx ? { ...item, qty: Math.max(1, item.qty + delta) } : item)
    setCart(updated)
  }

  const handleOrder = async () => {
    if (!cart.length) return
    if (fulfillment !== "meetup" && !address.trim()) { setError("Adresse requise."); return }
    setError(""); setPlacing(true)
    try {
      const res = await placeOrder({
        customerToken, customerName,
        items: cart.map(i => ({ title: i.title, variant: i.variant, price: i.price, qty: i.qty })),
        fulfillment, address: address || undefined,
        scheduledDate: scheduledDate || undefined,
        scheduledSlot: scheduledSlot || undefined,
        promoCode: promoCode || undefined,
        shop,
      })
      if (!res.ok) { setError(res.error ?? "Erreur lors de la commande."); return }
      setCart([])
      setDone({ trackingToken: res.trackingToken!, threadId: res.threadId! })
    } catch { setError("Erreur réseau. Réessaie.") }
    finally { setPlacing(false) }
  }

  if (done) return (
    <div style={{ maxWidth: 560, margin: "0 auto", padding: "40px 16px", textAlign: "center" }}>
      <div style={{ borderRadius: 24, border: `1px solid ${cardBorder}`, background: "rgba(20,18,12,.92)", padding: "40px 24px" }}>
        <CheckCircle2 style={{ width: 56, height: 56, color: "#4ade80", margin: "0 auto 16px" }} />
        <h2 style={{ margin: "0 0 8px", fontFamily: "Orbitron,sans-serif", fontSize: 20, fontWeight: 900, color: "#f5e8c7" }}>Commande passée !</h2>
        <p style={{ margin: "0 0 20px", fontSize: 13, color: "rgba(200,190,170,.8)" }}>
          Tu peux suivre ta commande et envoyer des messages depuis <strong style={{ color: accentColor }}>Mes commandes</strong>.
        </p>
        <p style={{ margin: "0 0 24px", fontSize: 11, color: "rgba(200,190,170,.5)", wordBreak: "break-all" }}>Token : {done.trackingToken}</p>
        <button onClick={onOrderPlaced}
          style={{ ...btnStyle, width: "100%", padding: "14px", borderRadius: 999, border: "none", fontSize: 14, fontWeight: 700, cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.12em" }}>
          Voir mes commandes
        </button>
      </div>
    </div>
  )

  return (
    <div style={{ maxWidth: 680, margin: "0 auto", padding: "20px 16px" }}>
      <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", color: accentColor, fontSize: 13, marginBottom: 20 }}>
        <ChevronLeft style={{ width: 16, height: 16 }} /> Retour
      </button>

      <h1 style={{ margin: "0 0 20px", fontSize: 22, fontWeight: 700, color: "#f5e8c7" }}>Panier</h1>

      {/* Items */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
        {cart.map((item, idx) => (
          <div key={idx} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderRadius: 16, border: `1px solid ${cardBorder}`, background: "rgba(20,18,12,.82)" }}>
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "#f5e8c7" }}>{item.title}</p>
              <p style={{ margin: "2px 0 0", fontSize: 12, color: "rgba(200,190,170,.7)" }}>{item.variant} — {item.price}€</p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button onClick={() => changeQty(idx, -1)} style={{ width: 28, height: 28, borderRadius: "50%", border: `1px solid ${cardBorder}`, background: "none", color: "#f5e8c7", cursor: "pointer", fontSize: 16 }}>-</button>
              <span style={{ minWidth: 20, textAlign: "center", fontSize: 14, color: "#f5e8c7", fontWeight: 600 }}>{item.qty}</span>
              <button onClick={() => changeQty(idx, 1)} style={{ width: 28, height: 28, borderRadius: "50%", border: `1px solid ${cardBorder}`, background: "none", color: "#f5e8c7", cursor: "pointer", fontSize: 16 }}>+</button>
            </div>
            <span style={{ minWidth: 48, textAlign: "right", fontSize: 14, fontWeight: 700, color: accentColor }}>{item.price * item.qty}€</span>
            <button onClick={() => removeItem(idx)} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(248,113,113,.8)" }}>
              <Trash2 style={{ width: 15, height: 15 }} />
            </button>
          </div>
        ))}
      </div>

      {/* Fulfillment */}
      <div style={{ marginBottom: 20 }}>
        <p style={{ margin: "0 0 10px", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(200,190,170,.7)" }}>Mode de livraison</p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {(isDelivery ? ["livraison", "locker"] : ["meetup", "livraison", "locker"]).map((f) => (
            <button key={f} onClick={() => setFulfillment(f as typeof fulfillment)}
              style={{ padding: "8px 16px", borderRadius: 999, border: `1px solid ${cardBorder}`, background: fulfillment === f ? accentColor : "transparent",
                color: fulfillment === f ? "#000" : "rgba(200,190,170,.8)", fontSize: 13, cursor: "pointer", fontWeight: fulfillment === f ? 700 : 400 }}>
              {f === "meetup" ? "En main propre" : f === "livraison" ? "Livraison Colissimo" : "Consigne"}
            </button>
          ))}
        </div>
      </div>

      {/* Address */}
      {(fulfillment === "livraison" || fulfillment === "locker") && (
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(200,190,170,.7)", marginBottom: 6 }}>
            <MapPin style={{ width: 12, height: 12, display: "inline", marginRight: 4 }} />
            {fulfillment === "livraison" ? "Adresse de livraison" : "Numéro de consigne"}
          </label>
          <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder={fulfillment === "livraison" ? "12 rue de la Paix, 75001 Paris" : "Code consigne Amazon / Pickup..."}
            style={{ width: "100%", padding: "11px 14px", borderRadius: 14, border: `1px solid ${cardBorder}`, background: "rgba(0,0,0,.4)", color: "#f5e8c7", fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }} />
        </div>
      )}

      {/* Scheduled */}
      {fulfillment === "meetup" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
          <div>
            <label style={{ display: "block", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(200,190,170,.7)", marginBottom: 6 }}>Date souhaitée</label>
            <input type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)}
              style={{ width: "100%", padding: "11px 14px", borderRadius: 14, border: `1px solid ${cardBorder}`, background: "rgba(0,0,0,.4)", color: "#f5e8c7", fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box", colorScheme: "dark" }} />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(200,190,170,.7)", marginBottom: 6 }}>Créneau</label>
            <input type="time" value={scheduledSlot} onChange={(e) => setScheduledSlot(e.target.value)}
              style={{ width: "100%", padding: "11px 14px", borderRadius: 14, border: `1px solid ${cardBorder}`, background: "rgba(0,0,0,.4)", color: "#f5e8c7", fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box", colorScheme: "dark" }} />
          </div>
        </div>
      )}

      {/* Promo */}
      <div style={{ marginBottom: 20 }}>
        <label style={{ display: "block", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(200,190,170,.7)", marginBottom: 6 }}>
          <Tag style={{ width: 12, height: 12, display: "inline", marginRight: 4 }} />
          Code promo / fidélité
        </label>
        <input value={promoCode} onChange={(e) => setPromoCode(e.target.value.toUpperCase())} placeholder="CODE-PROMO"
          style={{ width: "100%", padding: "11px 14px", borderRadius: 14, border: `1px solid ${cardBorder}`, background: "rgba(0,0,0,.4)", color: accentColor, fontSize: 13, fontFamily: "inherit", fontWeight: 700, letterSpacing: "0.08em", outline: "none", boxSizing: "border-box" }} />
      </div>

      {/* Summary */}
      <div style={{ borderRadius: 16, border: `1px solid ${cardBorder}`, background: "rgba(20,18,12,.82)", padding: "16px 20px", marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 13, color: "rgba(200,190,170,.8)" }}>
          <span>Sous-total</span><span>{subtotal}€</span>
        </div>
        {promoCode && (
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 13, color: "#4ade80" }}>
            <span>Promo : {promoCode}</span><span>appliqué à la validation</span>
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 16, fontWeight: 700, color: "#f5e8c7", paddingTop: 8, borderTop: `1px solid ${cardBorder}` }}>
          <span>Total</span><span style={{ color: accentColor }}>{subtotal}€</span>
        </div>
      </div>

      {error && (
        <div style={{ marginBottom: 16, padding: "10px 14px", borderRadius: 12, border: "1px solid rgba(248,113,113,.3)", background: "rgba(248,113,113,.1)", color: "#f87171", fontSize: 13 }}>
          {error}
        </div>
      )}

      <button onClick={handleOrder} disabled={placing || !cart.length}
        style={{ ...btnStyle, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", padding: "15px", borderRadius: 999, border: "none", fontSize: 15, fontWeight: 700, cursor: placing ? "wait" : "pointer", textTransform: "uppercase", letterSpacing: "0.12em", opacity: (placing || !cart.length) ? 0.6 : 1 }}>
        {placing && <Loader2 style={{ width: 16, height: 16, animation: "spin 1s linear infinite" }} />}
        Passer la commande
      </button>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
