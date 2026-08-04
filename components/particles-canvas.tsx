"use client"

import { useEffect, useRef } from "react"

type ParticleTheme = "gold" | "delivery"

interface Props {
  theme?: ParticleTheme
}

export function ParticlesCanvas({ theme = "gold" }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    let animId = 0
    let mouseX = window.innerWidth / 2
    let mouseY = window.innerHeight / 2

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener("resize", resize)

    const onMouseMove = (e: MouseEvent) => { mouseX = e.clientX; mouseY = e.clientY }
    const onTouch = (e: TouchEvent) => {
      if (e.touches[0]) { mouseX = e.touches[0].clientX; mouseY = e.touches[0].clientY }
    }
    document.addEventListener("mousemove", onMouseMove)
    document.addEventListener("touchmove", onTouch, { passive: true })

    type P = { x: number; y: number; vx: number; vy: number; size: number; color: string }
    const particles: P[] = []
    const count = window.innerWidth < 768 ? 60 : 110

    const goldColors = ["rgba(255,202,40,0.42)", "rgba(230,81,0,0.38)"]
    const deliveryColors = ["rgba(139,0,255,0.45)", "rgba(0,255,157,0.4)"]
    const colors = theme === "delivery" ? deliveryColors : goldColors

    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        size: Math.random() * 2 + 0.9,
        color: colors[Math.floor(Math.random() * colors.length)],
      })
    }

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      for (const p of particles) {
        const dx = mouseX - p.x
        const dy = mouseY - p.y
        const dist = Math.hypot(dx, dy)
        if (dist < 160) {
          const force = (160 - dist) / 160
          p.vx -= dx * force * 0.032
          p.vy -= dy * force * 0.032
        }
        p.x += p.vx
        p.y += p.vy
        p.vx *= 0.975
        p.vy *= 0.975
        if (p.x < 0 || p.x > canvas.width) p.vx *= -1
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1
        ctx.fillStyle = p.color
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx.fill()
      }
      animId = requestAnimationFrame(animate)
    }
    animate()

    return () => {
      window.removeEventListener("resize", resize)
      document.removeEventListener("mousemove", onMouseMove)
      document.removeEventListener("touchmove", onTouch)
      cancelAnimationFrame(animId)
    }
  }, [theme])

  return <canvas ref={canvasRef} id="particles-canvas" aria-hidden="true" />
}
