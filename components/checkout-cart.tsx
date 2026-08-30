"use client"

/**
 * Panier FrenchyCali multi-boutiques :
 * - Local (31 / IDF) : Meet-up + livraison société (frais distance)
 * - CaliDelivery : services colis configurables (Mondial Relay, Chronopost…) + crypto
 */

import { useEffect, useMemo, useState, type ReactNode, type CSSProperties } from "react"
import {
  ChevronLeft, Trash2, Tag, Loader2, CheckCircle2, MapPin, Calendar,
  Clock, Truck, Store, Package,
} from "lucide-react"
import { placeOrder } from "@/app/actions/order"
import {
  getCartConfig,
  getEnabledParcelServices,
  type CartConfig,
  type DeliverySlot,
  type MeetupSlot,
  type ParcelService,
} from "@/app/actions/settings"
import {
  getEnabledCryptoCurrencies,
  type CryptoCurrencyOption,
} from "@/app/actions/crypto-payment"
import {
  allowsCryptoCheckout,
  isDeliveryShop as shopIsDelivery,
  isLocalShop,
  type ShopId,
} from "@/lib/shops"

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

/** 0–10 km : 10€ | 10–20 km : 20€ | >20 km : 20€ + 1€/km */
function calcDeliveryFee(km: number): number {
  if (km <= 10) return 10
  if (km <= 20) return 20
  return 20 + Math.ceil(km - 20)
}

const FALLBACK_CONFIG: CartConfig = {
  minDeliveryAmount: 50,
  deliverySlots: [
    { id: "d1", label: "14H - 17H", startHour: 14, endHour: 17 },
    { id: "d2", label: "18H - 20H", startHour: 18, endHour: 20 },
    { id: "d3", label: "21H - 02H", startHour: 21, endHour: 2 },
  ],
  meetupSlots: [
    { id: "m14", label: "14H", hour: 14 },
    { id: "m15", label: "15H", hour: 15 },
    { id: "m16", label: "16H", hour: 16 },
    { id: "m17", label: "17H", hour: 17 },
    { id: "m18", label: "18H", hour: 18 },
    { id: "m19", label: "19H", hour: 19 },
    { id: "m20", label: "20H", hour: 20 },
    { id: "m21", label: "21H", hour: 21 },
    { id: "m22", label: "22H", hour: 22 },
    { id: "m23", label: "23H", hour: 23 },
    { id: "m00", label: "00H", hour: 0 },
  ],
}

const FR_DAYS = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"]

function dateOffset(days: number) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().split("T")[0]
}

function getOrderCutoff(now: Date): { minDate: string; isCutoff: boolean; cutoffLabel: string } {
  const day = now.getDay()
  const totalMinutes = now.getHours() * 60 + now.getMinutes()
  let isCutoff = false
  let cutoffLabel = ""
  if (day >= 0 && day <= 4) {
    if (totalMinutes >= 23 * 60 + 20) {
      isCutoff = true
      cutoffLabel = "Les commandes sont fermées après 23h20. Le premier créneau disponible est demain."
    }
  } else if (totalMinutes >= 1 * 60 + 20) {
    isCutoff = true
    cutoffLabel = "Les commandes sont fermées après 01h20. Le premier créneau disponible est demain."
  }
  return { minDate: isCutoff ? dateOffset(1) : dateOffset(0), isCutoff, cutoffLabel }
}

function dateToFrDay(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number)
  return FR_DAYS[new Date(y, (m ?? 1) - 1, d ?? 1).getDay()] ?? ""
}

function slotDate(dateStr: string, hour: number, afterMidnight: boolean) {
  const [y, m, d] = dateStr.split("-").map(Number)
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1, hour, 0, 0, 0)
  if (afterMidnight) dt.setDate(dt.getDate() + 1)
  return dt
}

function deliverySlotAvailable(dateStr: string, s: DeliverySlot, now: Date) {
  const crosses = s.endHour <= s.startHour
  return slotDate(dateStr, s.endHour, crosses).getTime() > now.getTime()
}

