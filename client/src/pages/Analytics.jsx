import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import Layout from '../components/Layout'
import Button from '../components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/Card'
import api from '../services/api'
import {
  BarChart3,
  TrendingUp,
  FileText,
  Download,
  DollarSign,
  Users,
  Calendar,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react'

const Analytics = () => {
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('30d')
  const [dashboard, setDashboard] = useState(null)
  const [financial, setFinancial] = useState(null)

  useEffect(() => {
    fetchData()
  }, [period])

  const fetchData = async () => {
    try {
      setLoading(true)
      const [dashboardRes, financialRes] = await Promise.all([
        api.get(`/analytics/dashboard?period=${period}`),
        api.get(`/analytics/financial?period=${period}`)
      ])
      setDashboard(dashboardRes.data)
      setFinancial(financialRes.data)
    } catch (err) {
      toast.error('Erreur lors du chargement des statistiques')
    } finally {
      setLoading(false)
    }
  }

  const StatCard = ({ title, value, subtitle, icon: Icon, trend, trendUp }) => (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">{title}</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
            {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
            {trend && (
              <div className={`flex items-center gap-1 mt-2 text-sm ${trendUp ? 'text-green-600' : 'text-red-600'}`}>
                {trendUp ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                {trend}
              </div>
            )}
          </div>
          <div className="p-3 bg-primary-50 rounded-lg">
            <Icon className="h-6 w-6 text-primary-600" />
          </div>
        </div>
      </CardContent>
    </Card>
  )

  const ProgressBar = ({ value, max, label, color = 'bg-primary-500' }) => (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-gray-600">{label}</span>
        <span className="font-medium">{value}</span>
      </div>
      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full ${color} rounded-full transition-all duration-500`}
          style={{ width: `${Math.min((value / max) * 100, 100)}%` }}
        />
      </div>
    </div>
  )

  if (loading) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center py-12 text-gray-500">Chargement des statistiques...</div>
        </div>
      </Layout>
    )
  }

  const summary = dashboard?.summary || {}
  const usage = dashboard?.usage || {}
  const financialSummary = financial?.summary || {}

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Tableau de bord</h1>
            <p className="text-gray-500">Vue d'ensemble de votre activite</p>
          </div>

          <div className="flex gap-2">
            {['7d', '30d', '90d', '12m'].map((p) => (
              <Button
                key={p}
                variant={period === p ? 'primary' : 'outline'}
                size="sm"
                onClick={() => setPeriod(p)}
              >
                {p === '7d' ? '7 jours' : p === '30d' ? '30 jours' : p === '90d' ? '90 jours' : '12 mois'}
              </Button>
            ))}
          </div>
        </div>

        {/* Usage Banner */}
        {usage && (
          <Card className="mb-8 bg-gradient-to-r from-primary-500 to-primary-600">
            <CardContent className="p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-primary-100 font-medium">Plan {usage.plan?.toUpperCase()}</p>
                  <p className="text-3xl font-bold mt-1">{usage.used} / {usage.limit}</p>
                  <p className="text-primary-100 mt-1">conversions ce mois-ci</p>
                </div>
                <div className="text-right">
                  <p className="text-primary-100">{usage.remaining} restantes</p>
                  <div className="w-48 h-3 bg-primary-400/30 rounded-full mt-2">
                    <div
                      className="h-full bg-white rounded-full"
                      style={{ width: `${usage.percentUsed || 0}%` }}
                    />
                  </div>
                  {usage.periodEnd && (
                    <p className="text-primary-100 text-sm mt-2">
                      Renouvellement le {new Date(usage.periodEnd).toLocaleDateString('fr-FR')}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            title="Conversions"
            value={summary.conversions?.total || 0}
            subtitle={`${summary.conversions?.successRate || 0}% de reussite`}
            icon={FileText}
          />
          <StatCard
            title="Chiffre d'affaires traite"
            value={`${(financialSummary.totalTTC || 0).toLocaleString('fr-FR')} EUR`}
            subtitle={`${financialSummary.invoiceCount || 0} factures`}
            icon={DollarSign}
          />
          <StatCard
            title="Exports"
            value={summary.exports?.total || 0}
            subtitle={`XML: ${summary.exports?.xml || 0}, PDF: ${summary.exports?.pdfa3 || 0}`}
            icon={Download}
          />
          <StatCard
            title="Temps moyen"
            value={`${((summary.processing?.avgTime || 0) / 1000).toFixed(1)}s`}
            subtitle={`${summary.processing?.totalPages || 0} pages traitees`}
            icon={TrendingUp}
          />
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Conversion Status */}
          <Card>
            <CardHeader>
              <CardTitle>Statut des factures</CardTitle>
              <CardDescription>Repartition par statut</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <ProgressBar
                  label="Validees"
                  value={summary.invoicesByStatus?.validated || 0}
                  max={Object.values(summary.invoicesByStatus || {}).reduce((a, b) => a + b, 0) || 1}
                  color="bg-green-500"
                />
                <ProgressBar
                  label="Brouillons"
                  value={summary.invoicesByStatus?.draft || 0}
                  max={Object.values(summary.invoicesByStatus || {}).reduce((a, b) => a + b, 0) || 1}
                  color="bg-yellow-500"
                />
                <ProgressBar
                  label="Exportees"
                  value={summary.invoicesByStatus?.exported || 0}
                  max={Object.values(summary.invoicesByStatus || {}).reduce((a, b) => a + b, 0) || 1}
                  color="bg-blue-500"
                />
                <ProgressBar
                  label="Echouees"
                  value={summary.invoicesByStatus?.failed || 0}
                  max={Object.values(summary.invoicesByStatus || {}).reduce((a, b) => a + b, 0) || 1}
                  color="bg-red-500"
                />
              </div>
            </CardContent>
          </Card>

          {/* Top Clients */}
          <Card>
            <CardHeader>
              <CardTitle>Top clients</CardTitle>
              <CardDescription>Par montant facture</CardDescription>
            </CardHeader>
            <CardContent>
              {financial?.topClients?.length > 0 ? (
                <div className="space-y-4">
                  {financial.topClients.slice(0, 5).map((client, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-sm font-medium text-gray-600">
                          {index + 1}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{client.name}</p>
                          <p className="text-sm text-gray-500">{client.invoiceCount} factures</p>
                        </div>
                      </div>
                      <p className="font-semibold text-gray-900">
                        {client.totalTTC.toLocaleString('fr-FR')} EUR
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Users className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                  <p>Aucune donnee disponible</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Financial Summary */}
        <Card>
          <CardHeader>
            <CardTitle>Resume financier</CardTitle>
            <CardDescription>Totaux des factures traitees</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500">Total HT</p>
                <p className="text-2xl font-bold text-gray-900">
                  {(financialSummary.totalHT || 0).toLocaleString('fr-FR')} EUR
                </p>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500">Total TVA</p>
                <p className="text-2xl font-bold text-gray-900">
                  {(financialSummary.totalVAT || 0).toLocaleString('fr-FR')} EUR
                </p>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500">Total TTC</p>
                <p className="text-2xl font-bold text-gray-900">
                  {(financialSummary.totalTTC || 0).toLocaleString('fr-FR')} EUR
                </p>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500">Facture moyenne</p>
                <p className="text-2xl font-bold text-gray-900">
                  {(financialSummary.avgInvoice || 0).toLocaleString('fr-FR')} EUR
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Daily Activity */}
        {dashboard?.dailyStats?.length > 0 && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Activite quotidienne</CardTitle>
              <CardDescription>Conversions par jour</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-end gap-1 h-32">
                {dashboard.dailyStats.slice(-30).map((day, index) => {
                  const maxConversions = Math.max(...dashboard.dailyStats.map(d => d.conversions)) || 1
                  const height = (day.conversions / maxConversions) * 100
                  return (
                    <div
                      key={index}
                      className="flex-1 bg-primary-500 rounded-t hover:bg-primary-600 transition-colors cursor-pointer group relative"
                      style={{ height: `${Math.max(height, 4)}%` }}
                      title={`${new Date(day.date).toLocaleDateString('fr-FR')}: ${day.conversions} conversions`}
                    >
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                        {day.conversions} conv.
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className="flex justify-between mt-2 text-xs text-gray-500">
                <span>{dashboard.dailyStats[0]?.date ? new Date(dashboard.dailyStats[0].date).toLocaleDateString('fr-FR') : ''}</span>
                <span>{dashboard.dailyStats[dashboard.dailyStats.length - 1]?.date ? new Date(dashboard.dailyStats[dashboard.dailyStats.length - 1].date).toLocaleDateString('fr-FR') : ''}</span>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  )
}

export default Analytics
