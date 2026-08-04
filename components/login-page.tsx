"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { createAccount, getAccount } from "@/app/actions/account"
import {
  startWebAuthnAuthentication,
  finishWebAuthnAuthentication,
  startWebAuthnRegistration,
  finishWebAuthnRegistration,
} from "@/app/actions/webauthn"
import { startAuthentication, startRegistration } from "@simplewebauthn/browser"

const CALI_LOGO = "https://i.imgur.com/amjflPT.jpeg"
const CALI_LOGO_TEAM = "https://i.imgur.com/1gye7hI.jpeg"

const LS_TOKEN = "cali_token"
const LS_PSEUDO = "cali_pseudo"
const LS_BIOMETRIC_IDS = "cali_biometric_ids"

interface LoginPageProps {
  redirectTo?: string
  shopName?: string
  shopLogo?: string
}

export default function LoginPage({ redirectTo = "/choix", shopName = "CaliPack", shopLogo }: LoginPageProps) {
  const router = useRouter()
  const [mode, setMode] = useState<"auto" | "create" | "login" | "biometric">("auto")
  const [token, setToken] = useState("")
  const [pseudo, setPseudo] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [biometricAvailable, setBiometricAvailable] = useState(false)

  useEffect(() => {
    const storedToken = localStorage.getItem(LS_TOKEN)
    const storedPseudo = localStorage.getItem(LS_PSEUDO)
    const biometricIds = JSON.parse(localStorage.getItem(LS_BIOMETRIC_IDS) || "[]") as string[]

    if (storedToken && biometricIds.length > 0) {
      setBiometricAvailable(true)
      setMode("biometric")
    } else if (storedToken) {
      handleAutoLogin(storedToken, storedPseudo || "")
    }
    // Check biometric support
    if (window.PublicKeyCredential) {
      PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable?.().then(setBiometricAvailable).catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleAutoLogin = useCallback(async (t: string, p: string) => {
    setLoading(true)
    try {
      const acc = await getAccount(t)
      if (acc) {
        localStorage.setItem(LS_TOKEN, t)
        localStorage.setItem(LS_PSEUDO, acc.pseudo)
        router.push(redirectTo)
      } else {
        setMode("login")
        setLoading(false)
      }
    } catch {
      setMode("login")
      setLoading(false)
    }
  }, [router, redirectTo])

  const handleBiometricLogin = async () => {
    setLoading(true)
    setError(null)
    try {
      const biometricIds = JSON.parse(localStorage.getItem(LS_BIOMETRIC_IDS) || "[]") as string[]
      const startRes = await startWebAuthnAuthentication(biometricIds)
      if (!startRes.ok) {
        if (startRes.clearLocal) localStorage.removeItem(LS_BIOMETRIC_IDS)
        setError(startRes.error)
        setMode("login")
        setLoading(false)
        return
      }
      const authResponse = await startAuthentication({ optionsJSON: startRes.options })
      const finishRes = await finishWebAuthnAuthentication({ challengeId: startRes.challengeId, response: authResponse })
      if (!finishRes.ok) {
        if (finishRes.clearLocal) localStorage.removeItem(LS_BIOMETRIC_IDS)
        setError(finishRes.error)
        setLoading(false)
        return
      }
      localStorage.setItem(LS_TOKEN, finishRes.token)
      localStorage.setItem(LS_PSEUDO, finishRes.pseudo)
      router.push(redirectTo)
    } catch (e: any) {
      setError(e?.message || "Biométrie annulée.")
      setLoading(false)
    }
  }

  const handleCreate = async () => {
    if (!token.trim() || !pseudo.trim()) { setError("Remplis tous les champs."); return }
    if (token.trim().length < 20) { setError("Ta clé secrète doit faire au moins 20 caractères."); return }
    setLoading(true); setError(null)
    const res = await createAccount(token.trim(), pseudo.trim())
    if (!res.ok) { setError(res.error); setLoading(false); return }
    localStorage.setItem(LS_TOKEN, token.trim())
    localStorage.setItem(LS_PSEUDO, res.pseudo)
    // Try to register biometric right after account creation
    await tryRegisterBiometric(token.trim())
    router.push(redirectTo)
  }

  const handleLogin = async () => {
    if (!token.trim()) { setError("Saisis ta clé secrète."); return }
    setLoading(true); setError(null)
    const acc = await getAccount(token.trim())
    if (!acc) { setError("Clé secrète invalide ou compte introuvable."); setLoading(false); return }
    localStorage.setItem(LS_TOKEN, token.trim())
    localStorage.setItem(LS_PSEUDO, acc.pseudo)
    await tryRegisterBiometric(token.trim())
    router.push(redirectTo)
  }

  const tryRegisterBiometric = async (userToken: string) => {
    if (!window.PublicKeyCredential) return
    try {
      const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable?.()
      if (!available) return
      const startRes = await startWebAuthnRegistration(userToken)
      if (!startRes.ok) return
      const regResponse = await startRegistration({ optionsJSON: startRes.options })
      const finishRes = await finishWebAuthnRegistration({ userToken, challengeId: startRes.challengeId, response: regResponse })
      if (finishRes.ok) {
        const existing = JSON.parse(localStorage.getItem(LS_BIOMETRIC_IDS) || "[]") as string[]
        const updated = [...new Set([...existing, finishRes.credentialId])]
        localStorage.setItem(LS_BIOMETRIC_IDS, JSON.stringify(updated))
      }
    } catch { /* silent — biométrie optionnelle */ }
  }

  const storedPseudo = typeof window !== "undefined" ? localStorage.getItem(LS_PSEUDO) : null

  if (loading && mode === "auto") {
    return (
      <div style={styles.overlay}>
        <div style={styles.spinner} />
      </div>
    )
  }

  return (
    <div style={styles.page}>
      <canvas id="login-particles" style={styles.canvas} />
      <div style={styles.card}>
        <img src={shopLogo || CALI_LOGO_TEAM} alt={shopName} style={styles.logo} />
        <h1 style={styles.title}>{shopName}</h1>
        <p style={styles.sub}>Accès sécurisé</p>

        {error && <div style={styles.errorBox}>{error}</div>}
        {success && <div style={styles.successBox}>{success}</div>}

        {mode === "biometric" && (
          <>
            <p style={styles.hint}>
              Bienvenue, <strong>{storedPseudo || "…"}</strong>
            </p>
            <button style={styles.btnPrimary} onClick={handleBiometricLogin} disabled={loading}>
              {loading ? "Vérification…" : "Déverrouiller (Face ID / Empreinte)"}
            </button>
            <button style={styles.btnGhost} onClick={() => setMode("login")}>
              Utiliser ma clé secrète
            </button>
          </>
        )}

        {(mode === "login" || mode === "create") && (
          <>
            <div style={styles.tabs}>
              <button
                style={{ ...styles.tab, ...(mode === "login" ? styles.tabActive : {}) }}
                onClick={() => { setMode("login"); setError(null) }}
              >
                Me connecter
              </button>
              <button
                style={{ ...styles.tab, ...(mode === "create" ? styles.tabActive : {}) }}
                onClick={() => { setMode("create"); setError(null) }}
              >
                Créer un compte
              </button>
            </div>

            {mode === "create" && (
              <div style={styles.field}>
                <label style={styles.label}>Mon pseudo</label>
                <input
                  style={styles.input}
                  value={pseudo}
                  onChange={(e) => setPseudo(e.target.value)}
                  placeholder="Choisis un pseudo unique"
                  autoComplete="off"
                />
              </div>
            )}

            <div style={styles.field}>
              <label style={styles.label}>Clé secrète</label>
              <input
                style={styles.input}
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder={mode === "create" ? "Invente une clé secrète (20+ car.)" : "Saisis ta clé secrète"}
                autoComplete="off"
                onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) mode === "create" ? handleCreate() : handleLogin() }}
              />
              {mode === "create" && (
                <p style={styles.hint2}>
                  Note ta clé secrète précieusement — elle est la seule façon de retrouver ton compte.
                </p>
              )}
            </div>

            <button
              style={styles.btnPrimary}
              onClick={mode === "create" ? handleCreate : handleLogin}
              disabled={loading}
            >
              {loading ? "Chargement…" : mode === "create" ? "Créer mon compte" : "Accéder"}
            </button>

            {biometricAvailable && mode === "login" && (
              <button style={styles.btnGhost} onClick={() => setMode("biometric")}>
                Utiliser Face ID / empreinte
              </button>
            )}
          </>
        )}

        <button
          style={styles.btnRecovery}
          onClick={() => router.push("/recuperation")}
        >
          Clé perdue ? Récupérer mon compte
        </button>
      </div>
      <ParticleCanvas />
    </div>
  )
}

