"use server"

// Turnstile verification — if key not set, allow all (dev/testing)
export async function verifyHuman(token: string): Promise<{ ok: boolean; error?: string }> {
  const secret = process.env.CLOUDFLARE_TURNSTILE_SECRET
  if (!secret || token === "unavailable") return { ok: true }
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret, response: token }),
    })
    const data = await res.json() as { success: boolean }
    if (!data.success) return { ok: false, error: "Vérification anti-robot échouée. Réessaie." }
    return { ok: true }
  } catch {
    return { ok: true } // fail-open en cas de panne Turnstile
  }
}
