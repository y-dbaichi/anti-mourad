import { useState, useEffect } from 'react'
import { Download, CheckCircle, FileText, Eye } from 'lucide-react'
import Button from '../ui/Button'
import Badge from '../ui/Badge'
import api from '../../services/api'

const DownloadStep = ({ data, onDownload, loading, error }) => {
  const [validation, setValidation] = useState(null)
  const [profile, setProfile] = useState('comfort')
  const [xmlPreview, setXmlPreview] = useState('')
  const [showPreview, setShowPreview] = useState(false)

  useEffect(() => {
    validateData()
  }, [data])

  const validateData = async () => {
    try {
      const response = await api.post('/facturex/validate', data)
      setValidation(response.data.validation)
    } catch (err) {
      console.error('Validation error:', err)
    }
  }

  const handlePreview = async () => {
    try {
      const response = await api.post('/facturex/generate', {
        invoiceData: data,
        profile,
        preview: true
      })
      setXmlPreview(response.data)
      setShowPreview(true)
    } catch (err) {
      console.error('Preview error:', err)
    }
  }

  const handleDownload = async () => {
    try {
      const response = await api.post('/facturex/generate', {
        invoiceData: data,
        profile
      }, {
        responseType: 'blob'
      })

      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.download = `facture-x-${data.invoiceNumber || Date.now()}.xml`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)

      if (onDownload) onDownload()
    } catch (err) {
      console.error('Download error:', err)
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-xl border p-8 space-y-6">
        {/* Validation badge */}
        {validation && (
          <div className="flex justify-center">
            <Badge
              variant={validation.score >= 90 ? 'success' : validation.score >= 70 ? 'warning' : 'danger'}
              className="text-base px-4 py-2"
            >
              <CheckCircle className="h-5 w-5 mr-2" />
              Score de conformite: {validation.score}/100
            </Badge>
          </div>
        )}

        {/* Success message */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Facture prete !</h2>
          <p className="text-gray-500">
            Vos donnees sont validees et conformes aux normes Facture-X (EN 16931)
          </p>
        </div>

        {/* Invoice summary */}
        <div className="border-t pt-6">
          <h3 className="text-sm font-medium text-gray-500 mb-4">Resume</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Facture n°</span>
              <p className="font-medium text-gray-900">{data.invoiceNumber || 'N/A'}</p>
            </div>
            <div>
              <span className="text-gray-500">Date</span>
              <p className="font-medium text-gray-900">{data.invoiceDate || 'N/A'}</p>
            </div>
            <div>
              <span className="text-gray-500">Vendeur</span>
              <p className="font-medium text-gray-900">{data.sellerName || 'N/A'}</p>
            </div>
            <div>
              <span className="text-gray-500">Total TTC</span>
              <p className="font-medium text-gray-900">
                {(data.totalTTC || 0).toFixed(2)} {data.currency || 'EUR'}
              </p>
            </div>
          </div>
        </div>

        {/* Profile selection */}
        <div className="border-t pt-6">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Profil Facture-X</h3>
          <select
            value={profile}
            onChange={(e) => setProfile(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
          >
            <option value="basic">Basic - Informations minimales</option>
            <option value="comfort">Comfort - Conforme EN 16931 (Recommande)</option>
            <option value="extended">Extended - Informations detaillees</option>
          </select>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 pt-4">
          <Button variant="outline" onClick={handlePreview} className="flex-1">
            <Eye className="h-4 w-4" />
            Previsualiser XML
          </Button>
          <Button onClick={handleDownload} loading={loading} className="flex-1">
            <Download className="h-4 w-4" />
            Telecharger
          </Button>
        </div>
      </div>

      {/* XML Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-3xl w-full max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold">Previsualisation XML</h3>
              <button
                onClick={() => setShowPreview(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4 overflow-auto max-h-[60vh]">
              <pre className="text-xs bg-gray-50 p-4 rounded-lg overflow-x-auto">
                {xmlPreview}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default DownloadStep
