"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { adminLogin } from "@/app/actions/admin-auth"

export default function AdminLoginPage() {
  const [token, setToken] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(""); setLoading(true)
    const res = await adminLogin(token)
    if (res.ok) router.push("/admin")
    else { setError(res.error ?? "Token invalide"); setLoading(false) }
  }

  return (
    <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "radial-gradient(circle at top right,rgba(255,202,40,.1),transparent 60%),#0f0d07", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 380, borderRadius: 24, border: "1px solid rgba(255,202,40,.18)",
        background: "rgba(20,18,12,.95)", padding: "36px 28px" }}>
        <h1 style={{ margin: "0 0 6px", fontFamily: "Orbitron,sans-serif", fontSize: 20, fontWeight: 900,
          background: "linear-gradient(90deg,#ffca28,#e65100)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
          Admin Panel
        </h1>
        <p style={{ margin: "0 0 28px", fontSize: 13, color: "rgba(200,190,170,.6)" }}>Accès réservé à l&apos;équipe</p>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <input type="password" value={token} onChange={(e) => setToken(e.target.value)}
            placeholder="Token admin" autoComplete="current-password"
            style={{ padding: "13px 16px", borderRadius: 14, border: "1px solid rgba(255,202,40,.2)",
              background: "rgba(0,0,0,.5)", color: "#f5e8c7", fontSize: 14, outline: "none", fontFamily: "monospace", letterSpacing: "0.1em" }} />
          {error && <p style={{ margin: 0, fontSize: 13, color: "#f87171" }}>{error}</p>}
          <button type="submit" disabled={loading || !token}
            style={{ padding: "14px", borderRadius: 999, background: "linear-gradient(120deg,#ffca28,#e65100)",
              color: "#0f0d07", fontFamily: "Orbitron,sans-serif", fontWeight: 900, fontSize: 14,
              letterSpacing: "0.12em", textTransform: "uppercase", border: "none", cursor: "pointer", opacity: loading ? 0.7 : 1 }}>
            {loading ? "Connexion..." : "Accéder"}
          </button>
        </form>
      </div>
    </main>
  )
}
