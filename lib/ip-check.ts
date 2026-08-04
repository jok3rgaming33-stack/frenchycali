import "server-only"
import { headers } from "next/headers"

export async function getClientIp(): Promise<string | null> {
  const h = await headers()
  const forwarded = h.get("x-forwarded-for")
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim()
    if (first) return first
  }
  return h.get("x-real-ip")?.trim() || null
}

export async function isVpnOrProxy(ip: string | null): Promise<boolean> {
  if (!ip) return false
  if (
    ip === "127.0.0.1" ||
    ip === "::1" ||
    ip.startsWith("10.") ||
    ip.startsWith("192.168.") ||
    ip.startsWith("172.16.")
  ) {
    return false
  }
  const key = process.env.PROXYCHECK_API_KEY
  if (!key) return false
  try {
    const res = await fetch(`https://proxycheck.io/v2/${ip}?key=${key}&vpn=1&risk=1`, {
      cache: "no-store",
    })
    if (!res.ok) return false
    const data = (await res.json()) as Record<string, any>
    const entry = data[ip]
    if (!entry || typeof entry !== "object") return false
    return entry.proxy === "yes"
  } catch {
    return false
  }
}
