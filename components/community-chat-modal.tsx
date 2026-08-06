"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  X,
  Send,
  Loader2,
  Users,
  Smile,
  Paperclip,
  Trash2,
  ImageIcon,
} from "lucide-react"
import {
  listCommunityMessages,
  postCommunityMessage,
  deleteCommunityMessage,
  type CommunityMessageDTO,
} from "@/app/actions/community"
import { BlobImg, BlobVideo } from "@/components/blob-media"
import { COMMUNITY_LIMITS } from "@/lib/community-filters"
import type { CommunityMedia } from "@/lib/db/schema"

const FAVORITE_KEY = "favoriteUniverse"

const EMOJIS = [
  "😀", "😂", "🤣", "😊", "😍", "😘", "😎", "🤔", "😮", "😢",
  "😡", "👍", "👎", "👏", "🙏", "🔥", "💯", "✨", "💪", "🎉",
  "❤️", "💔", "🌿", "💨", "🚚", "⭐", "✅", "👀", "🫡", "🤝",
]

type Props = {
  isOpen: boolean
  onClose: () => void
  userToken: string
  userPseudo: string
  isAdmin?: boolean
  accentColor?: string
  primaryColor?: string
  cardBorder?: string
  isDelivery?: boolean
}

function formatTime(d: Date | string) {
  try {
    return new Date(d).toLocaleString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
  } catch {
    return ""
  }
}

