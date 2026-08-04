import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { promoCodes } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { isAdminAuthenticated } from "@/app/actions/admin-auth"

export async function GET() {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const promos = await db.select().from(promoCodes).orderBy(promoCodes.createdAt)
  return NextResponse.json({ promos })
}

export async function POST(req: NextRequest) {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const body = await req.json()
  const [promo] = await db.insert(promoCodes).values({
    code: body.code,
    type: body.type || "fixed",
    value: body.value || 0,
    minAmount: body.minAmount || 0,
    productName: body.productName || null,
    active: true,
  }).returning()
  return NextResponse.json({ promo })
}

export async function DELETE(req: NextRequest) {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const id = Number(req.nextUrl.searchParams.get("id"))
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 })
  await db.delete(promoCodes).where(eq(promoCodes.id, id))
  return NextResponse.json({ ok: true })
}
