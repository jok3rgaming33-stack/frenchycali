/** Zones carte multi-boutiques FrenchyCali (partagé client + serveur). */

export type MapOrigin = { lat: number; lng: number; label?: string; zoom?: number }

export type MapRegion = "caliboyz31" | "caliboyz94" | "calidelivery"

export type MapOriginsByRegion = Record<MapRegion, MapOrigin>

/** Défauts : 31 → Toulouse · 94 → Créteil · delivery → vue France */
export const MAP_REGION_DEFAULTS: MapOriginsByRegion = {
  caliboyz31: { lat: 43.6045, lng: 1.4442, label: "Toulouse (Cali Boyz 31)", zoom: 12 },
  caliboyz94: { lat: 48.7904, lng: 2.4556, label: "Créteil (Cali Boyz 94)", zoom: 12 },
  calidelivery: { lat: 46.603354, lng: 1.888334, label: "France — CaliDelivery", zoom: 6 },
}
