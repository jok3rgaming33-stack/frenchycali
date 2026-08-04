"use client"

export const WEBAUTHN_FLAG_KEY = "cali_webauthn"
export const WEBAUTHN_IDS_KEY = "cali_webauthn_ids"

export function browserSupportsWebAuthn(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.PublicKeyCredential !== "undefined" &&
    typeof navigator.credentials?.create === "function"
  )
}

export async function platformAuthenticatorAvailable(): Promise<boolean> {
  if (!browserSupportsWebAuthn()) return false
  try {
    if (typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === "function") {
      return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
    }
  } catch { /* ignore */ }
  return true
}

export function getLocalCredentialIds(): string[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(WEBAUTHN_IDS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter((x): x is string => typeof x === "string" && x.length > 0)
  } catch { return [] }
}

export function hasLocalWebAuthn(): boolean {
  if (typeof window === "undefined") return false
  return localStorage.getItem(WEBAUTHN_FLAG_KEY) === "1" && getLocalCredentialIds().length > 0
}

export function rememberLocalCredential(credentialId: string) {
  if (typeof window === "undefined" || !credentialId) return
  const ids = new Set(getLocalCredentialIds())
  ids.add(credentialId)
  localStorage.setItem(WEBAUTHN_IDS_KEY, JSON.stringify([...ids]))
  localStorage.setItem(WEBAUTHN_FLAG_KEY, "1")
}

export function clearLocalWebAuthn() {
  if (typeof window === "undefined") return
  localStorage.removeItem(WEBAUTHN_IDS_KEY)
  localStorage.removeItem(WEBAUTHN_FLAG_KEY)
}

export function biometryLabel(): string {
  if (typeof navigator === "undefined") return "biométrie"
  const ua = navigator.userAgent || ""
  if (/iPhone|iPad|iPod/.test(ua)) return "Face ID / Touch ID"
  if (/Macintosh/.test(ua)) return "Touch ID"
  if (/Windows/.test(ua)) return "Windows Hello"
  if (/Android/.test(ua)) return "empreinte / déverrouillage"
  return "biométrie"
}
