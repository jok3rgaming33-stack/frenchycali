"use client"

import { useState, useEffect, useCallback } from "react"
import { ShoppingCart, User, Package, Star, MessageCircle, Truck, Heart, HelpCircle, Shield, Menu, X as XIcon } from "lucide-react"
import type { Product } from "@/lib/db/schema"
import { LoginPage } from "@/components/login-page"
import { CheckoutCart } from "@/components/checkout-cart"
import { OrderTracker } from "@/components/order-tracker"
import { ParticlesCanvas } from "@/components/particles-canvas"
import { getProducts } from "@/app/actions/products"
import { getOrdersByToken } from "@/app/actions/order"
import { getCustomerStats } from "@/app/actions/account"

type Shop = "caliboyz31" | "caliboyz94" | "calidelivery"

interface Props {
  shop: Shop
  initialProducts: Product[]
}

type CartItem = { productId: number; title: string; variant: string; price: number; qty: number }

export function ShopPage({ shop, initialProducts }: Props) {
  const isDelivery = shop === "calidelivery"
  const theme = isDelivery ? "delivery" : "gold"

  // Theme styles
  const accentColor = isDelivery ? "#00ff9d" : "#ffca28"
  const primaryColor = isDelivery ? "#8b00ff" : "#e65100"
  const bgMain = isDelivery ? "#0a0012" : "#0f0d07"
  const bgGrad = isDelivery
    ? "radial-gradient(circle at top left,rgba(139,0,255,.32),transparent 60%),radial-gradient(circle at bottom right,rgba(0,255,157,.35),transparent 60%)"
    : "radial-gradient(circle at top right,rgba(255,202,40,.09),transparent 60%),radial-gradient(circle at bottom left,rgba(230,81,0,.07),transparent 60%)"
  const cardBorder = isDelivery ? "rgba(0,255,170,.14)" : "rgba(255,202,40,.14)"
  const glowColor = isDelivery ? "rgba(0,255,170,.35)" : "rgba(255,202,40,.35)"

  const shopLabel = shop === "caliboyz31" ? "Cali Boyz 31" : shop === "caliboyz94" ? "Cali Boyz 94" : "CaliDelivery"
  const logo = isDelivery ? "https://i.imgur.com/K6NwuvJ.png" : "https://i.imgur.com/1gye7hI.jpeg"

  // Auth
  const [authed, setAuthed] = useState(false)
  const [userToken, setUserToken] = useState("")
  const [userPseudo, setUserPseudo] = useState("")
  const [isAdmin, setIsAdmin] = useState(false)

  // UI states
  const [view, setView] = useState<"shop"|"cart"|"orders"|"login">("login")
  const [cart, setCart] = useState<CartItem[]>([])
  const [products, setProducts] = useState<Product[]>(initialProducts)
  const [stats, setStats] = useState<{ points: number; active: number; past: number } | null>(null)
  const [activeSection, setActiveSection] = useState<string>("all")
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    const token = localStorage.getItem("authToken")
    const pseudo = localStorage.getItem("userPseudo")
    const admin = localStorage.getItem("isAdmin") === "1"
    if (token && pseudo) {
      setUserToken(token); setUserPseudo(pseudo); setIsAdmin(admin); setAuthed(true); setView("shop")
    }
  }, [])

  const loadStats = useCallback(async (token: string) => {
    try { setStats(await getCustomerStats(token)) } catch {}
  }, [])

  useEffect(() => { if (userToken) loadStats(userToken) }, [userToken, loadStats])

  const onLoginSuccess = (opts?: { openOrders?: boolean }) => {
    const token = localStorage.getItem("authToken") || ""
    const pseudo = localStorage.getItem("userPseudo") || ""
    const admin = localStorage.getItem("isAdmin") === "1"
    setUserToken(token); setUserPseudo(pseudo); setIsAdmin(admin); setAuthed(true)
    setView(opts?.openOrders ? "orders" : "shop")
  }

  const logout = () => {
    localStorage.removeItem("authToken"); localStorage.removeItem("userPseudo"); localStorage.removeItem("isAdmin")
    setAuthed(false); setUserToken(""); setUserPseudo(""); setIsAdmin(false); setCart([]); setView("login")
  }

  const addToCart = (product: Product, variant: { qty: number; price: number }, variantLabel: string) => {
    setCart((prev) => {
      const key = `${product.id}-${variantLabel}`
      const existing = prev.find((i) => `${i.productId}-${i.variant}` === key)
      if (existing) return prev.map((i) => `${i.productId}-${i.variant}` === key ? { ...i, qty: i.qty + 1 } : i)
      return [...prev, { productId: product.id, title: product.title, variant: variantLabel, price: variant.price, qty: 1 }]
    })
    setSelectedProduct(null)
  }

  const cartTotal = cart.reduce((s, i) => s + i.price * i.qty, 0)
  const cartCount = cart.reduce((s, i) => s + i.qty, 0)

  // Group products by section
  const sections = Array.from(new Set(products.map(p => p.section))).filter(Boolean)
  const displayed = activeSection === "all" ? products : products.filter(p => p.section === activeSection)

  if (!authed || view === "login") {
    return (
      <div style={{ minHeight:"100vh", background:`${bgGrad},${bgMain}`, ...(isDelivery ? {} : {}) }}>
        <ParticlesCanvas theme={theme} />
        <LoginPage onSuccess={onLoginSuccess} shop={shop} />
      </div>
    )
  }

  const navItems = [
    { label: "NOS PRODUITS",       icon: <ShoppingCart style={{width:14,height:14}} />, action: () => { setView("shop"); setMobileMenuOpen(false) } },
    { label: "MESSAGERIE",         icon: <MessageCircle style={{width:14,height:14}} />, action: () => { setView("orders"); setMobileMenuOpen(false) } },
    { label: "LIVRAISON / MEET-UP",icon: <Truck style={{width:14,height:14}} />, action: () => { setView("orders"); setMobileMenuOpen(false) } },
    { label: "MES COMMANDES",      icon: <Package style={{width:14,height:14}} />, action: () => { setView("orders"); setMobileMenuOpen(false) } },
    { label: "ESPACE FIDÉLITÉ",    icon: <Heart style={{width:14,height:14}} />, action: () => { setView("orders"); setMobileMenuOpen(false) } },
    { label: "COMMENT ÇA MARCHE", icon: <HelpCircle style={{width:14,height:14}} />, action: () => { setView("orders"); setMobileMenuOpen(false) } },
  ]

  return (
    <div style={{ minHeight:"100vh", background:`${bgGrad},${bgMain}`, color: isDelivery ? "#f0f8ff" : "#f5e8c7", fontFamily:"Inter,system-ui,sans-serif", position:"relative" }}>
      <style>{`
        @media (min-width: 768px) {
          .desktop-nav-right { display: flex !important; }
          .mobile-nav-right  { display: none !important; }
          .desktop-nav-bar   { display: flex !important; }
        }
        @media (max-width: 767px) {
          .desktop-nav-right { display: none !important; }
          .mobile-nav-right  { display: flex !important; }
          .desktop-nav-bar   { display: none !important; }
        }
      `}</style>
      <ParticlesCanvas theme={theme} />

      {/* ══ NAVBAR ══ */}
      <header style={{ position:"sticky", top:0, zIndex:40, borderBottom:`1px solid ${cardBorder}`, background:isDelivery?"rgba(10,0,18,.96)":"rgba(15,13,7,.96)", backdropFilter:"blur(14px)" }}>

        {/* Top row: logo + mobile controls */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"10px 16px", maxWidth:1400, margin:"0 auto" }}>
          {/* Logo */}
          <div style={{ display:"flex", alignItems:"center", gap:10, flexShrink:0 }}>
            <img src={logo} alt={shopLabel} style={{ width:34, height:34, borderRadius:8, objectFit:"cover", border:`1px solid ${cardBorder}` }} />
            <span style={{ fontFamily:"Orbitron,sans-serif", fontWeight:900, fontSize:13, letterSpacing:"0.1em",
              background:`linear-gradient(90deg,${accentColor},${primaryColor})`, WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>
              {shopLabel}
            </span>
          </div>

          {/* Desktop right cluster */}
          <div className="desktop-nav-right" style={{ display:"flex", alignItems:"center", gap:6 }}>
            {stats && (
              <div style={{ display:"flex", alignItems:"center", gap:4, padding:"4px 10px", borderRadius:999, border:`1px solid ${cardBorder}`, fontSize:11 }}>
                <Star style={{ width:11, height:11, color:accentColor }} />
                <span style={{ color:accentColor, fontWeight:700 }}>{stats.points}</span>
                <span style={{ color:"rgba(200,190,170,.5)", fontSize:10 }}>pts</span>
              </div>
            )}
            <button onClick={() => { setView("login"); setMobileMenuOpen(false) }}
              style={{ display:"flex", alignItems:"center", gap:6, background:"transparent", border:`1px solid ${cardBorder}`, borderRadius:999, padding:"5px 12px", cursor:"pointer", color:"rgba(200,190,170,.8)", fontSize:12 }}>
              <User style={{ width:13, height:13 }} />
              <span style={{ maxWidth:72, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{userPseudo}</span>
            </button>
            {/* PANEL ADMIN — visible seulement pour les comptes marqués isAdmin */}
            {isAdmin && (
              <a href="/admin"
                style={{ display:"flex", alignItems:"center", gap:6, padding:"6px 14px", borderRadius:999,
                  background:`rgba(${isDelivery?"139,0,255":"34,197,94"},.18)`,
                  border:`1px solid rgba(${isDelivery?"139,0,255":"34,197,94"},.35)`,
                  color: isDelivery ? "#bf7fff" : "#4ade80",
                  textDecoration:"none", fontSize:12, fontWeight:700, letterSpacing:"0.06em" }}>
                <Shield style={{ width:13, height:13 }} />
                PANEL ADMIN
              </a>
            )}
            {/* Panier */}
            <button onClick={() => { setView("cart"); setMobileMenuOpen(false) }}
              style={{ position:"relative", display:"flex", alignItems:"center", gap:6, background:cartCount>0?`rgba(${isDelivery?"0,255,157":"255,202,40"},.14)`:"transparent",
                border:`1px solid ${cartCount>0?accentColor:cardBorder}`, borderRadius:999, padding:"6px 14px", cursor:"pointer",
                color:cartCount>0?accentColor:"rgba(200,190,170,.7)", fontSize:12, fontWeight:700 }}>
              <ShoppingCart style={{ width:14, height:14 }} />
              <span>MON PANIER</span>
              {cartCount > 0 && (
                <span style={{ marginLeft:2, background:"#ef4444", color:"#fff", borderRadius:"50%", width:17, height:17,
                  display:"inline-flex", alignItems:"center", justifyContent:"center", fontSize:10, fontWeight:700 }}>{cartCount}</span>
              )}
            </button>
          </div>

          {/* Mobile right cluster */}
          <div style={{ display:"flex", alignItems:"center", gap:8 }} className="mobile-nav-right">
            <button onClick={() => { setView("cart"); setMobileMenuOpen(false) }}
              style={{ position:"relative", background:"transparent", border:`1px solid ${cartCount>0?accentColor:cardBorder}`, borderRadius:999, padding:"7px 10px", cursor:"pointer", color:cartCount>0?accentColor:"rgba(200,190,170,.7)", display:"flex", alignItems:"center" }}>
              <ShoppingCart style={{ width:16, height:16 }} />
              {cartCount > 0 && (
                <span style={{ position:"absolute", top:-5, right:-5, background:"#ef4444", color:"#fff", borderRadius:"50%", width:16, height:16,
                  display:"flex", alignItems:"center", justifyContent:"center", fontSize:9, fontWeight:700 }}>{cartCount}</span>
              )}
            </button>
            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              style={{ background:"transparent", border:`1px solid ${cardBorder}`, borderRadius:10, padding:"7px 10px", cursor:"pointer", color:"rgba(200,190,170,.8)", display:"flex", alignItems:"center" }}>
              {mobileMenuOpen ? <XIcon style={{ width:18, height:18 }} /> : <Menu style={{ width:18, height:18 }} />}
            </button>
          </div>
        </div>

        {/* Desktop nav links row */}
        <nav className="desktop-nav-bar" style={{ borderTop:`1px solid ${cardBorder}`, padding:"0 16px", maxWidth:1400, margin:"0 auto", display:"flex", alignItems:"stretch", gap:0, overflowX:"auto", scrollbarWidth:"none" }}>
          {navItems.map((item) => (
            <button key={item.label} onClick={item.action}
              style={{ display:"flex", alignItems:"center", gap:7, padding:"11px 14px", background:"transparent", border:"none",
                color:"rgba(200,190,170,.75)", fontSize:11, fontWeight:700, letterSpacing:"0.07em", cursor:"pointer",
                whiteSpace:"nowrap", borderBottom:`2px solid transparent`, transition:"all .2s",
                textTransform:"uppercase" as const }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = accentColor; (e.currentTarget as HTMLElement).style.borderBottomColor = accentColor }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "rgba(200,190,170,.75)"; (e.currentTarget as HTMLElement).style.borderBottomColor = "transparent" }}>
              {item.icon}{item.label}
            </button>
          ))}
        </nav>

        {/* Mobile dropdown menu */}
        {mobileMenuOpen && (
          <nav style={{ borderTop:`1px solid ${cardBorder}`, padding:"8px 0", background:isDelivery?"rgba(10,0,18,.98)":"rgba(15,13,7,.98)" }}>
            {navItems.map((item) => (
              <button key={item.label} onClick={item.action}
                style={{ width:"100%", display:"flex", alignItems:"center", gap:12, padding:"14px 20px", background:"transparent", border:"none",
                  color:"rgba(200,190,170,.85)", fontSize:14, fontWeight:700, letterSpacing:"0.06em", cursor:"pointer", textAlign:"left" as const, textTransform:"uppercase" as const }}>
                {item.icon}{item.label}
              </button>
            ))}
            {isAdmin && (
              <>
                <div style={{ height:1, background:cardBorder, margin:"6px 20px" }} />
                <a href="/admin"
                  style={{ display:"flex", alignItems:"center", gap:12, padding:"14px 20px",
                    color: isDelivery ? "#bf7fff" : "#4ade80", fontSize:14, fontWeight:700, textDecoration:"none", letterSpacing:"0.06em", textTransform:"uppercase" as const }}>
                  <Shield style={{ width:16, height:16 }} />PANEL ADMIN
                </a>
              </>
            )}
            <button onClick={() => { setView("login"); setMobileMenuOpen(false) }}
              style={{ width:"100%", display:"flex", alignItems:"center", gap:12, padding:"14px 20px", background:"transparent", border:"none",
                color:"rgba(200,190,170,.6)", fontSize:14, fontWeight:600, cursor:"pointer", textAlign:"left" as const }}>
              <User style={{ width:16, height:16 }} />{userPseudo}
            </button>
          </nav>
        )}
      </header>

      {/* VIEWS */}
      {view === "cart" && (
        <CheckoutCart
          cart={cart} setCart={setCart} customerToken={userToken} customerName={userPseudo}
          shop={shop} onBack={() => setView("shop")} onOrderPlaced={() => setView("orders")}
          accentColor={accentColor} primaryColor={primaryColor} cardBorder={cardBorder}
        />
      )}

      {view === "orders" && (
        <OrderTracker customerToken={userToken} onBack={() => setView("shop")} accentColor={accentColor} cardBorder={cardBorder} />
      )}

      {view === "shop" && (
        <main style={{ maxWidth:1100, margin:"0 auto", padding:"24px 16px 40px" }}>
          {/* Section filters — sticky desktop bar */}
          {sections.length > 0 && (
            <>
              {/* Desktop: sticky bar below header */}
              <div style={{ position:"sticky", top:61, zIndex:10, margin:"0 -16px 24px", padding:"8px 16px", background: isDelivery?"rgba(10,0,18,.95)":"rgba(15,13,7,.95)", backdropFilter:"blur(10px)", borderBottom:`1px solid ${cardBorder}`, display:"flex", gap:8, overflowX:"auto", scrollbarWidth:"none" }}>
                <button onClick={() => setActiveSection("all")}
                  style={{ flexShrink:0, padding:"7px 18px", borderRadius:999, border:`1px solid ${activeSection==="all"?accentColor:cardBorder}`, background:activeSection==="all"?accentColor:"transparent", color:activeSection==="all"?"#000":isDelivery?"#f0f8ff":"#f5e8c7", fontSize:13, cursor:"pointer", fontWeight:700, transition:"all .2s", whiteSpace:"nowrap" }}>
                  Tout
                </button>
                {sections.map((s) => (
                  <button key={s} onClick={() => setActiveSection(s)}
                    style={{ flexShrink:0, padding:"7px 18px", borderRadius:999, border:`1px solid ${activeSection===s?accentColor:cardBorder}`, background:activeSection===s?accentColor:"transparent", color:activeSection===s?"#000":isDelivery?"#f0f8ff":"#f5e8c7", fontSize:13, cursor:"pointer", fontWeight:activeSection===s?700:400, transition:"all .2s", whiteSpace:"nowrap" }}>
                    {s}
                  </button>
                ))}
              </div>


            </>
          )}

          {/* Product grid */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))", gap:20 }}>
            {displayed.map((product) => (
              <div key={product.id} onClick={() => setSelectedProduct(product)}
                style={{ borderRadius:20, border:`1px solid ${cardBorder}`, background:"rgba(20,18,12,.82)", overflow:"hidden", cursor:"pointer", transition:"all .3s",
                  boxShadow:"0 8px 20px rgba(0,0,0,.5)" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.transform="translateY(-4px)"; (e.currentTarget as HTMLElement).style.boxShadow=`0 0 25px ${glowColor}` }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.transform="translateY(0)"; (e.currentTarget as HTMLElement).style.boxShadow="0 8px 20px rgba(0,0,0,.5)" }}>
                {product.image && (
                  <div style={{ height:180, overflow:"hidden" }}>
                    <img src={product.image} alt={product.title} style={{ width:"100%", height:"100%", objectFit:"cover", transition:"transform .4s" }} />
                  </div>
                )}
                <div style={{ padding:"14px 16px" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:8, marginBottom:6 }}>
                    <h3 style={{ margin:0, fontSize:15, fontWeight:700, color: isDelivery?"#f0f8ff":"#f5e8c7" }}>{product.title}</h3>
                    {product.stock === 0 && (
                      <span style={{ flexShrink:0, fontSize:10, padding:"2px 8px", borderRadius:999, background:"rgba(239,68,68,.15)", border:"1px solid rgba(239,68,68,.3)", color:"#f87171" }}>Rupture</span>
                    )}
                  </div>
                  {product.description && <p style={{ margin:"0 0 10px", fontSize:12, color:"rgba(200,190,170,.7)", lineHeight:1.5 }}>{product.description}</p>}
                  {product.variants && product.variants.length > 0 && (
                    <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                      {product.variants.map((v, i) => (
                        <button key={i} onClick={(e) => { e.stopPropagation(); if(product.stock>0) addToCart(product, v, `${v.qty}g`) }}
                          disabled={product.stock === 0}
                          style={{ padding:"5px 12px", borderRadius:999, border:`1px solid ${cardBorder}`, background:`rgba(${isDelivery?"139,0,255":"255,202,40"},.1)`, color:accentColor, fontSize:12, cursor:product.stock===0?"not-allowed":"pointer", fontWeight:600, opacity:product.stock===0?.5:1 }}>
                          {v.qty}g — {v.price}€
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {displayed.length === 0 && (
            <div style={{ textAlign:"center", padding:"80px 20px", color:"rgba(200,190,170,.5)" }}>
              <Package style={{ width:48, height:48, margin:"0 auto 16px" }} />
              <p style={{ margin:0, fontSize:16 }}>Aucun produit disponible</p>
            </div>
          )}
        </main>
      )}

      {/* Product detail modal */}
      {selectedProduct && (
        <div style={{ position:"fixed", inset:0, zIndex:50, display:"flex", alignItems:"flex-end", justifyContent:"center", background:"rgba(0,0,0,.8)", padding:"0 0 0 0" }}
          onClick={() => setSelectedProduct(null)}>
          <div style={{ width:"100%", maxWidth:560, background:isDelivery?"#12001f":"rgba(20,18,12,.98)", borderRadius:"24px 24px 0 0", border:`1px solid ${cardBorder}`, padding:"24px", maxHeight:"80vh", overflowY:"auto" }}
            onClick={(e) => e.stopPropagation()}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
              <h2 style={{ margin:0, fontSize:18, fontWeight:700, color:isDelivery?"#f0f8ff":"#f5e8c7" }}>{selectedProduct.title}</h2>
              <button onClick={() => setSelectedProduct(null)} style={{ background:"none", border:"none", cursor:"pointer", color:"rgba(200,190,170,.7)", fontSize:20 }}>✕</button>
            </div>
            {selectedProduct.image && <img src={selectedProduct.image} alt={selectedProduct.title} style={{ width:"100%", height:220, objectFit:"cover", borderRadius:16, marginBottom:16 }} />}
            {selectedProduct.fullDescription && <p style={{ margin:"0 0 16px", fontSize:14, lineHeight:1.7, color:"rgba(200,190,170,.9)" }}>{selectedProduct.fullDescription}</p>}
            {selectedProduct.stock === 0 ? (
              <div style={{ textAlign:"center", padding:"16px", borderRadius:14, background:"rgba(239,68,68,.1)", border:"1px solid rgba(239,68,68,.25)", color:"#f87171", fontSize:14 }}>
                Rupture de stock
              </div>
            ) : (
              <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                <p style={{ margin:0, fontSize:12, textTransform:"uppercase", letterSpacing:"0.1em", color:"rgba(200,190,170,.6)" }}>Choisir un format</p>
                {selectedProduct.variants.map((v, i) => (
                  <button key={i} onClick={() => addToCart(selectedProduct, v, `${v.qty}g`)}
                    style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"14px 18px", borderRadius:14, border:`1px solid ${cardBorder}`, background:`rgba(${isDelivery?"139,0,255":"255,202,40"},.08)`, color:isDelivery?"#f0f8ff":"#f5e8c7", cursor:"pointer", fontSize:14, fontWeight:600 }}>
                    <span>{v.qty}g</span>
                    <span style={{ color:accentColor, fontWeight:700 }}>{v.price}€</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
