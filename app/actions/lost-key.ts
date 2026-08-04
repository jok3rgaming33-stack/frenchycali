"use server"

import { db } from "@/lib/db"
import { accountRecoveryClaims } from "@/lib/db/schema"
import { randomBytes } from "crypto"
import { notifyVendor } from "@/lib/push"

export async function submitLostKeyClaim(data: { claimedPseudo: string; clientMessage?: string }): Promise<{ ok: boolean; provisionalToken?: string; error?: string }> {
  if (!data.claimedPseudo?.trim()) return { ok: false, error: "Pseudo requis." }
  const provisionalToken = randomBytes(24).toString("hex")
  await db.insert(accountRecoveryClaims).values({
    provisionalToken,
    claimedPseudo: data.claimedPseudo.trim(),
    clientMessage: data.clientMessage?.trim() || null,
    status: "pending_kyc",
  })
  await notifyVendor({ title: "Récupération de compte", body: `${data.claimedPseudo.trim()} demande une récupération.`, url: "/admin", tag: "recovery" })
  return { ok: true, provisionalToken }
}
