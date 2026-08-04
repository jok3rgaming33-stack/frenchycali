"use client"

import { useEffect, useRef } from "react"
import { useRouter } from "next/navigation"

const SOCIALS = [
  { href:"http://t.me/Caliyorder", label:"Telegram", img:"https://upload.wikimedia.org/wikipedia/commons/8/82/Telegram_logo.svg" },
  { href:"https://www.instagram.com/calideliveryoff?igsh=NG56Y3lneWpidzM2", label:"Instagram", img:"https://upload.wikimedia.org/wikipedia/commons/e/e7/Instagram_logo_2016.svg" },
  { href:"https://discord.gg/sRXmW8cTE4", label:"Discord", img:"https://static.vecteezy.com/system/resources/previews/023/986/880/non_2x/discord-logo-discord-logo-transparent-discord-icon-transparent-free-free-png.png" },
  { href:"https://callup.luffa.im/c/A6DwyCuW6rp", label:"Luffa", img:"https://www.luffa.im/images/singleLogo.png" },
]

export default function ChoixPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const router = useRouter()

  useEffect(() => {
    const canvas = canvasRef.current; if(!canvas) return
    const ctx = canvas.getContext("2d"); if(!ctx) return
    let animId = 0
    const resize = () => { canvas.width=window.innerWidth; canvas.height=window.innerHeight }
    resize(); window.addEventListener("resize", resize)
    type P={x:number;y:number;vx:number;vy:number;size:number;color:string}
    const particles:P[]=[]
    const count = window.innerWidth < 768 ? 60 : 110
    for(let i=0;i<count;i++) particles.push({x:Math.random()*canvas.width,y:Math.random()*canvas.height,vx:(Math.random()-.5)*.5,vy:(Math.random()-.5)*.5,size:Math.random()*2+.9,color:Math.random()>.45?"rgba(255,202,40,.42)":"rgba(230,81,0,.38)"})
    let mx=window.innerWidth/2,my=window.innerHeight/2
    const onMouse=(e:MouseEvent)=>{mx=e.clientX;my=e.clientY}
    const onTouch=(e:TouchEvent)=>{if(e.touches[0]){mx=e.touches[0].clientX;my=e.touches[0].clientY}}
    document.addEventListener("mousemove",onMouse)
    document.addEventListener("touchmove",onTouch,{passive:true})
    const animate=()=>{
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
    return()=>{window.removeEventListener("resize",resize);document.removeEventListener("mousemove",onMouse);document.removeEventListener("touchmove",onTouch);cancelAnimationFrame(animId)}
  },[])

  const choices = [
    { key:"caliboyz31", label:"Cali Boyz 31", borderColor:"#ffca28", bg:"https://i.imgur.com/amjflPT.jpeg" },
    { key:"caliboyz94", label:"Cali Boyz 94", borderColor:"#e65100", bg:"https://i.imgur.com/e0tT4Dv.jpeg" },
    { key:"calidelivery", label:"CaliDelivery", borderColor:"#8b00ff", bg:"https://i.imgur.com/K6NwuvJ.png" },
  ]

  return (
    <main style={{ minHeight:"100vh", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:32, textAlign:"center", position:"relative", overflow:"hidden",
      background:"radial-gradient(circle at top right,rgba(255,202,40,.09),transparent 60%),radial-gradient(circle at bottom left,rgba(230,81,0,.07),transparent 60%),#0f0d07", padding:"20px" }}>
      <canvas ref={canvasRef} style={{ position:"fixed", inset:0, pointerEvents:"none", zIndex:1 }} aria-hidden="true" />

      {/* Socials */}
      <div style={{ position:"relative", zIndex:3, display:"flex", flexDirection:"column", alignItems:"center", gap:12 }}>
        <p style={{ margin:0, fontFamily:"Orbitron,sans-serif", fontSize:13, fontWeight:900, letterSpacing:"0.15em", textTransform:"uppercase", background:"linear-gradient(90deg,#ffca28,#e65100)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>
          Retrouvez-moi Sur
        </p>
        <div style={{ display:"flex", gap:24, flexWrap:"wrap", justifyContent:"center" }}>
          {SOCIALS.map((s) => (
            <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer"
              style={{ display:"flex", flexDirection:"column", alignItems:"center", textDecoration:"none", transition:"all .3s" }}>
              <div style={{ width:52, height:52, borderRadius:"50%", background:"rgba(255,202,40,.08)", border:"1px solid rgba(255,202,40,.18)", display:"flex", alignItems:"center", justifyContent:"center", backdropFilter:"blur(5px)", transition:"all .3s" }}
                onMouseEnter={(e)=>{ (e.currentTarget as HTMLElement).style.boxShadow="0 0 18px rgba(255,202,40,.45)"; (e.currentTarget as HTMLElement).style.borderColor="rgba(255,202,40,.5)" }}
                onMouseLeave={(e)=>{ (e.currentTarget as HTMLElement).style.boxShadow="none"; (e.currentTarget as HTMLElement).style.borderColor="rgba(255,202,40,.18)" }}>
                <img src={s.img} alt={s.label} style={{ width:30, height:30, objectFit:"contain" }} />
              </div>
            </a>
          ))}
        </div>
      </div>

      <h1 style={{ position:"relative", zIndex:2, margin:0, fontFamily:"Orbitron,sans-serif", fontSize:"clamp(18px,5vw,26px)", letterSpacing:"0.25em", textTransform:"uppercase",
        background:"linear-gradient(90deg,#ffca28,#e65100)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>
        CHOISIS TON UNIVERS
      </h1>

      <div style={{ position:"relative", zIndex:2, display:"flex", flexDirection:"column", gap:20, width:"100%", maxWidth:440 }}>
        {choices.map((c) => (
          <button key={c.key} onClick={() => router.push(`/${c.key}`)}
            style={{ position:"relative", width:"100%", padding:"44px 24px", borderRadius:24, background:"rgba(20,18,12,.82)", border:`1px solid rgba(255,202,40,.12)`, borderLeft:`5px solid ${c.borderColor}`,
              color:"#f5e8c7", fontFamily:"Orbitron,sans-serif", fontWeight:900, cursor:"pointer", textTransform:"uppercase", letterSpacing:"0.12em", fontSize:15, overflow:"hidden",
              boxShadow:"0 12px 25px rgba(0,0,0,.6)", transition:"all .35s ease" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.transform="translateY(-6px)"; (e.currentTarget as HTMLElement).style.boxShadow=`0 0 35px rgba(255,202,40,.4)` }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.transform="translateY(0)"; (e.currentTarget as HTMLElement).style.boxShadow="0 12px 25px rgba(0,0,0,.6)" }}>
            <div style={{ position:"absolute", inset:0, backgroundImage:`url(${c.bg})`, backgroundSize:"cover", backgroundPosition:"center", opacity:.18, transition:"opacity .35s" }} aria-hidden="true" />
            <span style={{ position:"relative", zIndex:2, textShadow:"0 3px 12px rgba(0,0,0,.9)" }}>{c.label}</span>
          </button>
        ))}
      </div>
    </main>
  )
}
