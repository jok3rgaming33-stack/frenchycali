"use client"

import { useEffect, useState } from "react"
import { X, Star, Loader2, CheckCircle2 } from "lucide-react"
import {
  getRateableProducts,
  submitProductRating,
  type RateableProduct,
} from "@/app/actions/ratings"

type Props = {
  isOpen: boolean
  onClose: () => void
  threadId: number
  userToken: string
  accentColor?: string
  primaryColor?: string
  cardBorder?: string
  isDelivery?: boolean
}

type Scores = { quality: number; quantity: number; packaging: number; delivery: number }

const CRITERIA: { key: keyof Scores; label: string }[] = [
  { key: "quality", label: "Qualité" },
  { key: "quantity", label: "Quantité" },
  { key: "packaging", label: "Conditionnement" },
  { key: "delivery", label: "Livraison" },
]

function StarRow({
  value,
  onChange,
  color,
}: {
  value: number
  onChange: (n: number) => void
  color: string
}) {
  return (
    <div style={{ display: "flex", gap: 4 }} role="group">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(value === n ? 0 : n)}
          aria-label={`${n} étoile${n > 1 ? "s" : ""}`}
          style={{
            background: "transparent",
            border: "none",
            cursor: "pointer",
            padding: 2,
            color: n <= value ? color : "rgba(200,190,170,.25)",
            lineHeight: 1,
          }}
        >
          <Star
            style={{ width: 22, height: 22 }}
            fill={n <= value ? color : "none"}
            strokeWidth={1.6}
          />
        </button>
      ))}
    </div>
  )
}

