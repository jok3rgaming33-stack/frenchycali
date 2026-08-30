"use client"

import { useState, useEffect } from "react"
import { Copy, CheckCircle2, Loader2, KeyRound, Fingerprint, ScanFace, Eye, EyeOff, AlertTriangle, X, ShieldCheck, MessageCircle } from "lucide-react"
import { createAccount, getCustomerStats } from "@/app/actions/account"
import { resolveClientLogin } from "@/app/actions/staff"
import { adminLogin } from "@/app/actions/admin-auth"
import { verifyHuman } from "@/app/actions/security"
import { submitLostKeyClaim } from "@/app/actions/lost-key"
import { submitVerification } from "@/app/actions/verification"
import { SelfieVerificationModal, type VerificationMetadata } from "@/components/selfie-verification-modal"
import {
  startWebAuthnRegistration, finishWebAuthnRegistration,
  startWebAuthnAuthentication, finishWebAuthnAuthentication,
} from "@/app/actions/webauthn"
import { loadWebAuthnBrowser } from "@/lib/webauthn-browser"
import { AddToHomeScreen } from "@/components/add-to-home-screen"
import { HowItWorksModal } from "@/components/how-it-works-modal"
import {
  biometryLabel, clearLocalWebAuthn, getLocalCredentialIds,
  hasLocalWebAuthn, platformAuthenticatorAvailable, rememberLocalCredential,
} from "@/lib/webauthn-client"

const HOW_IT_WORKS_KEY = "howItWorksAccepted"

interface Props {
  onSuccess: (opts?: { openOrders?: boolean; openMessaging?: boolean }) => void
  shop: "caliboyz31" | "caliboyz94" | "calidelivery"
}

type LostKeyStep = "form" | "key" | "kyc" | "done"

