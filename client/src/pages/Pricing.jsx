import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import Layout from '../components/Layout'
import { useAuth } from '../context/AuthContext'
import Button from '../components/ui/Button'
import { Card, CardContent } from '../components/ui/Card'
import api from '../services/api'
import { CheckCircle } from 'lucide-react'

const plans = [
  {
    id: 'free',
    name: 'Gratuit',
    price: 0,
    description: 'Pour tester le service',
    features: [
      '10 conversions/mois',
      'Extraction IA',
      'Validation EN 16931',
      'Support communautaire'
    ],
    cta: 'Commencer gratuitement',
    popular: false
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 29,
    description: 'Pour artisans et freelances',
    features: [
      '100 conversions/mois',
      'Mode batch',
      'Acces API complet',
      'Support prioritaire',
      'Historique 12 mois'
    ],
    cta: 'Passer a Pro',
    popular: true
  },
  {
    id: 'business',
    name: 'Business',
    price: 99,
    description: 'Pour les entreprises',
    features: [
      '500 conversions/mois',
      'API illimitee',
      'Webhooks',
      'Support dedie',
      'SLA 99.9%',
      'Historique illimite'
    ],
    cta: 'Passer a Business',
    popular: false
  }
]

const Pricing = () => {
  const [loading, setLoading] = useState(null)
  const { isAuthenticated, subscription } = useAuth()
  const navigate = useNavigate()

  const handleSelectPlan = async (planId) => {
    if (!isAuthenticated) {
      navigate('/auth/register')
      return
    }

    if (planId === 'free') {
      navigate('/dashboard')
      return
    }

    setLoading(planId)
    try {
      const response = await api.post('/stripe/create-checkout', { planId })
      if (response.data.url) {
        window.location.href = response.data.url
      }
    } catch (err) {
      toast.error('Erreur lors de la creation de la session de paiement')
    } finally {
      setLoading(null)
    }
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Tarification simple et transparente
          </h1>
          <p className="text-xl text-gray-500 max-w-2xl mx-auto">
            Choisissez le plan adapte a vos besoins. Changez ou annulez a tout moment.
          </p>
        </div>

        {/* Plans */}
        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {plans.map((plan) => (
            <Card
              key={plan.id}
              className={`relative ${plan.popular ? 'border-2 border-primary-500 shadow-lg' : ''}`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <span className="bg-primary-600 text-white text-xs font-bold px-3 py-1 rounded-full">
                    POPULAIRE
                  </span>
                </div>
              )}

              <CardContent className="p-6">
                <div className="mb-6">
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">{plan.name}</h3>
                  <div className="mb-4">
                    <span className="text-4xl font-bold text-gray-900">{plan.price}</span>
                    <span className="text-gray-500">EUR/mois</span>
                  </div>
                  <p className="text-gray-500 text-sm">{plan.description}</p>
                </div>

                <ul className="space-y-3 mb-6">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <CheckCircle className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                      <span className="text-gray-700">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  onClick={() => handleSelectPlan(plan.id)}
                  loading={loading === plan.id}
                  variant={plan.popular ? 'primary' : 'outline'}
                  className="w-full"
                  disabled={subscription?.plan === plan.id}
                >
                  {subscription?.plan === plan.id ? 'Plan actuel' : plan.cta}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Features */}
        <div className="mt-20 text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-8">
            Toutes les offres incluent
          </h2>
          <div className="grid md:grid-cols-4 gap-6 max-w-4xl mx-auto">
            <div className="text-center">
              <div className="text-3xl mb-2">🔒</div>
              <h3 className="font-semibold mb-1">100% securise</h3>
              <p className="text-sm text-gray-500">Aucune donnee stockee</p>
            </div>
            <div className="text-center">
              <div className="text-3xl mb-2">✅</div>
              <h3 className="font-semibold mb-1">Conforme</h3>
              <p className="text-sm text-gray-500">EN 16931 & Chorus Pro</p>
            </div>
            <div className="text-center">
              <div className="text-3xl mb-2">⚡</div>
              <h3 className="font-semibold mb-1">Rapide</h3>
              <p className="text-sm text-gray-500">Conversion en 30 secondes</p>
            </div>
            <div className="text-center">
              <div className="text-3xl mb-2">🇫🇷</div>
              <h3 className="font-semibold mb-1">Francais</h3>
              <p className="text-sm text-gray-500">Support en francais</p>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}

export default Pricing
