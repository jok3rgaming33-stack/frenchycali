"use client"

import { useEffect, useMemo, useState } from "react"
import {
  X,
  UserCircle2,
  ShoppingCart,
  Bell,
  MessageSquare,
  Truck,
  Gift,
  Smartphone,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Package,
  CheckCircle2,
  MapPin,
} from "lucide-react"
import { AddToHomeScreen } from "@/components/add-to-home-screen"
import { isDeliveryShop, shopLabel, type ShopId, isShopId } from "@/lib/shops"

type Section = {
  icon: React.ReactNode
  title: string
  color: string
  steps: { label: string; desc: string }[]
}

function sectionsForShop(shop?: string | null): Section[] {
  const id: ShopId | null = isShopId(shop) ? shop : null
  const delivery = id ? isDeliveryShop(id) : false
  const label = id ? shopLabel(id) : "LaCentral"
  const localName = id === "caliboyz94" ? "LaCentral IDF" : "LaCentral 31"

  const account: Section = {
    icon: <UserCircle2 className="h-5 w-5" />,
    title: "1. Créer ton compte",
    color: "text-blue-400 bg-blue-400/10 border-blue-400/20",
    steps: [
      {
        label: "Pseudo anonyme",
        desc: "Aucun email ni téléphone requis. Ton pseudo est ton seul identifiant visible sur la boutique.",
      },
      {
        label: "Clé secrète (token)",
        desc: "À la création, une clé unique t'est affichée une seule fois. Note-la sur papier : c'est le seul moyen de te reconnecter sur un autre appareil.",
      },
    ],
  }

  const orderLocal: Section = {
    icon: <ShoppingCart className="h-5 w-5" />,
    title: "2. Commander sur " + localName,
    color: "text-accent bg-accent/10 border-accent/20",
    steps: [
      {
        label: "Panier",
        desc: "Ajoute les produits disponibles. Le stock est mis à jour en temps réel.",
      },
      {
        label: "Modes de récupération",
        desc: "Deux options uniquement : Meet-up (retrait en main propre, gratuit) ou Livraison par nos soins (frais selon distance, dès le montant minimum fixé par le vendeur).",
      },
      {
        label: "Paiement",
        desc: "Pas de paiement crypto sur cette boutique. Le règlement se fait à la remise (meet-up ou livraison).",
      },
    ],
  }

  const orderDelivery: Section = {
    icon: <ShoppingCart className="h-5 w-5" />,
    title: "2. Commander sur CaliDelivery",
    color: "text-accent bg-accent/10 border-accent/20",
    steps: [
      {
        label: "Panier & colis",
        desc: "Ajoute tes produits puis choisis un service de livraison colis (Mondial Relay, Chronopost, Colissimo, UPS… selon ce que le vendeur a activé).",
      },
      {
        label: "Adresse / point relais",
        desc: "Indique l'adresse ou le point relais demandé pour le transporteur choisi.",
      },
      {
        label: "Devise de paiement",
        desc: "Choisis ta crypto (BTC, ETH, XMR, USDT…). Tu paies depuis ton propre portefeuille — aucune passerelle tierce obligatoire.",
      },
    ],
  }

  const parcelFlow: Section = {
    icon: <Package className="h-5 w-5" />,
    title: "3. Paiement crypto & suivi colis",
    color: "text-cyan-400 bg-cyan-400/10 border-cyan-400/20",
    steps: [
      {
        label: "Adresse wallet",
        desc: "Dès la validation, tu reçois automatiquement l'adresse du wallet correspondant à la devise choisie, dans Mes commandes / messagerie.",
      },
      {
        label: "« J'ai fait le virement »",
        desc: "Après l'envoi depuis ton portefeuille, clique sur ce bouton. Le vendeur est notifié et vérifie la réception.",
      },
      {
        label: "Préparation & expédition",
        desc: "Quand le virement est confirmé, la commande passe en préparation. Une fois le colis parti, tu reçois le numéro de suivi.",
      },
      {
        label: "Réception",
        desc: "Clique sur « J'ai bien reçu mon colis » pour clôturer. Sans cette validation, la commande reste en suspens et les points fidélité ne sont pas crédités.",
      },
    ],
  }

  const localDelivery: Section = {
    icon: <Truck className="h-5 w-5" />,
    title: "3. Livraison & Meet-up",
    color: "text-orange-400 bg-orange-400/10 border-orange-400/20",
    steps: [
      {
        label: "Livraison par nos soins",
        desc: "Disponible dès le montant minimum configuré. Frais selon la distance (ex. 10€ jusqu'à 10 km, 20€ jusqu'à 20 km, puis +1€/km). Choisis un créneau parmi ceux ouverts.",
      },
      {
        label: "Meet-up",
        desc: "Rendez-vous à un point convenu. Gratuit. Les créneaux déjà passés disparaissent automatiquement.",
      },
      {
        label: "Suivi",
        desc: "Chaque commande ouvre un fil privé. Tu suis le statut (validée, préparation, en route, livrée) et tu peux écrire au vendeur.",
      },
    ],
  }

  const notifs: Section = {
    icon: <Bell className="h-5 w-5" />,
    title: delivery ? "4. Notifications" : "4. Notifications",
    color: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20",
    steps: [
      {
        label: "Active la cloche",
        desc: "Autorise les notifications pour être alerté des messages et du suivi de commande, même app fermée.",
      },
      {
        label: "iPhone",
        desc: "Ajoute d'abord LaCentral à l'écran d'accueil (Safari → Partager → Sur l'écran d'accueil) pour que les push fonctionnent.",
      },
    ],
  }

  const messaging: Section = {
    icon: <MessageSquare className="h-5 w-5" />,
    title: delivery ? "5. Messagerie" : "5. Messagerie",
    color: "text-purple-400 bg-purple-400/10 border-purple-400/20",
    steps: [
      {
        label: "Fil par commande",
        desc: "Chaque commande crée un fil privé avec le vendeur (produits, adresse wallet, suivi, messages).",
      },
      {
        label: "Contact direct",
        desc: "Tu peux aussi écrire sans commande en cours pour une question ou une demande.",
      },
    ],
  }

  const loyalty: Section = {
    icon: <Gift className="h-5 w-5" />,
    title: delivery ? "6. Fidélité" : "6. Fidélité",
    color: "text-pink-400 bg-pink-400/10 border-pink-400/20",
    steps: [
      {
        label: "Points",
        desc: delivery
          ? "1 point ≈ 1€. Les points sont crédités uniquement quand tu confirmes « J'ai bien reçu mon colis »."
          : "1 point ≈ 1€, crédités à la livraison confirmée. Consulte ton solde dans l'espace fidélité.",
      },
      {
        label: "Codes promo",
        desc: "Saisis un code dans le panier s'il t'a été communiqué (annonces ou messagerie).",
      },
    ],
  }

  const mobile: Section = {
    icon: <Smartphone className="h-5 w-5" />,
    title: delivery ? "7. Application mobile" : "7. Application mobile",
    color: "text-teal-400 bg-teal-400/10 border-teal-400/20",
    steps: [
      {
        label: "Ajouter à l'écran d'accueil",
        desc: "iPhone (Safari) : Partager → Sur l'écran d'accueil. Android (Chrome) : menu ⋮ → Installer / Ajouter. L'app s'appelle LaCentral.",
      },
    ],
  }

  const security: Section = {
    icon: <ShieldCheck className="h-5 w-5" />,
    title: delivery ? "8. Sécurité" : "8. Sécurité",
    color: "text-red-400 bg-red-400/10 border-red-400/20",
    steps: [
      {
        label: "Anonymat",
        desc: `Sur ${label} : pas de vrai nom obligatoire. Pseudo + clé secrète suffisent.`,
      },
      {
        label: "Garde ta clé",
        desc: "Si tu perds ta clé secrète, l'accès au compte est très difficile à récupérer. Note-la hors ligne.",
      },
      {
        label: "Trois boutiques indépendantes",
        desc: "LaCentral 31, LaCentral IDF et CaliDelivery sont gérées séparément (produits, livraisons, paiements). Un même compte client peut naviguer partout.",
      },
    ],
  }

  const shopsOverview: Section = {
    icon: <MapPin className="h-5 w-5" />,
    title: "Les 3 univers",
    color: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
    steps: [
      {
        label: "LaCentral 31",
        desc: "Boutique locale Toulouse — meet-up & livraison par l'équipe. Pas de colis, pas de crypto.",
      },
      {
        label: "LaCentral IDF",
        desc: "Boutique Île-de-France — meet-up & livraison par l'équipe. Pas de colis, pas de crypto.",
      },
      {
        label: "CaliDelivery",
        desc: "Livraison uniquement par colis (transporteurs configurés) + paiement crypto depuis ton portefeuille.",
      },
    ],
  }

  if (delivery) {
    return [account, orderDelivery, parcelFlow, notifs, messaging, loyalty, mobile, security, shopsOverview]
  }
  return [account, orderLocal, localDelivery, notifs, messaging, loyalty, mobile, security, shopsOverview]
}

