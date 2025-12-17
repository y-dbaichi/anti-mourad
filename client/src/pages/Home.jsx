import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import Layout from '../components/Layout'
import UploadStep from '../components/steps/UploadStep'
import ReviewStep from '../components/steps/ReviewStep'
import DownloadStep from '../components/steps/DownloadStep'
import api from '../services/api'

const STEPS = [
  { id: 1, name: 'Upload', description: 'Charger votre PDF' },
  { id: 2, name: 'Verification', description: 'Verifier les donnees' },
  { id: 3, name: 'Telechargement', description: 'Obtenir votre Facture-X' }
]

const Home = () => {
  const [currentStep, setCurrentStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [extractedData, setExtractedData] = useState(null)
  const [pdfFile, setPdfFile] = useState(null)
  const [extractionMode, setExtractionMode] = useState('cloud')
  const [availableModes, setAvailableModes] = useState([])

  // Fetch available extraction modes on mount
  useEffect(() => {
    const fetchModes = async () => {
      try {
        const response = await api.get('/facturex/modes')
        if (response.data.success) {
          setAvailableModes(response.data.modes)
          // Default to first available mode
          const firstAvailable = response.data.modes.find(m => m.available)
          if (firstAvailable) {
            setExtractionMode(firstAvailable.id)
          }
        }
      } catch (err) {
        console.error('Failed to fetch extraction modes:', err)
        // Fallback to cloud mode only
        setAvailableModes([
          { id: 'cloud', name: 'Cloud (Groq)', description: 'Rapide (~3s), necessite internet', available: true }
        ])
      }
    }
    fetchModes()
  }, [])

  const handleUpload = async (file) => {
    setLoading(true)
    setError(null)
    setPdfFile(file)

    try {
      // Convert file to base64
      const reader = new FileReader()
      reader.onload = async (e) => {
        const base64 = e.target.result.split(',')[1]

        try {
          const response = await api.post('/facturex/extract', {
            pdfBase64: base64,
            extractionMode: extractionMode
          })

          if (response.data.success) {
            setExtractedData(response.data.data)
            setCurrentStep(2)
            const modeLabel = extractionMode === 'local' ? 'local' : 'cloud'
            const timeInfo = response.data.extractionTime
              ? ` (${(response.data.extractionTime / 1000).toFixed(1)}s)`
              : ''
            toast.success(`Extraction reussie en mode ${modeLabel}${timeInfo}`)
          } else {
            throw new Error(response.data.error || 'Extraction failed')
          }
        } catch (err) {
          console.error('API error:', err)
          setError(err.response?.data?.message || err.message || 'Erreur lors de l\'extraction')
          toast.error('Erreur lors de l\'extraction')
        } finally {
          setLoading(false)
        }
      }

      reader.readAsDataURL(file)
    } catch (err) {
      console.error('File read error:', err)
      setError('Erreur lors de la lecture du fichier')
      setLoading(false)
    }
  }

  const handleReviewSubmit = (data) => {
    setExtractedData(data)
    setCurrentStep(3)
    toast.success('Donnees validees !')
  }

  const handleDownloadComplete = () => {
    toast.success('Facture-X telechargee !')
  }

  const resetFlow = () => {
    setCurrentStep(1)
    setExtractedData(null)
    setPdfFile(null)
    setError(null)
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Hero */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Convertissez vos factures PDF en Facture-X
          </h1>
          <p className="text-xl text-gray-500 max-w-2xl mx-auto">
            Extraction automatique par IA, validation EN 16931, conforme Chorus Pro
          </p>
        </div>

        {/* Step indicator */}
        <div className="mb-12">
          <div className="flex items-center justify-center">
            {STEPS.map((step, index) => (
              <div key={step.id} className="flex items-center">
                <div className="flex items-center">
                  <div className={`
                    flex items-center justify-center w-10 h-10 rounded-full font-semibold text-sm
                    ${currentStep >= step.id
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-200 text-gray-500'
                    }
                  `}>
                    {currentStep > step.id ? (
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      step.id
                    )}
                  </div>
                  <div className="ml-3 hidden sm:block">
                    <p className={`text-sm font-medium ${currentStep >= step.id ? 'text-gray-900' : 'text-gray-500'}`}>
                      {step.name}
                    </p>
                    <p className="text-xs text-gray-500">{step.description}</p>
                  </div>
                </div>
                {index < STEPS.length - 1 && (
                  <div className={`w-16 sm:w-24 h-0.5 mx-4 ${currentStep > step.id ? 'bg-primary-600' : 'bg-gray-200'}`} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Step content */}
        <div className="mb-8">
          {currentStep === 1 && (
            <UploadStep
              onUpload={handleUpload}
              loading={loading}
              error={error}
              extractionMode={extractionMode}
              onModeChange={setExtractionMode}
              modes={availableModes}
            />
          )}

          {currentStep === 2 && (
            <ReviewStep
              data={extractedData}
              onSubmit={handleReviewSubmit}
              loading={loading}
              error={error}
            />
          )}

          {currentStep === 3 && (
            <DownloadStep
              data={extractedData}
              onDownload={handleDownloadComplete}
              loading={loading}
              error={error}
            />
          )}
        </div>

        {/* Reset button */}
        {currentStep > 1 && (
          <div className="text-center">
            <button
              onClick={resetFlow}
              className="text-sm text-gray-500 hover:text-gray-700 underline"
            >
              Recommencer avec un autre fichier
            </button>
          </div>
        )}

        {/* Features section */}
        {currentStep === 1 && (
          <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-primary-100 rounded-full mb-4">
                <svg className="h-6 w-6 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Extraction IA</h3>
              <p className="text-gray-500 text-sm">
                Notre IA extrait automatiquement toutes les donnees de votre facture
              </p>
            </div>
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-secondary-100 rounded-full mb-4">
                <svg className="h-6 w-6 text-secondary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">100% Conforme</h3>
              <p className="text-gray-500 text-sm">
                Validation automatique EN 16931, compatible Chorus Pro
              </p>
            </div>
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-green-100 rounded-full mb-4">
                <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Securise</h3>
              <p className="text-gray-500 text-sm">
                Aucune donnee stockee, traitement instantane
              </p>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}

export default Home
