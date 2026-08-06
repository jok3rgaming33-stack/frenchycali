# Guide d’activation NOWPayments + Vercel (FrenchyCali)

Guide pas à pas pour le propriétaire / admin.  
Sans ces clés, le site fonctionne **comme avant** (aucune casse).

---

## A. NOWPayments — compte et clés

### A1. Créer le compte
1. Ouvre **https://nowpayments.io/**
2. Clique **Sign up** / **Get started**
3. Valide l’email
4. Connecte-toi au **Dashboard**

### A2. Wallets de réception
1. Menu latéral → **Settings** (ou **Payouts / Wallets** selon l’UI)
2. Ajoute au minimum les wallets que tu veux accepter :
   - Bitcoin (BTC)
   - Ethereum (ETH) — mainnet
   - Monero (XMR)
   - évent. USDT (choisis **un** réseau clairement)
3. Enregistre / vérifie chaque adresse

### A3. API Key
1. Menu → **Settings** → **API keys** (parfois **Payments → API**)
2. Clique **Create API key** / **Generate**
3. Copie la clé dans un gestionnaire de mots de passe  
   → ce sera `NOWPAYMENTS_API_KEY` sur Vercel  
4. **Ne la commit jamais** dans Git

### A4. IPN Secret (callback)
1. Toujours dans **Settings / API / IPN**
2. Génère ou affiche le **IPN Secret**
3. Copie-le → ce sera `NOWPAYMENTS_IPN_SECRET` sur Vercel

### A5. URL de callback IPN
1. Champ **IPN callback URL** / **Notification URL**
2. Colle exactement :

```
https://frenchycali-full.vercel.app/api/crypto/ipn
```

3. Sauvegarde

> Si ton domaine custom change, mets `https://TON-DOMAINE/api/crypto/ipn`  
> et aligne `NEXT_PUBLIC_SITE_URL` sur le même domaine.

### A6. Coins activés
1. Section **Currencies** / **Coins**
2. Active BTC, ETH, XMR (et autres si besoin)
3. Désactive ce que tu ne veux pas afficher au client

### A7. Sécurité compte
1. Active la **2FA** (authenticator)
2. Email de récupération pro
3. Ne partage pas l’API key

---

## B. Vercel — variables d’environnement

### B1. Ouvrir le projet
1. Va sur **https://vercel.com/**
2. Projet **frenchycali-full** (team heisen-web-s-projects)
3. Onglet **Settings**

### B2. Environment Variables
1. Menu gauche → **Environment Variables**
2. Ajoute **une par une** :

| Name | Value | Environments |
|------|--------|--------------|
| `NOWPAYMENTS_API_KEY` | (clé API) | Production (et Preview si tests) |
| `NOWPAYMENTS_IPN_SECRET` | (secret IPN) | Production (+ Preview) |
| `NEXT_PUBLIC_SITE_URL` | `https://frenchycali-full.vercel.app` | Production |

3. Pour chaque variable : **Save**
4. **Important** : après ajout, va dans **Deployments** → ⋮ sur le dernier → **Redeploy**  
   (sinon les nouvelles variables ne sont pas chargées)

### B3. Vérifier le deploy
1. Deployment **Ready**
2. Ouvre le site prod
3. Admin → **Paiements crypto** : le bandeau doit indiquer que c’est **configuré**

---

## C. FrenchyCali admin — interrupteur

1. Connecte-toi sur `/admin`
2. Onglet **Paiements crypto**
3. Coche **Activer le paiement crypto au checkout**
4. **Enregistrer**

Si le switch est grisé : les clés Vercel ne sont pas vues (redeploy manquant ou mauvaise env).

---

## D. Test de bout en bout

1. Compte client sur une boutique
2. Passe une petite commande
3. Écran **Commande passée** → bouton **Payer en crypto**
4. Page NOWPayments → choisis une crypto (ou annule)
5. Admin → **Récap commandes** → colonne **Paiement** :
   - *En attente* puis *Payé* après IPN
6. Fil messagerie client : message de confirmation quand payé

---

## E. Dépannage

| Symptôme | Cause probable | Action |
|----------|----------------|--------|
| Pas de bouton « Payer en crypto » | Clés absentes / switch off / pas redeploy | Vérifier env + admin + redeploy |
| IPN jamais reçu | Mauvaise URL / secret | Vérifier `/api/crypto/ipn` + `IPN_SECRET` |
| Signature invalid (logs) | Secret incorrect | Recopier IPN secret, redeploy |
| Invoice error | API key / compte non validé | Dashboard NOWPayments, support |
| Colonne Paiement vide | Anciennes commandes | Normal ; seulement après activation |

---

## F. Où voir le statut dans l’admin

1. **Récap commandes** → colonne **Paiement** (badge + crypto + lien)
2. **Détail commande** (Voir) → bandeau paiement en haut
3. **Commandes en cours / Locker / Messagerie** (inbox) → ligne 💳 sous le total

Statuts affichés :
- **En attente** — invoice créée, pas encore payée
- **Partiel** — montant incomplet
- **Payé** — confirmé par webhook
- **Échoué / Expiré** — échec ou délai dépassé
- **—** — pas de gateway (commande legacy ou gateway off)
