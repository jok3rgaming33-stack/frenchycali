"use server"

import { cookies } from "next/headers"
import { db } from "@/lib/db"
import { adminAccounts, webauthnCredentials, webauthnChallenges } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import {
  startWebAuthnAuthentication,
  finishWebAuthnAuthentication,
  startWebAuthnRegistration,
  finishWebAuthnRegistration,
} from "@/app/actions/webauthn"

// ─── Clés localStorage pour le token admin biométrique ───────────────────────
// Les credentials admins sont stockés sous une clé séparée côté client
export const ADMIN_BIO_FLAG_KEY = "cali_admin_webauthn"
export const ADMIN_BIO_IDS_KEY  = "cali_admin_webauthn_ids"

export async function isAdminAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies()
  const token = cookieStore.get("admin_token")?.value
  if (!token) return false
  if (token === process.env.ADMIN_TOKEN) return true
  const rows = await db
    .select({ id: adminAccounts.id })
    .from(adminAccounts)
    .where(eq(adminAccounts.token, token))
    .limit(1)
  return rows.length > 0
}

export async function adminLogin(token: string): Promise<{ ok: boolean; error?: string }> {
  if (!token?.trim()) return { ok: false, error: "Token requis." }
  const isEnvToken = token.trim() === process.env.ADMIN_TOKEN
  let isDbToken = false
  if (!isEnvToken) {
    const rows = await db
      .select({ id: adminAccounts.id, active: adminAccounts.active })
      .from(adminAccounts)
      .where(eq(adminAccounts.token, token.trim()))
      .limit(1)
    isDbToken = rows.length > 0 && rows[0].active
  }
  if (!isEnvToken && !isDbToken) return { ok: false, error: "Token invalide." }
  const cookieStore = await cookies()
  // Session cookie — expires when browser/app is closed, no maxAge/expires
  cookieStore.set("admin_token", token.trim(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  })
  return { ok: true }
}

export async function adminLogout() {
  const cookieStore = await cookies()
  cookieStore.delete("admin_token")
}

// ─── Enrôlement biométrie ADMIN ───────────────────────────────────────────────
// On réutilise le token admin comme "userToken" pour les tables webauthn.
// La biométrie admin est stockée séparément (ADMIN_BIO_IDS_KEY côté client).
export async function startAdminBioRegistration(adminToken: string) {
  // Vérifie d'abord que le token admin est valide
  const isEnv = adminToken.trim() === process.env.ADMIN_TOKEN
  let isDb = false
  if (!isEnv) {
    const rows = await db
      .select({ id: adminAccounts.id, active: adminAccounts.active })
      .from(adminAccounts)
      .where(eq(adminAccounts.token, adminToken.trim()))
      .limit(1)
    isDb = rows.length > 0 && rows[0].active
  }
  if (!isEnv && !isDb) return { ok: false as const, error: "Token admin invalide." }

  // Utilise startWebAuthnRegistration mais en passant le token admin.
  // La table webauthn_credentials utilisera userToken = adminToken.
  // On by-passe la vérification du compte users en utilisant directement les primitives.
  const { generateRegistrationOptions } = await import("@simplewebauthn/server")
  const { createHash, randomBytes } = await import("crypto")
  const { sql } = await import("drizzle-orm")

  try {
    // Ensure schema exists
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS webauthn_credentials (
        id SERIAL PRIMARY KEY, user_token TEXT NOT NULL,
        credential_id TEXT NOT NULL UNIQUE, public_key TEXT NOT NULL,
        counter INTEGER NOT NULL DEFAULT 0, transports TEXT,
        device_label TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`)
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS webauthn_challenges (
        id TEXT PRIMARY KEY, challenge TEXT NOT NULL, user_token TEXT,
        purpose TEXT NOT NULL, expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`)
  } catch { /* already exists */ }

  const token = adminToken.trim()
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://frenchycali.vercel.app"
  let rpID = "frenchycali.vercel.app"
  let rpName = "FrenchyCali Admin"
  try {
    const { headers } = await import("next/headers")
    const h = await headers()
    const host = (h.get("x-forwarded-host") || h.get("host") || "").split(",")[0].trim().replace(/:\d+$/, "")
    if (host) rpID = host.includes(".") ? host.split(".").slice(-2).join(".") : host
  } catch { /* ignore */ }

  const userID = createHash("sha256").update("admin:" + token).digest()
  const userIDArray = new Uint8Array(userID.byteLength)
  userIDArray.set(userID)

  const existing = await db.select({ credentialId: webauthnCredentials.credentialId })
    .from(webauthnCredentials)
    .where(eq(webauthnCredentials.userToken, "admin:" + token))

  const options = await generateRegistrationOptions({
    rpName, rpID,
    userName: "admin", userDisplayName: "Admin FrenchyCali",
    userID: userIDArray,
    attestationType: "none",
    excludeCredentials: existing.map(c => ({ id: c.credentialId })),
    authenticatorSelection: { authenticatorAttachment: "platform", residentKey: "preferred", requireResidentKey: false, userVerification: "required" },
  })

  const challengeId = randomBytes(16).toString("hex")
  await db.insert(webauthnChallenges).values({
    id: challengeId, challenge: options.challenge,
    purpose: "registration", userToken: "admin:" + token,
    expiresAt: new Date(Date.now() + 5 * 60 * 1000),
  })

  return { ok: true as const, options, challengeId }
}