function ParticleCanvas() {
  useEffect(() => {
    const canvas = document.getElementById("login-particles") as HTMLCanvasElement
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    let particles: { x: number; y: number; vx: number; vy: number; size: number; color: string }[] = []
    let mx = 0, my = 0, raf = 0

    function resize() {
      canvas.width = window.innerWidth; canvas.height = window.innerHeight
    }
    function init() {
      particles = []
      const count = window.innerWidth < 768 ? 50 : 100
      for (let i = 0; i < count; i++) {
        particles.push({
          x: Math.random() * canvas.width, y: Math.random() * canvas.height,
          vx: (Math.random() - 0.5) * 0.5, vy: (Math.random() - 0.5) * 0.5,
          size: Math.random() * 2 + 1,
          color: Math.random() > 0.5 ? "rgba(255,46,0,0.35)" : "rgba(255,149,0,0.3)",
        })
      }
    }
    function animate() {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      for (const p of particles) {
        const dx = mx - p.x, dy = my - p.y, dist = Math.hypot(dx, dy)
        if (dist < 160) { const f = (160 - dist) / 160; p.vx -= dx * f * 0.03; p.vy -= dy * f * 0.03 }
        p.x += p.vx; p.y += p.vy; p.vx *= 0.975; p.vy *= 0.975
        if (p.x < 0 || p.x > canvas.width) p.vx *= -1
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1
        ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill()
      }
      raf = requestAnimationFrame(animate)
    }
    const onMouseMove = (e: MouseEvent) => { mx = e.clientX; my = e.clientY }
    window.addEventListener("mousemove", onMouseMove)
    window.addEventListener("resize", () => { resize(); init() })
    resize(); init(); animate()
    return () => { cancelAnimationFrame(raf); window.removeEventListener("mousemove", onMouseMove) }
  }, [])
  return null
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
    background: "radial-gradient(circle at top left, rgba(255,60,0,0.2), transparent 60%), radial-gradient(circle at bottom right, rgba(255,149,0,0.18), transparent 60%), #0a0200",
    fontFamily: "'Inter', system-ui, sans-serif", padding: "20px", position: "relative",
  },
  canvas: { position: "fixed", inset: 0, pointerEvents: "none", zIndex: 1 },
  card: {
    position: "relative", zIndex: 2, width: "100%", maxWidth: "440px",
    background: "radial-gradient(circle at 0 0, rgba(255,140,0,0.18), transparent 55%), radial-gradient(circle at 100% 100%, rgba(255,40,0,0.2), transparent 55%), #140500",
    border: "1px solid rgba(255,180,100,0.16)", borderRadius: "24px",
    padding: "36px 28px 28px", boxShadow: "0 32px 80px rgba(0,0,0,0.85)",
    display: "flex", flexDirection: "column", alignItems: "center", gap: "12px",
  },
  logo: { width: "72px", height: "72px", borderRadius: "20px", objectFit: "cover", boxShadow: "0 0 24px rgba(255,110,0,0.8)", marginBottom: "4px" },
  title: { margin: 0, fontSize: "22px", fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "#fffaf0", fontFamily: "'Orbitron', sans-serif" },
  sub: { margin: 0, fontSize: "12px", color: "#d0b0a0", letterSpacing: "0.14em", textTransform: "uppercase" },
  tabs: { display: "flex", width: "100%", borderRadius: "12px", background: "rgba(10,2,0,0.8)", border: "1px solid rgba(255,180,100,0.12)", overflow: "hidden" },
  tab: { flex: 1, padding: "10px", background: "transparent", border: "none", color: "#d0b0a0", fontSize: "13px", cursor: "pointer", transition: "all 0.2s" },
  tabActive: { background: "linear-gradient(135deg, rgba(255,40,0,0.4), rgba(255,140,0,0.4))", color: "#fffaf0", fontWeight: 600 },
  field: { width: "100%", display: "flex", flexDirection: "column", gap: "6px" },
  label: { fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.12em", color: "#d0b0a0" },
  input: {
    width: "100%", padding: "10px 14px", borderRadius: "12px", border: "1px solid rgba(255,180,100,0.18)",
    background: "rgba(10,2,0,0.95)", color: "#fffaf0", fontSize: "14px", outline: "none",
    boxSizing: "border-box", fontFamily: "inherit",
  },
  btnPrimary: {
    width: "100%", padding: "13px", borderRadius: "999px", border: "none",
    background: "linear-gradient(120deg, #ff2e00, #ff9500)", color: "#0f0100",
    fontSize: "13px", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase",
    cursor: "pointer", boxShadow: "0 0 24px rgba(255,40,0,0.8)", transition: "all 0.2s",
  },
  btnGhost: {
    width: "100%", padding: "10px", borderRadius: "999px", border: "1px solid rgba(255,180,100,0.22)",
    background: "transparent", color: "#fffaf0", fontSize: "13px", cursor: "pointer",
  },
  btnRecovery: { background: "none", border: "none", color: "#d0b0a0", fontSize: "12px", cursor: "pointer", textDecoration: "underline", marginTop: "4px" },
  errorBox: { width: "100%", padding: "10px 14px", borderRadius: "12px", background: "rgba(220,38,38,0.15)", border: "1px solid rgba(220,38,38,0.3)", color: "#fca5a5", fontSize: "13px" },
  successBox: { width: "100%", padding: "10px 14px", borderRadius: "12px", background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.3)", color: "#86efac", fontSize: "13px" },
  hint: { margin: 0, fontSize: "14px", color: "#fffaf0", textAlign: "center" },
  hint2: { margin: "4px 0 0", fontSize: "11px", color: "#d0b0a0", lineHeight: 1.5 },
  overlay: { position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "#0a0200" },
  spinner: { width: "40px", height: "40px", borderRadius: "50%", border: "3px solid rgba(255,180,100,0.2)", borderTopColor: "#ff9500", animation: "spin 0.8s linear infinite" },
}
