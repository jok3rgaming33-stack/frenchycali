"use client"

import { useEffect, useState } from "react"
import { Share, Smartphone, PlusSquare, X, Check, Download } from "lucide-react"

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

function isStandalone() {
  if (typeof window === "undefined") return false
  const nav = window.navigator as Navigator & { standalone?: boolean }
  return window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true
}

function isIos() {
  if (typeof window === "undefined") return false
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent)
}

function isSafari() {
  if (typeof window === "undefined") return false
  const ua = window.navigator.userAgent
  return /safari/i.test(ua) && !/crios|fxios|edgios|android/i.test(ua)
}

type Props = {
  accent?: string
  compact?: boolean
}

export function AddToHomeScreen({ accent = "#ffca28", compact = false }: Props) {
  const [installed, setInstalled] = useState(false)
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [iosOpen, setIosOpen] = useState(false)
  const [hint, setHint] = useState<string | null>(null)

  useEffect(() => {
    if (isStandalone()) {
      setInstalled(true)
      return
    }
    const onPrompt = (e: Event) => {
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
    }
    const onInstalled = () => setInstalled(true)
    window.addEventListener("beforeinstallprompt", onPrompt)
    window.addEventListener("appinstalled", onInstalled)
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt)
      window.removeEventListener("appinstalled", onInstalled)
    }
  }, [])

  if (installed) {
    return (
      <p
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: compact ? "flex-start" : "center",
          gap: 6,
          margin: 0,
          fontSize: 12,
          color: "rgba(74,222,128,.9)",
        }}
      >
        <Check style={{ width: 14, height: 14 }} aria-hidden />
        App installée sur l&apos;écran d&apos;accueil
      </p>
    )
  }

  const install = async () => {
    setHint(null)
    if (deferred) {
      try {
        await deferred.prompt()
        const choice = await deferred.userChoice
        if (choice.outcome === "accepted") setInstalled(true)
        setDeferred(null)
      } catch {
        setHint("Le navigateur a refusé le prompt. Utilise le menu ⋮ → Installer l'application.")
      }
      return
    }
    if (isIos()) {
      setIosOpen(true)
      return
    }
    setHint("Sur Android Chrome : menu ⋮ → « Installer l'application » ou « Ajouter à l'écran d'accueil ».")
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%" }}>
      <button
        type="button"
        onClick={() => void install()}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          minHeight: 44,
          padding: "10px 16px",
          borderRadius: 14,
          border: `1px solid ${accent}55`,
          background: `${accent}18`,
          color: accent,
          fontSize: 13,
          fontWeight: 800,
          letterSpacing: "0.04em",
          cursor: "pointer",
        }}
      >
        {deferred ? <Download style={{ width: 16, height: 16 }} /> : <Smartphone style={{ width: 16, height: 16 }} />}
        {deferred ? "Installer l'application" : "Ajouter à l'écran d'accueil"}
      </button>
      {hint && (
        <p style={{ margin: 0, fontSize: 11, lineHeight: 1.45, color: "rgba(200,190,170,.7)", textAlign: "center" }}>
          {hint}
        </p>
      )}

      {iosOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 90,
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
            background: "rgba(0,0,0,.72)",
            padding: 16,
          }}
          onClick={() => setIosOpen(false)}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 400,
              borderRadius: 24,
              border: "1px solid rgba(255,202,40,.22)",
              background: "#14120c",
              padding: 20,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
              <h2 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: "#f5e8c7" }}>Installer FrenchyCali</h2>
              <button
                type="button"
                onClick={() => setIosOpen(false)}
                aria-label="Fermer"
                style={{ background: "transparent", border: "none", color: "rgba(200,190,170,.7)", cursor: "pointer" }}
              >
                <X style={{ width: 18, height: 18 }} />
              </button>
            </div>
            <p style={{ margin: "0 0 14px", fontSize: 12, color: "rgba(200,190,170,.7)" }}>
              {isSafari()
                ? "iPhone n'affiche pas de bouton Installer : il faut passer par Safari."
                : "Ouvre ce site dans Safari (pas Chrome), puis :"}
            </p>
            <ol style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 12 }}>
              <li style={{ display: "flex", gap: 12, fontSize: 13, color: "rgba(200,190,170,.85)", lineHeight: 1.45 }}>
                <span
                  style={{
                    width: 32,
                    height: 32,
                    flexShrink: 0,
                    borderRadius: 10,
                    background: "rgba(255,202,40,.12)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: accent,
                  }}
                >
                  <Share style={{ width: 16, height: 16 }} />
                </span>
                <span>
                  Appuie sur <strong style={{ color: "#f5e8c7" }}>Partager</strong> (carré + flèche) en bas de Safari.
                </span>
              </li>
              <li style={{ display: "flex", gap: 12, fontSize: 13, color: "rgba(200,190,170,.85)", lineHeight: 1.45 }}>
                <span
                  style={{
                    width: 32,
                    height: 32,
                    flexShrink: 0,
                    borderRadius: 10,
                    background: "rgba(255,202,40,.12)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: accent,
                  }}
                >
                  <PlusSquare style={{ width: 16, height: 16 }} />
                </span>
                <span>
                  Choisis <strong style={{ color: "#f5e8c7" }}>Sur l&apos;écran d&apos;accueil</strong>, puis Ajouter.
                </span>
              </li>
            </ol>
          </div>
        </div>
      )}
    </div>
  )
}
