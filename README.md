# FrenchyCali — UI Cali + moteur features BB33

Identité visuelle **FrenchyCali** (multi-boutiques gold / CaliDelivery néon).  
Fonctionnalités métier portées depuis l’architecture BB33 (messagerie, KYC, logistique, push, admin modulaire, news, fidélité, restock, etc.).

## Parcours

- `/` — splash FrenchyCali  
- `/choix` — choix d’univers  
- `/caliboyz31` · `/caliboyz94` · `/calidelivery` — boutiques  
- `/admin` — panel admin complet  
- `/demo` · `/verification` · `/messagerie` · `/staff/[token]`

## Stack

Next.js 15 · React 19 · Tailwind 4 · Drizzle · Postgres (Neon) · WebAuthn · Web Push · Vercel Blob

## Dev

```bash
pnpm install
cp .env.example .env.local
# DATABASE_URL + ADMIN_TOKEN
pnpm dev
```

## Prod

Projet Vercel dédié (ne pas réutiliser le projet v0 `frenchycali` existant).
