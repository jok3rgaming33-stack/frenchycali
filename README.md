# FrenchyCali — UI Cali + moteur features BB33

Identité visuelle **FrenchyCali** (multi-boutiques gold / CaliDelivery néon).  
Fonctionnalités métier portées depuis l’architecture BB33 (messagerie, KYC, logistique, push, admin modulaire, news, fidélité, restock, etc.).

## URLs

| Environnement | URL |
|---|---|
| **Prod (full features)** | https://frenchycali-full.vercel.app |
| **v0 (inchangé)** | https://frenchycali.vercel.app |
| **GitHub** | https://github.com/jok3rgaming33-stack/frenchycali (branche `full`) |

> Le déploiement v0 (`frenchycali`) reste sur `main` / source-code-recovery.  
> Le projet Vercel **frenchycali-full** est isolé pour ne pas casser le travail v0.

## Parcours

- `/` — splash FrenchyCali  
- `/choix` — choix d’univers  
- `/caliboyz31` · `/caliboyz94` · `/calidelivery` — boutiques  
- `/admin` — panel admin complet  
- `/demo` · `/verification` · `/messagerie` · `/staff/[token]`

## Stack

Next.js 15.5 · React 19 · Tailwind 4 · Drizzle · Postgres (Neon) · WebAuthn · Web Push · Vercel Blob

## Dev

```bash
pnpm install
cp .env.example .env.local
# DATABASE_URL + ADMIN_TOKEN
pnpm db:push
pnpm db:seed
pnpm dev
```

## Prod

Projet Vercel dédié **frenchycali-full** (ne pas réutiliser le projet v0 `frenchycali`).
Branche Git : `full`.
