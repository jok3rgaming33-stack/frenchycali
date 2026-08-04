"use client"

import { useState, useEffect } from "react"
import { Bell, BellOff } from "lucide-react"
import { subscribePush, unsubscribePush, getVapidPublicKey } from "@/app/actions/notifications"

interface Props {
  role: "client" | "vendeur"
  customerToken?: string
  className?: string
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
  const rawData = window.atob(base64)
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)))
}

export function PushToggle({ role, customerToken, className }: Props) {
  const [subscribed, setSubscribed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [supported, setSupported] = useState(false)

  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window) {
      setSupported(true)
      navigator.serviceWorker.ready.then((reg) => {
        reg.pushManager.getSubscription().then((sub) => setSubscribed(!!sub))
      }).catch(() => {})
    }
  }, [])

  if (!supported) return null

  const toggle = async () => {
    setLoading(true)
    try {
      const reg = await navigator.serviceWorker.ready
      if (subscribed) {
        const sub = await reg.pushManager.getSubscription()
        if (sub) {
          await sub.unsubscribe()
          await unsubscribePush(sub.endpoint)
          setSubscribed(false)
        }
      } else {
        const { key } = await getVapidPublicKey()
        if (!key) { alert("Push non configuré sur ce serveur."); return }
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(key).buffer as ArrayBuffer,
        })
        const json = sub.toJSON()
        await subscribePush({
          role,
          endpoint: sub.endpoint,
          p256dh: json.keys?.p256dh || "",
          auth: json.keys?.auth || "",
          customerToken,
        })
        setSubscribed(true)
      }
    } catch (e) {
      console.error("[PushToggle]", e)
    } finally {
      setLoading(false)
    }
  }

  const BORDER = "rgba(255,202,40,.16)"
  const ACCENT = "#ffca28"

  return (
    <button onClick={toggle} disabled={loading} className={className}
      title={subscribed ? "Désactiver les notifications" : "Activer les notifications"}
      style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 999, border: `1px solid ${subscribed ? ACCENT : BORDER}`, background: subscribed ? "rgba(255,202,40,.1)" : "transparent", color: subscribed ? ACCENT : "rgba(200,190,170,.6)", fontSize: 12, cursor: "pointer", transition: "all .2s", opacity: loading ? 0.6 : 1 }}>
      {subscribed ? <Bell style={{ width: 13, height: 13 }} /> : <BellOff style={{ width: 13, height: 13 }} />}
      {subscribed ? "Notifs activées" : "Activer notifs"}
    </button>
  )
}
