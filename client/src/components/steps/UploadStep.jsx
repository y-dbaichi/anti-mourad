import { useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, AlertCircle } from 'lucide-react'

const UploadStep = ({ onUpload, loading, error }) => {
  const onDrop = useCallback((acceptedFiles) => {
    const file = acceptedFiles[0]
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        alert('Le fichier ne doit pas depasser 10 MB')
        return
      }
      onUpload(file)
    }
  }, [onUpload])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    multiple: false,
    disabled: loading
  })

  return (
    <div className="max-w-2xl mx-auto">
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      <div
        {...getRootProps()}
        className={`
          relative cursor-pointer transition-all duration-200
          ${isDragActive ? 'scale-105' : ''}
        `}
      >
        <div className="p-1 rounded-full bg-gradient-to-r from-primary-500 via-secondary-500 to-primary-500 bg-[length:200%_100%] animate-gradient">
          <div className="bg-white rounded-full px-8 py-6 flex items-center gap-4">
            <Upload className={`h-6 w-6 text-gray-400 ${loading ? 'animate-bounce' : ''}`} />
            <input {...getInputProps()} />
            <span className="text-gray-500 flex-1">
              {loading ? 'Analyse en cours...' : isDragActive ? 'Deposez le fichier ici' : 'Facture.pdf'}
            </span>
            <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
              <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      <div className="text-center mt-6">
        <p className="text-sm text-gray-500">
          Glissez-deposez votre facture PDF ou cliquez pour selectionner
        </p>
        <p className="text-xs text-gray-400 mt-2 flex items-center justify-center gap-1.5">
          <svg className="h-3.5 w-3.5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          <span>Traitement securise - Aucune donnee stockee</span>
        </p>
      </div>
    </div>
  )
}

export default UploadStep
