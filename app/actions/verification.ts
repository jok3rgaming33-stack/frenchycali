"use server"

import { db } from "@/lib/db"
import { userVerifications } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { isAdminAuthenticated } from "@/app/actions/admin-auth"
import { put } from "@vercel/blob"

export type VerificationRow = typeof userVerifications.$inferSelect

export async function getVerification(userToken: string): Promise<VerificationRow | null> {
  if (!userToken) return null
  const rows = await db.select().from(userVerifications).where(eq(userVerifications.userToken, userToken)).limit(1)
  return rows[0] ?? null
}

export async function submitVerification(formData: FormData) {
  const userToken = formData.get("userToken") as string
  const pseudo = formData.get("pseudo") as string
  const photoFile = formData.get("photo") as File | null
  const videoFile = formData.get("video") as File | null
  if (!userToken || !pseudo) return { ok: false as const, error: "Données manquantes." }

  let photoPathname: string | null = null
  let videoPathname: string | null = null

  if (photoFile && photoFile.size > 0) {
    const blob = await put(`kyc/${userToken}/photo-${Date.now()}.jpg`, photoFile, { access: "private" })
    photoPathname = blob.pathname
  }
  if (videoFile && videoFile.size > 0) {
    const blob = await put(`kyc/${userToken}/video-${Date.now()}.mp4`, videoFile, { access: "private" })
    videoPathname = blob.pathname
  }

  const existing = await db.select().from(userVerifications).where(eq(userVerifications.userToken, userToken)).limit(1)
  const now = new Date().toLocaleString("fr-FR")

  if (existing[0]) {
    await db.update(userVerifications).set({
      pseudo, photoPathname: photoPathname ?? existing[0].photoPathname,
      videoPathname: videoPathname ?? existing[0].videoPathname,
      siteName: "frenchycali", recordedAt: now, status: "pending",
    }).where(eq(userVerifications.userToken, userToken))
  } else {
    await db.insert(userVerifications).values({
      userToken, pseudo, photoPathname, videoPathname,
      siteName: "frenchycali", recordedAt: now, status: "pending",
    })
  }
  return { ok: true as const }
}

export async function listVerifications(): Promise<VerificationRow[]> {
  if (!(await isAdminAuthenticated())) return []
  return db.select().from(userVerifications).orderBy(userVerifications.createdAt)
}

export async function approveVerification(userToken: string) {
  if (!(await isAdminAuthenticated())) return { ok: false as const }
  await db.update(userVerifications)
    .set({ status: "approved", validatedAt: new Date() })
    .where(eq(userVerifications.userToken, userToken))
  revalidatePath("/admin")
  return { ok: true as const }
}

export async function rejectVerification(userToken: string) {
  if (!(await isAdminAuthenticated())) return { ok: false as const }
  await db.update(userVerifications).set({ status: "rejected" }).where(eq(userVerifications.userToken, userToken))
  revalidatePath("/admin")
  return { ok: true as const }
}
