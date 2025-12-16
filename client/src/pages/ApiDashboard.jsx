import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import Layout from '../components/Layout'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/Card'
import api from '../services/api'
import { Key, Copy, Eye, EyeOff, Trash2, Plus } from 'lucide-react'

const ApiDashboard = () => {
  const [keys, setKeys] = useState([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [newKeyName, setNewKeyName] = useState('')
  const [showNewKey, setShowNewKey] = useState(null)
  const [visibleKeys, setVisibleKeys] = useState({})

  useEffect(() => {
    fetchKeys()
  }, [])

  const fetchKeys = async () => {
    try {
      const response = await api.get('/keys')
      setKeys(response.data.keys || [])
    } catch (err) {
      toast.error('Erreur lors du chargement des cles API')
    } finally {
      setLoading(false)
    }
  }

  const createKey = async () => {
    if (!newKeyName.trim()) {
      toast.error('Veuillez entrer un nom pour la cle')
      return
    }

    setCreating(true)
    try {
      const response = await api.post('/keys', { name: newKeyName })
      setShowNewKey(response.data.key)
      setNewKeyName('')
      fetchKeys()
      toast.success('Cle API creee avec succes')
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erreur lors de la creation')
    } finally {
      setCreating(false)
    }
  }

  const deleteKey = async (keyId) => {
    if (!confirm('Etes-vous sur de vouloir supprimer cette cle ?')) return

    try {
      await api.delete(`/keys/${keyId}`)
      setKeys(keys.filter(k => k.id !== keyId))
      toast.success('Cle supprimee')
    } catch (err) {
      toast.error('Erreur lors de la suppression')
    }
  }

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text)
    toast.success('Copie dans le presse-papier')
  }

  const toggleKeyVisibility = (keyId) => {
    setVisibleKeys(prev => ({ ...prev, [keyId]: !prev[keyId] }))
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Gestion des cles API</h1>
          <p className="text-gray-500">Creez et gerez vos cles d'acces a l'API Mourad</p>
        </div>

        {/* New key notification */}
        {showNewKey && (
          <Card className="mb-6 border-green-200 bg-green-50">
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold text-green-800 mb-2">
                Nouvelle cle creee !
              </h3>
              <p className="text-green-700 text-sm mb-4">
                Copiez cette cle maintenant. Elle ne sera plus affichee.
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-white px-4 py-2 rounded border border-green-300 font-mono text-sm">
                  {showNewKey.key}
                </code>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(showNewKey.key)}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="mt-4"
                onClick={() => setShowNewKey(null)}
              >
                J'ai copie ma cle
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Create new key */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Creer une nouvelle cle</CardTitle>
            <CardDescription>Maximum 5 cles par compte</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3">
              <Input
                placeholder="Nom de la cle (ex: Production, Test)"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                className="flex-1"
              />
              <Button onClick={createKey} loading={creating} disabled={keys.length >= 5}>
                <Plus className="h-4 w-4" />
                Creer
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Keys list */}
        <Card>
          <CardHeader>
            <CardTitle>Vos cles API</CardTitle>
            <CardDescription>{keys.length} / 5 cles utilisees</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-gray-500">Chargement...</div>
            ) : keys.length === 0 ? (
              <div className="text-center py-8">
                <Key className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">Aucune cle API</p>
                <p className="text-gray-400 text-sm">Creez votre premiere cle pour commencer</p>
              </div>
            ) : (
              <div className="space-y-4">
                {keys.map((key) => (
                  <div
                    key={key.id}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-gray-900">{key.name}</span>
                        {!key.isActive && (
                          <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">
                            Inactive
                          </span>
                        )}
                      </div>
                      <code className="text-sm text-gray-500 font-mono">
                        {visibleKeys[key.id] ? key.key : key.key}
                      </code>
                      <div className="text-xs text-gray-400 mt-1">
                        Creee le {new Date(key.createdAt).toLocaleDateString('fr-FR')}
                        {key.lastUsed && ` • Derniere utilisation: ${new Date(key.lastUsed).toLocaleDateString('fr-FR')}`}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(key.key)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteKey(key.id)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Usage instructions */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Comment utiliser</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 mb-4">
              Incluez votre cle API dans le header de vos requetes HTTP:
            </p>
            <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg text-sm overflow-x-auto">
{`curl -X POST http://localhost:5000/api/v1/convert \\
  -H "X-API-Key: fx_your_api_key" \\
  -H "Content-Type: application/json" \\
  -d '{"pdfBase64": "..."}'`}
            </pre>
          </CardContent>
        </Card>
      </div>
    </Layout>
  )
}

export default ApiDashboard
