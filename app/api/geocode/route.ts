import { type NextRequest, NextResponse } from "next/server"
import { MAP_REGION_DEFAULTS, type MapRegion } from "@/lib/map-regions"

// Distance Haversine en km
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function originForShop(shop: string | null): { lat: number; lng: number } {
  if (shop === "caliboyz94") return MAP_REGION_DEFAULTS.caliboyz94
  if (shop === "calidelivery") return MAP_REGION_DEFAULTS.calidelivery
  if (shop === "caliboyz31") return MAP_REGION_DEFAULTS.caliboyz31
  // Défaut Toulouse (31)
  return MAP_REGION_DEFAULTS.caliboyz31
}

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get("q")?.trim()
  const shop = req.nextUrl.searchParams.get("shop")?.trim() || null

  if (!query) {
    return NextResponse.json({ error: "Adresse manquante" }, { status: 400 })
  }

  try {
    // API Adresse (Base Adresse Nationale) — gratuite, sans clé
    const url = `https://api-adresse.data.gouv.fr/search/?limit=1&q=${encodeURIComponent(query)}`
    const res = await fetch(url, { headers: { Accept: "application/json" } })

    if (!res.ok) {
      return NextResponse.json({ error: "Service de géocodage indisponible" }, { status: 502 })
    }

    const data = await res.json()
    const feature = data?.features?.[0]

    if (!feature) {
      return NextResponse.json({ found: false }, { status: 200 })
    }

    const [lng, lat] = feature.geometry.coordinates as [number, number]
    const origin = originForShop(shop as MapRegion | null)
    const distanceKm = haversineKm(origin.lat, origin.lng, lat, lng)

    return NextResponse.json({
      found: true,
      label: feature.properties?.label ?? query,
      lat,
      lng,
      distanceKm,
      score: feature.properties?.score ?? null,
      originShop: shop || "caliboyz31",
    })
  } catch {
    return NextResponse.json({ error: "Erreur lors du géocodage" }, { status: 500 })
  }
}
