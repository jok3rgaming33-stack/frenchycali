"use server"

import { cookies, headers } from "next/headers"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { adminAccounts } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { verifyTurnstile } from "@/lib/turnstile"
import { verifyPassword } from "@/lib/admin-password"

const COOKIE_NAME = "admin_session"
const ADMIN_PSEUDO = "Heisenberg"

// Vérifie un token : super-admin (env) ou compte admin actif en base.
export async function isAdminToken(token: string) {
  if (!token) return false
  if (process.env.ADMIN_TOKEN && token === process.env.ADMIN_TOKEN) return true
  const rows = await db.select().from(adminAccounts).where(eq(adminAccounts.token, token)).limit(1)
  return rows.length > 0 && rows[0].active
}

async function setSessionCookie(value: string) {
  const hdrs = await headers()
  const isHttps = (hdrs.get("x-forwarded-proto") ?? "http") === "https"
  const store = await cookies()
  store.set(COOKIE_NAME, value, {
    httpOnly: true,
    secure: isHttps,
    sameSite: isHttps ? "none" : "lax",
    path: "/",
    // Pas de maxAge → cookie de session : supprimé à la fermeture du navigateur.
  })
}

// Connexion par token : super-admin (env) ou compte admin actif.
export async function adminLogin(token: string): Promise<{ ok: boolean; pseudo?: string; error?: string }> {
  if (process.env.ADMIN_TOKEN && token === process.env.ADMIN_TOKEN) {
    await setSessionCookie(token)
    return { ok: true, pseudo: ADMIN_PSEUDO }
  }
  const rows = await db.select().from(adminAccounts).where(eq(adminAccounts.token, token)).limit(1)
  const admin = rows[0]
  if (!admin || !admin.active) return { ok: false, error: "Token invalide ou accès révoqué." }
  await setSessionCookie(admin.token)
  return { ok: true, pseudo: admin.pseudo }
}

// Connexion par pseudo + mot de passe (comptes admin disposant d'un mot de passe).
export async function adminLoginWithPassword(
  pseudo: string,
  password: string,
): Promise<{ ok: boolean; pseudo?: string; error?: string }> {
  const p = pseudo?.trim()
  if (!p || !password) return { ok: false, error: "Identifiants requis." }
  const rows = await db.select().from(adminAccounts).where(eq(adminAccounts.pseudo, p)).limit(1)
  const admin = rows[0]
  if (!admin || !admin.active) return { ok: false, error: "Identifiants invalides ou accès révoqué." }
  if (!admin.passwordHash || !verifyPassword(password, admin.passwordHash)) {
    return { ok: false, error: "Identifiants invalides." }
  }
  await setSessionCookie(admin.token)
  return { ok: true, pseudo: admin.pseudo }
}

// Lu côté serveur (panel admin) pour vérifier la session.
export async function isAdminAuthenticated() {
  const store = await cookies()
  const session = store.get(COOKIE_NAME)?.value
  if (!session) return false
  if (process.env.ADMIN_TOKEN && session === process.env.ADMIN_TOKEN) return true
  const rows = await db.select().from(adminAccounts).where(eq(adminAccounts.token, session)).limit(1)
  return rows.length > 0 && rows[0].active
}

export async function adminLogout() {
  const store = await cookies()
  store.delete(COOKIE_NAME)
  // Passer par /logout pour nettoyer aussi le localStorage côté client
  redirect("/logout")
}

/** Compte client dédié à l'aperçu admin (Vue Client) — stable, sans limite IP/VPN. */
const PREVIEW_TOKEN = "fc-admin-preview-client-v1"
const PREVIEW_PSEUDO = "Apercu Admin"

/**
 * Démarre une session « Vue Client » pour le gestionnaire authentifié.
 * Crée si besoin un compte client d'aperçu et renvoie token/pseudo pour localStorage.
 */
export async function startAdminClientPreview(): Promise<
  { ok: true; token: string; pseudo: string } | { ok: false; error: string }
> {
  if (!(await isAdminAuthenticated())) {
    return { ok: false, error: "Session admin requise. Reconnecte-toi au panel." }
  }

  const { users, reservedPseudos } = await import("@/lib/db/schema")

  const existing = await db.select().from(users).where(eq(users.token, PREVIEW_TOKEN)).limit(1)
  if (existing.length === 0) {
    await db.insert(reservedPseudos).values({ pseudo: PREVIEW_PSEUDO }).onConflictDoNothing()
    await db.insert(users).values({ token: PREVIEW_TOKEN, pseudo: PREVIEW_PSEUDO }).onConflictDoNothing()
  }

  return { ok: true, token: PREVIEW_TOKEN, pseudo: PREVIEW_PSEUDO }
}

// Action de formulaire pour la porte du panel admin (/admin).
// Supporte token seul OU pseudo+mot de passe, protégé par Cloudflare Turnstile.
export async function adminGateAction(_prevState: { error?: string } | null, formData: FormData) {
  const token = String(formData.get("token") ?? "")
  const pseudo = String(formData.get("pseudo") ?? "")
  const password = String(formData.get("password") ?? "")
  const captcha = String(formData.get("captcha") ?? "")

  const captchaOk = await verifyTurnstile(captcha)
  if (!captchaOk) return { error: "Vérification anti-robot échouée. Réessaie." }

  const res = password ? await adminLoginWithPassword(pseudo, password) : await adminLogin(token)
  if (!res.ok) return { error: res.error ?? "Identifiants invalides." }
  redirect("/admin")
}
