import Layout from '../components/Layout'
import { Card, CardContent } from '../components/ui/Card'

const ApiDocs = () => {
  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Documentation API</h1>
          <p className="text-gray-500">
            API REST pour convertir vos factures PDF en format Facture-X conforme EN 16931
          </p>
        </div>

        <div className="space-y-8">
          {/* Authentication */}
          <Card>
            <CardContent className="p-6">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Authentification</h2>
              <p className="text-gray-600 mb-4">Incluez votre cle API dans le header de chaque requete:</p>
              <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg text-sm overflow-x-auto">
{`X-API-Key: fx_your_api_key_here

ou

Authorization: Bearer fx_your_api_key_here`}
              </pre>
            </CardContent>
          </Card>

          {/* POST /api/v1/convert */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-bold">POST</span>
                <code className="text-lg font-mono">/api/v1/convert</code>
              </div>
              <p className="text-gray-600 mb-4">Convertit une facture PDF en Facture-X</p>

              <h3 className="font-semibold text-gray-900 mb-2">Request Body</h3>
              <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg text-sm overflow-x-auto mb-4">
{`{
  "pdfBase64": "JVBERi0xLjQKJeLjz9...",  // Required: PDF en base64
  "profile": "comfort",                   // Optional: basic | comfort | extended
  "autoValidate": true                    // Optional: valider automatiquement
}`}
              </pre>

              <h3 className="font-semibold text-gray-900 mb-2">Response 200</h3>
              <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg text-sm overflow-x-auto">
{`{
  "success": true,
  "data": {
    "extractedData": {
      "invoiceNumber": "2025-001",
      "invoiceDate": "2025-12-16",
      "sellerName": "ACME Corp",
      "buyerName": "Client SARL",
      "totalHT": 1000.00,
      "totalTTC": 1200.00
    },
    "factureX": {
      "xml": "<?xml version='1.0'...",
      "profile": "comfort",
      "fileName": "facture-x-2025-001.xml"
    },
    "validation": {
      "isValid": true,
      "score": 95,
      "errors": [],
      "warnings": []
    }
  },
  "meta": {
    "apiVersion": "1.0",
    "creditsRemaining": 95
  }
}`}
              </pre>
            </CardContent>
          </Card>

          {/* POST /api/v1/validate */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-bold">POST</span>
                <code className="text-lg font-mono">/api/v1/validate</code>
              </div>
              <p className="text-gray-600 mb-4">Valide les donnees d'une facture</p>

              <h3 className="font-semibold text-gray-900 mb-2">Request Body</h3>
              <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg text-sm overflow-x-auto mb-4">
{`{
  "invoiceData": {
    "invoiceNumber": "INV-001",
    "sellerName": "Mon Entreprise",
    "sellerSIRET": "12345678901234",
    "buyerName": "Client",
    "totalHT": 1000,
    "totalTTC": 1200
  }
}`}
              </pre>

              <h3 className="font-semibold text-gray-900 mb-2">Response 200</h3>
              <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg text-sm overflow-x-auto">
{`{
  "success": true,
  "validation": {
    "isValid": true,
    "score": 100,
    "errors": [],
    "warnings": []
  }
}`}
              </pre>
            </CardContent>
          </Card>

          {/* GET /api/v1/usage */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-bold">GET</span>
                <code className="text-lg font-mono">/api/v1/usage</code>
              </div>
              <p className="text-gray-600 mb-4">Retourne les statistiques d'utilisation de l'API</p>

              <h3 className="font-semibold text-gray-900 mb-2">Response 200</h3>
              <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg text-sm overflow-x-auto">
{`{
  "success": true,
  "usage": {
    "plan": "pro",
    "conversionsUsed": 45,
    "conversionsLimit": 100,
    "conversionsRemaining": 55,
    "periodEnd": "2025-01-16T00:00:00.000Z"
  }
}`}
              </pre>
            </CardContent>
          </Card>

          {/* Error codes */}
          <Card>
            <CardContent className="p-6">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Codes d'erreur</h2>
              <div className="space-y-3">
                <div className="flex items-start gap-4">
                  <code className="bg-gray-100 px-2 py-1 rounded text-sm">401</code>
                  <span className="text-gray-600">Cle API invalide ou manquante</span>
                </div>
                <div className="flex items-start gap-4">
                  <code className="bg-gray-100 px-2 py-1 rounded text-sm">429</code>
                  <span className="text-gray-600">Limite mensuelle atteinte</span>
                </div>
                <div className="flex items-start gap-4">
                  <code className="bg-gray-100 px-2 py-1 rounded text-sm">422</code>
                  <span className="text-gray-600">Impossible d'extraire les donnees du PDF</span>
                </div>
                <div className="flex items-start gap-4">
                  <code className="bg-gray-100 px-2 py-1 rounded text-sm">500</code>
                  <span className="text-gray-600">Erreur serveur interne</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* cURL example */}
          <Card>
            <CardContent className="p-6">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Exemple cURL</h2>
              <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg text-sm overflow-x-auto">
{`curl -X POST http://localhost:5000/api/v1/convert \\
  -H "X-API-Key: fx_your_api_key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "pdfBase64": "JVBERi0xLjQKJeLjz9...",
    "profile": "comfort",
    "autoValidate": true
  }'`}
              </pre>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  )
}

export default ApiDocs