export async function finishAdminBioRegistration(input: {
  adminToken: string; challengeId: string; response: unknown
}) {
  const { verifyRegistrationResponse } = await import("@simplewebauthn/server")
  const { isoBase64URL } = await import("@simplewebauthn/server/helpers")
  const { eq } = await import("drizzle-orm")

  const token = input.adminToken?.trim()
  if (!token) return { ok: false as const, error: "Token manquant." }

  const rows = await db.select().from(webauthnChallenges).where(eq(webauthnChallenges.id, input.challengeId)).limit(1)
  const row = rows[0]
  if (!row || row.userToken !== "admin:" + token) return { ok: false as const, error: "Défi expiré." }
  if (new Date(row.expiresAt).getTime() < Date.now()) return { ok: false as const, error: "Délai dépassé." }
  await db.delete(webauthnChallenges).where(eq(webauthnChallenges.id, input.challengeId))

  // Build expected origins
  const origins: string[] = []
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://frenchycali.vercel.app"
  try { const u = new URL(siteUrl); origins.push(u.origin) } catch { origins.push("https://frenchycali.vercel.app") }
  let rpID = "frenchycali.vercel.app"
  try {
    const { headers } = await import("next/headers")
    const h = await headers()
    const host = (h.get("x-forwarded-host") || h.get("host") || "").split(",")[0].trim()
    const proto = (h.get("x-forwarded-proto") || "https").split(",")[0].trim()
    if (host) {
      const cleanHost = host.replace(/:\d+$/, "")
      origins.push(`${proto}://${host}`)
      origins.push(`${proto}://${cleanHost}`)
      rpID = cleanHost.includes(".") ? cleanHost.split(".").slice(-2).join(".") : cleanHost
    }
  } catch { /* ignore */ }

  try {
    const resp = input.response as any
    const verification = await verifyRegistrationResponse({
      response: resp, expectedChallenge: row.challenge,
      expectedOrigin: origins, expectedRPID: [rpID],
      requireUserVerification: true,
    })
    if (!verification.verified || !verification.registrationInfo) return { ok: false as const, error: "Vérification refusée." }

    const { credential } = verification.registrationInfo
    const publicKeyB64 = isoBase64URL.fromBuffer(credential.publicKey)
    const transports = resp.response?.transports?.join(",") ?? null

    await db.delete(webauthnCredentials).where(eq(webauthnCredentials.credentialId, credential.id))
    await db.insert(webauthnCredentials).values({
      userToken: "admin:" + token,
      credentialId: credential.id,
      publicKey: publicKeyB64,
      counter: credential.counter ?? 0,
      transports,
      deviceLabel: "Admin device",
    })

    return { ok: true as const, credentialId: credential.id }
  } catch { return { ok: false as const, error: "Activation impossible." } }
}

