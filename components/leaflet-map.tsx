"use client"

import { useEffect, useRef } from "react"
import type { Map as LeafletMap } from "leaflet"

interface OrderPoint {
  id: number
  lat: number
  lng: number
  name: string
  total: number
  summary: string
}

interface Props {
  orders: OrderPoint[]
}

const ACCENT = "#ffca28"

export default function LeafletMapComponent({ orders }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<LeafletMap | null>(null)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    let isMounted = true;

    (async () => {
      const L = (await import("leaflet")).default

      if (!isMounted || !containerRef.current) return

      // Inject Leaflet CSS once
      const cssId = "leaflet-css"
      if (!document.getElementById(cssId)) {
        const link = document.createElement("link")
        link.id = cssId
        link.rel = "stylesheet"
        link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
        document.head.appendChild(link)
      }

      const map = L.map(containerRef.current, { zoomControl: true })

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 18,
      }).addTo(map)

      if (orders.length > 0) {
        const bounds: [number, number][] = []
        orders.forEach(o => {
          bounds.push([o.lat, o.lng])
          const icon = L.divIcon({
            className: "",
            html: `<div style="background:${ACCENT};color:#000;border-radius:50%;width:32px;height:32px;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;border:2px solid rgba(255,255,255,.3);box-shadow:0 0 10px rgba(255,202,40,.6);cursor:pointer">${o.total}€</div>`,
            iconSize: [32, 32],
            iconAnchor: [16, 16],
          })
          L.marker([o.lat, o.lng], { icon })
            .addTo(map)
            .bindPopup(
              `<div style="font-family:sans-serif;min-width:160px"><b style="font-size:13px">#${o.id} — ${o.name}</b><br><span style="font-size:11px;color:#555">${o.summary.slice(0, 70)}</span><br><b style="color:#e65100;font-size:14px">${o.total}€</b></div>`
            )
        })
        map.fitBounds(bounds, { padding: [48, 48] })
      } else {
        map.setView([46.6034, 1.8883], 6) // Vue France par défaut
      }

      mapRef.current = map
    })()

    return () => {
      isMounted = false
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      ref={containerRef}
      style={{ width: "100%", height: 500, background: "#1a1810" }}
    />
  )
}
