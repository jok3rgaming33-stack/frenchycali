"use client"

import { useEffect, useState } from "react"
import { Loader2, Save, Wallet, Plus, Trash2 } from "lucide-react"
import {
  getCryptoCurrencies,
  setCryptoCurrencies,
  type CryptoCurrencyOption,
} from "@/app/actions/crypto-payment"

/**
 * Devises + adresses wallet proposées au checkout CaliDelivery.
 * Le client reçoit l'adresse automatiquement selon son choix.
 */
export function AdminCryptoSettings() {
  const [currencies, setCurrencies] = useState<CryptoCurrencyOption[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => {
    getCryptoCurrencies()
      .then(setCurrencies)
      .catch(() => setCurrencies([]))
      .finally(() => setLoading(false))
  }, [])

  const updateCurrency = (id: string, patch: Partial<CryptoCurrencyOption>) => {
    setCurrencies((prev) =>
      prev ? prev.map((c) => (c.id === id ? { ...c, ...patch } : c)) : prev,
    )
  }

  const removeCurrency = (id: string) => {
    setCurrencies((prev) => (prev ? prev.filter((c) => c.id !== id) : prev))
  }

  const addCurrency = () => {
    const id = `c_${crypto.randomUUID().replace(/-/g, "").slice(0, 8)}`
    setCurrencies((prev) => [
      ...(prev ?? []),
      { id, code: "", name: "Nouvelle devise", enabled: true, address: "" },
    ])
  }

  const save = async () => {
    if (!currencies) return
    setSaving(true)
    setMsg(null)
    const cleaned = currencies.map((c) => ({
      ...c,
      code: c.code.trim().toLowerCase(),
      name: c.name.trim(),
      id: (c.id || c.code).trim().toLowerCase(),
      address: (c.address ?? "").toString().trim() || null,
    }))
    const cur = await setCryptoCurrencies(cleaned)
    setSaving(false)
    if (!cur.ok) {
      setMsg(cur.error ?? "Erreur")
      return
    }
    setCurrencies(await getCryptoCurrencies())
    setMsg("Enregistré.")
  }

  if (loading || !currencies) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-accent" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="mb-4 flex items-start gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/15 text-accent">
            <Wallet className="h-5 w-5" />
          </span>
          <div>
            <h3 className="text-lg font-bold">Devises &amp; adresses</h3>
            <p className="text-sm text-muted-foreground">
              Renseigne l&apos;adresse wallet pour chaque crypto. Elle est envoyée automatiquement au
              client dès qu&apos;il choisit cette devise à la commande.
            </p>
          </div>
        </div>

        <div className="mb-4 flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            Active / désactive, ajoute ou supprime. Sans adresse, le client devra attendre ton message.
          </p>
          <button
            type="button"
            onClick={addCurrency}
            className="flex shrink-0 items-center gap-1.5 rounded-xl border border-accent/40 bg-accent/10 px-3 py-2 text-xs font-semibold text-accent"
          >
            <Plus className="h-3.5 w-3.5" />
            Ajouter
          </button>
        </div>

        <ul className="space-y-3">
          {currencies.map((c) => (
            <li
              key={c.id}
              className="flex flex-col gap-2 rounded-xl border border-border bg-background/40 p-3"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <label className="flex items-center gap-2 text-xs font-medium">
                  <input
                    type="checkbox"
                    checked={c.enabled}
                    onChange={(e) => updateCurrency(c.id, { enabled: e.target.checked })}
                    className="h-4 w-4 accent-[var(--color-accent,#00ff9d)]"
                  />
                  Actif
                </label>
                <input
                  value={c.name}
                  onChange={(e) => updateCurrency(c.id, { name: e.target.value })}
                  placeholder="Nom affiché"
                  className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
                />
                <input
                  value={c.code}
                  onChange={(e) => updateCurrency(c.id, { code: e.target.value.toLowerCase() })}
                  placeholder="code (btc)"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm outline-none focus:border-accent sm:w-32"
                />
                <button
                  type="button"
                  onClick={() => removeCurrency(c.id)}
                  className="flex items-center justify-center gap-1 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Suppr.
                </button>
              </div>
              <label className="block">
                <span className="mb-1 block text-[11px] font-medium text-muted-foreground">
                  Adresse wallet ({c.code ? c.code.toUpperCase() : "…"})
                </span>
                <input
                  value={c.address ?? ""}
                  onChange={(e) => updateCurrency(c.id, { address: e.target.value })}
                  placeholder="Colle l'adresse de réception pour cette devise"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs outline-none focus:border-accent"
                />
              </label>
            </li>
          ))}
        </ul>
      </div>

      {msg && <p className="text-sm text-accent">{msg}</p>}

      <button
        type="button"
        onClick={save}
        disabled={saving}
        className="flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        Enregistrer
      </button>
    </div>
  )
}
