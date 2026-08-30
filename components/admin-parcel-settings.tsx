"use client"

import { useEffect, useState } from "react"
import { Loader2, Save, Check, Package, Plus, Trash2 } from "lucide-react"
import {
  getParcelServices,
  setParcelServices,
  type ParcelService,
} from "@/app/actions/settings"

function slugifyId(name: string): string {
  const base = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 40)
  return base || `svc_${crypto.randomUUID().slice(0, 8)}`
}

/** Réglages des services colis CaliDelivery (frais + activation). */
export function AdminParcelSettings() {
  const [services, setServices] = useState<ParcelService[] | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getParcelServices()
      .then(setServices)
      .catch(() => setError("Impossible de charger les services colis."))
  }, [])

  const update = (id: string, patch: Partial<ParcelService>) => {
    setServices((prev) =>
      prev ? prev.map((s) => (s.id === id ? { ...s, ...patch } : s)) : prev,
    )
  }

  const remove = (id: string) => {
    setServices((prev) => (prev ? prev.filter((s) => s.id !== id) : prev))
  }

  const add = () => {
    const id = `svc_${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`
    setServices((prev) => [
      ...(prev ?? []),
      { id, name: "Nouveau service", costEur: null, enabled: true },
    ])
  }

  const save = async () => {
    if (!services) return
    setSaving(true)
    setSaved(false)
    setError(null)
    const cleaned = services.map((s) => ({
      ...s,
      id: s.id.trim() || slugifyId(s.name),
      name: s.name.trim(),
      costEur:
        s.costEur == null || Number.isNaN(Number(s.costEur))
          ? null
          : Math.max(0, Number(s.costEur)),
    }))
    const res = await setParcelServices(cleaned)
    setSaving(false)
    if (!res.ok) {
      setError(res.error ?? "Erreur lors de l'enregistrement.")
      return
    }
    setServices(cleaned)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (!services) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-accent" aria-hidden="true" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-6 flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/15 text-accent">
          <Package className="h-5 w-5" aria-hidden="true" />
        </span>
        <div>
          <h2 className="text-lg font-bold">Services colis (CaliDelivery)</h2>
          <p className="text-sm text-muted-foreground">
            Transporteurs proposés au panier. Laisse le coût vide pour un envoi gratuit.
          </p>
        </div>
      </div>

      <div className="space-y-4 rounded-2xl border border-border bg-card p-5">
        {services.map((s) => (
          <div
            key={s.id}
            className="space-y-3 rounded-xl border border-accent/25 bg-background/40 p-4"
          >
            <div className="flex flex-wrap items-start gap-3">
              <div className="min-w-0 flex-1 space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Nom affiché</label>
                <input
                  type="text"
                  value={s.name}
                  onChange={(e) => update(s.id, { name: e.target.value })}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
                  placeholder="Ex. Chronopost"
                />
              </div>
              <div className="w-28 space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Coût (€)</label>
                <input
                  type="number"
                  min={0}
                  step={0.5}
                  value={s.costEur ?? ""}
                  onChange={(e) => {
                    const v = e.target.value.trim()
                    update(s.id, { costEur: v === "" ? null : Number(v) })
                  }}
                  placeholder="Gratuit"
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="font-mono text-[11px] text-muted-foreground">id : {s.id}</p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => update(s.id, { enabled: !s.enabled })}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                    s.enabled
                      ? "border-accent bg-accent/15 text-accent"
                      : "border-border text-muted-foreground hover:bg-secondary"
                  }`}
                >
                  {s.enabled ? "Activé" : "Désactivé"}
                </button>
                <button
                  type="button"
                  onClick={() => remove(s.id)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-destructive hover:text-destructive"
                  aria-label={`Supprimer ${s.name}`}
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={add}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-accent/40 py-3 text-sm font-semibold text-accent transition-colors hover:bg-accent/10"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Ajouter un service
        </button>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <button
          type="button"
          onClick={save}
          disabled={saving || services.length === 0}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-accent px-5 py-3 font-semibold text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : saved ? (
            <Check className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Save className="h-4 w-4" aria-hidden="true" />
          )}
          {saved ? "Enregistré" : "Enregistrer"}
        </button>
      </div>
    </div>
  )
}
