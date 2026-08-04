import { put } from "@vercel/blob"
import { type NextRequest, NextResponse } from "next/server"
import { isAdminAuthenticated } from "@/app/actions/admin-auth"

/**
 * Upload SERVEUR admin → Vercel Blob (privé).
 * Utilisé par produits, news et notifications (même pipeline).
 * - Auth admin obligatoire
 * - Détection MIME + extension (iOS souvent sans type)
 * - Limite 40 Mo, multipart pour gros fichiers
 * - Préfixe folder: products | news | notifications | media
 */

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const IMAGE_EXTS = new Set(["jpg", "jpeg", "png", "gif", "webp", "heic", "heif", "avif", "bmp"])
const VIDEO_EXTS = new Set(["mp4", "mov", "m4v", "webm", "mkv"])
const FOLDERS = new Set(["products", "news", "notifications", "media"])

const MAX_BYTES = 40 * 1024 * 1024
const MIN_BYTES = 32

function extFromName(name: string | undefined): string | null {
  if (!name) return null
  const ext = name.split(".").pop()?.toLowerCase()
  if (!ext || ext.length > 8) return null
  return ext === "quicktime" ? "mov" : ext
}

function detectKind(mime: string, filename: string): "image" | "video" | null {
  const type = (mime || "").toLowerCase().split(";")[0].trim()
  const ext = extFromName(filename) ?? ""

  if (type.startsWith("image/")) return "image"
  if (type.startsWith("video/")) return "video"
  if (IMAGE_EXTS.has(ext)) return "image"
  if (VIDEO_EXTS.has(ext)) return "video"
  return null
}

function resolveContentType(kind: "image" | "video", mime: string, ext: string): string {
  const base = (mime || "").split(";")[0].trim().toLowerCase()
  if (base && base !== "application/octet-stream") {
    if (kind === "image" && base.startsWith("image/")) return base
    if (kind === "video" && base.startsWith("video/")) return base
  }
  if (kind === "video") {
    if (ext === "webm") return "video/webm"
    if (ext === "mov") return "video/quicktime"
    if (ext === "mkv") return "video/x-matroska"
    return "video/mp4"
  }
  if (ext === "png") return "image/png"
  if (ext === "webp") return "image/webp"
  if (ext === "gif") return "image/gif"
  if (ext === "avif") return "image/avif"
  if (ext === "heic" || ext === "heif") return "image/heic"
  return "image/jpeg"
}

function resolveExt(kind: "image" | "video", mime: string, fromName: string | null): string {
  if (fromName && (IMAGE_EXTS.has(fromName) || VIDEO_EXTS.has(fromName))) {
    return fromName === "jpeg" ? "jpg" : fromName
  }
  const m = mime.toLowerCase()
  if (kind === "video") {
    if (m.includes("webm")) return "webm"
    if (m.includes("quicktime") || m.includes("mov")) return "mov"
    return "mp4"
  }
  if (m.includes("png")) return "png"
  if (m.includes("webp")) return "webp"
  if (m.includes("gif")) return "gif"
  return "jpg"
}

function hasBlobCredentials(): boolean {
  return Boolean(
    process.env.BLOB_READ_WRITE_TOKEN ||
      (process.env.BLOB_STORE_ID && process.env.VERCEL_OIDC_TOKEN),
  )
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    if (!(await isAdminAuthenticated())) {
      return NextResponse.json({ error: "Non autorisé." }, { status: 401 })
    }

    if (!hasBlobCredentials()) {
      return NextResponse.json(
        {
          error:
            "Stockage Blob non configuré (BLOB_READ_WRITE_TOKEN manquant). Connecte un store Vercel Blob au projet.",
        },
        { status: 503 },
      )
    }

    const formData = await request.formData()
    const file = formData.get("file") as File | null
    const folderRaw = String(formData.get("folder") ?? "media").toLowerCase()
    const folder = FOLDERS.has(folderRaw) ? folderRaw : "media"

    if (!file) {
      return NextResponse.json({ error: "Aucun fichier reçu." }, { status: 400 })
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: `Fichier trop volumineux (max ${Math.floor(MAX_BYTES / (1024 * 1024))} Mo).` },
        { status: 400 },
      )
    }
    if (file.size < MIN_BYTES) {
      return NextResponse.json({ error: "Fichier vide ou invalide." }, { status: 400 })
    }

    const kind = detectKind(file.type, file.name)
    if (!kind) {
      return NextResponse.json(
        { error: "Format non supporté (image ou vidéo). Vérifie l'extension (.jpg, .png, .webp, .mp4, .mov…)." },
        { status: 400 },
      )
    }

    const fromName = extFromName(file.name)
    const ext = resolveExt(kind, file.type, fromName)
    const contentType = resolveContentType(kind, file.type, ext)
    const safeName = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

    const blob = await put(safeName, file, {
      access: "private",
      contentType,
      // Gros fichiers vidéo : split + retry
      multipart: file.size > 4 * 1024 * 1024,
      addRandomSuffix: false,
    })

    // URL brute — BlobMedia / toProxyUrl convertit en /api/media?url=…
    return NextResponse.json({
      url: blob.url,
      type: kind,
      pathname: blob.pathname,
      contentType: blob.contentType ?? contentType,
    })
  } catch (error) {
    console.error("[admin/upload] error:", error)
    const msg = error instanceof Error ? error.message : "Échec de l'envoi."
    // Message plus clair si token manquant côté runtime
    if (/token|BLOB|credentials|unauthorized/i.test(msg)) {
      return NextResponse.json(
        { error: "Blob non authentifié. Vérifie BLOB_READ_WRITE_TOKEN sur Vercel et redéploie." },
        { status: 503 },
      )
    }
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
