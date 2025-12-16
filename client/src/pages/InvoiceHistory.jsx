import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import Layout from '../components/Layout'
import Button from '../components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card'
import api from '../services/api'
import {
  FileText,
  Download,
  Trash2,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  AlertCircle,
  Clock,
  FileOutput
} from 'lucide-react'

const statusConfig = {
  draft: { label: 'Brouillon', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
  validated: { label: 'Valide', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  exported: { label: 'Exporte', color: 'bg-blue-100 text-blue-700', icon: FileOutput },
  failed: { label: 'Echoue', color: 'bg-red-100 text-red-700', icon: AlertCircle }
}

const InvoiceHistory = () => {
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading] = useState(true)
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 })
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    startDate: '',
    endDate: ''
  })
  const [selectedInvoices, setSelectedInvoices] = useState([])
  const [showFilters, setShowFilters] = useState(false)

  useEffect(() => {
    fetchInvoices()
  }, [pagination.page, filters.status])

  const fetchInvoices = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: pagination.page,
        limit: 20,
        ...(filters.status && { status: filters.status }),
        ...(filters.search && { search: filters.search }),
        ...(filters.startDate && { startDate: filters.startDate }),
        ...(filters.endDate && { endDate: filters.endDate })
      })

      const response = await api.get(`/invoices?${params}`)
      setInvoices(response.data.invoices)
      setPagination(response.data.pagination)
    } catch (err) {
      toast.error('Erreur lors du chargement des factures')
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = (e) => {
    e.preventDefault()
    setPagination(prev => ({ ...prev, page: 1 }))
    fetchInvoices()
  }

  const handleDownloadXml = async (invoiceId, invoiceNumber) => {
    try {
      const response = await api.get(`/invoices/${invoiceId}/xml`, {
        responseType: 'blob'
      })
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `facture-x-${invoiceNumber}.xml`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      toast.success('XML telecharge')
    } catch (err) {
      toast.error('Erreur lors du telechargement')
    }
  }

  const handleDownloadPdf = async (invoiceId, invoiceNumber) => {
    try {
      const response = await api.get(`/invoices/${invoiceId}/pdf`, {
        responseType: 'blob'
      })
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `facture-x-${invoiceNumber}.pdf`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      toast.success('PDF/A-3 telecharge')
    } catch (err) {
      toast.error('Erreur lors du telechargement')
    }
  }

  const handleDelete = async (invoiceId) => {
    if (!confirm('Supprimer cette facture ?')) return

    try {
      await api.delete(`/invoices/${invoiceId}`)
      setInvoices(invoices.filter(i => i._id !== invoiceId))
      toast.success('Facture supprimee')
    } catch (err) {
      toast.error('Erreur lors de la suppression')
    }
  }

  const handleExport = async (format) => {
    if (selectedInvoices.length === 0) {
      toast.error('Selectionnez au moins une facture')
      return
    }

    try {
      const response = await api.post('/invoices/export', {
        invoiceIds: selectedInvoices,
        format
      }, { responseType: 'blob' })

      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `export-${format}-${new Date().toISOString().split('T')[0]}.${format === 'json' ? 'json' : format === 'csv' ? 'csv' : 'txt'}`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      toast.success(`Export ${format.toUpperCase()} telecharge`)
    } catch (err) {
      toast.error('Erreur lors de l\'export')
    }
  }

  const toggleSelectAll = () => {
    if (selectedInvoices.length === invoices.length) {
      setSelectedInvoices([])
    } else {
      setSelectedInvoices(invoices.map(i => i._id))
    }
  }

  const toggleSelect = (invoiceId) => {
    if (selectedInvoices.includes(invoiceId)) {
      setSelectedInvoices(selectedInvoices.filter(id => id !== invoiceId))
    } else {
      setSelectedInvoices([...selectedInvoices, invoiceId])
    }
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Historique des factures</h1>
            <p className="text-gray-500">{pagination.total} factures au total</p>
          </div>

          {selectedInvoices.length > 0 && (
            <div className="flex gap-2">
              <select
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                onChange={(e) => e.target.value && handleExport(e.target.value)}
                defaultValue=""
              >
                <option value="">Exporter ({selectedInvoices.length})</option>
                <option value="csv">CSV</option>
                <option value="json">JSON</option>
                <option value="sage">Sage</option>
                <option value="cegid">Cegid</option>
                <option value="quadra">Quadra</option>
                <option value="fec">FEC</option>
              </select>
            </div>
          )}
        </div>

        {/* Search and Filters */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <form onSubmit={handleSearch} className="flex gap-4 items-end">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Rechercher</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Numero, vendeur, acheteur..."
                    value={filters.search}
                    onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Statut</label>
                <select
                  value={filters.status}
                  onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                  className="px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="">Tous</option>
                  <option value="draft">Brouillon</option>
                  <option value="validated">Valide</option>
                  <option value="exported">Exporte</option>
                  <option value="failed">Echoue</option>
                </select>
              </div>

              <Button type="submit">
                <Search className="h-4 w-4" />
                Rechercher
              </Button>

              <Button
                type="button"
                variant="ghost"
                onClick={() => setShowFilters(!showFilters)}
              >
                <Filter className="h-4 w-4" />
              </Button>
            </form>

            {showFilters && (
              <div className="mt-4 pt-4 border-t border-gray-200 grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date debut</label>
                  <input
                    type="date"
                    value={filters.startDate}
                    onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date fin</label>
                  <input
                    type="date"
                    value={filters.endDate}
                    onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Invoice List */}
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="text-center py-12 text-gray-500">Chargement...</div>
            ) : invoices.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">Aucune facture trouvee</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left">
                        <input
                          type="checkbox"
                          checked={selectedInvoices.length === invoices.length}
                          onChange={toggleSelectAll}
                          className="rounded"
                        />
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Numero</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vendeur</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acheteur</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Montant TTC</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {invoices.map((invoice) => {
                      const status = statusConfig[invoice.status] || statusConfig.draft
                      const StatusIcon = status.icon
                      return (
                        <tr key={invoice._id} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <input
                              type="checkbox"
                              checked={selectedInvoices.includes(invoice._id)}
                              onChange={() => toggleSelect(invoice._id)}
                              className="rounded"
                            />
                          </td>
                          <td className="px-4 py-3 font-medium text-gray-900">
                            {invoice.invoiceNumber}
                          </td>
                          <td className="px-4 py-3 text-gray-600 text-sm">
                            {invoice.extractedData?.sellerName || '-'}
                          </td>
                          <td className="px-4 py-3 text-gray-600 text-sm">
                            {invoice.extractedData?.buyerName || '-'}
                          </td>
                          <td className="px-4 py-3 font-medium">
                            {invoice.extractedData?.totalTTC?.toFixed(2) || '-'} {invoice.extractedData?.currency || 'EUR'}
                          </td>
                          <td className="px-4 py-3 text-gray-500 text-sm">
                            {new Date(invoice.createdAt).toLocaleDateString('fr-FR')}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full ${status.color}`}>
                              <StatusIcon className="h-3 w-3" />
                              {status.label}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDownloadXml(invoice._id, invoice.invoiceNumber)}
                                title="Telecharger XML"
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDownloadPdf(invoice._id, invoice.invoiceNumber)}
                                title="Telecharger PDF/A-3"
                              >
                                <FileText className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(invoice._id)}
                                className="text-red-600 hover:bg-red-50"
                                title="Supprimer"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            {pagination.pages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
                <p className="text-sm text-gray-500">
                  Page {pagination.page} sur {pagination.pages}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pagination.page <= 1}
                    onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pagination.page >= pagination.pages}
                    onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  )
}

export default InvoiceHistory