export function RateProductsModal({
  isOpen,
  onClose,
  threadId,
  userToken,
  accentColor = "#ffca28",
  primaryColor = "#e65100",
  cardBorder = "rgba(255,202,40,.18)",
  isDelivery = false,
}: Props) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [list, setList] = useState<RateableProduct[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [scores, setScores] = useState<Scores>({ quality: 0, quantity: 0, packaging: 0, delivery: 0 })
  const [comment, setComment] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const bg = isDelivery ? "rgba(18,0,31,.98)" : "rgba(20,18,12,.98)"
  const text = isDelivery ? "#f0f8ff" : "#f5e8c7"

  useEffect(() => {
    if (!isOpen || !threadId || !userToken) return
    setLoading(true)
    setError(null)
    setSelectedId(null)
    setScores({ quality: 0, quantity: 0, packaging: 0, delivery: 0 })
    setComment("")
    setSuccessMsg(null)
    getRateableProducts(threadId, userToken)
      .then((res) => {
        if (!res.ok) {
          setError(res.error)
          setList([])
          return
        }
        setList(res.products)
        const first = res.products.find((p) => !p.alreadyRated)
        if (first) setSelectedId(first.productId)
      })
      .catch(() => setError("Impossible de charger les produits."))
      .finally(() => setLoading(false))
  }, [isOpen, threadId, userToken])

  if (!isOpen) return null

  const selected = list.find((p) => p.productId === selectedId) ?? null
  const avgPreview =
    Math.round(((scores.quality + scores.quantity + scores.packaging + scores.delivery) / 4) * 10) / 10

  const handleSubmit = async () => {
    if (!selected || selected.alreadyRated || submitting) return
    setSubmitting(true)
    setError(null)
    setSuccessMsg(null)
    try {
      const res = await submitProductRating(threadId, userToken, {
        productId: selected.productId,
        quality: scores.quality,
        quantity: scores.quantity,
        packaging: scores.packaging,
        delivery: scores.delivery,
        comment,
      })
      if (!res.ok) {
        setError(res.error)
        return
      }
      setList((prev) =>
        prev.map((p) => (p.productId === selected.productId ? { ...p, alreadyRated: true } : p)),
      )
      setSuccessMsg(`Merci ! Note enregistrée : ${res.average}/5`)
      setScores({ quality: 0, quantity: 0, packaging: 0, delivery: 0 })
      setComment("")
      const next = list.find((p) => p.productId !== selected.productId && !p.alreadyRated)
      setSelectedId(next?.productId ?? selected.productId)
    } catch {
      setError("Erreur réseau. Réessaie.")
    } finally {
      setSubmitting(false)
    }
  }

  const allRated = list.length > 0 && list.every((p) => p.alreadyRated)

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Noter les produits"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: "rgba(0,0,0,.75)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 460,
          maxHeight: "90vh",
          overflowY: "auto",
          borderRadius: 20,
          border: `1px solid ${cardBorder}`,
          background: bg,
          color: text,
          boxShadow: `0 0 40px ${accentColor}33, 0 24px 60px rgba(0,0,0,.8)`,
          padding: "20px 18px 18px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 14 }}>
          <div>
            <h2
              style={{
                margin: 0,
                fontFamily: "Orbitron,sans-serif",
                fontSize: 14,
                fontWeight: 900,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                background: `linear-gradient(90deg,${accentColor},${primaryColor})`,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              Noter tes produits
            </h2>
            <p style={{ margin: "6px 0 0", fontSize: 12, color: "rgba(200,190,170,.7)", lineHeight: 1.45 }}>
              Uniquement les articles de ta commande livrée. 0 à 5 étoiles par critère.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            style={{
              background: "transparent",
              border: `1px solid ${cardBorder}`,
              borderRadius: 10,
              padding: 8,
              cursor: "pointer",
              color: "rgba(200,190,170,.75)",
              display: "flex",
            }}
          >
            <X style={{ width: 16, height: 16 }} />
          </button>
        </div>

        {loading && (
          <div style={{ display: "flex", justifyContent: "center", padding: 32 }}>
            <Loader2 style={{ width: 28, height: 28, color: accentColor, animation: "spin 1s linear infinite" }} />
          </div>
        )}

        {error && (
          <p style={{ margin: "0 0 12px", padding: "10px 12px", borderRadius: 12, background: "rgba(239,68,68,.12)", border: "1px solid rgba(239,68,68,.3)", color: "#f87171", fontSize: 13 }}>
            {error}
          </p>
        )}

        {successMsg && (
          <p style={{ margin: "0 0 12px", padding: "10px 12px", borderRadius: 12, background: "rgba(34,197,94,.12)", border: "1px solid rgba(34,197,94,.3)", color: "#4ade80", fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
            <CheckCircle2 style={{ width: 16, height: 16 }} /> {successMsg}
          </p>
        )}

        {!loading && !error && list.length === 0 && (
          <p style={{ textAlign: "center", color: "rgba(200,190,170,.6)", fontSize: 13, padding: 24 }}>
            Aucun produit à noter.
          </p>
        )}

        {!loading && list.length > 0 && (
          <>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
              {list.map((p) => {
                const active = p.productId === selectedId
                return (
                  <button
                    key={p.productId}
                    type="button"
                    disabled={p.alreadyRated}
                    onClick={() => {
                      if (p.alreadyRated) return
                      setSelectedId(p.productId)
                      setScores({ quality: 0, quantity: 0, packaging: 0, delivery: 0 })
                      setComment("")
                      setSuccessMsg(null)
                    }}
                    style={{
                      textAlign: "left",
                      padding: "12px 14px",
                      borderRadius: 14,
                      border: `1px solid ${active ? accentColor : cardBorder}`,
                      background: active ? `${accentColor}18` : "rgba(255,255,255,.03)",
                      color: text,
                      cursor: p.alreadyRated ? "default" : "pointer",
                      opacity: p.alreadyRated ? 0.55 : 1,
                      fontSize: 13,
                      fontWeight: 600,
                    }}
                  >
                    {p.alreadyRated ? "✓ " : ""}
                    {p.title}
                    {p.variant ? ` · ${p.variant}` : ""}
                    {p.alreadyRated ? " — déjà noté" : ""}
                  </button>
                )
              })}
            </div>

            {allRated ? (
              <p style={{ textAlign: "center", fontSize: 13, color: accentColor, padding: "8px 0 4px" }}>
                Tous les produits de cette commande sont notés. Merci !
              </p>
            ) : selected && !selected.alreadyRated ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {CRITERIA.map((c) => (
                  <div key={c.key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "rgba(200,190,170,.85)" }}>{c.label}</span>
                    <StarRow
                      value={scores[c.key]}
                      color={accentColor}
                      onChange={(n) => setScores((s) => ({ ...s, [c.key]: n }))}
                    />
                  </div>
                ))}

                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <label style={{ fontSize: 12, color: "rgba(200,190,170,.7)" }}>Commentaire</label>
                    <span style={{ fontSize: 11, color: "rgba(200,190,170,.45)" }}>{comment.length}/200</span>
                  </div>
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value.slice(0, 200))}
                    maxLength={200}
                    rows={3}
                    placeholder="Optionnel — ton retour en quelques mots…"
                    style={{
                      width: "100%",
                      boxSizing: "border-box",
                      resize: "none",
                      borderRadius: 12,
                      border: `1px solid ${cardBorder}`,
                      background: "rgba(0,0,0,.35)",
                      color: text,
                      padding: "10px 12px",
                      fontSize: 13,
                      outline: "none",
                    }}
                  />
                </div>

                <p style={{ margin: 0, fontSize: 12, color: "rgba(200,190,170,.6)", textAlign: "center" }}>
                  Note moyenne estimée : <strong style={{ color: accentColor }}>{avgPreview}/5</strong>
                </p>

                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={submitting}
                  style={{
                    width: "100%",
                    padding: "14px 16px",
                    borderRadius: 14,
                    border: "none",
                    cursor: submitting ? "wait" : "pointer",
                    background: `linear-gradient(120deg,${accentColor},${primaryColor})`,
                    color: isDelivery ? "#000814" : "#0f0d07",
                    fontFamily: "Orbitron,sans-serif",
                    fontWeight: 900,
                    fontSize: 12,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    opacity: submitting ? 0.7 : 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                  }}
                >
                  {submitting ? <Loader2 style={{ width: 16, height: 16, animation: "spin 1s linear infinite" }} /> : null}
                  Envoyer ma note
                </button>
              </div>
            ) : null}
          </>
        )}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
