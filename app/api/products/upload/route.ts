import { handleUpload, type HandleUploadBody } from "@vercel/blob/client"
import { type NextRequest, NextResponse } from "next/server"
import { put } from "@vercel/blob"
import { isAdminAuthenticated } from "@/app/actions/admin-auth"

/**
 * Upload admin médias (produits / news / notifications).
 *
 * Deux modes :
 * 1) Client upload (JSON handleUpload) — recommandé pour vidéos > 4.5 Mo
 *    Le fichier va du navigateur → Blob, sans passer par la function Vercel.
 * 2) Server upload (multipart) — petits fichiers seulement (< 4 Mo), fallback.
 */

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const FOLDERS = new Set(["products", "news", "notifications", "media"])
const MAX_BYTES = 100 * 1024 * 1024 // 100 Mo côté token client
const SERVER_MAX_BYTES = 4 * 1024 * 1024 // limite safe function Vercel (~4.5 Mo)

const ALLOWED_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/heic",
  "image/heif",
  "image/avif",
  "image/bmp",
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/x-m4v",
  "video/x-matroska",
  "video/mpeg",
  "application/octet-stream", // iOS / Android souvent sans MIME fiable
]

function hasBlobCredentials(): boolean {
  return Boolean(
    process.env.BLOB_READ_WRITE_TOKEN ||
      (process.env.BLOB_STORE_ID && process.env.VERCEL_OIDC_TOKEN),
  )
}

function parseFolder(clientPayload: string | null): string {
  if (!clientPayload) return "media"
  try {
    const data = JSON.parse(clientPayload) as { folder?: string }
    const f = String(data.folder ?? "media").toLowerCase()
    return FOLDERS.has(f) ? f : "media"
  } catch {
    return "media"
  }
}

/** Client token exchange + webhook completion (JSON body). */
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

    const contentType = request.headers.get("content-type") || ""

    // ── Mode client upload (bypass limite 4.5 Mo Vercel) ──
    if (contentType.includes("application/json")) {
      const body = (await request.json()) as HandleUploadBody

      const jsonResponse = await handleUpload({
        body,
        request,
        onBeforeGenerateToken: async (pathname, clientPayload) => {
          const folder = parseFolder(clientPayload)
          // Refuse les chemins hors des dossiers autorisés
          const clean = pathname.replace(/^\/+/, "")
          if (!clean.startsWith(`${folder}/`) && !FOLDERS.has(clean.split("/")[0] ?? "")) {
            // On accepte aussi si le pathname est juste un nom de fichier :
            // le client envoie déjà products/xxx.ext
            const first = clean.split("/")[0]
            if (!FOLDERS.has(first ?? "")) {
              throw new Error("Dossier de destination non autorisé.")
            }
          }

          return {
            allowedContentTypes: ALLOWED_TYPES,
            maximumSizeInBytes: MAX_BYTES,
            addRandomSuffix: false,
            allowOverwrite: false,
            tokenPayload: JSON.stringify({ folder }),
          }
        },
        onUploadCompleted: async () => {
          // Pas de DB ici : le client reçoit déjà l'URL et l'associe au produit.
        },
      })

      return NextResponse.json(jsonResponse)
    }

    // ── Mode serveur (petits fichiers uniquement) ──
    const formData = await request.formData()
    const file = formData.get("file") as File | null
    const folderRaw = String(formData.get("folder") ?? "media").toLowerCase()
    const folder = FOLDERS.has(folderRaw) ? folderRaw : "media"

    if (!file) {
      return NextResponse.json({ error: "Aucun fichier reçu." }, { status: 400 })
    }

    if (file.size > SERVER_MAX_BYTES) {
      return NextResponse.json(
        {
          error:
            "Fichier trop volumineux pour l'upload serveur (max ~4 Mo). Utilise l'upload client (vidéos).",
        },
        { status: 413 },
      )
    }
    if (file.size < 32) {
      return NextResponse.json({ error: "Fichier vide ou invalide." }, { status: 400 })
    }

    const type = (file.type || "").toLowerCase()
    const name = file.name || "file.bin"
    const isVideo =
      type.startsWith("video/") || /\.(mp4|mov|m4v|webm|mkv)$/i.test(name)
    const isImage =
      type.startsWith("image/") || /\.(jpe?g|png|gif|webp|heic|heif|avif|bmp)$/i.test(name)
    if (!isVideo && !isImage) {
      return NextResponse.json(
        { error: "Format non supporté (image ou vidéo)." },
        { status: 400 },
      )
    }

    const ext =
      name.split(".").pop()?.toLowerCase()?.replace(/[^a-z0-9]/g, "") ||
      (isVideo ? "mp4" : "jpg")
    const safeName = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

    const blob = await put(safeName, file, {
      access: "private",
      contentType: file.type || (isVideo ? "video/mp4" : "image/jpeg"),
      multipart: false,
      addRandomSuffix: false,
    })

    return NextResponse.json({
      url: blob.url,
      type: isVideo ? "video" : "image",
      pathname: blob.pathname,
      contentType: blob.contentType,
    })
  } catch (error) {
    console.error("[admin/upload] error:", error)
    const msg = error instanceof Error ? error.message : "Échec de l'envoi."
    if (/token|BLOB|credentials|unauthorized/i.test(msg)) {
      return NextResponse.json(
        { error: "Blob non authentifié. Vérifie BLOB_READ_WRITE_TOKEN sur Vercel et redéploie." },
        { status: 503 },
      )
    }
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
