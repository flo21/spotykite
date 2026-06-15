# SpotyKite

Plateforme V1 pour reserver ou offrir une experience kitesurf en France.

## Stack

- Frontend : React + Vite + Tailwind CSS
- Backend : Node.js + Express
- Base de donnees : SQLite via `node:sqlite`
- Paiement : structure compatible panier/reservation/Carte Cadeau SpotyKite, sans integration Stripe en V1

## Installation

```bash
npm install
npm run seed
```

## Lancement

Backend seul :

```bash
npm run dev:server
```

Frontend seul :

```bash
npm run dev:client
```

Les deux en parallele :

```bash
npm run dev
```

URLs par defaut :

- Frontend : http://localhost:5173
- API : http://localhost:4000/api

Si le port `5173` est deja occupe :

```bash
npm --workspace client run dev -- --port 5174 --strictPort
```

## Fonctionnalites V1

- Accueil immersif avec recherche par type et region
- Listing stages/spots avec filtres region, niveau, duree, prix et type
- Pages detail dynamiques avec galerie, informations, avis et reservation fictive
- Page Carte Cadeau SpotyKite avec beneficiaire, message personnalise, email et PDF fictif
- Page J'ai une Carte Cadeau avec validation, reservation et statut utilise
- Dashboard admin basique
- CRUD ecoles et offres
- Listes reservations et Cartes Cadeaux SpotyKite
- Donnees de demonstration seedees en SQLite
- Responsive desktop/mobile

## Donnees

La base est creee dans :

```bash
server/data/spotykite.sqlite
```

Le seed ajoute des ecoles, offres, une reservation et une Carte Cadeau SpotyKite de demonstration.

## API principale

- `GET /api/schools`
- `POST /api/schools`
- `PUT /api/schools/:id`
- `DELETE /api/schools/:id`
- `GET /api/offers`
- `GET /api/offers/:id`
- `POST /api/offers`
- `PUT /api/offers/:id`
- `DELETE /api/offers/:id`
- `GET /api/bookings`
- `POST /api/bookings`
- `GET /api/gift-cards`
- `POST /api/gift-cards`
- `POST /api/gift-cards/validate`
- `POST /api/gift-cards/redeem`

## Notes V1

Les paiements ne sont pas executes. Les objets `Booking` et `GiftCard` contiennent deja les champs necessaires pour brancher ensuite un flux Stripe Checkout ou PaymentIntent.