export function LoginPage({ onSuccess, shop }: Props) {
  const isDelivery = shop === "calidelivery"

  // Theme-aware style helpers
  const accentGrad = isDelivery
    ? "linear-gradient(90deg,#8b00ff,#00ff9d)"
    : "linear-gradient(90deg,#ffca28,#e65100)"
  const btnStyle: React.CSSProperties = isDelivery
    ? { background: "linear-gradient(120deg,#8b00ff,#00ff9d)", color: "#000814" }
    : { background: "linear-gradient(120deg,#ffca28,#e65100)", color: "#0f0d07" }
  const cardBorder = isDelivery
    ? "1px solid rgba(0,255,170,0.18)"
    : "1px solid rgba(255,202,40,0.18)"
  const cardShadow = isDelivery
    ? "0 0 35px rgba(0,255,170,0.35),0 32px 80px rgba(0,0,0,0.85)"
    : "0 0 35px rgba(255,202,40,0.3),0 32px 80px rgba(0,0,0,0.85)"
  const cardBg = isDelivery ? "#12001f" : "rgba(20,18,12,0.92)"
  const inputBorder = isDelivery ? "rgba(0,255,170,0.2)" : "rgba(255,202,40,0.18)"
  const inputFocusBorder = isDelivery ? "#00ff9d" : "#ffca28"

  // States
  const [tab, setTab] = useState<"create" | "login">("create")
  const [showKey, setShowKey] = useState(false)
  const [loginInput, setLoginInput] = useState("")
  const [creating, setCreating] = useState(false)
  const [loggingIn, setLoggingIn] = useState(false)
  const [generatedKey, setGeneratedKey] = useState("")
  const [generatedPseudo, setGeneratedPseudo] = useState("")
  const [showResultModal, setShowResultModal] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState("")
  const [errorCreate, setErrorCreate] = useState("")
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [stats, setStats] = useState<{ points: number; active: number; past: number } | null>(null)
  // Bio
  const [bioAvailable, setBioAvailable] = useState(false)
  const [bioReady, setBioReady] = useState(false)
  const [bioBusy, setBioBusy] = useState(false)
  const [bioError, setBioError] = useState("")
  const [bioEnrolling, setBioEnrolling] = useState(false)
  const [bioEnrollMsg, setBioEnrollMsg] = useState<string | null>(null)
  // Lost key recovery (clé perdue → compte provisoire → KYC → validation admin)
  const [showLostKey, setShowLostKey] = useState(false)
  const [lostKeyStep, setLostKeyStep] = useState<LostKeyStep>("form")
  const [lostKeyPseudo, setLostKeyPseudo] = useState("")
  const [lostKeyMsg, setLostKeyMsg] = useState("")
  const [lostKeySubmitting, setLostKeySubmitting] = useState(false)
  const [lostKeyError, setLostKeyError] = useState("")
  const [lostKeyToken, setLostKeyToken] = useState("")
  const [lostKeyProvPseudo, setLostKeyProvPseudo] = useState("")
  const [lostKeyCopied, setLostKeyCopied] = useState(false)
  const [kycSubmitting, setKycSubmitting] = useState(false)
  const [kycError, setKycError] = useState<string | null>(null)
  const [howOpen, setHowOpen] = useState(false)

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

  const generatePseudo = () => {
    const a = ["Cool","Fast","Zen","Bold","Wild","Slick","Sharp","Dark"]
    const n = ["Cat","Fox","Bear","Wolf","Hawk","Lynx","Ghost","Storm"]
    return a[Math.floor(Math.random()*a.length)] + n[Math.floor(Math.random()*n.length)]
  }

  const generateKey = () => {
    const arr = new Uint8Array(32); crypto.getRandomValues(arr)
    return btoa(String.fromCharCode(...arr)).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"")
  }

  const createAnonymousAccess = async () => {
    if (creating) return
    // Gate : lecture obligatoire de « Comment ça marche » avant création
    try {
      if (localStorage.getItem(HOW_IT_WORKS_KEY) !== "1") {
        setHowOpen(true)
        return
      }
    } catch {
      setHowOpen(true)
      return
    }
    await runCreateAccount()
  }

  const runCreateAccount = async () => {
    if (creating) return
    setCreating(true); setErrorCreate("")
    const key = generateKey()
    try {
      const human = await verifyHuman("unavailable")
      if (!human.ok) { setErrorCreate(human.error ?? "Vérification échouée."); return }
      // Retry si collision de pseudo (rare)
      let res: Awaited<ReturnType<typeof createAccount>> | null = null
      let pseudo = generatePseudo()
      for (let attempt = 0; attempt < 5; attempt++) {
        pseudo = attempt === 0 ? pseudo : generatePseudo() + String(Math.floor(Math.random() * 90 + 10))
        res = await createAccount(key, pseudo)
        if (res.ok) break
        if (!res.error?.includes("déjà pris")) break
      }
      if (!res?.ok) { setErrorCreate(res?.error ?? "Impossible de créer le compte."); return }
      const finalPseudo = res.pseudo ?? pseudo
      setGeneratedKey(key); setGeneratedPseudo(finalPseudo)
      localStorage.setItem("authToken", key); localStorage.setItem("userPseudo", finalPseudo)
      localStorage.removeItem("isAdmin")
      setShowResultModal(true)
    } catch { setErrorCreate("Impossible de créer le compte. Réessaie.") }
    finally { setCreating(false) }
  }

  const onHowItWorksConfirmed = () => {
    try { localStorage.setItem(HOW_IT_WORKS_KEY, "1") } catch { /* ignore */ }
    setHowOpen(false)
    void runCreateAccount()
  }

  const loginWithKey = async () => {
    const token = loginInput.trim()
    if (token.length < 30) { setError("Clé secrète trop courte."); return }
    if (loggingIn) return
    setError(""); setBioError(""); setLoggingIn(true)
    try {
      const adminRes = await adminLogin(token)
      if (adminRes.ok) {
        localStorage.setItem("authToken", token); localStorage.setItem("isAdmin","1")
        const dest =
          adminRes.needsShopAssignment
            ? "/admin?needsShop=1"
            : adminRes.shop && adminRes.shop !== "all"
              ? `/admin/${adminRes.shop}`
              : "/admin"
        window.location.href = dest
        return
      }
      const resolved = await resolveClientLogin(token)
      if (!resolved.ok) { setError("Clé secrète invalide ou compte inexistant."); return }
      localStorage.removeItem("isAdmin")
      localStorage.setItem("authToken", resolved.token!); localStorage.setItem("userPseudo", resolved.pseudo!)
      setGeneratedPseudo(resolved.pseudo!); setIsLoggedIn(true)
    } catch { setError("Connexion impossible. Réessaie.") }
    finally { setLoggingIn(false) }
  }

  const loginWithBiometry = async () => {
    if (bioBusy) return
    setBioBusy(true); setBioError("")
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
      localStorage.setItem("authToken", finishRes.token); localStorage.setItem("userPseudo", finishRes.pseudo)
      localStorage.removeItem("isAdmin")
      setGeneratedPseudo(finishRes.pseudo); setIsLoggedIn(true)
    } catch (e: any) {
      if (e?.name === "NotAllowedError") setBioError("Annulé ou délai dépassé.")
      else setBioError("Biométrie indisponible.")
    } finally { setBioBusy(false) }
  }

  const enrollBiometry = async () => {
    const token = typeof window !== "undefined" ? localStorage.getItem("authToken") : null
    if (!token) return
    setBioEnrolling(true); setBioEnrollMsg(null)
    try {
      const api = await loadWebAuthnBrowser()
      if (!api) { setBioEnrollMsg("Biométrie non disponible sur cet appareil."); return }
      const startRes = await startWebAuthnRegistration(token)
      if (!startRes.ok) { setBioEnrollMsg(startRes.error); return }
      const response = await api.startRegistration({ optionsJSON: startRes.options })
      const finishRes = await finishWebAuthnRegistration({ userToken: token, challengeId: startRes.challengeId, response: response as any })
      if (!finishRes.ok) { setBioEnrollMsg(finishRes.error); return }
      rememberLocalCredential(finishRes.credentialId); setBioReady(true)
      setBioEnrollMsg(`${biometryLabel()} activé avec succès.`)
    } catch (e: any) {
      setBioEnrollMsg(e?.name === "NotAllowedError" ? "Activation annulée." : "Activation impossible.")
    } finally { setBioEnrolling(false) }
  }

  const copyKey = async () => {
    await navigator.clipboard.writeText(generatedKey); setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  const resetLostKeyModal = () => {
    setShowLostKey(false)
    setLostKeyStep("form")
    setLostKeyPseudo("")
    setLostKeyMsg("")
    setLostKeyError("")
    setLostKeyToken("")
    setLostKeyProvPseudo("")
    setLostKeyCopied(false)
    setKycError(null)
    setKycSubmitting(false)
  }

  const persistProvisionalSession = (token: string, pseudo: string) => {
    localStorage.setItem("authToken", token)
    localStorage.setItem("userPseudo", pseudo)
    localStorage.removeItem("isAdmin")
    localStorage.removeItem("adminPreview")
    setGeneratedPseudo(pseudo)
  }

  const submitLostKey = async () => {
    if (lostKeySubmitting || !lostKeyPseudo.trim()) return
    setLostKeySubmitting(true)
    setLostKeyError("")
    try {
      const res = await submitLostKeyClaim({
        claimedPseudo: lostKeyPseudo.trim(),
        message: lostKeyMsg.trim() || undefined,
      })
      if (!res.ok) {
        setLostKeyError(res.error || "Impossible d'ouvrir le dossier de récupération.")
        return
      }
      setLostKeyToken(res.provisionalToken)
      setLostKeyProvPseudo(res.provisionalPseudo)
      persistProvisionalSession(res.provisionalToken, res.provisionalPseudo)
      setLostKeyStep("key")
    } catch {
      setLostKeyError("Erreur réseau. Réessaie dans un instant.")
    } finally {
      setLostKeySubmitting(false)
    }
  }

  const copyLostKey = async () => {
    if (!lostKeyToken) return
    await navigator.clipboard.writeText(lostKeyToken)
    setLostKeyCopied(true)
    setTimeout(() => setLostKeyCopied(false), 2500)
  }

  const handleRecoveryKyc = async (photo: File, video: File, meta: VerificationMetadata) => {
    const token = lostKeyToken || localStorage.getItem("authToken")
    if (!token) {
      setKycError("Session provisoire introuvable. Recommence la récupération.")
      return
    }
    setKycSubmitting(true)
    setKycError(null)
    try {
      const upload = async (file: File, kind: "photo" | "video") => {
        const fd = new FormData()
        fd.append("file", file)
        fd.append("token", token)
        fd.append("kind", kind)
        const res = await fetch("/api/verification/upload", { method: "POST", body: fd })
        if (!res.ok) throw new Error("upload failed")
        const data = (await res.json()) as { pathname: string }
        return data.pathname
      }
      const [photoPathname, videoPathname] = await Promise.all([
        upload(photo, "photo"),
        upload(video, "video"),
      ])
      const saved = await submitVerification({
        token,
        photoPathname,
        videoPathname,
        siteName: meta.siteName,
        recordedAt: meta.recordedAt,
      })
      if (!saved.ok) {
        setKycError(saved.error ?? "Échec de l'enregistrement. Réessaie.")
        return
      }
      setLostKeyStep("done")
    } catch {
      setKycError("Échec de l'envoi. Vérifie ta connexion et réessaie.")
    } finally {
      setKycSubmitting(false)
    }
  }

  const finishRecoveryToShop = (openMessaging = false) => {
    if (lostKeyToken && lostKeyProvPseudo) {
      persistProvisionalSession(lostKeyToken, lostKeyProvPseudo)
    }
    resetLostKeyModal()
    onSuccess({ openMessaging })
  }

  useEffect(() => {
    if (!isLoggedIn) return
    const token = localStorage.getItem("authToken")
    if (!token) return
    getCustomerStats(token).then(setStats).catch(() => {})
  }, [isLoggedIn])

  const logo = isDelivery ? "https://i.imgur.com/K6NwuvJ.png" : "https://i.imgur.com/1gye7hI.jpeg"
  const shopLabel = shop === "caliboyz31" ? "LaCentral 31" : shop === "caliboyz94" ? "LaCentral IDF" : "CaliDelivery"

  // --- SUCCESS MODAL (key display) ---
  if (showResultModal) return (
    <div style={{ display:"flex", minHeight:"100vh", alignItems:"center", justifyContent:"center", padding:"16px" }}>
      <div style={{ position:"relative", zIndex:10, width:"100%", maxWidth:"400px", background:cardBg, border:cardBorder, borderRadius:"24px", padding:"32px 24px", boxShadow:cardShadow }}>
        <div style={{ textAlign:"center", marginBottom:"24px" }}>
          <CheckCircle2 style={{ margin:"0 auto 12px", width:48, height:48, color:"#4ade80" }} />
          <h2 style={{ margin:0, fontFamily:"Orbitron,sans-serif", fontSize:"18px", fontWeight:900, textTransform:"uppercase", letterSpacing:"0.2em", background:accentGrad, WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>Compte créé !</h2>
          <p style={{ margin:"8px 0 0", fontSize:"14px", color:"rgba(200,190,170,0.8)" }}>Pseudo : <strong style={{ color:"#f5e8c7" }}>{generatedPseudo}</strong></p>
        </div>
        <div style={{ marginBottom:"16px", borderRadius:"16px", border:"1px solid rgba(245,158,11,0.35)", background:"rgba(245,158,11,0.08)", padding:"16px" }}>
          <p style={{ margin:"0 0 8px", fontSize:"11px", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.1em", color:"#fbbf24" }}>Ta clé secrète — NOTE-LA !</p>
          <div style={{ display:"flex", gap:8, alignItems:"center" }}>
            <code style={{ flex:1, wordBreak:"break-all", borderRadius:"10px", background:"rgba(0,0,0,0.4)", padding:"8px 10px", fontSize:"11px", color:"#f5e8c7" }}>{generatedKey}</code>
            <button onClick={copyKey} style={{ flexShrink:0, borderRadius:"10px", background:copied?"rgba(74,222,128,0.2)":"rgba(255,202,40,0.15)", border:"none", padding:8, cursor:"pointer" }}>
              {copied ? <CheckCircle2 style={{ width:16, height:16, color:"#4ade80" }} /> : <Copy style={{ width:16, height:16, color:"#ffca28" }} />}
            </button>
          </div>
        </div>
        <p style={{ margin:"0 0 20px", textAlign:"center", fontSize:"12px", color:"rgba(200,190,170,0.7)" }}>Sans cette clé, l&apos;accès à ton compte sera définitivement perdu.</p>
        <button onClick={() => { setShowResultModal(false); setIsLoggedIn(true) }}
          style={{ ...btnStyle, width:"100%", padding:"14px", borderRadius:"999px", border:"none", fontSize:"14px", fontWeight:700, letterSpacing:"0.12em", textTransform:"uppercase", cursor:"pointer" }}>
          Continuer
        </button>
      </div>
    </div>
  )

  // --- LOGGED IN DASHBOARD ---
  if (isLoggedIn) return (
    <div style={{ display:"flex", minHeight:"100vh", alignItems:"center", justifyContent:"center", padding:"16px" }}>
      <div style={{ position:"relative", zIndex:10, width:"100%", maxWidth:"400px", background:cardBg, border:cardBorder, borderRadius:"24px", padding:"32px 24px", boxShadow:cardShadow }}>
        <div style={{ textAlign:"center", marginBottom:"24px" }}>
          <CheckCircle2 style={{ margin:"0 auto 12px", width:40, height:40, color:"#4ade80" }} />
          <h2 style={{ margin:0, fontFamily:"Orbitron,sans-serif", fontSize:"18px", fontWeight:900, textTransform:"uppercase", letterSpacing:"0.15em", background:accentGrad, WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>Connecté</h2>
          <p style={{ margin:"6px 0 0", fontSize:"14px", color:"rgba(200,190,170,0.8)" }}>Bienvenue, <strong style={{ color:"#f5e8c7" }}>{generatedPseudo}</strong></p>
        </div>
        {stats && (
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10, marginBottom:20 }}>
            {[
              { label:"Points fidélité", value:stats.points, accent:true },
              { label:"Commandes actives", value:stats.active },
              { label:"Passées", value:stats.past },
            ].map((s) => (
              <div key={s.label} style={{ borderRadius:14, border:"1px solid rgba(255,202,40,0.12)", background:"rgba(255,202,40,0.04)", padding:"12px 8px", textAlign:"center" }}>
                <p style={{ margin:0, fontSize:20, fontWeight:700, color: s.accent ? "#ffca28" : "#f5e8c7" }}>{s.value}</p>
                <p style={{ margin:"4px 0 0", fontSize:10, color:"rgba(200,190,170,0.7)", lineHeight:1.3 }}>{s.label}</p>
              </div>
            ))}
          </div>
        )}
        {bioAvailable && !bioReady && (
          <div style={{ marginBottom:16, borderRadius:14, border:"1px solid rgba(255,202,40,0.12)", background:"rgba(255,202,40,0.04)", padding:14 }}>
            <p style={{ margin:"0 0 8px", fontSize:12, color:"rgba(200,190,170,0.8)" }}>Activer le déverrouillage rapide sur cet appareil</p>
            <button onClick={enrollBiometry} disabled={bioEnrolling} style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:8, width:"100%", padding:"10px", borderRadius:12, border:"1px solid rgba(255,202,40,0.2)", background:"transparent", color:"#f5e8c7", fontSize:13, cursor:"pointer" }}>
              {bioEnrolling ? <Loader2 style={{ width:14, height:14, animation:"spin 1s linear infinite" }} /> : <Fingerprint style={{ width:14, height:14, color:"#ffca28" }} />}
              Activer {biometryLabel()}
            </button>
            {bioEnrollMsg && <p style={{ margin:"8px 0 0", textAlign:"center", fontSize:12, color:"#4ade80" }}>{bioEnrollMsg}</p>}
          </div>
        )}
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          <button onClick={() => onSuccess({ openOrders: true })} style={{ width:"100%", padding:"12px", borderRadius:999, border:"1px solid rgba(255,202,40,0.2)", background:"transparent", color:"#f5e8c7", fontSize:13, fontWeight:500, cursor:"pointer" }}>
            Mes commandes
          </button>
          <button onClick={() => onSuccess()} style={{ ...btnStyle, width:"100%", padding:"14px", borderRadius:999, border:"none", fontSize:13, fontWeight:700, letterSpacing:"0.12em", textTransform:"uppercase", cursor:"pointer" }}>
            Voir le catalogue
          </button>
        </div>
      </div>
    </div>
  )

  // --- MAIN LOGIN FORM ---
  return (
    <div style={{ display:"flex", minHeight:"100vh", alignItems:"center", justifyContent:"center", padding:"16px" }}>
      <div style={{ position:"relative", zIndex:10, width:"100%", maxWidth:"420px", background:cardBg, border:cardBorder, borderRadius:"26px", padding:"36px 28px", boxShadow:cardShadow }}>
        {/* Logo */}
        <div style={{ textAlign:"center", marginBottom:28 }}>
          <img src={logo} alt={shopLabel} style={{ width:76, height:76, borderRadius:20, objectFit:"cover", boxShadow:"0 0 28px rgba(255,110,0,0.7)", marginBottom:14 }} />
          <h1 style={{ margin:0, fontFamily:"Orbitron,sans-serif", fontSize:22, fontWeight:900, textTransform:"uppercase", letterSpacing:"0.18em", background:accentGrad, WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>{shopLabel}</h1>
          <p style={{ margin:"6px 0 0", fontSize:11, textTransform:"uppercase", letterSpacing:"0.14em", color:"rgba(200,190,170,0.7)" }}>Accès Sécurisé</p>
        </div>

        {/* Biometry fast login */}
        {bioAvailable && bioReady && (
          <>
            <button onClick={loginWithBiometry} disabled={bioBusy} style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:8, width:"100%", padding:"13px", borderRadius:999, border:"1px solid rgba(255,202,40,0.22)", background:"rgba(255,202,40,0.06)", color:"#f5e8c7", fontSize:14, fontWeight:600, cursor:"pointer", marginBottom:4 }}>
              {bioBusy ? <Loader2 style={{ width:16, height:16, animation:"spin 1s linear infinite" }} /> : <ScanFace style={{ width:16, height:16, color:"#ffca28" }} />}
              Déverrouiller avec {biometryLabel()}
            </button>
            {bioError && <p style={{ margin:"4px 0 12px", textAlign:"center", fontSize:12, color:"#f87171" }}>{bioError}</p>}
            <div style={{ display:"flex", alignItems:"center", gap:10, margin:"12px 0" }}>
              <div style={{ flex:1, height:1, background:"rgba(255,202,40,0.12)" }} />
              <span style={{ fontSize:11, color:"rgba(200,190,170,0.6)" }}>ou</span>
              <div style={{ flex:1, height:1, background:"rgba(255,202,40,0.12)" }} />
            </div>
          </>
        )}

        {/* Tabs */}
        <div style={{ display:"flex", borderRadius:14, border:"1px solid rgba(255,202,40,0.12)", background:"rgba(255,202,40,0.04)", padding:4, marginBottom:20 }}>
          {(["create","login"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} style={{ flex:1, padding:"9px 4px", borderRadius:11, border:"none", fontSize:13, fontWeight:600, cursor:"pointer", transition:"all 0.2s",
              ...(tab===t ? { ...btnStyle, boxShadow:"0 2px 8px rgba(0,0,0,0.4)" } : { background:"transparent", color:"rgba(200,190,170,0.7)" }) }}>
              {t === "create" ? "Créer un accès" : "J'ai une clé"}
            </button>
          ))}
        </div>

        {/* Create tab */}
        {tab === "create" && (
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            <p style={{ margin:0, fontSize:12, lineHeight:1.6, color:"rgba(200,190,170,0.8)" }}>
              Accès 100% anonyme. Une clé secrète unique est générée — c&apos;est ton seul moyen de te reconnecter. <strong style={{ color:"#fbbf24" }}>Note-la sur papier.</strong>
            </p>
            {errorCreate && (
              <div style={{ display:"flex", gap:8, alignItems:"flex-start", borderRadius:12, border:"1px solid rgba(248,113,113,0.35)", background:"rgba(248,113,113,0.1)", padding:"10px 12px", fontSize:12, color:"#f87171" }}>
                <AlertTriangle style={{ width:14, height:14, flexShrink:0, marginTop:1 }} />
                {errorCreate}
              </div>
            )}
            <button onClick={createAnonymousAccess} disabled={creating} style={{ ...btnStyle, display:"flex", alignItems:"center", justifyContent:"center", gap:8, width:"100%", padding:"14px", borderRadius:999, border:"none", fontSize:14, fontWeight:700, letterSpacing:"0.12em", textTransform:"uppercase", cursor:"pointer", opacity:creating?0.6:1 }}>
              {creating && <Loader2 style={{ width:16, height:16, animation:"spin 1s linear infinite" }} />}
              Créer mon accès anonyme
            </button>
            <button type="button" onClick={()=>{ setShowLostKey(true); setLostKeyStep("form"); setLostKeyError("") }} style={{ background:"none", border:"none", cursor:"pointer", fontSize:12, color:"rgba(200,190,170,0.7)", textDecoration:"underline", padding:0, textAlign:"center" }}>
              Clé perdue ? Récupérer mon compte
            </button>
          </div>
        )}

        {/* Login tab */}
        {tab === "login" && (
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
              <label style={{ fontSize:11, textTransform:"uppercase", letterSpacing:"0.12em", color:"rgba(200,190,170,0.8)" }}>Ta clé secrète</label>
              <div style={{ position:"relative" }}>
                <input type={showKey?"text":"password"} value={loginInput} onChange={(e)=>setLoginInput(e.target.value)}
                  onKeyDown={(e)=>{ if(e.key==="Enter" && !e.nativeEvent.isComposing) loginWithKey() }}
                  placeholder="Colle ta clé secrète ici" autoComplete="off" spellCheck={false}
                  style={{ width:"100%", padding:"12px 44px 12px 14px", borderRadius:14, border:`1px solid ${inputBorder}`, background:"rgba(0,0,0,0.5)", color:"#f5e8c7", fontSize:13, outline:"none", boxSizing:"border-box", fontFamily:"inherit",
                    transition:"border-color 0.2s" }}
                  onFocus={(e)=>(e.target.style.borderColor=inputFocusBorder)}
                  onBlur={(e)=>(e.target.style.borderColor=inputBorder)}
                />
                <button type="button" onClick={()=>setShowKey(!showKey)} style={{ position:"absolute", right:12, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer", color:"rgba(200,190,170,0.6)", padding:0 }}>
                  {showKey ? <EyeOff style={{ width:16, height:16 }} /> : <Eye style={{ width:16, height:16 }} />}
                </button>
              </div>
            </div>
            {error && <p style={{ margin:0, fontSize:12, color:"#f87171" }}>{error}</p>}
            <button onClick={loginWithKey} disabled={loggingIn} style={{ ...btnStyle, display:"flex", alignItems:"center", justifyContent:"center", gap:8, width:"100%", padding:"14px", borderRadius:999, border:"none", fontSize:14, fontWeight:700, letterSpacing:"0.12em", textTransform:"uppercase", cursor:"pointer", opacity:loggingIn?0.6:1 }}>
              {loggingIn ? <Loader2 style={{ width:16, height:16, animation:"spin 1s linear infinite" }} /> : <KeyRound style={{ width:16, height:16 }} />}
              Se connecter
            </button>
            <button onClick={()=>setShowLostKey(true)} style={{ background:"none", border:"none", cursor:"pointer", fontSize:12, color:"rgba(200,190,170,0.7)", textDecoration:"underline", padding:0, textAlign:"center" }}>
              Clé perdue ? Récupérer mon compte
            </button>
          </div>
        )}
        <div style={{ marginTop: 18 }}>
          <AddToHomeScreen accent={isDelivery ? "#00ff9d" : "#ffca28"} compact />
        </div>
      </div>

      {/* Lost key recovery modal — form → clé provisoire → KYC → attente admin */}
      {showLostKey && (
        <div style={{ position:"fixed", inset:0, zIndex:50, display:"flex", alignItems:"center", justifyContent:"center", background:"rgba(0,0,0,0.8)", padding:16, overflowY:"auto" }}>
          <div style={{ width:"100%", maxWidth: lostKeyStep === "kyc" ? 480 : 400, maxHeight:"92vh", overflowY:"auto", background:cardBg, border:cardBorder, borderRadius:24, padding:"28px 24px", boxShadow:cardShadow, margin:"auto" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
              <h2 style={{ margin:0, fontFamily:"Orbitron,sans-serif", fontSize:14, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.1em", color:"#f5e8c7" }}>
                {lostKeyStep === "form" && "Récupération de compte"}
                {lostKeyStep === "key" && "Clé provisoire"}
                {lostKeyStep === "kyc" && "Vérification d'identité"}
                {lostKeyStep === "done" && "Dossier envoyé"}
              </h2>
              {lostKeyStep !== "kyc" && (
                <button type="button" onClick={resetLostKeyModal} style={{ background:"none", border:"none", cursor:"pointer", color:"rgba(200,190,170,0.7)", padding:4 }} aria-label="Fermer">
                  <X style={{ width:18, height:18 }} />
                </button>
              )}
            </div>

            {/* Étape 1 — demande */}
            {lostKeyStep === "form" && (
              <>
                <p style={{ margin:"0 0 14px", fontSize:12, lineHeight:1.6, color:"rgba(200,190,170,0.8)" }}>
                  Indique le pseudo du compte à récupérer. Un accès provisoire sera créé, tu devras refaire le KYC, puis l&apos;admin validera (ou refusera) le rattachement. Tu pourras aussi écrire au vendeur dans la messagerie.
                </p>
                <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                  <input
                    value={lostKeyPseudo}
                    onChange={(e)=>setLostKeyPseudo(e.target.value)}
                    placeholder="Ton pseudo (compte d'origine)"
                    autoComplete="off"
                    style={{ padding:"10px 14px", borderRadius:12, border:`1px solid ${inputBorder}`, background:"rgba(0,0,0,0.5)", color:"#f5e8c7", fontSize:13, outline:"none", fontFamily:"inherit" }}
                  />
                  <textarea
                    value={lostKeyMsg}
                    onChange={(e)=>setLostKeyMsg(e.target.value)}
                    placeholder="Infos utiles pour l'admin (optionnel) — commandes, dates…"
                    rows={3}
                    style={{ padding:"10px 14px", borderRadius:12, border:`1px solid ${inputBorder}`, background:"rgba(0,0,0,0.5)", color:"#f5e8c7", fontSize:13, outline:"none", fontFamily:"inherit", resize:"none" }}
                  />
                  {lostKeyError && (
                    <div style={{ display:"flex", gap:8, alignItems:"flex-start", borderRadius:12, border:"1px solid rgba(248,113,113,0.35)", background:"rgba(248,113,113,0.1)", padding:"10px 12px", fontSize:12, color:"#f87171" }}>
                      <AlertTriangle style={{ width:14, height:14, flexShrink:0, marginTop:1 }} />
                      {lostKeyError}
                    </div>
                  )}
                  <div style={{ display:"flex", gap:8 }}>
                    <button type="button" onClick={resetLostKeyModal} style={{ flex:1, padding:"10px", borderRadius:999, border:"1px solid rgba(255,202,40,0.2)", background:"transparent", color:"rgba(200,190,170,0.8)", fontSize:13, cursor:"pointer" }}>Annuler</button>
                    <button
                      type="button"
                      disabled={lostKeySubmitting || !lostKeyPseudo.trim()}
                      onClick={submitLostKey}
                      style={{ ...btnStyle, flex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:6, padding:"10px", borderRadius:999, border:"none", fontSize:13, fontWeight:700, cursor:"pointer", opacity:lostKeySubmitting||!lostKeyPseudo.trim()?0.5:1 }}
                    >
                      {lostKeySubmitting ? <Loader2 style={{ width:14, height:14, animation:"spin 1s linear infinite" }} /> : null}
                      {lostKeySubmitting ? "Envoi…" : "Continuer"}
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* Étape 2 — clé provisoire à noter */}
            {lostKeyStep === "key" && (
              <>
                <div style={{ textAlign:"center", marginBottom:16 }}>
                  <CheckCircle2 style={{ margin:"0 auto 10px", width:40, height:40, color:"#4ade80" }} />
                  <p style={{ margin:0, fontSize:13, color:"rgba(200,190,170,0.85)", lineHeight:1.55 }}>
                    Compte provisoire créé{lostKeyProvPseudo ? <> (<strong style={{ color:"#f5e8c7" }}>{lostKeyProvPseudo}</strong>)</> : null}.
                    Note cette clé — c&apos;est ton accès en attendant la validation.
                  </p>
                </div>
                <div style={{ marginBottom:16, borderRadius:16, border:"1px solid rgba(245,158,11,0.35)", background:"rgba(245,158,11,0.08)", padding:14 }}>
                  <p style={{ margin:"0 0 8px", fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.1em", color:"#fbbf24" }}>Clé provisoire — NOTE-LA</p>
                  <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                    <code style={{ flex:1, wordBreak:"break-all", borderRadius:10, background:"rgba(0,0,0,0.4)", padding:"8px 10px", fontSize:11, color:"#f5e8c7" }}>{lostKeyToken}</code>
                    <button type="button" onClick={copyLostKey} style={{ flexShrink:0, borderRadius:10, background:lostKeyCopied?"rgba(74,222,128,0.2)":"rgba(255,202,40,0.15)", border:"none", padding:8, cursor:"pointer" }}>
                      {lostKeyCopied ? <CheckCircle2 style={{ width:16, height:16, color:"#4ade80" }} /> : <Copy style={{ width:16, height:16, color:"#ffca28" }} />}
                    </button>
                  </div>
                </div>
                <p style={{ margin:"0 0 16px", fontSize:12, lineHeight:1.55, color:"rgba(200,190,170,0.75)" }}>
                  Prochaine étape obligatoire : refaire le KYC (selfie + vidéo). L&apos;admin validera ensuite le rattachement à <strong style={{ color:"#f5e8c7" }}>{lostKeyPseudo || "ton compte"}</strong>.
                </p>
                <button
                  type="button"
                  onClick={() => setLostKeyStep("kyc")}
                  style={{ ...btnStyle, display:"flex", alignItems:"center", justifyContent:"center", gap:8, width:"100%", padding:13, borderRadius:999, border:"none", fontSize:13, fontWeight:700, cursor:"pointer", marginBottom:10 }}
                >
                  <ShieldCheck style={{ width:16, height:16 }} />
                  Passer le KYC maintenant
                </button>
                <button
                  type="button"
                  onClick={() => finishRecoveryToShop(true)}
                  style={{ width:"100%", padding:11, borderRadius:999, border:"1px solid rgba(255,202,40,0.22)", background:"transparent", color:"rgba(200,190,170,0.9)", fontSize:12, cursor:"pointer" }}
                >
                  Faire le KYC plus tard (ouvrir la messagerie)
                </button>
              </>
            )}

            {/* Étape 3 — KYC */}
            {lostKeyStep === "kyc" && (
              <>
                <p style={{ margin:"0 0 14px", fontSize:12, lineHeight:1.55, color:"rgba(200,190,170,0.8)" }}>
                  Même procédure que pour une 1<sup>re</sup> commande. Une fois validé par l&apos;admin, tes commandes, messages et points seront rattachés.
                </p>
                <SelfieVerificationModal
                  onComplete={handleRecoveryKyc}
                  submitting={kycSubmitting}
                  submitError={kycError}
                />
                <button
                  type="button"
                  onClick={() => setLostKeyStep("key")}
                  style={{ marginTop:12, width:"100%", padding:10, borderRadius:999, border:"1px solid rgba(255,202,40,0.18)", background:"transparent", color:"rgba(200,190,170,0.75)", fontSize:12, cursor:"pointer" }}
                >
                  Retour
                </button>
              </>
            )}

            {/* Étape 4 — terminé, en attente admin */}
            {lostKeyStep === "done" && (
              <>
                <div style={{ textAlign:"center", marginBottom:18 }}>
                  <CheckCircle2 style={{ margin:"0 auto 10px", width:44, height:44, color:"#4ade80" }} />
                  <p style={{ margin:0, fontSize:14, color:"#4ade80", fontWeight:600 }}>KYC envoyé</p>
                  <p style={{ margin:"10px 0 0", fontSize:12, lineHeight:1.6, color:"rgba(200,190,170,0.85)" }}>
                    L&apos;admin examine ton dossier. Tu restes connecté avec ta clé provisoire. Tu peux échanger par message si besoin.
                  </p>
                </div>
                <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                  <button
                    type="button"
                    onClick={() => finishRecoveryToShop(true)}
                    style={{ ...btnStyle, display:"flex", alignItems:"center", justifyContent:"center", gap:8, width:"100%", padding:13, borderRadius:999, border:"none", fontSize:13, fontWeight:700, cursor:"pointer" }}
                  >
                    <MessageCircle style={{ width:16, height:16 }} />
                    Ouvrir la messagerie
                  </button>
                  <button
                    type="button"
                    onClick={() => finishRecoveryToShop(false)}
                    style={{ width:"100%", padding:11, borderRadius:999, border:"1px solid rgba(255,202,40,0.22)", background:"transparent", color:"#f5e8c7", fontSize:13, cursor:"pointer" }}
                  >
                    Continuer vers le catalogue
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      <HowItWorksModal
        isOpen={howOpen}
        onClose={() => setHowOpen(false)}
        requireRead
        onConfirm={onHowItWorksConfirmed}
      />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
