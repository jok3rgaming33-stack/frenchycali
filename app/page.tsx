"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"

const FAVORITE_KEY = "favoriteUniverse"
const VALID_FAVORITES = ["caliboyz31", "caliboyz94", "calidelivery"] as const

export default function SplashPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const router = useRouter()
  const [redirecting, setRedirecting] = useState(false)

  // Redirection immédiate vers l'univers favori s'il est défini
  useEffect(() => {
    try {
      const fav = localStorage.getItem(FAVORITE_KEY)
      if (fav && (VALID_FAVORITES as readonly string[]).includes(fav)) {
        setRedirecting(true)
        router.replace(`/${fav}`)
      }
    } catch { /* ignore */ }
  }, [router])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    let animId = 0
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight }
    resize()
    window.addEventListener("resize", resize)
    type P = { x:number;y:number;vx:number;vy:number;size:number;color:string }
    const particles: P[] = []
    for (let i = 0; i < 110; i++) {
      particles.push({ x:Math.random()*canvas.width, y:Math.random()*canvas.height, vx:(Math.random()-.5)*.5, vy:(Math.random()-.5)*.5, size:Math.random()*2+.9, color:Math.random()>.45?"rgba(255,202,40,.42)":"rgba(230,81,0,.38)" })
    }
    let mx = window.innerWidth/2, my = window.innerHeight/2
    const onMouse = (e:MouseEvent) => { mx=e.clientX; my=e.clientY }
    const onTouch = (e:TouchEvent) => { if(e.touches[0]){mx=e.touches[0].clientX;my=e.touches[0].clientY} }
    document.addEventListener("mousemove", onMouse)
    document.addEventListener("touchmove", onTouch, {passive:true})
    const animate = () => {
      ctx.clearRect(0,0,canvas.width,canvas.height)
      for(const p of particles){
        const dx=mx-p.x,dy=my-p.y,dist=Math.hypot(dx,dy)
        if(dist<160){const f=(160-dist)/160;p.vx-=dx*f*.032;p.vy-=dy*f*.032}
        p.x+=p.vx;p.y+=p.vy;p.vx*=.975;p.vy*=.975
        if(p.x<0||p.x>canvas.width)p.vx*=-1
        if(p.y<0||p.y>canvas.height)p.vy*=-1
        ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(p.x,p.y,p.size,0,Math.PI*2);ctx.fill()
      }
      animId=requestAnimationFrame(animate)
    }
    animate()
    return () => { window.removeEventListener("resize",resize); document.removeEventListener("mousemove",onMouse); document.removeEventListener("touchmove",onTouch); cancelAnimationFrame(animId) }
  }, [])

  // Typewriter effect
  useEffect(() => {
    if (redirecting) return
    const words = ["FRENCHYCALI", "ACCÈS SÉCURISÉ", "BIENVENUE"]
    let wordIdx = 0; let charIdx = 0; let deleting = false
    const el = document.getElementById("typewriter")
    if (!el) return
    const tick = () => {
      const word = words[wordIdx]
      if (!deleting) {
        el.textContent = word.slice(0, charIdx + 1); charIdx++
        if (charIdx === word.length) { deleting = true; setTimeout(tick, 1800); return }
      } else {
        el.textContent = word.slice(0, charIdx - 1); charIdx--
        if (charIdx === 0) { deleting = false; wordIdx = (wordIdx+1)%words.length }
      }
      setTimeout(tick, deleting ? 60 : 100)
    }
    const t = setTimeout(tick, 400)
    return () => clearTimeout(t)
  }, [redirecting])

  if (redirecting) {
    return (
      <main style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center",
        background:"radial-gradient(circle at top right,rgba(255,202,40,.09),transparent 60%),radial-gradient(circle at bottom left,rgba(230,81,0,.07),transparent 60%),#0f0d07" }}>
        <p style={{ margin:0, fontFamily:"Orbitron,sans-serif", fontSize:13, letterSpacing:"0.2em", textTransform:"uppercase",
          background:"linear-gradient(90deg,#ffca28,#e65100)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>
          Redirection vers ton favori…
        </p>
      </main>
    )
  }

  return (
    <main style={{ minHeight:"100vh", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:40, textAlign:"center", position:"relative", overflow:"hidden",
      background:"radial-gradient(circle at top right,rgba(255,202,40,.09),transparent 60%),radial-gradient(circle at bottom left,rgba(230,81,0,.07),transparent 60%),#0f0d07", padding:"20px" }}>
      <canvas ref={canvasRef} style={{ position:"fixed", inset:0, pointerEvents:"none", zIndex:1 }} aria-hidden="true" />

      {/* Logo + typewriter */}
      <div style={{ position:"relative", zIndex:2, display:"flex", flexDirection:"column", alignItems:"center", gap:16 }}>
        <img src="https://i.imgur.com/1gye7hI.jpeg" alt="FrenchyCali" style={{ width:100, height:100, borderRadius:28, objectFit:"cover", boxShadow:"0 0 40px rgba(255,202,40,.5)" }} />
        <h1 id="typewriter" style={{ margin:0, fontFamily:"Orbitron,sans-serif", fontSize:"clamp(22px,6vw,36px)", fontWeight:900, letterSpacing:"0.25em", textTransform:"uppercase",
          background:"linear-gradient(90deg,#ffca28,#e65100)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", minHeight:"1.2em" }}>
          FRENCHYCALI
        </h1>
        <p style={{ margin:0, fontSize:13, letterSpacing:"0.2em", textTransform:"uppercase", color:"rgba(201,167,108,.8)" }}>La plateforme sécurisée</p>
      </div>

      {/* CTA */}
      <div style={{ position:"relative", zIndex:2, display:"flex", flexDirection:"column", gap:16, width:"100%", maxWidth:360 }}>
        <button onClick={() => router.push("/choix")}
          style={{ width:"100%", padding:"18px 24px", borderRadius:999, background:"linear-gradient(120deg,#ffca28,#e65100)", color:"#0f0d07", fontFamily:"Orbitron,sans-serif", fontWeight:900, fontSize:15, letterSpacing:"0.15em", textTransform:"uppercase", border:"none", cursor:"pointer", boxShadow:"0 0 30px rgba(255,202,40,.5)" }}>
          Accéder au site
        </button>
      </div>
    </main>
  )
}
