"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Loader2, ScanFace, Fingerprint, Eye, EyeOff, Shield, AlertTriangle } from "lucide-react"
import { adminLogin } from "@/app/actions/admin-auth"
import {
  startWebAuthnAuthentication, finishWebAuthnAuthentication,
  startWebAuthnRegistration, finishWebAuthnRegistration,
} from "@/app/actions/webauthn"
import { loadWebAuthnBrowser } from "@/lib/webauthn-browser"
import {
  biometryLabel, clearLocalWebAuthn, getLocalCredentialIds,
  hasLocalWebAuthn, platformAuthenticatorAvailable, rememberLocalCredential,
} from "@/lib/webauthn-client"

const ACCENT = "#ffca28"
const GRAD = "linear-gradient(120deg,#ffca28,#e65100)"
const BORDER = "rgba(255,202,40,.2)"

export default function AdminLoginPage() {
  const [token, setToken] = useState("")
  const [showToken, setShowToken] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  // WebAuthn / biometry
  const [bioAvailable, setBioAvailable] = useState(false)
  const [bioReady, setBioReady] = useState(false)
  const [bioBusy, setBioBusy] = useState(false)
  const [bioError, setBioError] = useState("")
  const [bioEnrolling, setBioEnrolling] = useState(false)
  const [bioEnrollMsg, setBioEnrollMsg] = useState<string | null>(null)
  const [justLoggedIn, setJustLoggedIn] = useState(false)

  useEffect(() => {
    setBioReady(hasLocalWebAuthn())
    ;(async () => {
      try {
        const api = await loadWebAuthnBrowser()
        if (!api?.browserSupportsWebAuthn()) return
        setBioAvailable(await platformAuthenticatorAvailable())
      } catch { /* ignore */ }
    })()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(""); setLoading(true)
    const res = await adminLogin(token)
    if (res.ok) {
      setJustLoggedIn(true)
      router.push("/admin")
    } else {
      setError(res.error ?? "Token invalide")
      setLoading(false)
    }
  }

  const loginWithBiometry = async () => {
    if (bioBusy) return
    setBioBusy(true); setBioError(""); setError("")
    try {
      const api = await loadWebAuthnBrowser()
      if (!api) { setBioError("Biométrie indisponible."); return }
      const ids = getLocalCredentialIds()
      const startRes = await startWebAuthnAuthentication(ids.length ? ids : undefined)
      if (!startRes.ok) {
        if (startRes.clearLocal) clearLocalWebAuthn()
        setBioError(startRes.error); return
      }
      const response = await api.startAuthentication({ optionsJSON: startRes.options })
      const finishRes = await finishWebAuthnAuthentication({ challengeId: startRes.challengeId, response: response as any })
      if (!finishRes.ok) {
        if (finishRes.clearLocal) clearLocalWebAuthn()
        setBioError(finishRes.error); return
      }
      // Use the client token to try admin login
      const adminRes = await adminLogin(finishRes.token)
      if (adminRes.ok) {
        router.push("/admin")
      } else {
        setBioError("Ce compte n'a pas les droits admin.")
      }
    } catch (e: any) {
      if (e?.name === "NotAllowedError") setBioError("Annulé ou délai dépassé.")
      else setBioError("Biométrie indisponible sur cet appareil.")
    } finally { setBioBusy(false) }
  }

  const enrollBiometry = async () => {
    setBioEnrolling(true); setBioEnrollMsg(null)
    try {
      const api = await loadWebAuthnBrowser()
      if (!api) { setBioEnrollMsg("Biométrie non disponible."); return }
      const startRes = await startWebAuthnRegistration(token)
      if (!startRes.ok) { setBioEnrollMsg(startRes.error); return }
      const response = await api.startRegistration({ optionsJSON: startRes.options })
      const finishRes = await finishWebAuthnRegistration({ userToken: token, challengeId: startRes.challengeId, response: response as any })
      if (!finishRes.ok) { setBioEnrollMsg(finishRes.error); return }
      rememberLocalCredential(finishRes.credentialId)
      setBioReady(true)
      setBioEnrollMsg(`${biometryLabel()} activé pour les prochaines connexions admin.`)
    } catch (e: any) {
      setBioEnrollMsg(e?.name === "NotAllowedError" ? "Activation annulée." : "Activation impossible.")
    } finally { setBioEnrolling(false) }
  }

  return (
    <main style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "radial-gradient(circle at top right,rgba(255,202,40,.12),transparent 60%),radial-gradient(circle at bottom left,rgba(230,81,0,.08),transparent 50%),#0f0d07",
      padding: 20,
    }}>
      <div style={{
        width: "100%", maxWidth: 400, borderRadius: 26,
        border: "1px solid rgba(255,202,40,.2)",
        background: "rgba(20,18,12,.97)",
        padding: "38px 30px",
        boxShadow: "0 0 40px rgba(255,202,40,.12), 0 32px 80px rgba(0,0,0,.85)",
      }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 30 }}>
          <div style={{ width: 52, height: 52, borderRadius: 16, background: "rgba(255,202,40,.1)", border: "1px solid rgba(255,202,40,.25)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
            <Shield size={24} color={ACCENT} />
          </div>
          <h1 style={{ margin: "0 0 6px", fontFamily: "Orbitron,sans-serif", fontSize: 18, fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.18em", background: GRAD, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            Panel Admin
          </h1>
          <p style={{ margin: 0, fontSize: 12, color: "rgba(200,190,170,.55)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
            Accès sécurisé — LaCentral
          </p>
        </div>

        {/* Biometry fast login */}
        {bioAvailable && bioReady && (
          <>
            <button onClick={loginWithBiometry} disabled={bioBusy}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 9,
                width: "100%", padding: "13px", borderRadius: 999,
                border: "1px solid rgba(255,202,40,.25)", background: "rgba(255,202,40,.07)",
                color: "#f5e8c7", fontSize: 14, fontWeight: 600, cursor: "pointer",
                marginBottom: 4, opacity: bioBusy ? 0.6 : 1,
              }}>
              {bioBusy
                ? <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} />
                : <ScanFace size={16} color={ACCENT} />
              }
              Connexion avec {biometryLabel()}
            </button>
            {bioError && (
              <div style={{ display: "flex", gap: 7, alignItems: "flex-start", borderRadius: 10, border: "1px solid rgba(248,113,113,.3)", background: "rgba(248,113,113,.08)", padding: "9px 12px", fontSize: 12, color: "#f87171", marginBottom: 4 }}>
                <AlertTriangle size={13} style={{ flexShrink: 0, marginTop: 1 }} />{bioError}
              </div>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "14px 0" }}>
              <div style={{ flex: 1, height: 1, background: "rgba(255,202,40,.1)" }} />
              <span style={{ fontSize: 11, color: "rgba(200,190,170,.5)" }}>ou avec le token</span>
              <div style={{ flex: 1, height: 1, background: "rgba(255,202,40,.1)" }} />
            </div>
          </>
        )}

        {/* Token form */}
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ position: "relative" }}>
            <input
              type={showToken ? "text" : "password"}
              value={token}
              onChange={(e) => setToken(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) handleSubmit(e as any) }}
              placeholder="Token admin"
              autoComplete="current-password"
              style={{
                width: "100%", padding: "13px 44px 13px 16px", borderRadius: 14,
                border: `1px solid ${BORDER}`,
                background: "rgba(0,0,0,.5)", color: "#f5e8c7", fontSize: 14,
                outline: "none", fontFamily: "monospace", letterSpacing: "0.08em",
                boxSizing: "border-box",
              }}
            />
            <button type="button" onClick={() => setShowToken(!showToken)}
              style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "rgba(200,190,170,.5)", padding: 0, display: "flex" }}>
              {showToken ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          {error && (
            <div style={{ display: "flex", gap: 7, alignItems: "flex-start", borderRadius: 10, border: "1px solid rgba(248,113,113,.3)", background: "rgba(248,113,113,.08)", padding: "9px 12px", fontSize: 12, color: "#f87171" }}>
              <AlertTriangle size={13} style={{ flexShrink: 0, marginTop: 1 }} />{error}
            </div>
          )}

          <button type="submit" disabled={loading || !token || justLoggedIn}
            style={{
              padding: "14px", borderRadius: 999, background: GRAD,
              color: "#0f0d07", fontFamily: "Orbitron,sans-serif", fontWeight: 900,
              fontSize: 13, letterSpacing: "0.14em", textTransform: "uppercase",
              border: "none", cursor: "pointer", opacity: (loading || !token || justLoggedIn) ? 0.7 : 1,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            }}>
            {loading || justLoggedIn
              ? <><Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /> Connexion...</>
              : "Accéder au panel"
            }
          </button>
        </form>

        {/* Enroll biometry after typing token */}
        {bioAvailable && !bioReady && token.startsWith("adminfc") && (
          <div style={{ marginTop: 18, borderRadius: 14, border: "1px solid rgba(255,202,40,.1)", background: "rgba(255,202,40,.04)", padding: "14px 16px" }}>
            <p style={{ margin: "0 0 10px", fontSize: 12, color: "rgba(200,190,170,.75)" }}>
              Activer {biometryLabel()} pour les prochaines connexions admin
            </p>
            <button onClick={enrollBiometry} disabled={bioEnrolling}
              style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "10px", borderRadius: 12, border: "1px solid rgba(255,202,40,.2)", background: "transparent", color: "#f5e8c7", fontSize: 13, cursor: "pointer" }}>
              {bioEnrolling
                ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />
                : <Fingerprint size={14} color={ACCENT} />
              }
              Activer {biometryLabel()}
            </button>
            {bioEnrollMsg && <p style={{ margin: "8px 0 0", fontSize: 12, color: "#4ade80" }}>{bioEnrollMsg}</p>}
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </main>
  )
}
