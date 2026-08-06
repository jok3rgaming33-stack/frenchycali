import { put } from "@vercel/blob"
import { type NextRequest, NextResponse } from "next/server"
import { COMMUNITY_LIMITS } from "@/lib/community-filters"

const IMAGE_EXTS = new Set(["jpg", "jpeg", "png", "gif", "webp", "heic", "heif"])
const VIDEO_EXTS = new Set(["mp4", "mov", "m4v", "webm"])

function extFromName(name: string | undefined): string | null {
  if (!name) return null
  const ext = name.split(".").pop()?.toLowerCase()
  if (!ext || ext.length > 5) return null
  return ext
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

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const formData = await request.formData()
    // Support multi : "file" ou "files"
    const files: File[] = []
    const single = formData.get("file")
    if (single instanceof File) files.push(single)
    for (const v of formData.getAll("files")) {
      if (v instanceof File) files.push(v)
    }
    if (!files.length) {
      return NextResponse.json({ error: "Aucun fichier reçu." }, { status: 400 })
    }
    if (files.length > COMMUNITY_LIMITS.MAX_MEDIA) {
      return NextResponse.json(
        { error: `Maximum ${COMMUNITY_LIMITS.MAX_MEDIA} fichiers par envoi.` },
        { status: 400 },
      )
    }

    const uploaded: { url: string; type: "image" | "video" }[] = []

    for (const file of files) {
      const kind = detectKind(file.type, file.name)
      if (!kind) {
        return NextResponse.json(
          { error: `"${file.name}" : format non supporté (photo ou vidéo).` },
          { status: 400 },
        )
      }
      const max =
        kind === "image" ? COMMUNITY_LIMITS.PHOTO_MAX_BYTES : COMMUNITY_LIMITS.VIDEO_MAX_BYTES
      if (file.size > max) {
        const mb = Math.round(max / (1024 * 1024))
        return NextResponse.json(
          {
            error:
              kind === "image"
                ? `Photo trop lourde (max ${mb} Mo) : ${file.name}`
                : `Vidéo trop lourde (max ${mb} Mo) : ${file.name}`,
          },
          { status: 413 },
        )
      }

      const ext = extFromName(file.name) || (kind === "image" ? "jpg" : "mp4")
      const contentType =
        file.type && file.type !== "application/octet-stream"
          ? file.type.split(";")[0]
          : kind === "image"
            ? "image/jpeg"
            : "video/mp4"
      const safeName = `community/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

      const blob = await put(safeName, file, {
        access: "private",
        contentType,
      })
      uploaded.push({ url: blob.url, type: kind })
    }

    return NextResponse.json({
      ok: true,
      files: uploaded,
      // rétrocompat 1 fichier
      url: uploaded[0]?.url,
      type: uploaded[0]?.type,
    })
  } catch (error) {
    console.error("[community/upload] error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Échec de l'envoi." },
      { status: 500 },
    )
  }
}
