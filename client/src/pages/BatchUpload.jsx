import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { toast } from 'sonner'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import Button from '../components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/Card'
import api from '../services/api'
import {
  Upload,
  FileArchive,
  FileText,
  CheckCircle,
  XCircle,
  Loader2,
  Download,
  ArrowRight
} from 'lucide-react'

const BatchUpload = () => {
  const navigate = useNavigate()
  const [files, setFiles] = useState([])
  const [uploading, setUploading] = useState(false)
  const [results, setResults] = useState(null)
  const [options, setOptions] = useState({
    profile: 'comfort',
    generatePdfA3: true
  })

  const onDrop = useCallback((acceptedFiles) => {
    setFiles(acceptedFiles)
    setResults(null)
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/zip': ['.zip'],
      'application/x-zip-compressed': ['.zip']
    },
    multiple: true,
    maxSize: 50 * 1024 * 1024 // 50MB
  })

  const handleUpload = async () => {
    if (files.length === 0) {
      toast.error('Veuillez selectionner des fichiers')
      return
    }

    setUploading(true)
    setResults(null)

    try {
      // Check if it's a single ZIP file
      const isZip = files.length === 1 && (
        files[0].type === 'application/zip' ||
        files[0].type === 'application/x-zip-compressed' ||
        files[0].name.endsWith('.zip')
      )

      let response

      if (isZip) {
        // Upload ZIP file
        const formData = new FormData()
        formData.append('file', files[0])
        formData.append('profile', options.profile)
        formData.append('generatePdfA3', options.generatePdfA3)

        response = await api.post('/invoices/batch', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        })
      } else {
        // Upload multiple PDFs
        const formData = new FormData()
        files.forEach(file => formData.append('files', file))
        formData.append('profile', options.profile)
        formData.append('generatePdfA3', options.generatePdfA3)

        response = await api.post('/invoices/batch/multiple', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        })
      }

      setResults(response.data)

      if (response.data.successful > 0) {
        toast.success(`${response.data.successful} facture(s) traitee(s) avec succes`)
      }
      if (response.data.failed > 0) {
        toast.error(`${response.data.failed} facture(s) en erreur`)
      }

    } catch (err) {
      toast.error(err.response?.data?.error || 'Erreur lors du traitement')
    } finally {
      setUploading(false)
    }
  }

  const handleDownloadBatch = async (format) => {
    if (!results?.batchId) return

    try {
      const response = await api.get(`/invoices/batch/${results.batchId}/export?format=${format}`, {
        responseType: 'blob'
      })

      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `batch-${results.batchId}.zip`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      toast.success('Telechargement lance')
    } catch (err) {
      toast.error('Erreur lors du telechargement')
    }
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Traitement par lot</h1>
          <p className="text-gray-500">Convertissez plusieurs factures PDF en une seule operation</p>
        </div>

        {/* Upload Zone */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors ${
                isDragActive
                  ? 'border-primary-500 bg-primary-50'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
            >
              <input {...getInputProps()} />
              <div className="flex justify-center gap-4 mb-4">
                <FileText className="h-12 w-12 text-gray-400" />
                <FileArchive className="h-12 w-12 text-gray-400" />
              </div>
              {isDragActive ? (
                <p className="text-primary-600 font-medium">Deposez les fichiers ici...</p>
              ) : (
                <>
                  <p className="text-gray-600 font-medium mb-2">
                    Glissez-deposez vos fichiers PDF ou une archive ZIP
                  </p>
                  <p className="text-gray-400 text-sm">
                    ou cliquez pour selectionner (max 50MB)
                  </p>
                </>
              )}
            </div>

            {files.length > 0 && (
              <div className="mt-4">
                <p className="text-sm font-medium text-gray-700 mb-2">
                  {files.length} fichier(s) selectionne(s)
                </p>
                <div className="max-h-40 overflow-y-auto space-y-2">
                  {files.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg text-sm"
                    >
                      {file.name.endsWith('.zip') ? (
                        <FileArchive className="h-4 w-4 text-yellow-500" />
                      ) : (
                        <FileText className="h-4 w-4 text-red-500" />
                      )}
                      <span className="flex-1 truncate">{file.name}</span>
                      <span className="text-gray-400">
                        {(file.size / 1024).toFixed(0)} KB
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Options */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Options de traitement</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Profil Facture-X
                </label>
                <select
                  value={options.profile}
                  onChange={(e) => setOptions({ ...options, profile: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="minimum">Minimum</option>
                  <option value="basic">Basic</option>
                  <option value="comfort">Comfort (recommande)</option>
                  <option value="extended">Extended</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Generer PDF/A-3
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={options.generatePdfA3}
                    onChange={(e) => setOptions({ ...options, generatePdfA3: e.target.checked })}
                    className="rounded"
                  />
                  <span className="text-gray-600">Inclure le XML dans le PDF</span>
                </label>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Upload Button */}
        <div className="flex justify-center mb-8">
          <Button
            onClick={handleUpload}
            disabled={files.length === 0 || uploading}
            loading={uploading}
            size="lg"
            className="px-12"
          >
            {uploading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Traitement en cours...
              </>
            ) : (
              <>
                <Upload className="h-5 w-5" />
                Lancer le traitement
              </>
            )}
          </Button>
        </div>

        {/* Results */}
        {results && (
          <Card>
            <CardHeader>
              <CardTitle>Resultats du traitement</CardTitle>
              <CardDescription>Lot {results.batchId?.substring(0, 8)}</CardDescription>
            </CardHeader>
            <CardContent>
              {/* Summary */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <p className="text-3xl font-bold text-gray-900">{results.total}</p>
                  <p className="text-sm text-gray-500">Total</p>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <p className="text-3xl font-bold text-green-600">{results.successful}</p>
                  <p className="text-sm text-green-600">Reussies</p>
                </div>
                <div className="text-center p-4 bg-red-50 rounded-lg">
                  <p className="text-3xl font-bold text-red-600">{results.failed}</p>
                  <p className="text-sm text-red-600">Echouees</p>
                </div>
              </div>

              {/* Processed Invoices */}
              {results.invoices?.length > 0 && (
                <div className="mb-6">
                  <h4 className="text-sm font-medium text-gray-700 mb-3">Factures traitees</h4>
                  <div className="max-h-60 overflow-y-auto space-y-2">
                    {results.invoices.map((inv, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-lg"
                      >
                        <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 truncate">{inv.invoiceNumber}</p>
                          <p className="text-sm text-gray-500 truncate">{inv.fileName}</p>
                        </div>
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          inv.status === 'validated'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-yellow-100 text-yellow-700'
                        }`}>
                          {inv.status === 'validated' ? 'Valide' : 'Brouillon'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Errors */}
              {results.errors?.length > 0 && (
                <div className="mb-6">
                  <h4 className="text-sm font-medium text-red-700 mb-3">Erreurs</h4>
                  <div className="space-y-2">
                    {results.errors.map((err, index) => (
                      <div
                        key={index}
                        className="flex items-start gap-3 px-4 py-3 bg-red-50 rounded-lg"
                      >
                        <XCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="font-medium text-red-900">{err.fileName}</p>
                          <p className="text-sm text-red-600">{err.error}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Download Options */}
              {results.successful > 0 && (
                <div className="flex flex-wrap gap-3 pt-4 border-t border-gray-200">
                  <Button onClick={() => handleDownloadBatch('xml')}>
                    <Download className="h-4 w-4" />
                    Telecharger XML
                  </Button>
                  {options.generatePdfA3 && (
                    <Button variant="outline" onClick={() => handleDownloadBatch('pdfa3')}>
                      <Download className="h-4 w-4" />
                      Telecharger PDF/A-3
                    </Button>
                  )}
                  <Button variant="outline" onClick={() => handleDownloadBatch('both')}>
                    <Download className="h-4 w-4" />
                    Tout telecharger
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => navigate('/invoices')}
                    className="ml-auto"
                  >
                    Voir l'historique
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  )
}

export default BatchUpload
