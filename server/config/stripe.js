const Stripe = require('stripe');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const PRODUCTS = {
  free: {
    id: 'free',
    name: 'Gratuit',
    priceInCents: 0,
    priceId: null,
    conversionsPerMonth: 10,
    features: ['10 conversions/mois', 'Extraction IA', 'Validation EN 16931']
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    priceInCents: 2900,
    priceId: process.env.STRIPE_PRO_PRICE_ID,
    conversionsPerMonth: 100,
    features: ['100 conversions/mois', 'Mode batch', 'API Access', 'Support prioritaire']
  },
  business: {
    id: 'business',
    name: 'Business',
    priceInCents: 9900,
    priceId: process.env.STRIPE_BUSINESS_PRICE_ID,
    conversionsPerMonth: 500,
    features: ['500 conversions/mois', 'API illimitee', 'Webhooks', 'Support dedie', 'SLA']
  }
};

module.exports = { stripe, PRODUCTS };