function meetupSlotAvailable(dateStr: string, s: MeetupSlot, now: Date) {
  const afterMidnight = s.hour < 12
  return slotDate(dateStr, s.hour, afterMidnight).getTime() > now.getTime()
}

/** Si le label commence par un jour FR → filtre jour ; sinon créneau valide tous les jours. */
function slotMatchesDay(label: string, dayName: string): boolean {
  const first = (label.split(/\s+/)[0] ?? "").replace(/,$/, "")
  if (FR_DAYS.includes(first)) return first === dayName
  return true
}

function isRelayService(svc: ParcelService | undefined): boolean {
  if (!svc) return false
  const id = svc.id.toLowerCase()
  const name = svc.name.toLowerCase()
  return id.includes("mondial") || id.includes("relay") || name.includes("mondial") || name.includes("locker") || name.includes("relais")
}

export function CheckoutCart({
  cart, setCart, customerToken, customerName, shop, onBack, onOrderPlaced,
  accentColor, primaryColor, cardBorder,
}: Props) {
  const shopId = shop as ShopId
  const isDeliveryShop = shopIsDelivery(shopId)
  const localShop = isLocalShop(shopId)
  const cryptoOk = allowsCryptoCheckout(shopId)

  const btnStyle: CSSProperties = isDeliveryShop
    ? { background: "linear-gradient(120deg,#8b00ff,#00ff9d)", color: "#000814" }
    : { background: "linear-gradient(120deg,#ffca28,#e65100)", color: "#0f0d07" }
  const textMain = isDeliveryShop ? "#f0f8ff" : "#f5e8c7"
  const textMuted = "rgba(200,190,170,.75)"
  const inputStyle: CSSProperties = {
    width: "100%", padding: "11px 14px", borderRadius: 14, border: `1px solid ${cardBorder}`,
    background: "rgba(0,0,0,.4)", color: textMain, fontSize: 13, fontFamily: "inherit",
    outline: "none", boxSizing: "border-box",
  }
  const chip = (active: boolean): CSSProperties => ({
    flex: 1, minWidth: 100, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
    padding: "12px 10px", borderRadius: 16,
    border: `1px solid ${active ? accentColor : cardBorder}`,
    background: active ? `${accentColor}22` : "rgba(20,18,12,.6)",
    color: active ? textMain : textMuted,
    fontSize: 12, fontWeight: active ? 700 : 500, cursor: "pointer",
  })

  const [parcelServices, setParcelServices] = useState<ParcelService[]>([])
  const [fulfillment, setFulfillment] = useState<string>(localShop ? "meetup" : "")
  const isMeetup = fulfillment === "meetup"
  const isLocalLivraison = fulfillment === "livraison"
  const selectedParcel = useMemo(
    () => parcelServices.find((s) => s.id === fulfillment),
    [parcelServices, fulfillment],
  )
  const isParcel = isDeliveryShop && !!selectedParcel

  const [cryptoList, setCryptoList] = useState<CryptoCurrencyOption[]>([])
  const [payCurrency, setPayCurrency] = useState("")
  /** CaliDelivery : le client choisit toujours sa devise (portefeuille autonome). */
  const needsCrypto = cryptoOk

  const [address, setAddress] = useState("")
  const [parcelAddress, setParcelAddress] = useState("")
  const [date, setDate] = useState("")
  const [slot, setSlot] = useState("")
  const [meetupHour, setMeetupHour] = useState("")
  const [promoCode, setPromoCode] = useState("")
  const [placing, setPlacing] = useState(false)
  const [done, setDone] = useState<{
    trackingToken: string
    threadId: number
    payCurrency?: string
  } | null>(null)
  const [error, setError] = useState("")

  const [config, setConfig] = useState<CartConfig>(FALLBACK_CONFIG)
  const [geoStatus, setGeoStatus] = useState<"idle" | "loading" | "done" | "error" | "notfound">("idle")
  const [distanceKm, setDistanceKm] = useState<number | null>(null)
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [resolvedLabel, setResolvedLabel] = useState<string | null>(null)

  useEffect(() => {
    getCartConfig(shop)
      .then((c) => setConfig(c))
      .catch(() => {})
  }, [shop])

  useEffect(() => {
    if (!isDeliveryShop) return
    getEnabledParcelServices()
      .then((list) => {
        setParcelServices(list)
        setFulfillment((prev) => {
          if (prev && list.some((s) => s.id === prev)) return prev
          return list[0]?.id ?? ""
        })
      })
      .catch(() => setParcelServices([]))
  }, [isDeliveryShop])

  useEffect(() => {
    if (!cryptoOk) return
    getEnabledCryptoCurrencies()
      .then((list) => {
        setCryptoList(list)
        setPayCurrency((prev) => {
          if (prev && list.some((c) => c.code === prev)) return prev
          return list[0]?.code ?? ""
        })
      })
      .catch(() => setCryptoList([]))
  }, [cryptoOk])

  const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0)
  const deliveryAllowed = subtotal >= config.minDeliveryAmount

  useEffect(() => {
    if (localShop && !deliveryAllowed && fulfillment === "livraison") {
      setFulfillment("meetup")
    }
  }, [deliveryAllowed, fulfillment, localShop])

  const now = new Date()
  const { minDate, isCutoff, cutoffLabel } = getOrderCutoff(now)

  const availableDeliverySlots = useMemo(() => {
    if (!date) return []
    const dayName = dateToFrDay(date)
    return config.deliverySlots.filter(
      (s) => slotMatchesDay(s.label, dayName) && deliverySlotAvailable(date, s, now),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.deliverySlots, date])

  const availableMeetupSlots = useMemo(() => {
    if (!date) return []
    const dayName = dateToFrDay(date)
    return config.meetupSlots.filter(
      (s) => slotMatchesDay(s.label, dayName) && meetupSlotAvailable(date, s, now),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.meetupSlots, date])

  useEffect(() => {
    if (date && date < minDate) setDate("")
  }, [date, minDate])
  useEffect(() => {
    if (slot && !availableDeliverySlots.some((s) => s.label === slot)) setSlot("")
  }, [availableDeliverySlots, slot])
  useEffect(() => {
    if (meetupHour && !availableMeetupSlots.some((s) => s.label === meetupHour)) setMeetupHour("")
  }, [availableMeetupSlots, meetupHour])

  const deliveryFee = useMemo(() => {
    if (isMeetup) return 0
    if (isParcel) return selectedParcel?.costEur ?? 0
    if (isLocalLivraison) {
      if (distanceKm == null) return 0
      return calcDeliveryFee(distanceKm)
    }
    return 0
  }, [isMeetup, isParcel, selectedParcel, isLocalLivraison, distanceKm])

  const total = Math.max(0, subtotal + deliveryFee)

  const removeItem = (idx: number) => setCart(cart.filter((_, i) => i !== idx))
  const changeQty = (idx: number, delta: number) => {
    setCart(cart.map((item, i) => (i === idx ? { ...item, qty: Math.max(1, item.qty + delta) } : item)))
  }

  const checkAddress = async () => {
    if (!address.trim()) return
    setGeoStatus("loading")
    setResolvedLabel(null)
    try {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(address)}&shop=${encodeURIComponent(shop)}`)
      const data = await res.json()
      if (res.ok && data.found) {
        setDistanceKm(Number(data.distanceKm))
        setCoords(
          typeof data.lat === "number" && typeof data.lng === "number"
            ? { lat: data.lat, lng: data.lng }
            : null,
        )
        setResolvedLabel(data.label ?? null)
        setGeoStatus("done")
      } else if (res.ok && data.found === false) {
        setDistanceKm(null)
        setCoords(null)
        setGeoStatus("notfound")
      } else {
        setDistanceKm(null)
        setCoords(null)
        setGeoStatus("error")
      }
    } catch {
      setDistanceKm(null)
      setCoords(null)
      setGeoStatus("error")
    }
  }

  const canValidate =
    cart.length > 0 &&
    !!fulfillment &&
    (!needsCrypto || !!payCurrency) &&
    (isParcel
      ? !!parcelAddress.trim()
      : !!date &&
        (isMeetup
          ? !!meetupHour
          : !!address.trim() && !!slot && distanceKm != null))

  const handleOrder = async () => {
    if (!canValidate || placing) return
    if (needsCrypto && !payCurrency) {
      setError("Choisis une crypto pour régler ta commande.")
      return
    }
    setError("")
    setPlacing(true)
    const payload = {
      customerToken,
      customerName,
      items: cart.map((i) => ({
        productId: i.productId,
        title: i.title,
        variant: i.variant,
        price: i.price,
        qty: i.qty,
      })),
      fulfillment,
      address: isMeetup
        ? undefined
        : isParcel
          ? parcelAddress.trim()
          : (resolvedLabel ?? address.trim()),
      lat: isMeetup || isParcel ? null : coords?.lat ?? null,
      lng: isMeetup || isParcel ? null : coords?.lng ?? null,
      scheduledDate: isParcel ? undefined : date || undefined,
      scheduledSlot: isParcel ? undefined : isMeetup ? meetupHour : slot,
      promoCode: promoCode || undefined,
      deliveryFee,
      shop,
      payCurrency: needsCrypto ? payCurrency : undefined,
    }
    try {
      let res: Awaited<ReturnType<typeof placeOrder>> | null = null
      try {
        const http = await fetch("/api/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify(payload),
          credentials: "same-origin",
          cache: "no-store",
        })
        const data = (await http.json().catch(() => null)) as Awaited<ReturnType<typeof placeOrder>> | null
        if (data && typeof data.ok === "boolean") res = data
      } catch {
        /* Safari / PWA : fallback Server Action */
      }
      if (!res) res = await placeOrder(payload)
      if (!res.ok) {
        setError(res.error ?? "Erreur lors de la commande.")
        return
      }
      setCart([])
      setDone({
        trackingToken: res.trackingToken!,
        threadId: res.threadId!,
        payCurrency: needsCrypto ? payCurrency : undefined,
      })
    } catch {
      setError("Erreur réseau. Vérifie ta connexion et réessaie.")
    } finally {
      setPlacing(false)
    }
  }

  if (done) {
    return (
      <div style={{ maxWidth: 560, margin: "0 auto", padding: "40px 16px", textAlign: "center" }}>
        <div style={{ borderRadius: 24, border: `1px solid ${cardBorder}`, background: "rgba(20,18,12,.92)", padding: "40px 24px" }}>
          <CheckCircle2 style={{ width: 56, height: 56, color: "#4ade80", margin: "0 auto 16px" }} />
          <h2 style={{ margin: "0 0 8px", fontFamily: "Orbitron,sans-serif", fontSize: 20, fontWeight: 900, color: textMain }}>
            Commande passée !
          </h2>
          <p style={{ margin: "0 0 12px", fontSize: 13, color: textMuted, lineHeight: 1.55 }}>
            {isParcel
              ? "Commande colis enregistrée — suis le paiement et l'expédition depuis Mes commandes."
              : "Tu peux suivre ta commande et écrire au vendeur depuis Mes commandes."}
          </p>
          <p style={{ margin: "0 0 16px", fontSize: 11, color: "rgba(200,190,170,.5)", wordBreak: "break-all" }}>
            Suivi : {done.trackingToken}
          </p>

          {done.payCurrency && (
            <div style={{ marginBottom: 20, padding: 16, borderRadius: 16, border: `1px solid ${accentColor}55`, background: `${accentColor}12`, textAlign: "left" }}>
              <p style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 800, color: accentColor, fontFamily: "Orbitron,sans-serif", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                Devise choisie : {done.payCurrency.toUpperCase()}
              </p>
              <p style={{ margin: 0, fontSize: 12, color: textMuted, lineHeight: 1.5 }}>
                Le vendeur te communiquera les instructions de paiement (adresse / montant) dans la messagerie.
                Tu règles depuis ton propre portefeuille.
              </p>
            </div>
          )}

          <button
            type="button"
            onClick={onOrderPlaced}
            style={{ ...btnStyle, width: "100%", padding: "14px", borderRadius: 999, border: "none", fontSize: 14, fontWeight: 700, cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.12em" }}
          >
            Voir mes commandes
          </button>
        </div>
      </div>
    )
  }

  const localModes: { id: string; label: string; icon: ReactNode; disabled?: boolean; title?: string }[] = [
    {
      id: "meetup",
      label: "Meet-up",
      icon: <Store style={{ width: 15, height: 15 }} />,
    },
    {
      id: "livraison",
      label: "Livraison",
      icon: <Truck style={{ width: 15, height: 15 }} />,
      disabled: !deliveryAllowed,
      title: !deliveryAllowed ? `Disponible dès ${config.minDeliveryAmount}€ d'achat` : "Livraison par nos soins",
    },
  ]

  const parcelModes: { id: string; label: string; icon: ReactNode; feeLabel: string }[] = parcelServices.map((s) => ({
    id: s.id,
    label: s.name,
    icon: <Package style={{ width: 15, height: 15 }} />,
    feeLabel: s.costEur == null || s.costEur === 0 ? "Gratuit" : `${s.costEur}€`,
  }))

  const modes = isDeliveryShop ? parcelModes : localModes
  const parcelAddressLabel = isRelayService(selectedParcel)
    ? "Adresse du point relais"
    : "Adresse de livraison du colis"
  const parcelAddressPlaceholder = isRelayService(selectedParcel)
    ? "Ex. Locker Leclerc — 12 rue de la Paix, 75001 Paris"
    : "N°, rue, code postal, ville"

  return (
    <div style={{ maxWidth: 680, margin: "0 auto", padding: "20px 16px" }}>
      <button type="button" onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", color: accentColor, fontSize: 13, marginBottom: 20 }}>
        <ChevronLeft style={{ width: 16, height: 16 }} /> Retour
      </button>

      <h1 style={{ margin: "0 0 20px", fontSize: 22, fontWeight: 700, color: textMain }}>Panier</h1>

      {/* Articles */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
        {cart.map((item, idx) => (
          <div key={idx} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderRadius: 16, border: `1px solid ${cardBorder}`, background: "rgba(20,18,12,.82)" }}>
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: textMain }}>{item.title}</p>
              <p style={{ margin: "2px 0 0", fontSize: 12, color: textMuted }}>{item.variant} — {item.price}€</p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button type="button" onClick={() => changeQty(idx, -1)} style={{ width: 28, height: 28, borderRadius: "50%", border: `1px solid ${cardBorder}`, background: "none", color: textMain, cursor: "pointer", fontSize: 16 }}>−</button>
              <span style={{ minWidth: 20, textAlign: "center", fontSize: 14, color: textMain, fontWeight: 600 }}>{item.qty}</span>
              <button type="button" onClick={() => changeQty(idx, 1)} style={{ width: 28, height: 28, borderRadius: "50%", border: `1px solid ${cardBorder}`, background: "none", color: textMain, cursor: "pointer", fontSize: 16 }}>+</button>
            </div>
            <span style={{ minWidth: 48, textAlign: "right", fontSize: 14, fontWeight: 700, color: accentColor }}>{item.price * item.qty}€</span>
            <button type="button" onClick={() => removeItem(idx)} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(248,113,113,.8)" }}>
              <Trash2 style={{ width: 15, height: 15 }} />
            </button>
          </div>
        ))}
        {cart.length === 0 && (
          <p style={{ textAlign: "center", color: textMuted, fontSize: 14, padding: 24 }}>Ton panier est vide.</p>
        )}
      </div>

      {/* Modes */}
      <div style={{ marginBottom: 12 }}>
        <p style={{ margin: "0 0 10px", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.1em", color: textMuted }}>
          Mode de récupération
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {modes.map((m) => (
            <button
              key={m.id}
              type="button"
              disabled={"disabled" in m ? !!m.disabled : false}
              title={"title" in m ? m.title : undefined}
              onClick={() => {
                if ("disabled" in m && m.disabled) return
                setFulfillment(m.id)
              }}
              style={{
                ...chip(fulfillment === m.id),
                opacity: "disabled" in m && m.disabled ? 0.4 : 1,
                cursor: "disabled" in m && m.disabled ? "not-allowed" : "pointer",
                flexDirection: isDeliveryShop ? "column" : "row",
                gap: isDeliveryShop ? 4 : 8,
              }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {m.icon}
                {m.label}
              </span>
              {"feeLabel" in m && (
                <span style={{ fontSize: 10, opacity: 0.75 }}>{m.feeLabel}</span>
              )}
            </button>
          ))}
        </div>
        {localShop && !deliveryAllowed && (
          <p style={{ margin: "10px 0 0", fontSize: 12, color: textMuted, lineHeight: 1.5, padding: "10px 12px", borderRadius: 12, border: `1px solid ${cardBorder}`, background: "rgba(0,0,0,.25)" }}>
            La <strong style={{ color: textMain }}>livraison par nos soins</strong> est disponible à partir de{" "}
            <strong style={{ color: accentColor }}>{config.minDeliveryAmount}€</strong> d&apos;achat.
            Ajoute encore <strong style={{ color: textMain }}>{Math.max(0, config.minDeliveryAmount - subtotal)}€</strong>
            , ou choisis le meet-up.
          </p>
        )}
        {isLocalLivraison && (
          <p style={{ margin: "8px 0 0", fontSize: 11, color: textMuted }}>
            Livraison discrète effectuée par notre équipe — frais selon la distance (10 € jusqu&apos;à 10 km, 20 € jusqu&apos;à 20 km, puis +1 €/km).
          </p>
        )}
        {isDeliveryShop && parcelServices.length === 0 && (
          <p style={{ margin: "10px 0 0", fontSize: 12, color: "#f87171" }}>
            Aucun service colis disponible pour le moment.
          </p>
        )}
      </div>

      {/* Adresse colis (CaliDelivery) */}
      {isParcel && (
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.1em", color: textMuted, marginBottom: 6 }}>
            <Package style={{ width: 12, height: 12, display: "inline", marginRight: 4 }} />
            {parcelAddressLabel}
          </label>
          <textarea
            value={parcelAddress}
            onChange={(e) => setParcelAddress(e.target.value)}
            rows={2}
            placeholder={parcelAddressPlaceholder}
            style={{ ...inputStyle, resize: "none" }}
          />
          <p style={{ margin: "8px 0 0", fontSize: 12, color: textMuted }}>
            Frais d&apos;envoi {selectedParcel?.name ?? ""} :{" "}
            <strong style={{ color: accentColor }}>
              {(selectedParcel?.costEur ?? 0) === 0 ? "Gratuit" : `${selectedParcel?.costEur}€`}
            </strong>
            {" · "}délai selon le transporteur après validation du paiement.
          </p>
        </div>
      )}

      {/* Adresse livraison société (local) */}
      {isLocalLivraison && (
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.1em", color: textMuted, marginBottom: 6 }}>
            <MapPin style={{ width: 12, height: 12, display: "inline", marginRight: 4 }} />
            Adresse de livraison
          </label>
          <textarea
            value={address}
            onChange={(e) => {
              setAddress(e.target.value)
              setGeoStatus("idle")
              setDistanceKm(null)
              setCoords(null)
              setResolvedLabel(null)
            }}
            onBlur={checkAddress}
            rows={2}
            placeholder="N°, rue, code postal, ville"
            style={{ ...inputStyle, resize: "none" }}
          />
          <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
            <button type="button" onClick={checkAddress} style={{ padding: "8px 14px", borderRadius: 10, border: `1px solid ${cardBorder}`, background: "rgba(255,255,255,.06)", color: textMain, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
              Calculer les frais
            </button>
            {geoStatus === "loading" && <span style={{ fontSize: 12, color: textMuted }}><Loader2 style={{ width: 12, height: 12, display: "inline", animation: "spin 1s linear infinite" }} /> Vérification…</span>}
            {geoStatus === "done" && distanceKm != null && (
              <span style={{ fontSize: 12, color: accentColor, fontWeight: 600 }}>≈ {distanceKm.toFixed(1)} km — frais {deliveryFee}€</span>
            )}
            {geoStatus === "notfound" && <span style={{ fontSize: 12, color: "#f87171" }}>Adresse introuvable</span>}
            {geoStatus === "error" && <span style={{ fontSize: 12, color: "#f87171" }}>Erreur géocodage</span>}
          </div>
          {resolvedLabel && geoStatus === "done" && (
            <p style={{ margin: "6px 0 0", fontSize: 11, color: textMuted }}>Adresse reconnue : {resolvedLabel}</p>
          )}
        </div>
      )}

      {/* Date + créneaux (local uniquement) */}
      {localShop && (
        <>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.1em", color: textMuted, marginBottom: 6 }}>
              <Calendar style={{ width: 12, height: 12, display: "inline", marginRight: 4 }} />
              Date souhaitée (sous 3 jours)
            </label>
            {isCutoff && (
              <p style={{ margin: "0 0 8px", fontSize: 11, color: "#fbbf24", padding: "8px 10px", borderRadius: 10, border: "1px solid rgba(251,191,36,.3)", background: "rgba(251,191,36,.08)" }}>
                {cutoffLabel}
              </p>
            )}
            <input
              type="date"
              value={date}
              min={minDate}
              max={dateOffset(3)}
              onChange={(e) => setDate(e.target.value)}
              style={{ ...inputStyle, colorScheme: "dark" }}
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <p style={{ margin: "0 0 8px", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.1em", color: textMuted }}>
              <Clock style={{ width: 12, height: 12, display: "inline", marginRight: 4 }} />
              {isMeetup ? "Heure de meet-up" : "Créneau de livraison"}
            </p>
            {!date ? (
              <p style={{ fontSize: 12, color: textMuted, padding: "10px 12px", borderRadius: 12, border: `1px dashed ${cardBorder}` }}>
                Choisis d&apos;abord une date pour voir les créneaux.
              </p>
            ) : isMeetup ? (
              availableMeetupSlots.length === 0 ? (
                <p style={{ fontSize: 12, color: textMuted }}>Aucun meet-up dispo ce jour. Essaie un autre jour.</p>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
                  {availableMeetupSlots.map((s) => (
                    <button key={s.id} type="button" onClick={() => setMeetupHour(s.label)} style={{ ...chip(meetupHour === s.label), padding: "10px 6px", minWidth: 0 }}>
                      {s.label}
                    </button>
                  ))}
                </div>
              )
            ) : availableDeliverySlots.length === 0 ? (
              <p style={{ fontSize: 12, color: textMuted }}>Aucun créneau de livraison ce jour. Essaie un autre jour.</p>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                {availableDeliverySlots.map((s) => (
                  <button key={s.id} type="button" onClick={() => setSlot(s.label)} style={{ ...chip(slot === s.label), padding: "10px 6px", minWidth: 0 }}>
                    {s.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {isParcel && (
        <div style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 8, padding: "12px 14px", borderRadius: 14, border: `1px solid ${cardBorder}`, background: "rgba(0,0,0,.25)" }}>
          <Calendar style={{ width: 16, height: 16, color: accentColor, flexShrink: 0 }} />
          <p style={{ margin: 0, fontSize: 13, color: textMain }}>
            Expédition après validation du paiement — délai selon le transporteur choisi.
          </p>
        </div>
      )}

      {/* Choix crypto — même modèle d'affichage que les modes de récupération */}
      {needsCrypto && (
        <div style={{ marginBottom: 16 }}>
          <p style={{ margin: "0 0 10px", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.1em", color: textMuted }}>
            Devise de paiement
          </p>
          {cryptoList.length === 0 ? (
            <p style={{ fontSize: 12, color: "#f87171", margin: 0 }}>
              Aucune devise activée pour le moment. Réessaie plus tard.
            </p>
          ) : (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {cryptoList.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setPayCurrency(c.code)}
                  style={{
                    ...chip(payCurrency === c.code),
                    flex: "1 1 120px",
                    minWidth: 110,
                    flexDirection: "column",
                    gap: 4,
                  }}
                >
                  <span style={{ fontWeight: 800, letterSpacing: "0.06em" }}>{c.code.toUpperCase()}</span>
                  <span style={{ fontSize: 10, opacity: 0.75 }}>{c.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Promo */}
      <div style={{ marginBottom: 20 }}>
        <label style={{ display: "block", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.1em", color: textMuted, marginBottom: 6 }}>
          <Tag style={{ width: 12, height: 12, display: "inline", marginRight: 4 }} />
          Code promo / fidélité
        </label>
        <input
          value={promoCode}
          onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
          placeholder="CODE-PROMO"
          style={{ ...inputStyle, color: accentColor, fontWeight: 700, letterSpacing: "0.08em" }}
        />
      </div>

      {/* Récap */}
      <div style={{ borderRadius: 16, border: `1px solid ${cardBorder}`, background: "rgba(20,18,12,.82)", padding: "16px 20px", marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 13, color: textMuted }}>
          <span>Sous-total</span><span>{subtotal}€</span>
        </div>
        {!isMeetup && (
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 13, color: textMuted }}>
            <span>{isParcel ? (selectedParcel?.name ?? "Envoi colis") : "Livraison (société)"}</span>
            <span>
              {isParcel || distanceKm != null
                ? deliveryFee === 0
                  ? "Gratuit"
                  : `${deliveryFee}€`
                : "—"}
            </span>
          </div>
        )}
        {promoCode && (
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 13, color: "#4ade80" }}>
            <span>Promo : {promoCode}</span><span>appliqué à la validation</span>
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 16, fontWeight: 700, color: textMain, paddingTop: 8, borderTop: `1px solid ${cardBorder}` }}>
          <span>Total</span><span style={{ color: accentColor }}>{total}€</span>
        </div>
      </div>

      {error && (
        <div style={{ marginBottom: 16, padding: "10px 14px", borderRadius: 12, border: "1px solid rgba(248,113,113,.3)", background: "rgba(248,113,113,.1)", color: "#f87171", fontSize: 13 }}>
          {error}
        </div>
      )}

      <button
        type="button"
        onClick={handleOrder}
        disabled={placing || !canValidate}
        style={{ ...btnStyle, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", padding: "15px", borderRadius: 999, border: "none", fontSize: 15, fontWeight: 700, cursor: placing ? "wait" : "pointer", textTransform: "uppercase", letterSpacing: "0.12em", opacity: placing || !canValidate ? 0.55 : 1 }}
      >
        {placing && <Loader2 style={{ width: 16, height: 16, animation: "spin 1s linear infinite" }} />}
        Valider ma commande
      </button>
      {!canValidate && cart.length > 0 && (
        <p style={{ margin: "10px 0 0", textAlign: "center", fontSize: 11, color: textMuted }}>
          {isParcel
            ? "Adresse du point / colis requise."
            : isMeetup
              ? "Date et heure de meet-up requis."
              : "Adresse (frais calculés), date et créneau requis."}
        </p>
      )}

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
