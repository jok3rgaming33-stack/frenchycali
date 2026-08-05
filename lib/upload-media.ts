import { upload } from "@vercel/blob/client"

export type UploadedMedia = { url: string; type: "image" | "video" }

export type MediaFolder = "products" | "news" | "notifications" | "media"

const IMAGE_EXTS = new Set(["jpg", "jpeg", "png", "gif", "webp", "heic", "heif", "avif", "bmp"])
const VIDEO_EXTS = new Set(["mp4", "mov", "m4v", "webm", "quicktime", "mkv"])

/** Max 100 Mo (aligné token serveur). Au-delà, message clair. */
const MAX_BYTES = 100 * 1024 * 1024
/** Au-delà de 4 Mo → multipart client obligatoire (limite body Vercel = 4.5 Mo). */
const MULTIPART_THRESHOLD = 4 * 1024 * 1024

function extFromName(name: string | undefined): string | null {
  if (!name) return null
  const ext = name.split(".").pop()?.toLowerCase()
  if (!ext || ext.length > 8) return null
  return ext === "jpeg" ? "jpg" : ext
}

/** Détecte image/vidéo même si le MIME navigateur est vide (iOS/Android). */
export function detectImageOrVideo(file: File): "image" | "video" | null {
  const type = (file.type || "").toLowerCase().split(";")[0].trim()
  const ext = extFromName(file.name) ?? ""

  if (type.startsWith("image/")) return "image"
  if (type.startsWith("video/")) return "video"
  if (IMAGE_EXTS.has(ext)) return "image"
  if (VIDEO_EXTS.has(ext) || ext === "quicktime") return "video"
  return null
}

function resolveContentType(kind: "image" | "video", file: File, ext: string): string {
  const base = (file.type || "").split(";")[0].trim().toLowerCase()
  if (base && base !== "application/octet-stream") {
    if (kind === "image" && base.startsWith("image/")) return base
    if (kind === "video" && base.startsWith("video/")) return base
  }
  if (kind === "video") {
    if (ext === "webm") return "video/webm"
    if (ext === "mov") return "video/quicktime"
    if (ext === "mkv") return "video/x-matroska"
    if (ext === "m4v") return "video/x-m4v"
    return "video/mp4"
  }
  if (ext === "png") return "image/png"
  if (ext === "webp") return "image/webp"
  if (ext === "gif") return "image/gif"
  if (ext === "avif") return "image/avif"
  if (ext === "heic" || ext === "heif") return "image/heic"
  return "image/jpeg"
}

/**
 * Upload admin → Vercel Blob en **client direct** (bypass limite 4.5 Mo des functions).
 * Auth : cookie admin via /api/products/upload (handleUpload).
 * folder: products | news | notifications | media
 */
export async function uploadMedia(
  file: File,
  opts?: { folder?: MediaFolder; onProgress?: (pct: number) => void },
): Promise<UploadedMedia> {
  const kind = detectImageOrVideo(file)
  if (!kind) {
    throw new Error("Format non supporté (image ou vidéo).")
  }

  if (file.size > MAX_BYTES) {
    throw new Error("Fichier trop volumineux (max 100 Mo).")
  }
  if (file.size < 32) {
    throw new Error("Fichier vide ou invalide.")
  }

  const folder = opts?.folder ?? "media"
  const fromName = extFromName(file.name)
  const ext =
    fromName && (IMAGE_EXTS.has(fromName) || VIDEO_EXTS.has(fromName) || fromName === "quicktime")
      ? fromName === "quicktime"
        ? "mov"
        : fromName
      : kind === "video"
        ? "mp4"
        : "jpg"

  const pathname = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  const contentType = resolveContentType(kind, file, ext)
  const useMultipart = file.size > MULTIPART_THRESHOLD

  try {
    const blob = await upload(pathname, file, {
      access: "private",
      handleUploadUrl: "/api/products/upload",
      contentType,
      multipart: useMultipart,
      clientPayload: JSON.stringify({ folder, kind }),
      onUploadProgress: opts?.onProgress
        ? (e) => opts.onProgress?.(Math.round(e.percentage))
        : undefined,
    })

    if (!blob?.url) {
      throw new Error("Réponse upload invalide.")
    }

    return { url: blob.url, type: kind }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Échec de l'envoi."
    // Messages plus clairs
    if (/413|entity too large|payload/i.test(msg)) {
      throw new Error(
        "Fichier trop volumineux pour le serveur. Réessaie (upload direct Blob) ou compresse la vidéo.",
      )
    }
    if (/not authorized|non autorisé|unauthorized|401/i.test(msg)) {
      throw new Error("Session admin expirée. Reconnecte-toi puis réessaie.")
    }
    if (/BLOB|token|credentials/i.test(msg)) {
      throw new Error("Stockage Blob non configuré. Vérifie BLOB_READ_WRITE_TOKEN sur Vercel.")
    }
    throw new Error(msg)
  }
}
