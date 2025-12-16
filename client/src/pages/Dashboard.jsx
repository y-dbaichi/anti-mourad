import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import Layout from '../components/Layout'
import { useAuth } from '../context/AuthContext'
import Button from '../components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/Card'
import Progress from '../components/ui/Progress'
import Badge from '../components/ui/Badge'
import api from '../services/api'

const Dashboard = () => {
  const { user, subscription, refreshSubscription } = useAuth()
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    refreshSubscription()
  }, [])

  const handleUpgrade = async (planId) => {
    setLoading(true)
    try {
      const response = await api.post('/stripe/create-checkout', { planId })
      if (response.data.url) {
        window.location.href = response.data.url
      }
    } catch (err) {
      toast.error('Erreur lors de la creation de la session de paiement')
    } finally {
      setLoading(false)
    }
  }

  const handleManageBilling = async () => {
    setLoading(true)
    try {
      const response = await api.post('/stripe/create-portal')
      if (response.data.url) {
        window.location.href = response.data.url
      }
    } catch (err) {
      toast.error('Erreur lors de l\'acces au portail de facturation')
    } finally {
      setLoading(false)
    }
  }

  const usagePercentage = subscription
    ? (subscription.conversionsUsed / subscription.conversionsLimit) * 100
    : 0

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Bonjour{user?.fullName ? `, ${user.fullName}` : ''} !
          </h1>
          <p className="text-gray-500 mt-1">Gerez votre compte et suivez votre utilisation</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Usage card */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Utilisation ce mois</CardTitle>
              <CardDescription>
                {subscription?.conversionsUsed || 0} / {subscription?.conversionsLimit || 10} conversions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Progress value={usagePercentage} className="h-3 mb-4" />

              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">
                  {subscription?.conversionsLimit - subscription?.conversionsUsed || 10} conversions restantes
                </span>
                {subscription?.currentPeriodEnd && (
                  <span className="text-gray-500">
                    Renouvellement: {new Date(subscription.currentPeriodEnd).toLocaleDateString('fr-FR')}
                  </span>
                )}
              </div>

              <div className="mt-6 flex gap-3">
                <Link to="/">
                  <Button>Convertir une facture</Button>
                </Link>
                <Link to="/api-dashboard">
                  <Button variant="outline">Gerer les cles API</Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          {/* Plan card */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Mon abonnement</CardTitle>
                <Badge variant={subscription?.plan === 'free' ? 'default' : 'primary'}>
                  {subscription?.plan?.toUpperCase() || 'FREE'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <p className="text-3xl font-bold text-gray-900">
                    {subscription?.plan === 'free' ? '0' : subscription?.plan === 'pro' ? '29' : '99'}
                    <span className="text-lg text-gray-500 font-normal"> EUR/mois</span>
                  </p>
                </div>

                <ul className="space-y-2 text-sm text-gray-600">
                  <li className="flex items-center gap-2">
                    <svg className="h-4 w-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {subscription?.conversionsLimit || 10} conversions/mois
                  </li>
                  <li className="flex items-center gap-2">
                    <svg className="h-4 w-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Extraction IA
                  </li>
                  {subscription?.plan !== 'free' && (
                    <>
                      <li className="flex items-center gap-2">
                        <svg className="h-4 w-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Acces API
                      </li>
                      <li className="flex items-center gap-2">
                        <svg className="h-4 w-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Mode batch
                      </li>
                    </>
                  )}
                </ul>

                {subscription?.plan === 'free' ? (
                  <Button
                    onClick={() => handleUpgrade('pro')}
                    loading={loading}
                    className="w-full"
                  >
                    Passer a Pro
                  </Button>
                ) : (
                  <Button
                    onClick={handleManageBilling}
                    loading={loading}
                    variant="outline"
                    className="w-full"
                  >
                    Gerer l'abonnement
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick actions */}
        <div className="mt-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Actions rapides</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link to="/">
              <Card className="hover:border-primary-300 transition-colors cursor-pointer">
                <CardContent className="p-6 flex items-center gap-4">
                  <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center">
                    <svg className="h-6 w-6 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900">Nouvelle conversion</h3>
                    <p className="text-sm text-gray-500">Convertir un PDF en Facture-X</p>
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link to="/api-dashboard">
              <Card className="hover:border-primary-300 transition-colors cursor-pointer">
                <CardContent className="p-6 flex items-center gap-4">
                  <div className="w-12 h-12 bg-secondary-100 rounded-lg flex items-center justify-center">
                    <svg className="h-6 w-6 text-secondary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900">Cles API</h3>
                    <p className="text-sm text-gray-500">Gerer vos cles d'acces</p>
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link to="/api-docs">
              <Card className="hover:border-primary-300 transition-colors cursor-pointer">
                <CardContent className="p-6 flex items-center gap-4">
                  <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                    <svg className="h-6 w-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900">Documentation</h3>
                    <p className="text-sm text-gray-500">Guide d'utilisation de l'API</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          </div>
        </div>
      </div>
    </Layout>
  )
}

export default Dashboard
