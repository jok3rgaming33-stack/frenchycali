"use client"

import { useEffect, useState } from "react"
import { Loader2, Save, Wallet, ExternalLink, CheckCircle2, AlertTriangle, Plus, Trash2 } from "lucide-react"
import {
  getCryptoGatewayStatus,
  setCryptoGatewayEnabled,
  getCryptoCurrencies,
  setCryptoCurrencies,
  type CryptoGatewayPublicStatus,
  type CryptoCurrencyOption,
} from "@/app/actions/crypto-payment"

/**
 * Réglages gateway multi-crypto (NOWPayments) + liste des cryptos proposées au checkout.
 * Pas de ChangeNOW — uniquement NOWPayments.
 */
export function AdminCryptoSettings() {
  const [status, setStatus] = useState<CryptoGatewayPublicStatus | null>(null)
  const [enabled, setEnabled] = useState(true)
  const [currencies, setCurrencies] = useState<CryptoCurrencyOption[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([getCryptoGatewayStatus(), getCryptoCurrencies()])
      .then(([s, list]) => {
        setStatus(s)
        if (s.configured && !s.enabled) setEnabled(false)
        if (s.configured && s.enabled) setEnabled(true)
        setCurrencies(list)
      })
      .catch(() => {
        setStatus(null)
        setCurrencies([])
      })
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
      { id, code: "", name: "Nouvelle crypto", enabled: true },
    ])
  }

  const save = async () => {
    if (!currencies) return
    setSaving(true)
    setMsg(null)
    const gate = await setCryptoGatewayEnabled(enabled)
    if (!gate.ok) {
      setSaving(false)
      setMsg(gate.error ?? "Erreur gateway")
      return
    }
    const cleaned = currencies.map((c) => ({
      ...c,
      code: c.code.trim().toLowerCase(),
      name: c.name.trim(),
      id: (c.id || c.code).trim().toLowerCase(),
    }))
    const cur = await setCryptoCurrencies(cleaned)
    setSaving(false)
    if (!cur.ok) {
      setMsg(cur.error ?? "Erreur cryptos")
      return
    }
    const s = await getCryptoGatewayStatus()
    setStatus(s)
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
            <h3 className="text-lg font-bold">Paiements multi-crypto</h3>
            <p className="text-sm text-muted-foreground">
              Gateway <strong>NOWPayments</strong> uniquement (pas de ChangeNOW). Le client choisit sa
              crypto dans le panier avant de valider.
            </p>
          </div>
        </div>

        <div
          className={`mb-4 flex items-start gap-2 rounded-xl border px-3 py-2.5 text-sm ${
            status?.enabled
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
              : "border-amber-500/30 bg-amber-500/10 text-amber-200"
          }`}
        >
          {status?.enabled ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          <span>{status?.message ?? "Statut inconnu."}</span>
        </div>

        <div className="mb-4 space-y-2 rounded-xl border border-border bg-background/50 p-3 text-xs text-muted-foreground">
          <p className="font-semibold text-foreground">Variables d&apos;environnement Vercel</p>
          <ul className="list-inside list-disc space-y-1 font-mono">
            <li>NOWPAYMENTS_API_KEY</li>
            <li>NOWPAYMENTS_IPN_SECRET</li>
            <li>NEXT_PUBLIC_SITE_URL</li>
          </ul>
          <p>
            IPN : <code className="rounded bg-black/30 px-1">/api/crypto/ipn</code>
          </p>
          <a
            href="https://nowpayments.io/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-accent hover:underline"
          >
            Ouvrir NOWPayments <ExternalLink className="h-3 w-3" />
          </a>
        </div>

        <label className="mb-2 flex cursor-pointer items-center gap-3 rounded-xl border border-border px-3 py-3">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            disabled={!status?.configured}
            className="h-4 w-4 accent-[var(--color-accent,#ffca28)]"
          />
          <span className="text-sm">
            <span className="font-semibold">Activer le paiement crypto au checkout</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              Si désactivé, le client ne pourra pas régler en crypto.
            </span>
          </span>
        </label>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold">Cryptos proposées</h3>
            <p className="text-xs text-muted-foreground">
              Comme pour les colis : active / désactive, ajoute ou supprime. Code = ticker NOWPayments
              (ex. <code className="rounded bg-black/30 px-1">btc</code>,{" "}
              <code className="rounded bg-black/30 px-1">usdttrc20</code>).
            </p>
          </div>
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
              className="flex flex-col gap-2 rounded-xl border border-border bg-background/40 p-3 sm:flex-row sm:items-center"
            >
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
                className="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm outline-none focus:border-accent sm:w-36"
              />
              <button
                type="button"
                onClick={() => removeCurrency(c.id)}
                className="flex items-center justify-center gap-1 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Suppr.
              </button>
            </li>
          ))}
        </ul>
      </div>

      {msg && <p className="text-sm text-accent">{msg}</p>}

      <button
        type="button"
        onClick={save}
        disabled={saving || !status?.configured}
        className="flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        Enregistrer
      </button>
    </div>
  )
}
