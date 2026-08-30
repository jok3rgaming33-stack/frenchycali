/** Identité visuelle par boutique — 31 gold, IDF bleu/indigo, Delivery néon. */
import type { ShopId } from "@/lib/shops"
import { SHOP_LABELS } from "@/lib/shops"

export type ShopParticleTheme = "gold" | "idf" | "delivery"

export type ShopTheme = {
  id: ShopId
  label: string
  particle: ShopParticleTheme
  /** Classe CSS optionnelle (modales Tailwind). */
  cssClass: string | undefined
  accent: string
  primary: string
  bgMain: string
  bgGrad: string
  cardBorder: string
  glow: string
  text: string
  textMuted: string
  headerBg: string
  cardBg: string
  logo: string
  /** RGB accent sans alpha, pour rgba(...) */
  accentRgb: string
  primaryRgb: string
  chipActiveBg: string
  chipIdleBg: string
  chipIdleBorder: string
  chipActiveBorder: string
  chipActiveShadow: string
  chipActiveText: string
  chipIdleText: string
  previewBarBg: string
  btnGrad: string
  accentGrad: string
  inputBorder: string
  inputFocus: string
  cardShadow: string
}

const THEMES: Record<ShopId, ShopTheme> = {
  caliboyz31: {
    id: "caliboyz31",
    label: SHOP_LABELS.caliboyz31,
    particle: "gold",
    cssClass: undefined,
    accent: "#ffca28",
    primary: "#e65100",
    bgMain: "#0f0d07",
    bgGrad:
      "radial-gradient(circle at top right,rgba(255,202,40,.09),transparent 60%),radial-gradient(circle at bottom left,rgba(230,81,0,.07),transparent 60%)",
    cardBorder: "rgba(255,202,40,.14)",
    glow: "rgba(255,202,40,.35)",
    text: "#f5e8c7",
    textMuted: "rgba(200,190,170,.7)",
    headerBg: "rgba(15,13,7,.96)",
    cardBg: "rgba(20,18,12,.92)",
    logo: "https://i.imgur.com/1gye7hI.jpeg",
    accentRgb: "255,202,40",
    primaryRgb: "230,81,0",
    chipActiveBg: "linear-gradient(135deg, #ffca28 0%, #e65100 100%)",
    chipIdleBg: "rgba(255,202,40,.06)",
    chipIdleBorder: "rgba(255,202,40,.22)",
    chipActiveBorder: "rgba(255,202,40,.55)",
    chipActiveShadow: "0 0 18px rgba(255,202,40,.4), 0 4px 14px rgba(230,81,0,.25)",
    chipActiveText: "#0f0d07",
    chipIdleText: "rgba(245,232,199,.88)",
    previewBarBg: "rgba(230,81,0,.92)",
    btnGrad: "linear-gradient(120deg,#ffca28,#e65100)",
    accentGrad: "linear-gradient(90deg,#ffca28,#e65100)",
    inputBorder: "rgba(255,202,40,0.18)",
    inputFocus: "#ffca28",
    cardShadow: "0 0 35px rgba(255,202,40,0.3),0 32px 80px rgba(0,0,0,0.85)",
  },
  caliboyz94: {
    id: "caliboyz94",
    label: SHOP_LABELS.caliboyz94,
    particle: "idf",
    cssClass: "theme-idf",
    accent: "#60a5fa",
    primary: "#6366f1",
    bgMain: "#070b16",
    bgGrad:
      "radial-gradient(circle at top left,rgba(99,102,241,.28),transparent 58%),radial-gradient(circle at bottom right,rgba(96,165,250,.22),transparent 55%)",
    cardBorder: "rgba(96,165,250,.16)",
    glow: "rgba(99,102,241,.4)",
    text: "#e8eef8",
    textMuted: "rgba(180,195,220,.72)",
    headerBg: "rgba(7,11,22,.96)",
    cardBg: "rgba(12,18,36,.94)",
    logo: "https://i.imgur.com/1gye7hI.jpeg",
    accentRgb: "96,165,250",
    primaryRgb: "99,102,241",
    chipActiveBg: "linear-gradient(135deg, #60a5fa 0%, #6366f1 100%)",
    chipIdleBg: "rgba(96,165,250,.08)",
    chipIdleBorder: "rgba(96,165,250,.24)",
    chipActiveBorder: "rgba(96,165,250,.55)",
    chipActiveShadow: "0 0 18px rgba(99,102,241,.45), 0 0 28px rgba(96,165,250,.18)",
    chipActiveText: "#050814",
    chipIdleText: "rgba(232,238,248,.88)",
    previewBarBg: "rgba(99,102,241,.92)",
    btnGrad: "linear-gradient(120deg,#60a5fa,#6366f1)",
    accentGrad: "linear-gradient(90deg,#60a5fa,#6366f1)",
    inputBorder: "rgba(96,165,250,0.22)",
    inputFocus: "#60a5fa",
    cardShadow: "0 0 35px rgba(99,102,241,0.32),0 32px 80px rgba(0,0,0,0.85)",
  },
  calidelivery: {
    id: "calidelivery",
    label: SHOP_LABELS.calidelivery,
    particle: "delivery",
    cssClass: "theme-delivery",
    accent: "#00ff9d",
    primary: "#8b00ff",
    bgMain: "#0a0012",
    bgGrad:
      "radial-gradient(circle at top left,rgba(139,0,255,.32),transparent 60%),radial-gradient(circle at bottom right,rgba(0,255,157,.35),transparent 60%)",
    cardBorder: "rgba(0,255,170,.14)",
    glow: "rgba(0,255,170,.35)",
    text: "#f0f8ff",
    textMuted: "rgba(176,168,208,.8)",
    headerBg: "rgba(10,0,18,.96)",
    cardBg: "rgba(18,0,31,.92)",
    logo: "https://i.imgur.com/K6NwuvJ.png",
    accentRgb: "0,255,157",
    primaryRgb: "139,0,255",
    chipActiveBg: "linear-gradient(135deg, #8b00ff 0%, #00ff9d 100%)",
    chipIdleBg: "rgba(139,0,255,.08)",
    chipIdleBorder: "rgba(0,255,157,.22)",
    chipActiveBorder: "rgba(0,255,157,.55)",
    chipActiveShadow: "0 0 18px rgba(139,0,255,.45), 0 0 28px rgba(0,255,157,.18)",
    chipActiveText: "#05010a",
    chipIdleText: "rgba(240,248,255,.88)",
    previewBarBg: "rgba(139,0,255,.92)",
    btnGrad: "linear-gradient(120deg,#8b00ff,#00ff9d)",
    accentGrad: "linear-gradient(90deg,#8b00ff,#00ff9d)",
    inputBorder: "rgba(0,255,170,0.2)",
    inputFocus: "#00ff9d",
    cardShadow: "0 0 35px rgba(0,255,170,0.35),0 32px 80px rgba(0,0,0,0.85)",
  },
}

export function getShopTheme(shop: ShopId | string): ShopTheme {
  if (shop === "caliboyz94" || shop === "calidelivery" || shop === "caliboyz31") {
    return THEMES[shop]
  }
  return THEMES.caliboyz31
}