export async function startAdminBioAuthentication(credentialIds?: string[]) {
  const { generateAuthenticationOptions } = await import("@simplewebauthn/server")
  const { randomBytes } = await import("crypto")

  let rpID = "frenchycali.vercel.app"
  try {
    const { headers } = await import("next/headers")
    const h = await headers()
    const host = (h.get("x-forwarded-host") || h.get("host") || "").split(",")[0].trim().replace(/:\d+$/, "")
    if (host) rpID = host.includes(".") ? host.split(".").slice(-2).join(".") : host
  } catch { /* ignore */ }

  let allowCredentials: { id: string }[] | undefined
  if (credentialIds?.length) {
    const rows = await db.select({ credentialId: webauthnCredentials.credentialId, userToken: webauthnCredentials.userToken })
      .from(webauthnCredentials)
    const set = new Set(credentialIds)
    allowCredentials = rows
      .filter(r => set.has(r.credentialId) && r.userToken.startsWith("admin:"))
      .map(r => ({ id: r.credentialId }))
    if (!allowCredentials.length) return { ok: false as const, clearLocal: true, error: "Biométrie admin expirée. Reconnecte-toi avec le token." }
  }

  const options = await generateAuthenticationOptions({
    rpID, userVerification: "required",
    allowCredentials: allowCredentials?.length ? allowCredentials : undefined,
  })

  const challengeId = randomBytes(16).toString("hex")
  await db.insert(webauthnChallenges).values({
    id: challengeId, challenge: options.challenge,
    purpose: "authentication", userToken: null,
    expiresAt: new Date(Date.now() + 5 * 60 * 1000),
  })

  return { ok: true as const, options, challengeId }
}

export async function finishAdminBioAuthentication(input: { challengeId: string; response: unknown }) {
  const { verifyAuthenticationResponse } = await import("@simplewebauthn/server")
  const { isoBase64URL } = await import("@simplewebauthn/server/helpers")

  if (!input.challengeId || !(input.response as any)?.id) return { ok: false as const, error: "Données manquantes." }

  const rows = await db.select().from(webauthnChallenges).where(eq(webauthnChallenges.id, input.challengeId)).limit(1)
  const row = rows[0]
  if (!row) return { ok: false as const, error: "Délai dépassé." }
  if (new Date(row.expiresAt).getTime() < Date.now()) return { ok: false as const, error: "Délai dépassé." }
  await db.delete(webauthnChallenges).where(eq(webauthnChallenges.id, input.challengeId))

  const resp = input.response as any
  const credRows = await db.select().from(webauthnCredentials)
    .where(eq(webauthnCredentials.credentialId, resp.id)).limit(1)
  const cred = credRows[0]
  if (!cred || !cred.userToken.startsWith("admin:")) {
    return { ok: false as const, clearLocal: true, error: "Identifiant biométrique admin inconnu." }
  }

  // Build expected origins + rpID
  const origins: string[] = []
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://frenchycali.vercel.app"
  try { const u = new URL(siteUrl); origins.push(u.origin) } catch { origins.push("https://frenchycali.vercel.app") }
  let rpID = "frenchycali.vercel.app"
  try {
    const { headers } = await import("next/headers")
    const h = await headers()
    const host = (h.get("x-forwarded-host") || h.get("host") || "").split(",")[0].trim()
    const proto = (h.get("x-forwarded-proto") || "https").split(",")[0].trim()
    if (host) {
      const cleanHost = host.replace(/:\d+$/, "")
      origins.push(`${proto}://${host}`)
      origins.push(`${proto}://${cleanHost}`)
      rpID = cleanHost.includes(".") ? cleanHost.split(".").slice(-2).join(".") : cleanHost
    }
  } catch { /* ignore */ }

  try {
    const verification = await verifyAuthenticationResponse({
      response: resp, expectedChallenge: row.challenge,
      expectedOrigin: origins, expectedRPID: [rpID],
      credential: {
        id: cred.credentialId,
        publicKey: isoBase64URL.toBuffer(cred.publicKey),
        counter: Math.max(0, cred.counter ?? 0),
        transports: cred.transports?.split(",") as any,
      },
      requireUserVerification: true,
    })
    if (!verification.verified) return { ok: false as const, error: "Vérification biométrique échouée." }

    const newCounter = verification.authenticationInfo.newCounter
    if (typeof newCounter === "number" && newCounter >= (cred.counter ?? 0)) {
      try { await db.update(webauthnCredentials).set({ counter: newCounter }).where(eq(webauthnCredentials.credentialId, cred.credentialId)) } catch { /* non bloquant */ }
    }

    // Récupère le token admin réel depuis userToken = "admin:<token>"
    const adminToken = cred.userToken.replace(/^admin:/, "")

    // Pose le cookie admin
    const cookieStore = await cookies()
    cookieStore.set("admin_token", adminToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    })

    return { ok: true as const }
  } catch { return { ok: false as const, error: "Déverrouillage impossible." } }
}
