# FormatX - PDF to Facture-X (MERN Stack)

Application de conversion de factures PDF vers le format Facture-X conforme EN 16931.

## Stack Technique

- **Backend**: Node.js, Express.js, MongoDB
- **Frontend**: React 18, Vite, Tailwind CSS
- **Auth**: JWT
- **Paiements**: Stripe
- **IA**: Groq API (LLaMA 3.3)

## Structure du Projet

```
facturex-mern/
├── server/                 # Backend Express
│   ├── config/            # Configuration (DB, Stripe)
│   ├── models/            # Modeles Mongoose
│   ├── routes/            # Routes API
│   ├── middleware/        # Auth, API Key validation
│   ├── services/          # Services (Groq, PDF, XML)
│   └── utils/             # Utilitaires
├── client/                 # Frontend React
│   ├── src/
│   │   ├── components/    # Composants React
│   │   ├── pages/         # Pages
│   │   ├── context/       # Auth Context
│   │   └── services/      # API client
│   └── public/
└── README.md
```

## Installation

### 1. Prerequis

- Node.js 18+
- MongoDB Atlas (ou local)
- Compte Groq (pour l'IA)
- Compte Stripe (pour les paiements)

### 2. Configuration

Copier le fichier d'environnement:

```bash
cd server
cp .env.example .env
```

Remplir les variables dans `.env`:

```env
MONGODB_URI=mongodb+srv://...
JWT_SECRET=votre-secret-jwt
GROQ_API_KEY=gsk_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

### 3. Installation des dependances

```bash
# A la racine du projet
npm install
npm run install:all
```

### 4. Lancer le projet

```bash
# Mode developpement (backend + frontend)
npm run dev

# Ou separement:
npm run dev:server  # Backend sur http://localhost:5000
npm run dev:client  # Frontend sur http://localhost:5173
```

## Configuration MongoDB Atlas

1. Creer un cluster sur [MongoDB Atlas](https://cloud.mongodb.com)
2. Creer une database "facturex"
3. Creer un utilisateur avec acces lecture/ecriture
4. Copier l'URI de connexion dans `.env`

### Collections creees automatiquement:
- `users` - Utilisateurs
- `subscriptions` - Abonnements
- `apikeys` - Cles API

## Configuration Groq

1. Creer un compte sur [Groq](https://console.groq.com)
2. Generer une cle API
3. Copier dans `GROQ_API_KEY`

## Configuration Stripe

1. Creer un compte sur [Stripe](https://dashboard.stripe.com)
2. Creer 2 produits/prix:
   - Pro: 29 EUR/mois
   - Business: 99 EUR/mois
3. Copier les Price IDs dans:
   - `STRIPE_PRO_PRICE_ID`
   - `STRIPE_BUSINESS_PRICE_ID`
4. Configurer le webhook:
   - URL: `https://votre-domaine.com/api/stripe/webhook`
   - Events: `checkout.session.completed`, `customer.subscription.*`, `invoice.payment_failed`

## API Endpoints

### Auth
- `POST /api/auth/register` - Inscription
- `POST /api/auth/login` - Connexion
- `GET /api/auth/me` - Utilisateur courant

### Facture-X
- `POST /api/facturex/extract` - Extraire donnees du PDF
- `POST /api/facturex/validate` - Valider une facture
- `POST /api/facturex/generate` - Generer XML

### API Publique (cle API requise)
- `POST /api/v1/convert` - Convertir PDF
- `POST /api/v1/validate` - Valider
- `GET /api/v1/usage` - Statistiques

### Stripe
- `GET /api/stripe/products` - Plans disponibles
- `POST /api/stripe/create-checkout` - Session paiement
- `POST /api/stripe/create-portal` - Portail facturation

## Deploiement

### Backend (Railway/Render)
```bash
cd server
npm start
```

### Frontend (Vercel)
```bash
cd client
npm run build
```

## License

MIT