type Props = {
  isOpen: boolean
  onClose: () => void
  requireRead?: boolean
  onConfirm?: () => void
  /** Boutique courante pour adapter le contenu (31 / IDF / delivery). */
  shop?: string | null
}

export function HowItWorksModal({ isOpen, onClose, requireRead = false, onConfirm, shop }: Props) {
  const sections = useMemo(() => sectionsForShop(shop), [shop])
  const [expanded, setExpanded] = useState<number | null>(0)
  const [seen, setSeen] = useState<Set<number>>(() => new Set([0]))

  useEffect(() => {
    if (!isOpen) return
    setExpanded(0)
    setSeen(new Set([0]))
  }, [isOpen, shop, requireRead])

  const allSeen = seen.size >= sections.length
  const canClose = !requireRead || allSeen

  const toggle = (i: number) => {
    const opening = expanded !== i
    setExpanded(opening ? i : null)
    if (opening) setSeen((prev) => new Set(prev).add(i))
  }

  if (!isOpen) return null

  const titleShop = isShopId(shop) ? shopLabel(shop) : "LaCentral"

  return (
    <div
      className="modal-overlay fixed inset-0 z-[110] flex items-end justify-center bg-background/85 backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label="Comment ça marche"
    >
      <div className="modal-shell w-full max-w-2xl rounded-3xl border border-border bg-card shadow-2xl">
        <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-4 sm:px-6 sm:py-5">
          <div className="min-w-0 pr-3">
            <h2 className="text-lg font-bold tracking-tight sm:text-xl">Comment ça marche ?</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {requireRead
                ? `Lis chaque section (${titleShop}) pour débloquer la création de ton compte.`
                : `Guide ${titleShop} — modes de commande, paiement et suivi.`}
            </p>
          </div>
          {canClose && (
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-secondary text-secondary-foreground"
              aria-label="Fermer"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {requireRead && (
          <div className="border-b border-border px-5 py-2 sm:px-6">
            <div className="mb-1 flex justify-between text-[11px] text-muted-foreground">
              <span>Progression</span>
              <span>
                {seen.size}/{sections.length} sections
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full bg-accent transition-all"
                style={{ width: `${(seen.size / sections.length) * 100}%` }}
              />
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6">
          <div className="flex flex-col gap-2">
            {sections.map((section, i) => {
              const open = expanded === i
              const hasBeenSeen = seen.has(i)
              return (
                <div
                  key={section.title}
                  className={`overflow-hidden rounded-2xl border transition-colors ${
                    open ? "border-accent/40 bg-accent/5" : "border-border bg-background/40"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => toggle(i)}
                    className="flex w-full items-center gap-3 px-3 py-3 text-left sm:px-4"
                  >
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${section.color}`}
                    >
                      {section.icon}
                    </span>
                    <span className="min-w-0 flex-1 text-sm font-semibold text-foreground">{section.title}</span>
                    {requireRead && hasBeenSeen && (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" aria-hidden="true" />
                    )}
                    {open ? (
                      <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                  </button>
                  {open && (
                    <div className="space-y-3 border-t border-border/60 px-4 py-3">
                      {section.steps.map((step) => (
                        <div key={step.label}>
                          <p className="text-xs font-bold text-accent">{step.label}</p>
                          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{step.desc}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {requireRead && allSeen && (
          <div className="shrink-0 border-t border-border p-4 sm:p-5">
            <button
              type="button"
              onClick={() => (onConfirm ? onConfirm() : onClose())}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-accent py-3.5 text-sm font-bold text-accent-foreground"
            >
              <CheckCircle2 className="h-5 w-5" />
              J&apos;ai compris — créer ma clé
            </button>
          </div>
        )}

        {requireRead && !allSeen && (
          <div className="shrink-0 border-t border-border px-4 py-3 text-center text-xs text-muted-foreground">
            Ouvre toutes les sections pour continuer ({sections.length - seen.size} restante
            {sections.length - seen.size > 1 ? "s" : ""}).
          </div>
        )}

        {(!requireRead || allSeen) && !requireRead && (
          <div className="shrink-0 border-t border-border p-4">
            <AddToHomeScreen accent="var(--color-accent,#ffca28)" compact />
          </div>
        )}
      </div>
    </div>
  )
}
