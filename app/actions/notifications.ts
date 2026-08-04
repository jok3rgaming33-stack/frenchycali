"use server"

import { db } from "@/lib/db"
import { broadcastNotifications, notificationReads, pushSubscriptions } from "@/lib/db/schema"
import { eq, desc, and } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { isAdminAuthenticated } from "@/app/actions/admin-auth"
import { notifyAllClients, notifyVendor } from "@/lib/push"

export type BroadcastNotificationRow = typeof broadcastNotifications.$inferSelect

export async function listBroadcastNotifications(): Promise<BroadcastNotificationRow[]> {
  if (!(await isAdminAuthenticated())) return []
  return db.select().from(broadcastNotifications).orderBy(desc(broadcastNotifications.createdAt))
}

export async function sendBroadcast(data: { title: string; body: string; recipients?: string }) {
  if (!(await isAdminAuthenticated())) return { ok: false as const }
  await notifyAllClients({ title: data.title, body: data.body })
  const [row] = await db.insert(broadcastNotifications).values({
    title: data.title, body: data.body, recipients: data.recipients || "all",
  }).returning()
  revalidatePath("/admin")
  return { ok: true as const, row }
}

export async function subscribePush(data: { role: string; endpoint: string; p256dh: string; auth: string; customerToken?: string }) {
  await db.insert(pushSubscriptions).values({
    role: data.role, endpoint: data.endpoint, p256dh: data.p256dh,
    auth: data.auth, customerToken: data.customerToken || null,
  }).onConflictDoNothing()
  return { ok: true as const }
}

export async function unsubscribePush(endpoint: string) {
  await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint))
  return { ok: true as const }
}

export async function getVapidPublicKey() {
  return { key: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || null }
}

export const listBroadcasts = listBroadcastNotifications
