"use client"

import { useEffect, useState } from "react"
import { X, Star, Loader2 } from "lucide-react"
import { getProductReviews, type ProductRatingDetail } from "@/app/actions/ratings"

type Props = {
  isOpen: boolean
  onClose: () => void
  productId: number
  productTitle?: string
  accentColor?: string
  primaryColor?: string
  cardBorder?: string
  isDelivery?: boolean
}

function Stars({ value, color, size = 14 }: { value: number; color: string; size?: number }) {
  return (
    <span style={{ display: "inline-flex", gap: 2, verticalAlign: "middle" }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          style={{ width: size, height: size }}
          fill={n <= Math.round(value) ? color : "none"}
          color={n <= Math.round(value) ? color : "rgba(200,190,170,.3)"}
          strokeWidth={1.5}
        />
      ))}
    </span>
  )
}

function formatDate(d: Date | string) {
  try {
    return new Date(d).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })
  } catch {
    return "—"
  }
}

export function ProductReviewsModal({
  isOpen,
  onClose,
  productId,
  productTitle,
  accentColor = "#ffca28",
  primaryColor = "#e65100",
  cardBorder = "rgba(255,202,40,.18)",
  isDelivery = false,
}: Props) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [average, setAverage] = useState<number | null>(null)
  const [count, setCount] = useState(0)
  const [reviews, setReviews] = useState<ProductRatingDetail[]>([])

  const bg = isDelivery ? "rgba(18,0,31,.98)" : "rgba(20,18,12,.98)"
  const text = isDelivery ? "#f0f8ff" : "#f5e8c7"

  useEffect(() => {
    if (!isOpen || !productId) return
    setLoading(true)
    setError(null)
    getProductReviews(productId)
      .then((res) => {
        if (!res.ok) {
          setError(res.error)
          return
        }
        setAverage(res.average)
        setCount(res.count)
        setReviews(res.reviews)
      })
      .catch(() => setError("Impossible de charger les avis."))
      .finally(() => setLoading(false))
  }, [isOpen, productId])

  if (!isOpen) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Avis produit"
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
          maxWidth: 440,
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
              Avis clients
            </h2>
            {productTitle && (
              <p style={{ margin: "6px 0 0", fontSize: 13, fontWeight: 600, color: "rgba(200,190,170,.85)" }}>
                {productTitle}
              </p>
            )}
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
          <p style={{ color: "#f87171", fontSize: 13 }}>{error}</p>
        )}

        {!loading && !error && (
          <>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "12px 14px",
                borderRadius: 14,
                border: `1px solid ${cardBorder}`,
                background: `${accentColor}12`,
                marginBottom: 16,
              }}
            >
              <span style={{ fontSize: 28, fontWeight: 900, color: accentColor, fontFamily: "Orbitron,sans-serif" }}>
                {average != null ? average.toFixed(1) : "—"}
              </span>
              <div>
                {average != null && <Stars value={average} color={accentColor} size={16} />}
                <p style={{ margin: "4px 0 0", fontSize: 12, color: "rgba(200,190,170,.65)" }}>
                  {count === 0 ? "Aucun avis pour l'instant" : `${count} avis`}
                </p>
              </div>
            </div>

            {reviews.length === 0 ? (
              <p style={{ textAlign: "center", color: "rgba(200,190,170,.55)", fontSize: 13, padding: 16 }}>
                Sois le premier à noter ce produit après une commande livrée.
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {reviews.map((r) => (
                  <article
                    key={r.id}
                    style={{
                      padding: "12px 14px",
                      borderRadius: 14,
                      border: `1px solid ${cardBorder}`,
                      background: "rgba(255,255,255,.03)",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 700 }}>{r.userPseudo}</span>
                      <span style={{ fontSize: 11, color: "rgba(200,190,170,.5)" }}>{formatDate(r.createdAt)}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                      <Stars value={r.average} color={accentColor} />
                      <span style={{ fontSize: 12, fontWeight: 700, color: accentColor }}>{r.average.toFixed(1)}/5</span>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 12px", fontSize: 11, color: "rgba(200,190,170,.7)", marginBottom: r.comment ? 8 : 0 }}>
                      <span>Qualité : {r.quality}/5</span>
                      <span>Quantité : {r.quantity}/5</span>
                      <span>Conditionnement : {r.packaging}/5</span>
                      <span>Livraison : {r.delivery}/5</span>
                    </div>
                    {r.comment && (
                      <p style={{ margin: 0, fontSize: 12, lineHeight: 1.5, color: "rgba(200,190,170,.85)", fontStyle: "italic" }}>
                        « {r.comment} »
                      </p>
                    )}
                  </article>
                ))}
              </div>
            )}
          </>
        )}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
