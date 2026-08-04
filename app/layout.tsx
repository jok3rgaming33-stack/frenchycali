import type { Metadata, Viewport } from "next"
import { Orbitron, Inter } from "next/font/google"
import "./globals.css"

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" })
const orbitron = Orbitron({ subsets: ["latin"], weight: ["400", "700", "900"], variable: "--font-orbitron" })

export const metadata: Metadata = {
  title: "FrenchyCali — Accès Sécurisé",
  description: "Accès sécurisé à la plateforme FrenchyCali.",
  robots: "noindex, nofollow",
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0f0d07",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`bg-background ${inter.variable} ${orbitron.variable}`}>
      <body className="font-sans">{children}</body>
    </html>
  )
}
