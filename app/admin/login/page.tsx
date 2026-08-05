"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Loader2, ScanFace, Fingerprint, Eye, EyeOff, Shield, AlertTriangle, CheckCircle2 } from "lucide-react"
import { adminLogin, startAdminBioRegistration, finishAdminBioRegistration, startAdminBioAuthentication, finishAdminBioAuthentication } from "@/app/actions/admin-auth"
import { loadWebAuthnBrowser } from "@/lib/webauthn-browser"
import { biometryLabel, platformAuthenticatorAvailable } from "@/lib/webauthn-client"

const ACCENT = "#ffca28"
const GRAD   = "linear-gradient(120deg,#ffca28,#e65100)"
const BORDER = "rgba(255,202,40,.2)"

// ─── localStorage keys spécifiques admin ─────────────────────────────────────
const ADMIN_BIO_FLAG = "cali_admin_webauthn"
const ADMIN_BIO_IDS  = "cali_admin_webauthn_ids"

function getAdminCredIds(): string[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(ADMIN_BIO_IDS)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : []
  } catch { return [] }
}
function hasAdminBio(): boolean {
  if (typeof window === "undefined") return false
  return localStorage.getItem(ADMIN_BIO_FLAG) === "1" && getAdminCredIds().length > 0
}
function saveAdminCredId(id: string) {
  const ids = new Set(getAdminCredIds())
  ids.add(id)
  localStorage.setItem(ADMIN_BIO_IDS, JSON.stringify([...ids]))
  localStorage.setItem(ADMIN_BIO_FLAG, "1")
}
function clearAdminBio() {
  localStorage.removeItem(ADMIN_BIO_IDS)
  localStorage.removeItem(ADMIN_BIO_FLAG)
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function AdminLoginPage() {
  const [token,       setToken]       = useState("")
  const [showToken,   setShowToken]   = useState(false)
  const [error,       setError]       = useState("")
  const [loading,     setLoading]     = useState(false)
  const router = useRouter()

  // Biométrie
  const [bioAvailable,  setBioAvailable]  = useState(false)   // appareil supporte Touch ID / Face ID
  const [bioReady,      setBioReady]      = useState(false)   // credential déjà enrôlé pour cet admin
  const [bioBusy,       setBioBusy]       = useState(false)
  const [bioError,      setBioError]      = useState("")
  const [enrolling,     setEnrolling]     = useState(false)
  const [enrollMsg,     setEnrollMsg]     = useState<string | null>(null)
  const [enrollSuccess, setEnrollSuccess] = useState(false)

  useEffect(() => {
    setBioReady(hasAdminBio())
    ;(async () => {
      try {
        const api = await loadWebAuthnBrowser()
        if (!api?.browserSupportsWebAuthn()) return
        const available = await platformAuthenticatorAvailable()
        setBioAvailable(available)
      } catch { /* ignore */ }
    })()
  }, [])

  // ── Connexion token ──────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(""); setLoading(true)
    const res = await adminLogin(token)
    if (res.ok) {
      router.push("/admin")
    } else {
      setError(res.error ?? "Token invalide")
      setLoading(false)
    }
  }

  // ── Connexion biométrique ────────────────────────────────────────────────────
  const loginWithBio = async () => {
    if (bioBusy) return
    setBioBusy(true); setBioError(""); setError("")
    try {
      const api = await loadWebAuthnBrowser()
      if (!api) { setBioError("Biométrie indisponible sur cet appareil."); return }

      const ids = getAdminCredIds()
      const startRes = await startAdminBioAuthentication(ids.length ? ids : undefined)
      if (!startRes.ok) {
        if ("clearLocal" in startRes && startRes.clearLocal) clearAdminBio()
        setBioError(startRes.error)
        return
      }

      const response = await api.startAuthentication({ optionsJSON: startRes.options })

      const finishRes = await finishAdminBioAuthentication({ challengeId: startRes.challengeId, response })
      if (!finishRes.ok) {
        if ("clearLocal" in finishRes && finishRes.clearLocal) clearAdminBio()
        setBioError(finishRes.error)
        return
      }

      // Cookie admin posé côté serveur — redirect direct
      router.push("/admin")
    } catch (e: any) {
      if (e?.name === "NotAllowedError") setBioError("Annulé ou délai dépassé.")
      else setBioError("Biométrie indisponible. Utilise ton token.")
    } finally { setBioBusy(false) }
  }

  // ── Enrôlement biométrie ─────────────────────────────────────────────────────
  const enrollBio = async () => {
    setEnrolling(true); setEnrollMsg(null); setEnrollSuccess(false)
    try {
      const api = await loadWebAuthnBrowser()
      if (!api) { setEnrollMsg("Biométrie non disponible sur cet appareil."); return }

      const startRes = await startAdminBioRegistration(token)
      if (!startRes.ok) { setEnrollMsg(startRes.error); return }

      const response = await api.startRegistration({ optionsJSON: startRes.options })

      const finishRes = await finishAdminBioRegistration({
        adminToken: token,
        challengeId: startRes.challengeId,
        response,
      })
      if (!finishRes.ok) { setEnrollMsg(finishRes.error); return }

      saveAdminCredId(finishRes.credentialId)
      setBioReady(true)
      setEnrollSuccess(true)
      setEnrollMsg(`${biometryLabel()} activé — tu peux maintenant te connecter sans token.`)
    } catch (e: any) {
      setEnrollMsg(e?.name === "NotAllowedError" ? "Activation annulée." : "Activation impossible.")
    } finally { setEnrolling(false) }
  }

  const canEnroll = bioAvailable && !bioReady && token.startsWith("adminfc")

  return (
    <main style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "radial-gradient(circle at top right,rgba(255,202,40,.12),transparent 60%),radial-gradient(circle at bottom left,rgba(230,81,0,.08),transparent 50%),#0f0d07",
      padding: 20,
    }}>
      <div style={{
        width: "100%", maxWidth: 420, borderRadius: 26,
        border: `1px solid ${BORDER}`,
        background: "rgba(20,18,12,.97)",
        padding: "38px 30px",
        boxShadow: "0 0 40px rgba(255,202,40,.12), 0 32px 80px rgba(0,0,0,.85)",
      }}>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ width: 52, height: 52, borderRadius: 16, background: "rgba(255,202,40,.1)", border: `1px solid rgba(255,202,40,.25)`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
            <Shield size={24} color={ACCENT} />
          </div>
          <h1 style={{ margin: "0 0 6px", fontFamily: "Orbitron,sans-serif", fontSize: 18, fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.18em", background: GRAD, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            Panel Admin
          </h1>
          <p style={{ margin: 0, fontSize: 12, color: "rgba(200,190,170,.55)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
            Accès sécurisé — FrenchyCali
          </p>
        </div>

        {/* ── Bouton biométrie rapide (si credential déjà enrôlé) ── */}
        {bioAvailable && bioReady && (
          <>
            <button onClick={loginWithBio} disabled={bioBusy}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 9,
                width: "100%", padding: "14px", borderRadius: 999,
                border: `1px solid rgba(255,202,40,.3)`,
                background: "rgba(255,202,40,.09)",
                color: "#f5e8c7", fontSize: 14, fontWeight: 700, cursor: bioBusy ? "default" : "pointer",
                marginBottom: 6, opacity: bioBusy ? 0.65 : 1, transition: "opacity .2s",
              }}>
              {bioBusy
                ? <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} />
                : <ScanFace size={16} color={ACCENT} />
              }
              Connexion avec {biometryLabel()}
            </button>

            {bioError && (
              <div style={{ display: "flex", gap: 7, alignItems: "flex-start", borderRadius: 10, border: "1px solid rgba(248,113,113,.3)", background: "rgba(248,113,113,.08)", padding: "9px 12px", fontSize: 12, color: "#f87171", marginBottom: 8 }}>
                <AlertTriangle size={13} style={{ flexShrink: 0, marginTop: 1 }} />{bioError}
              </div>
            )}

            <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "14px 0" }}>
              <div style={{ flex: 1, height: 1, background: "rgba(255,202,40,.1)" }} />
              <span style={{ fontSize: 11, color: "rgba(200,190,170,.45)" }}>ou avec le token</span>
              <div style={{ flex: 1, height: 1, background: "rgba(255,202,40,.1)" }} />
            </div>
          </>
        )}

        {/* ── Formulaire token ── */}
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ position: "relative" }}>
            <input
              type={showToken ? "text" : "password"}
              value={token}
              onChange={e => setToken(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.nativeEvent.isComposing) handleSubmit(e as any) }}
              placeholder="Token admin (adminfc…)"
              autoComplete="current-password"
              style={{
                width: "100%", padding: "13px 44px 13px 16px", borderRadius: 14,
                border: `1px solid ${BORDER}`,
                background: "rgba(0,0,0,.5)", color: "#f5e8c7", fontSize: 14,
                outline: "none", fontFamily: "monospace", letterSpacing: "0.06em",
                boxSizing: "border-box",
              }}
            />
            <button type="button" onClick={() => setShowToken(v => !v)}
              style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "rgba(200,190,170,.5)", padding: 0, display: "flex" }}>
              {showToken ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          {error && (
            <div style={{ display: "flex", gap: 7, alignItems: "flex-start", borderRadius: 10, border: "1px solid rgba(248,113,113,.3)", background: "rgba(248,113,113,.08)", padding: "9px 12px", fontSize: 12, color: "#f87171" }}>
              <AlertTriangle size={13} style={{ flexShrink: 0, marginTop: 1 }} />{error}
            </div>
          )}

          <button type="submit" disabled={loading || !token.trim()}
            style={{
              padding: "14px", borderRadius: 999, background: GRAD,
              color: "#0f0d07", fontFamily: "Orbitron,sans-serif", fontWeight: 900,
              fontSize: 13, letterSpacing: "0.14em", textTransform: "uppercase",
              border: "none", cursor: loading || !token.trim() ? "default" : "pointer",
              opacity: loading || !token.trim() ? 0.7 : 1,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            }}>
            {loading
              ? <><Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /> Connexion...</>
              : "Accéder au panel"
            }
          </button>
        </form>

        {/* ── Bloc enrôlement (affiché quand token valide tapé et pas encore enrôlé) ── */}
        {canEnroll && (
          <div style={{ marginTop: 18, borderRadius: 14, border: `1px solid rgba(255,202,40,.12)`, background: "rgba(255,202,40,.04)", padding: "16px" }}>
            <p style={{ margin: "0 0 12px", fontSize: 13, fontWeight: 600, color: "rgba(200,190,170,.85)" }}>
              Activer {biometryLabel()} pour les prochaines connexions
            </p>
            <p style={{ margin: "0 0 12px", fontSize: 11, color: "rgba(200,190,170,.5)", lineHeight: 1.5 }}>
              Plus besoin de saisir le token — une simple vérification biométrique suffira.
            </p>
            <button onClick={enrollBio} disabled={enrolling}
              style={{
                display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "11px 14px",
                borderRadius: 12, border: `1px solid rgba(255,202,40,.22)`,
                background: "rgba(255,202,40,.06)", color: "#f5e8c7", fontSize: 13, fontWeight: 600,
                cursor: enrolling ? "default" : "pointer", opacity: enrolling ? 0.7 : 1,
              }}>
              {enrolling
                ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />
                : <Fingerprint size={14} color={ACCENT} />
              }
              {enrolling ? "Activation en cours..." : `Activer ${biometryLabel()}`}
            </button>

            {enrollMsg && (
              <div style={{ display: "flex", gap: 7, alignItems: "flex-start", marginTop: 10, padding: "9px 12px", borderRadius: 10,
                border: enrollSuccess ? "1px solid rgba(74,222,128,.3)" : "1px solid rgba(248,113,113,.3)",
                background: enrollSuccess ? "rgba(74,222,128,.07)" : "rgba(248,113,113,.07)",
                fontSize: 12, color: enrollSuccess ? "#4ade80" : "#f87171" }}>
                {enrollSuccess ? <CheckCircle2 size={13} style={{ flexShrink: 0, marginTop: 1 }} /> : <AlertTriangle size={13} style={{ flexShrink: 0, marginTop: 1 }} />}
                {enrollMsg}
              </div>
            )}
          </div>
        )}

        {/* ── Message si biométrie déjà enrôlée (après enrôlement réussi) ── */}
        {bioAvailable && bioReady && !bioBusy && (
          <p style={{ margin: "14px 0 0", textAlign: "center", fontSize: 11, color: "rgba(200,190,170,.35)" }}>
            Connecté via {biometryLabel()} sur cet appareil
          </p>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </main>
  )
}
