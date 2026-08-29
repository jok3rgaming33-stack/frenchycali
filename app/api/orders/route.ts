import { NextRequest, NextResponse } from "next/server"
import { placeOrder, type PlaceOrderInput } from "@/app/actions/order"

/**
 * POST JSON — plus fiable que les Server Actions Next sur Safari / PWA iOS
 * (Failed to fetch / « Erreur réseau » au checkout).
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as PlaceOrderInput
    if (!body?.customerToken || !Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json({ ok: false, error: "Données invalides." }, { status: 400 })
    }
    const result = await placeOrder(body)
    return NextResponse.json(result)
  } catch (e) {
    console.error("[api/orders]", e)
    return NextResponse.json(
      { ok: false, error: "Impossible d'enregistrer la commande. Réessaie dans un instant." },
      { status: 500 },
    )
  }
}
