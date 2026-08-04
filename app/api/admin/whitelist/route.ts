import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { reservedPseudos } from "@/lib/db/schema"
import { eq, isNull } from "drizzle-orm"
import { isAdminAuthenticated } from "@/app/actions/admin-auth"

export async function GET() {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const pseudos = await db.select().from(reservedPseudos)
    .where(isNull(reservedPseudos.deletedAt))
    .orderBy(reservedPseudos.createdAt)
  return NextResponse.json({ pseudos })
}

export async function POST(req: NextRequest) {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { pseudo } = await req.json()
  if (!pseudo?.trim()) return NextResponse.json({ error: "Missing pseudo" }, { status: 400 })
  const [row] = await db.insert(reservedPseudos).values({ pseudo: pseudo.trim() }).returning()
  return NextResponse.json({ row })
}

export async function DELETE(req: NextRequest) {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const id = Number(req.nextUrl.searchParams.get("id"))
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 })
  await db.update(reservedPseudos).set({ deletedAt: new Date() }).where(eq(reservedPseudos.id, id))
  return NextResponse.json({ ok: true })
}
