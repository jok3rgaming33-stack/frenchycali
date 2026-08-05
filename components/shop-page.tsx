"use client"

import { useState, useEffect, useCallback } from "react"
import { ShoppingCart, User, Package, Star, MessageCircle, Truck, Heart, HelpCircle, Shield, Menu, X as XIcon } from "lucide-react"
import type { Product } from "@/lib/db/schema"
import { LoginPage } from "@/components/login-page"
import { CheckoutCart } from "@/components/checkout-cart"
import { OrderTracker } from "@/components/order-tracker"
import { ParticlesCanvas } from "@/components/particles-canvas"
import { getCustomerStats } from "@/app/actions/account"
import { startAdminClientPreview } from "@/app/actions/admin-auth"
import { getProducts } from "@/app/actions/products"
import { CartProvider } from "@/components/cart-provider"
import { MessagerieModal } from "@/components/messagerie-modal"
import { MyOrdersModal } from "@/components/my-orders-modal"
import { LoyaltyModal } from "@/components/loyalty-modal"
import { HowItWorksModal } from "@/components/how-it-works-modal"
import { DeliveryInfoModal } from "@/components/delivery-info-modal"
import { NewsPopup } from "@/components/news-popup"
import { NotificationBell } from "@/components/notification-bell"
import { RecoveryBanner } from "@/components/recovery-banner"
import { AppBadgeSync } from "@/components/app-badge-sync"
import { NotificationsProvider } from "@/components/notifications-provider"
import { UserDashboardModal } from "@/components/user-dashboard-modal"
import { BlobMedia } from "@/components/blob-media"

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
  const [previewMode, setPreviewMode] = useState(false)
  const [previewBooting, setPreviewBooting] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [liveTick, setLiveTick] = useState(0)

  // UI states
  const [view, setView] = useState<"shop"|"cart"|"orders"|"login">("login")
  const [cart, setCart] = useState<CartItem[]>([])
  const [products, setProducts] = useState<Product[]>(initialProducts)
  const [stats, setStats] = useState<{ points: number; active: number; past: number } | null>(null)
  const [activeSection, setActiveSection] = useState<string>("all")
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // Features BB33 (modales) — UI reste 100 % FrenchyCali
  const [msgOpen, setMsgOpen] = useState(false)
  const [ordersOpen, setOrdersOpen] = useState(false)
  const [loyaltyOpen, setLoyaltyOpen] = useState(false)
  const [howOpen, setHowOpen] = useState(false)
  const [deliveryOpen, setDeliveryOpen] = useState(false)
  const [dashOpen, setDashOpen] = useState(false)

  const userData = { token: userToken || undefined, pseudo: userPseudo || undefined }

  const enterAsClient = useCallback((token: string, pseudo: string, admin: boolean, preview: boolean) => {
    localStorage.setItem("authToken", token)
    localStorage.setItem("userPseudo", pseudo)
    localStorage.setItem("isAdmin", admin ? "1" : "0")
    if (preview) localStorage.setItem("adminPreview", "1")
    else localStorage.removeItem("adminPreview")
    setUserToken(token)
    setUserPseudo(pseudo)
    setIsAdmin(admin)
    setPreviewMode(preview)
    setAuthed(true)
    setView("shop")
  }, [])

  // Entrée normale (localStorage) + mode aperçu admin (?preview=1)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const wantPreview = params.get("preview") === "1" || localStorage.getItem("adminPreview") === "1"

    if (wantPreview) {
      setPreviewBooting(true)
      setPreviewError(null)
      ;(async () => {
        try {
          // Session déjà injectée par le panel admin
          const existingToken = localStorage.getItem("authToken")
          const existingPseudo = localStorage.getItem("userPseudo")
          if (existingToken && existingPseudo && localStorage.getItem("adminPreview") === "1") {
            enterAsClient(existingToken, existingPseudo, true, true)
            setPreviewBooting(false)
            // Nettoie l'URL sans recharger
            if (params.get("preview") === "1") {
              const url = new URL(window.location.href)
              url.searchParams.delete("preview")
              window.history.replaceState({}, "", url.pathname)
            }
            return
          }
          // Fallback : session cookie admin → crée le compte aperçu
          const res = await startAdminClientPreview()
          if (!res.ok) {
            setPreviewError(res.error)
            setPreviewBooting(false)
            return
          }
          enterAsClient(res.token, res.pseudo, true, true)
          if (params.get("preview") === "1") {
            const url = new URL(window.location.href)
            url.searchParams.delete("preview")
            window.history.replaceState({}, "", url.pathname)
          }
        } catch {
          setPreviewError("Impossible d'ouvrir l'aperçu admin.")
        } finally {
          setPreviewBooting(false)
        }
      })()
      return
    }

    const token = localStorage.getItem("authToken")
    const pseudo = localStorage.getItem("userPseudo")
    const admin = localStorage.getItem("isAdmin") === "1"
    if (token && pseudo) {
      enterAsClient(token, pseudo, admin, localStorage.getItem("adminPreview") === "1")
    }
  }, [enterAsClient])

  const loadStats = useCallback(async (token: string) => {
    try { setStats(await getCustomerStats(token)) } catch {}
  }, [])

  useEffect(() => { if (userToken) loadStats(userToken) }, [userToken, loadStats])

  // Aperçu live : rafraîchit le catalogue toutes les 6 s
  useEffect(() => {
    if (!previewMode || !authed) return
    let cancelled = false
    const pull = async () => {
      try {
        const list = await getProducts(shop)
        if (!cancelled) {
          setProducts(list)
          setLiveTick((t) => t + 1)
        }
      } catch { /* silencieux */ }
    }
    pull()
    const id = setInterval(pull, 6000)
    const onVis = () => {
      if (document.visibilityState === "visible") pull()
    }
    document.addEventListener("visibilitychange", onVis)
    return () => {
      cancelled = true
      clearInterval(id)
      document.removeEventListener("visibilitychange", onVis)
    }
  }, [previewMode, authed, shop])

  const onLoginSuccess = (opts?: { openOrders?: boolean; openMessaging?: boolean }) => {
    const token = localStorage.getItem("authToken") || ""
    const pseudo = localStorage.getItem("userPseudo") || ""
    const admin = localStorage.getItem("isAdmin") === "1"
    setUserToken(token); setUserPseudo(pseudo); setIsAdmin(admin); setAuthed(true)
    setView("shop")
    if (opts?.openOrders) setOrdersOpen(true)
    if (opts?.openMessaging) setMsgOpen(true)
  }

  const logout = () => {
    localStorage.removeItem("authToken")
    localStorage.removeItem("userPseudo")
    localStorage.removeItem("isAdmin")
    localStorage.removeItem("adminPreview")
    setAuthed(false)
    setUserToken("")
    setUserPseudo("")
    setIsAdmin(false)
    setPreviewMode(false)
    setCart([])
    setView("login")
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

  if (previewBooting) {
    return (
      <div style={{ minHeight:"100vh", background:`${bgGrad},${bgMain}`, display:"flex", alignItems:"center", justifyContent:"center", color: isDelivery ? "#f0f8ff" : "#f5e8c7" }}>
        <ParticlesCanvas theme={theme} />
        <p style={{ position:"relative", zIndex:2, fontSize:14, letterSpacing:"0.12em", textTransform:"uppercase" as const }}>
          Ouverture aperçu admin…
        </p>
      </div>
    )
  }

  if (previewError) {
    return (
      <div style={{ minHeight:"100vh", background:`${bgGrad},${bgMain}`, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:16, color: isDelivery ? "#f0f8ff" : "#f5e8c7", padding:24 }}>
        <ParticlesCanvas theme={theme} />
        <p style={{ position:"relative", zIndex:2, maxWidth:360, textAlign:"center", fontSize:14 }}>{previewError}</p>
        <a href="/admin" style={{ position:"relative", zIndex:2, color: accentColor, fontWeight:700 }}>← Retour panel admin</a>
      </div>
    )
  }

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
    { label: "MESSAGERIE",         icon: <MessageCircle style={{width:14,height:14}} />, action: () => { setMsgOpen(true); setMobileMenuOpen(false) } },
    { label: "LIVRAISON / MEET-UP",icon: <Truck style={{width:14,height:14}} />, action: () => { setDeliveryOpen(true); setMobileMenuOpen(false) } },
    { label: "MES COMMANDES",      icon: <Package style={{width:14,height:14}} />, action: () => { setOrdersOpen(true); setMobileMenuOpen(false) } },
    { label: "ESPACE FIDÉLITÉ",    icon: <Heart style={{width:14,height:14}} />, action: () => { setLoyaltyOpen(true); setMobileMenuOpen(false) } },
    { label: "COMMENT ÇA MARCHE", icon: <HelpCircle style={{width:14,height:14}} />, action: () => { setHowOpen(true); setMobileMenuOpen(false) } },
  ]

  const productImage = (p: Product) => p.image || p.media?.[0]?.url || null
  const productMediaType = (p: Product): "image" | "video" | undefined => {
    const m = p.media?.[0]
    if (m?.type === "video" || m?.type === "image") return m.type
    return undefined
  }

  return (
    <NotificationsProvider>
    <CartProvider>
    <div className={isDelivery ? "theme-delivery" : undefined} style={{ minHeight:"100vh", background:`${bgGrad},${bgMain}`, color: isDelivery ? "#f0f8ff" : "#f5e8c7", fontFamily:"Inter,system-ui,sans-serif", position:"relative", isolation:"isolate" }}>
      <AppBadgeSync />
      <RecoveryBanner token={userToken} onOpenMessaging={() => setMsgOpen(true)} />
      {previewMode && (
        <div style={{
          position:"relative", zIndex:60, display:"flex", flexWrap:"wrap", alignItems:"center", justifyContent:"space-between", gap:10,
          padding:"10px 16px", background: isDelivery ? "rgba(139,0,255,.92)" : "rgba(230,81,0,.92)", color:"#fff", fontSize:12, fontWeight:600,
        }}>
          <span>
            Mode aperçu admin — {shopLabel} · catalogue live (maj auto)
            {liveTick > 0 ? ` · sync #${liveTick}` : ""}
          </span>
          <span style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
            <a href="/caliboyz31?preview=1" style={{ color:"#fff", textDecoration:"underline" }}>31</a>
            <a href="/caliboyz94?preview=1" style={{ color:"#fff", textDecoration:"underline" }}>94</a>
            <a href="/calidelivery?preview=1" style={{ color:"#fff", textDecoration:"underline" }}>Delivery</a>
            <a href="/admin" style={{ color:"#fff", textDecoration:"underline", fontWeight:800 }}>Panel admin</a>
          </span>
        </div>
      )}
      <style>{`
        @media (min-width: 768px) {
          .desktop-nav-right { display: flex !important; }
          .mobile-nav-right  { display: none !important; }
          .desktop-nav-bar   { display: flex !important; }
          .product-modal-backdrop { align-items: center !important; padding: 24px !important; }
          .product-modal-sheet {
            border-radius: 20px !important;
            max-height: min(88vh, 780px) !important;
            width: min(100%, 520px) !important;
          }
          .product-grid {
            grid-template-columns: repeat(auto-fill, minmax(min(100%, 260px), 1fr)) !important;
            gap: 18px !important;
          }
        }
        @media (max-width: 767px) {
          .desktop-nav-right { display: none !important; }
          .mobile-nav-right  { display: flex !important; }
          .desktop-nav-bar   { display: none !important; }
          .product-modal-backdrop { align-items: flex-end !important; }
          .product-modal-sheet {
            border-radius: 24px 24px 0 0 !important;
            max-height: 90vh !important;
            width: 100% !important;
          }
          /* 2 colonnes mobiles : thumbs portrait, hauteur raisonnable pour scroller */
          .product-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            gap: 10px !important;
          }
          .product-thumb {
            aspect-ratio: 3 / 4 !important;
          }
        }
        /* Images dans la thumb : cover centré (produits) */
        .product-thumb img {
          width: 100% !important;
          height: 100% !important;
          object-fit: cover !important;
          object-position: center !important;
        }
        .product-detail-media img {
          width: 100% !important;
          height: 100% !important;
          object-fit: cover !important;
          object-position: center !important;
        }
        .shop-layer { position: relative; z-index: 2; }
      `}</style>
      <ParticlesCanvas theme={theme} />

      {/* ══ NAVBAR ══ */}
      <header className="shop-layer" style={{ position:"sticky", top:0, zIndex:40, borderBottom:`1px solid ${cardBorder}`, background:isDelivery?"rgba(10,0,18,.96)":"rgba(15,13,7,.96)", backdropFilter:"blur(14px)" }}>

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
              <button type="button" onClick={() => setLoyaltyOpen(true)}
                style={{ display:"flex", alignItems:"center", gap:4, padding:"4px 10px", borderRadius:999, border:`1px solid ${cardBorder}`, fontSize:11, background:"transparent", cursor:"pointer" }}>
                <Star style={{ width:11, height:11, color:accentColor }} />
                <span style={{ color:accentColor, fontWeight:700 }}>{stats.points}</span>
                <span style={{ color:"rgba(200,190,170,.5)", fontSize:10 }}>pts</span>
              </button>
            )}
            <NotificationBell onOpenOrder={() => setOrdersOpen(true)} />
            <button onClick={() => setDashOpen(true)}
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
        <div className="shop-layer">
        <CheckoutCart
          cart={cart} setCart={setCart} customerToken={userToken} customerName={userPseudo}
          shop={shop} onBack={() => setView("shop")} onOrderPlaced={() => setView("orders")}
          accentColor={accentColor} primaryColor={primaryColor} cardBorder={cardBorder}
        />
        </div>
      )}

      {view === "orders" && (
        <div className="shop-layer">
        <OrderTracker customerToken={userToken} onBack={() => setView("shop")} accentColor={accentColor} cardBorder={cardBorder} />
        </div>
      )}

      {view === "shop" && (
        <main className="shop-layer" style={{ position:"relative", zIndex:2, maxWidth:1200, margin:"0 auto", padding:"20px 16px 48px", width:"100%", boxSizing:"border-box" }}>
          {/* Filtres catégories */}
          {sections.length > 0 && (
            <div style={{
              position:"sticky", top:0, zIndex:15, margin:"0 0 20px", padding:"10px 0",
              background: isDelivery?"rgba(10,0,18,.92)":"rgba(15,13,7,.92)", backdropFilter:"blur(10px)",
              display:"flex", gap:8, overflowX:"auto", scrollbarWidth:"none", WebkitOverflowScrolling:"touch" as unknown as undefined,
            }}>
              <button type="button" onClick={() => setActiveSection("all")}
                style={{ flexShrink:0, padding:"8px 18px", borderRadius:999, border:`1px solid ${activeSection==="all"?accentColor:cardBorder}`, background:activeSection==="all"?accentColor:"transparent", color:activeSection==="all"?"#000":isDelivery?"#f0f8ff":"#f5e8c7", fontSize:13, cursor:"pointer", fontWeight:700, whiteSpace:"nowrap" }}>
                Tout
              </button>
              {sections.map((s) => (
                <button type="button" key={s} onClick={() => setActiveSection(s)}
                  style={{ flexShrink:0, padding:"8px 18px", borderRadius:999, border:`1px solid ${activeSection===s?accentColor:cardBorder}`, background:activeSection===s?accentColor:"transparent", color:activeSection===s?"#000":isDelivery?"#f0f8ff":"#f5e8c7", fontSize:13, cursor:"pointer", fontWeight:activeSection===s?700:400, whiteSpace:"nowrap" }}>
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Grille produits — miniatures plus hautes (moins de crop vidéo/photo), scroll fluide web + mobile */}
          <div className="product-grid" style={{
            display:"grid",
            gridTemplateColumns:"repeat(auto-fill, minmax(min(100%, 240px), 1fr))",
            gap:16,
            alignItems:"start",
            alignContent:"start",
          }}>
            {displayed.map((product) => {
              const img = productImage(product)
              const mType = productMediaType(product)
              const isVideoMedia = mType === "video"
              return (
              <div key={product.id} role="button" tabIndex={0}
                onClick={() => setSelectedProduct(product)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelectedProduct(product) } }}
                style={{
                  borderRadius:20, border:`1px solid ${cardBorder}`, background:isDelivery?"rgba(18,0,31,.92)":"rgba(20,18,12,.92)",
                  overflow:"hidden", cursor:"pointer", transition:"transform .25s, box-shadow .25s",
                  boxShadow:"0 8px 20px rgba(0,0,0,.45)", display:"flex", flexDirection:"column", minHeight:0,
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.transform="translateY(-3px)"; (e.currentTarget as HTMLElement).style.boxShadow=`0 0 22px ${glowColor}` }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.transform="translateY(0)"; (e.currentTarget as HTMLElement).style.boxShadow="0 8px 20px rgba(0,0,0,.45)" }}>
                {/* Zone média portrait (~4:5) — ~2× plus haute qu’avant (170px) pour moins cropper vidéos/photos */}
                <div className="product-thumb" style={{
                  position:"relative",
                  width:"100%",
                  aspectRatio:"4 / 5",
                  overflow:"hidden",
                  flexShrink:0,
                  background: isDelivery
                    ? "linear-gradient(145deg, rgba(139,0,255,.25), rgba(0,255,157,.08))"
                    : "linear-gradient(145deg, rgba(255,202,40,.18), rgba(230,81,0,.08))",
                  display:"flex", alignItems:"center", justifyContent:"center",
                }}>
                  {img ? (
                    <BlobMedia
                      src={img}
                      alt={product.title}
                      mediaType={mType}
                      className="h-full w-full"
                      videoProps={{
                        muted: true,
                        playsInline: true,
                        loop: true,
                        autoPlay: true,
                        // contain = cadre entier visible ; cover pour photos produit
                        style: {
                          width:"100%",
                          height:"100%",
                          objectFit: isVideoMedia ? "contain" : "cover",
                          objectPosition: "center",
                          background: "#000",
                        },
                      }}
                    />
                  ) : (
                    <Package style={{ width:40, height:40, opacity:0.35, color: accentColor }} />
                  )}
                </div>
                <div style={{ padding:"14px 16px", display:"flex", flexDirection:"column", gap:8, flex:1 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:8 }}>
                    <h3 style={{ margin:0, fontSize:15, fontWeight:700, color: isDelivery?"#f0f8ff":"#f5e8c7", lineHeight:1.3 }}>{product.title}</h3>
                    {product.stock === 0 && (
                      <span style={{ flexShrink:0, fontSize:10, padding:"2px 8px", borderRadius:999, background:"rgba(239,68,68,.15)", border:"1px solid rgba(239,68,68,.3)", color:"#f87171" }}>Rupture</span>
                    )}
                  </div>
                  {product.description && <p style={{ margin:0, fontSize:12, color:"rgba(200,190,170,.7)", lineHeight:1.5 }}>{product.description}</p>}
                  {product.variants && product.variants.length > 0 && (
                    <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginTop:"auto" }}>
                      {product.variants.map((v, i) => (
                        <button key={i} type="button" onClick={(e) => { e.stopPropagation(); if(product.stock>0) addToCart(product, v, `${v.qty}g`) }}
                          disabled={product.stock === 0}
                          style={{ padding:"6px 12px", borderRadius:999, border:`1px solid ${cardBorder}`, background:`rgba(${isDelivery?"139,0,255":"255,202,40"},.12)`, color:accentColor, fontSize:12, cursor:product.stock===0?"not-allowed":"pointer", fontWeight:600, opacity:product.stock===0?.5:1 }}>
                          {v.qty}g — {v.price}€
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              )
            })}
          </div>

          {displayed.length === 0 && (
            <div style={{ textAlign:"center", padding:"64px 20px", color:"rgba(200,190,170,.5)" }}>
              <Package style={{ width:48, height:48, margin:"0 auto 16px" }} />
              <p style={{ margin:0, fontSize:16 }}>Aucun produit disponible</p>
            </div>
          )}
        </main>
      )}

      {/* Détail produit : bottom sheet mobile · modal centré desktop */}
      {selectedProduct && (
        <div
          className="product-modal-backdrop"
          style={{ position:"fixed", inset:0, zIndex:80, display:"flex", justifyContent:"center", background:"rgba(0,0,0,.82)", padding:0 }}
          onClick={() => setSelectedProduct(null)}
        >
          <div
            className="product-modal-sheet"
            style={{
              background:isDelivery?"#12001f":"rgba(20,18,12,.98)",
              border:`1px solid ${cardBorder}`,
              padding:"20px 20px 28px",
              overflowY:"auto",
              boxShadow:"0 -8px 40px rgba(0,0,0,.55)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14, gap:12 }}>
              <h2 style={{ margin:0, fontSize:18, fontWeight:700, color:isDelivery?"#f0f8ff":"#f5e8c7" }}>{selectedProduct.title}</h2>
              <button type="button" onClick={() => setSelectedProduct(null)} aria-label="Fermer"
                style={{ background:"rgba(255,255,255,.06)", border:`1px solid ${cardBorder}`, borderRadius:10, width:36, height:36, cursor:"pointer", color:"rgba(200,190,170,.9)", fontSize:18, lineHeight:1 }}>×</button>
            </div>
            {productImage(selectedProduct) ? (
              <div className="product-detail-media" style={{
                width:"100%",
                aspectRatio:"4 / 5",
                maxHeight:"min(52vh, 420px)",
                borderRadius:16,
                overflow:"hidden",
                marginBottom:16,
                background:"#000",
                display:"flex",
                alignItems:"center",
                justifyContent:"center",
              }}>
                <BlobMedia
                  src={productImage(selectedProduct)}
                  alt={selectedProduct.title}
                  mediaType={productMediaType(selectedProduct)}
                  className="h-full w-full"
                  videoProps={{
                    muted: true,
                    playsInline: true,
                    controls: true,
                    style: {
                      width:"100%",
                      height:"100%",
                      objectFit: productMediaType(selectedProduct) === "video" ? "contain" : "cover",
                      objectPosition: "center",
                      background: "#000",
                    },
                  }}
                />
              </div>
            ) : null}
            {(selectedProduct.fullDescription || selectedProduct.description) && (
              <p style={{ margin:"0 0 16px", fontSize:14, lineHeight:1.7, color:"rgba(200,190,170,.9)" }}>
                {selectedProduct.fullDescription || selectedProduct.description}
              </p>
            )}
            {selectedProduct.stock === 0 ? (
              <div style={{ textAlign:"center", padding:"16px", borderRadius:14, background:"rgba(239,68,68,.1)", border:"1px solid rgba(239,68,68,.25)", color:"#f87171", fontSize:14 }}>Rupture de stock</div>
            ) : (
              <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                <p style={{ margin:0, fontSize:12, textTransform:"uppercase", letterSpacing:"0.1em", color:"rgba(200,190,170,.6)" }}>Choisir un format</p>
                {(selectedProduct.variants ?? []).map((v, i) => (
                  <button key={i} type="button" onClick={() => addToCart(selectedProduct, v, `${v.qty}g`)}
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

      <MessagerieModal isOpen={msgOpen} onClose={() => setMsgOpen(false)} userData={userData} />
      <MyOrdersModal isOpen={ordersOpen} onClose={() => setOrdersOpen(false)} userData={userData} />
      <LoyaltyModal isOpen={loyaltyOpen} onClose={() => setLoyaltyOpen(false)} userData={userData} />
      <HowItWorksModal isOpen={howOpen} onClose={() => setHowOpen(false)} />
      <DeliveryInfoModal isOpen={deliveryOpen} onClose={() => setDeliveryOpen(false)} />
      <UserDashboardModal isOpen={dashOpen} onClose={() => setDashOpen(false)} userData={userData} onLogout={logout} />
      {userToken ? <NewsPopup token={userToken} /> : null}
    </div>
    </CartProvider>
    </NotificationsProvider>
  )
}