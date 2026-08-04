"use server"

import { db } from "@/lib/db"
import { news, newsSlides, userNewsReads } from "@/lib/db/schema"
import { eq, asc } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { isAdminAuthenticated } from "@/app/actions/admin-auth"
import { sql } from "drizzle-orm"

export async function getActiveNews() {
  const activeNews = await db.select().from(news).where(eq(news.isActive, true)).orderBy(asc(news.sortOrder))
  const result = []
  for (const n of activeNews) {
    const slides = await db.select().from(newsSlides).where(eq(newsSlides.newsId, n.id)).orderBy(asc(newsSlides.order))
    result.push({ ...n, slides })
  }
  return result
}

export async function markNewsRead(userToken: string, newsId: number) {
  if (!userToken || !newsId) return
  await db.insert(userNewsReads).values({ userToken, newsId }).onConflictDoNothing()
}

export async function hasReadNews(userToken: string, newsId: number): Promise<boolean> {
  if (!userToken || !newsId) return false
  const rows = await db.select({ id: userNewsReads.id }).from(userNewsReads)
    .where(sql`${userNewsReads.userToken} = ${userToken} AND ${userNewsReads.newsId} = ${newsId}`).limit(1)
  return rows.length > 0
}

export async function listAllNews() {
  if (!(await isAdminAuthenticated())) return []
  const allNews = await db.select().from(news).orderBy(asc(news.sortOrder))
  const result = []
  for (const n of allNews) {
    const slides = await db.select().from(newsSlides).where(eq(newsSlides.newsId, n.id)).orderBy(asc(newsSlides.order))
    result.push({ ...n, slides })
  }
  return result
}

export async function createNews(title: string) {
  if (!(await isAdminAuthenticated())) return { ok: false as const }
  const [n] = await db.insert(news).values({ title }).returning()
  revalidatePath("/admin")
  return { ok: true as const, news: n }
}

export async function toggleNews(id: number, active: boolean) {
  if (!(await isAdminAuthenticated())) return { ok: false as const }
  await db.update(news).set({ isActive: active, updatedAt: new Date() }).where(eq(news.id, id))
  revalidatePath("/admin")
  return { ok: true as const }
}

// Aliases expected by admin-panel
export const listNews = listAllNews
export const updateNewsActive = toggleNews

export async function deleteNews(id: number) {
  if (!(await isAdminAuthenticated())) return { ok: false as const }
  await db.delete(newsSlides).where(eq(newsSlides.newsId, id))
  await db.delete(news).where(eq(news.id, id))
  revalidatePath("/admin")
  return { ok: true as const }
}
