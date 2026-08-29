"use client"

import { useEffect } from "react"

/** Enregistre le SW dès le chargement (installabilité Chrome + push iOS). */
export function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {})
  }, [])
  return null
}
