/**
 * Filtres anti-insultes / anti-spam pour le canal communautaire.
 * Heuristiques simples côté serveur (pas un filtre exhaustif).
 */

import { shopLabel, isShopId } from "@/lib/shops"

// Mots / racines (fr) — formes normalisées (sans accents, minuscules)
const INSULT_ROOTS = [
  "pute", "putain", "salope", "salop", "connard", "connasse", "conne",
  "encule", "enculé", "pd", "fdp", "ntm", "nique", "niquer", "niqué",
  "batard", "bâtard", "batar", "enfoire", "enfoiré", "filsdepute",
  "tg", "ta gueule", "ferme ta gueule", "va te faire", "va te faire foutre",
  "foutre", "bite", "couille", "couilles", "branleur", "branle",
  "merde", "chier", "chiant", "chiotte", "enculer",
  "negro", "négro", "negro", "nazi", "sale juif", "sale arabe",
  "racaille", "sous merde", "sous-merde", "abruti", "debile", "débile",
  "idiot", "attarde", "attardé", "mongol", "trisomique",
  "ptn", "plmd", "suce", "suceur", "trou du cul", "trouduc",
]

function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
}

/** Normalise pour comparaison (leetspeak basique). */
export function normalizeForFilter(input: string): string {
  let s = stripAccents(input.toLowerCase())
  s = s
    .replace(/0/g, "o")
    .replace(/1/g, "i")
    .replace(/3/g, "e")
    .replace(/4/g, "a")
    .replace(/5/g, "s")
    .replace(/7/g, "t")
    .replace(/@/g, "a")
    .replace(/\$/g, "s")
  // espaces / ponctuation multiples
  s = s.replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim()
  return s
}

export function containsInsult(text: string): boolean {
  const n = normalizeForFilter(text)
  if (!n) return false
  // version sans espaces pour détecter "f d p" / "nt m"
  const compact = n.replace(/\s+/g, "")
  for (const root of INSULT_ROOTS) {
    const r = normalizeForFilter(root)
    if (!r) continue
    if (n.includes(r) || compact.includes(r.replace(/\s+/g, ""))) return true
  }
  return false
}

export type SpamCheckInput = {
  body: string
  mediaCount: number
  recentBodies: string[] // derniers messages du même user (corps normalisés)
  recentTimestamps: number[] // ms
  now?: number
}

export type FilterResult =
  | { ok: true }
  | { ok: false; error: string }

const MAX_BODY = 500
const MIN_INTERVAL_MS = 4_000 // 4s entre messages
const WINDOW_MS = 120_000 // 2 min
const MAX_IN_WINDOW = 8
const DUPLICATE_WINDOW_MS = 90_000
const MAX_MEDIA = 4

export function validateCommunityPost(input: SpamCheckInput): FilterResult {
  const body = (input.body ?? "").trim()
  const mediaCount = Math.max(0, input.mediaCount | 0)
  const now = input.now ?? Date.now()

  if (!body && mediaCount === 0) {
    return { ok: false, error: "Écris un message ou ajoute une photo / vidéo." }
  }
  if (body.length > MAX_BODY) {
    return { ok: false, error: `Message trop long (max ${MAX_BODY} caractères).` }
  }
  if (mediaCount > MAX_MEDIA) {
    return { ok: false, error: `Maximum ${MAX_MEDIA} médias par message.` }
  }

  if (body && containsInsult(body)) {
    return { ok: false, error: "Message refusé : langage inapproprié détecté." }
  }

  const stamps = input.recentTimestamps.filter((t) => now - t < WINDOW_MS)
  if (stamps.length >= MAX_IN_WINDOW) {
    return { ok: false, error: "Trop de messages. Patiente 2 minutes (anti-spam)." }
  }

  const last = Math.max(0, ...input.recentTimestamps)
  if (last > 0 && now - last < MIN_INTERVAL_MS) {
    return { ok: false, error: "Patiente quelques secondes avant un nouvel envoi." }
  }

  if (body) {
    const norm = normalizeForFilter(body)
    const recent = input.recentBodies
    const recentTs = input.recentTimestamps
    for (let i = 0; i < recent.length; i++) {
      if (recent[i] === norm && now - (recentTs[i] ?? 0) < DUPLICATE_WINDOW_MS) {
        return { ok: false, error: "Message déjà envoyé récemment (anti-spam)." }
      }
    }
  }

  return { ok: true }
}

export const COMMUNITY_LIMITS = {
  MAX_BODY,
  MAX_MEDIA,
  PHOTO_MAX_BYTES: 3 * 1024 * 1024,
  VIDEO_MAX_BYTES: 6 * 1024 * 1024,
} as const

export function favoriteShopLabel(key: string | null | undefined): string | null {
  if (!key) return null
  const k = key.toLowerCase()
  if (k === "31" || k === "caliboyz31") return shopLabel("caliboyz31")
  if (k === "94" || k === "caliboyz94") return shopLabel("caliboyz94")
  if (k === "delivery" || k === "calidelivery") return shopLabel("calidelivery")
  return isShopId(k) ? shopLabel(k) : null
}
