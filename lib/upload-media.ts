export type UploadedMedia = { url: string; type: "image" | "video" }

export type MediaFolder = "products" | "news" | "notifications" | "media"

const IMAGE_EXTS = new Set(["jpg", "jpeg", "png", "gif", "webp", "heic", "heif", "avif", "bmp"])
const VIDEO_EXTS = new Set(["mp4", "mov", "m4v", "webm", "quicktime", "mkv"])

function extFromName(name: string | undefined): string | null {
  if (!name) return null
  const ext = name.split(".").pop()?.toLowerCase()
  if (!ext || ext.length > 5) return null
  return ext
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

/**
 * Upload via route serveur /api/products/upload (auth admin).
 * - Pas d'appel Blob direct navigateur (CORS).
 * - folder: préfixe de stockage (products | news | notifications).
 */
export async function uploadMedia(
  file: File,
  opts?: { folder?: MediaFolder },
): Promise<UploadedMedia> {
  const kind = detectImageOrVideo(file)
  if (!kind) {
    throw new Error("Format non supporté (image ou vidéo).")
  }

  // 40 Mo max côté client (la route serveur re-vérifie)
  const MAX = 40 * 1024 * 1024
  if (file.size > MAX) {
    throw new Error("Fichier trop volumineux (max 40 Mo).")
  }
  if (file.size < 32) {
    throw new Error("Fichier vide ou invalide.")
  }

  const formData = new FormData()
  formData.append("file", file)
  formData.append("folder", opts?.folder ?? "media")

  const res = await fetch("/api/products/upload", {
    method: "POST",
    body: formData,
  })

  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(
      typeof data?.error === "string" ? data.error : `Échec de l'envoi (${res.status}).`,
    )
  }

  const data = await res.json()
  if (!data?.url || (data.type !== "image" && data.type !== "video")) {
    throw new Error("Réponse upload invalide.")
  }
  return { url: data.url as string, type: data.type as "image" | "video" }
}