export function CommunityChatModal({
  isOpen,
  onClose,
  userToken,
  userPseudo,
  isAdmin = false,
  accentColor = "#ffca28",
  primaryColor = "#e65100",
  cardBorder = "rgba(255,202,40,.18)",
  isDelivery = false,
}: Props) {
  const [messages, setMessages] = useState<CommunityMessageDTO[]>([])
  const [loading, setLoading] = useState(false)
  const [text, setText] = useState("")
  const [pendingMedia, setPendingMedia] = useState<CommunityMedia[]>([])
  const [sending, setSending] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showEmoji, setShowEmoji] = useState(false)
  const [canModerate, setCanModerate] = useState(isAdmin)
  const listRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const lastIdRef = useRef(0)

  const scrollBottom = useCallback(() => {
    requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" })
    })
  }, [])

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!userToken) return
    if (!opts?.silent) setLoading(true)
    try {
      const res = await listCommunityMessages(userToken)
      if (!res.ok) {
        if (!opts?.silent) setError(res.error)
        return
      }
      setMessages(res.messages)
      setCanModerate(res.canModerate || isAdmin)
      const maxId = res.messages.reduce((m, x) => Math.max(m, x.id), 0)
      lastIdRef.current = maxId
      if (!opts?.silent) scrollBottom()
    } catch {
      if (!opts?.silent) setError("Chargement impossible.")
    } finally {
      if (!opts?.silent) setLoading(false)
    }
  }, [userToken, isAdmin, scrollBottom])

  // Polling nouveaux messages
  useEffect(() => {
    if (!isOpen || !userToken) return
    load()
    const id = setInterval(async () => {
      try {
        const after = lastIdRef.current
        const res = await listCommunityMessages(userToken, { afterId: after > 0 ? after : undefined })
        if (!res.ok) return
        setCanModerate(res.canModerate || isAdmin)
        if (after > 0 && res.messages.length) {
          setMessages((prev) => {
            const ids = new Set(prev.map((m) => m.id))
            const next = [...prev]
            for (const m of res.messages) {
              if (!ids.has(m.id)) next.push(m)
            }
            return next
          })
          const maxId = res.messages.reduce((m, x) => Math.max(m, x.id), after)
          lastIdRef.current = maxId
          scrollBottom()
        } else if (after === 0) {
          setMessages(res.messages)
          lastIdRef.current = res.messages.reduce((m, x) => Math.max(m, x.id), 0)
        }
      } catch { /* ignore */ }
    }, 4000)
    return () => clearInterval(id)
  }, [isOpen, userToken, load, isAdmin, scrollBottom])

  if (!isOpen) return null

  const bg = isDelivery ? "rgba(12,0,22,.98)" : "rgba(15,13,7,.98)"
  const textColor = isDelivery ? "#f0f8ff" : "#f5e8c7"

  const favoriteShop =
    typeof window !== "undefined" ? localStorage.getItem(FAVORITE_KEY) : null

  const handleUpload = async (files: FileList | null) => {
    if (!files?.length || uploading) return
    setError(null)
    const list = Array.from(files).slice(0, COMMUNITY_LIMITS.MAX_MEDIA - pendingMedia.length)
    if (!list.length) {
      setError(`Maximum ${COMMUNITY_LIMITS.MAX_MEDIA} médias par message.`)
      return
    }

    for (const f of list) {
      const isImage = f.type.startsWith("image/")
      const isVideo = f.type.startsWith("video/")
      if (!isImage && !isVideo) {
        setError(`Format non supporté : ${f.name}`)
        return
      }
      const max = isImage ? COMMUNITY_LIMITS.PHOTO_MAX_BYTES : COMMUNITY_LIMITS.VIDEO_MAX_BYTES
      if (f.size > max) {
        setError(
          isImage
            ? `Photo max ${COMMUNITY_LIMITS.PHOTO_MAX_BYTES / (1024 * 1024)} Mo : ${f.name}`
            : `Vidéo max ${COMMUNITY_LIMITS.VIDEO_MAX_BYTES / (1024 * 1024)} Mo : ${f.name}`,
        )
        return
      }
    }

    setUploading(true)
    try {
      const fd = new FormData()
      list.forEach((f) => fd.append("files", f))
      const res = await fetch("/api/community/upload", { method: "POST", body: fd })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data?.error ?? "Échec de l'upload.")
        return
      }
      const filesOut = (data.files ?? []) as CommunityMedia[]
      setPendingMedia((prev) => [...prev, ...filesOut].slice(0, COMMUNITY_LIMITS.MAX_MEDIA))
    } catch {
      setError("Erreur réseau lors de l'upload.")
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ""
    }
  }

  const handleSend = async () => {
    if (sending || uploading) return
    const body = text.trim()
    if (!body && !pendingMedia.length) return
    setSending(true)
    setError(null)
    try {
      const res = await postCommunityMessage({
        userToken,
        body,
        media: pendingMedia,
        favoriteShop,
      })
      if (!res.ok) {
        setError(res.error)
        return
      }
      setText("")
      setPendingMedia([])
      setShowEmoji(false)
      setMessages((prev) => [...prev, res.message])
      lastIdRef.current = Math.max(lastIdRef.current, res.message.id)
      scrollBottom()
    } catch {
      setError("Envoi impossible.")
    } finally {
      setSending(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!canModerate) return
    const res = await deleteCommunityMessage(id, userToken)
    if (!res.ok) {
      setError(res.error)
      return
    }
    setMessages((prev) => prev.filter((m) => m.id !== id))
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Canal communautaire"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-3 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl border shadow-2xl"
        style={{
          borderColor: cardBorder,
          background: bg,
          color: textColor,
          boxShadow: `0 0 40px ${accentColor}33`,
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between gap-3 border-b px-4 py-3"
          style={{ borderColor: cardBorder }}
        >
          <div className="flex min-w-0 items-center gap-2.5">
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl"
              style={{ background: `${accentColor}22`, color: accentColor }}
            >
              <Users className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h2
                className="truncate text-sm font-black uppercase tracking-wider"
                style={{
                  fontFamily: "Orbitron,sans-serif",
                  background: `linear-gradient(90deg,${accentColor},${primaryColor})`,
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                Canal communautaire
              </h2>
              <p className="text-[11px] opacity-60">
                Toutes les boutiques · connecté en {userPseudo}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl border"
            style={{ borderColor: cardBorder, color: "rgba(200,190,170,.8)" }}
            aria-label="Fermer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Messages */}
        <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-3 py-4" style={{ minHeight: 280 }}>
          {loading && (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin" style={{ color: accentColor }} />
            </div>
          )}
          {!loading && messages.length === 0 && (
            <p className="px-4 py-10 text-center text-sm opacity-55">
              Aucun message pour l&apos;instant. Lance la discussion !
            </p>
          )}
          {messages.map((m) => (
            <article
              key={m.id}
              className={`rounded-2xl border px-3 py-2.5 ${m.isMine ? "ml-6" : "mr-4"}`}
              style={{
                borderColor: m.isMine ? `${accentColor}44` : cardBorder,
                background: m.isMine ? `${accentColor}14` : "rgba(255,255,255,.03)",
              }}
            >
              <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span className="text-xs font-bold" style={{ color: accentColor }}>
                  {m.pseudo}
                </span>
                {m.favoriteLabel && (
                  <span
                    className="rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide"
                    style={{
                      background: "rgba(255,255,255,.06)",
                      border: `1px solid ${cardBorder}`,
                      color: "rgba(200,190,170,.75)",
                    }}
                  >
                    {m.favoriteLabel}
                  </span>
                )}
                <span className="text-[10px] opacity-45">{formatTime(m.createdAt)}</span>
                {(m.canModerate || canModerate) && (
                  <button
                    type="button"
                    onClick={() => handleDelete(m.id)}
                    className="ml-auto rounded-lg p-1 text-red-400/80 hover:bg-red-500/15 hover:text-red-300"
                    title="Supprimer (modération)"
                    aria-label="Supprimer le message"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              {m.body ? (
                <p className="whitespace-pre-wrap break-words text-sm leading-relaxed opacity-95">
                  {m.body}
                </p>
              ) : null}
              {m.media?.length > 0 && (
                <div className="mt-2 flex flex-col gap-2">
                  {m.media.map((med, i) =>
                    med.type === "video" ? (
                      <div key={i} className="overflow-hidden rounded-xl bg-black">
                        <BlobVideo
                          src={med.url}
                          controls
                          playsInline
                          className="max-h-56 w-full object-contain"
                        />
                      </div>
                    ) : (
                      <div key={i} className="overflow-hidden rounded-xl bg-black/30">
                        <BlobImg
                          src={med.url}
                          alt="Photo"
                          className="max-h-56 w-full object-contain"
                        />
                      </div>
                    ),
                  )}
                </div>
              )}
            </article>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Composer */}
        <div className="border-t px-3 py-3" style={{ borderColor: cardBorder }}>
          {error && (
            <p className="mb-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
              {error}
            </p>
          )}

          {pendingMedia.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {pendingMedia.map((m, i) => (
                <div
                  key={i}
                  className="relative flex h-14 w-14 items-center justify-center overflow-hidden rounded-lg border"
                  style={{ borderColor: cardBorder }}
                >
                  {m.type === "video" ? (
                    <span className="text-[10px] font-bold" style={{ color: accentColor }}>
                      VID
                    </span>
                  ) : (
                    <ImageIcon className="h-5 w-5 opacity-60" />
                  )}
                  <button
                    type="button"
                    onClick={() => setPendingMedia((p) => p.filter((_, j) => j !== i))}
                    className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] text-white"
                    aria-label="Retirer"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          {showEmoji && (
            <div
              className="mb-2 grid max-h-28 grid-cols-8 gap-1 overflow-y-auto rounded-xl border p-2"
              style={{ borderColor: cardBorder, background: "rgba(0,0,0,.35)" }}
            >
              {EMOJIS.map((e) => (
                <button
                  key={e}
                  type="button"
                  className="rounded-lg p-1 text-lg hover:bg-white/10"
                  onClick={() => {
                    setText((t) => t + e)
                  }}
                >
                  {e}
                </button>
              ))}
            </div>
          )}

          <input
            ref={fileRef}
            type="file"
            accept="image/*,video/*"
            multiple
            className="hidden"
            onChange={(e) => handleUpload(e.target.files)}
          />

          <div className="flex items-end gap-2">
            <button
              type="button"
              onClick={() => setShowEmoji((v) => !v)}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border"
              style={{ borderColor: cardBorder, color: showEmoji ? accentColor : "rgba(200,190,170,.7)" }}
              title="Smileys"
              aria-label="Menu smiley"
            >
              <Smile className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading || pendingMedia.length >= COMMUNITY_LIMITS.MAX_MEDIA}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border disabled:opacity-40"
              style={{ borderColor: cardBorder, color: "rgba(200,190,170,.7)" }}
              title={`Photos (max ${COMMUNITY_LIMITS.PHOTO_MAX_BYTES / (1024 * 1024)} Mo) · Vidéos (max ${COMMUNITY_LIMITS.VIDEO_MAX_BYTES / (1024 * 1024)} Mo)`}
              aria-label="Joindre photos ou vidéos"
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Paperclip className="h-4 w-4" />
              )}
            </button>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, COMMUNITY_LIMITS.MAX_BODY))}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault()
                  handleSend()
                }
              }}
              rows={2}
              maxLength={COMMUNITY_LIMITS.MAX_BODY}
              placeholder="Écrire au canal…"
              className="flex-1 resize-none rounded-2xl border bg-black/30 px-3 py-2 text-sm outline-none"
              style={{ borderColor: cardBorder, color: textColor }}
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={sending || uploading || (!text.trim() && !pendingMedia.length)}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl disabled:opacity-40"
              style={{
                background: `linear-gradient(120deg,${accentColor},${primaryColor})`,
                color: isDelivery ? "#000814" : "#0f0d07",
              }}
              aria-label="Envoyer"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </div>
          <p className="mt-1.5 text-center text-[10px] opacity-40">
            Anti-spam · anti-insultes · photo ≤3 Mo · vidéo ≤6 Mo · multi OK
          </p>
        </div>
      </div>
    </div>
  )
}
