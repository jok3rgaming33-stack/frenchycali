"use server"

import { db } from "@/lib/db"
import { orderThreads, threadMessages } from "@/lib/db/schema"
import { eq, and, gt, isNull, desc, sql } from "drizzle-orm"
import { isAdminAuthenticated } from "@/app/actions/admin-auth"

export async function getAdminBadgeCounts() {
  if (!(await isAdminAuthenticated())) return { orders: 0, locker: 0, messaging: 0, verifications: 0, recovery: 0, total: 0 }

  const activeOrders = await db.select({ id: orderThreads.id })
    .from(orderThreads)
    .where(and(
      sql`${orderThreads.status} NOT IN ('livree', 'annule', 'rembourse', 'locker_livre', 'annulee')`,
      sql`${orderThreads.fulfillment} != 'locker'`,
    ))
  const lockerOrders = await db.select({ id: orderThreads.id })
    .from(orderThreads)
    .where(and(
      sql`${orderThreads.status} NOT IN ('locker_livre', 'annule', 'annulee')`,
      eq(orderThreads.fulfillment, "locker"),
    ))
  const unreadMsgs = await db.select({ id: threadMessages.id })
    .from(threadMessages)
    .where(and(eq(threadMessages.sender, "client"), isNull(threadMessages.clientReadAt)))
  
  const { userVerifications, accountRecoveryClaims } = await import("@/lib/db/schema")
  const pendingVerifs = await db.select({ id: userVerifications.id })
    .from(userVerifications).where(eq(userVerifications.status, "pending"))
  const pendingRecovery = await db.select({ id: accountRecoveryClaims.id })
    .from(accountRecoveryClaims).where(eq(accountRecoveryClaims.status, "pending_kyc"))

  const orders = activeOrders.length
  const locker = lockerOrders.length
  const messaging = unreadMsgs.length
  const verifications = pendingVerifs.length
  const recovery = pendingRecovery.length
  const total = orders + locker + messaging + verifications + recovery
  return { orders, locker, messaging, verifications, recovery, total }
}

export async function markMessagesRead(threadId: number) {
  await db.update(threadMessages)
    .set({ clientReadAt: sql`now()` })
    .where(and(eq(threadMessages.threadId, threadId), eq(threadMessages.sender, "vendeur"), isNull(threadMessages.clientReadAt)))
}

export async function getActiveOrders() {
  if (!(await isAdminAuthenticated())) return []
  return db.select().from(orderThreads)
    .where(sql`${orderThreads.status} NOT IN ('livree','annule','rembourse','locker_livre','annulee') AND ${orderThreads.fulfillment} != 'locker'`)
    .orderBy(desc(orderThreads.updatedAt))
}

export async function getLockerOrders() {
  if (!(await isAdminAuthenticated())) return []
  return db.select().from(orderThreads)
    .where(and(eq(orderThreads.fulfillment, "locker"), sql`${orderThreads.status} NOT IN ('locker_livre','annule','annulee')`))
    .orderBy(desc(orderThreads.updatedAt))
}

export async function getPastOrders() {
  if (!(await isAdminAuthenticated())) return []
  return db.select().from(orderThreads)
    .where(sql`${orderThreads.status} IN ('livree','annule','rembourse','locker_livre','annulee')`)
    .orderBy(desc(orderThreads.updatedAt))
}
