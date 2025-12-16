import { useState, useEffect } from 'react'
import { AlertCircle, CheckCircle2, AlertTriangle, Plus, Trash2 } from 'lucide-react'
import Button from '../ui/Button'
import Input from '../ui/Input'
import Badge from '../ui/Badge'

const ReviewStep = ({ data, onSubmit, loading, error }) => {
  const [formData, setFormData] = useState({
    invoiceNumber: '',
    invoiceDate: '',
    dueDate: '',
    currency: 'EUR',
    sellerName: '',
    sellerAddress: '',
    sellerSIRET: '',
    sellerCountry: 'FR',
    buyerName: '',
    buyerAddress: '',
    buyerSIRET: '',
    buyerCountry: 'FR',
    items: [],
    totalHT: 0,
    totalTVA: 0,
    totalTTC: 0
  })

  const [validation, setValidation] = useState({ score: 0, messages: [] })

  useEffect(() => {
    if (data) {
      setFormData(prev => ({ ...prev, ...data }))
    }
  }, [data])

  useEffect(() => {
    validateForm()
  }, [formData])

  const validateForm = () => {
    const messages = []
    let score = 100

    if (!formData.invoiceNumber) { messages.push('Numero de facture manquant'); score -= 15 }
    if (!formData.invoiceDate) { messages.push('Date de facture manquante'); score -= 15 }
    if (!formData.sellerName) { messages.push('Nom du vendeur manquant'); score -= 15 }
    if (!formData.sellerSIRET) { messages.push('SIRET/TVA vendeur manquant'); score -= 15 }
    if (!formData.buyerName) { messages.push('Nom de l\'acheteur manquant'); score -= 10 }

    setValidation({ score: Math.max(0, score), messages })
  }

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleItemChange = (index, field, value) => {
    setFormData(prev => {
      const items = [...prev.items]
      items[index] = { ...items[index], [field]: value }

      // Auto-calculate
      const item = items[index]
      if (field === 'unitPrice' || field === 'quantity' || field === 'vatRate') {
        const ht = (parseFloat(item.unitPrice) || 0) * (parseFloat(item.quantity) || 1)
        item.montantHT = ht
        item.montantTTC = ht * (1 + (parseFloat(item.vatRate) || 20) / 100)
      }

      return { ...prev, items }
    })
  }

  const addItem = () => {
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, {
        id: `item-${Date.now()}`,
        designation: '',
        quantity: 1,
        unitPrice: 0,
        vatRate: 20,
        montantHT: 0,
        montantTTC: 0
      }]
    }))
  }

  const removeItem = (index) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    onSubmit(formData)
  }

  const getStatusVariant = () => {
    if (validation.score >= 90) return 'success'
    if (validation.score >= 70) return 'warning'
    return 'danger'
  }

  return (
    <div className="max-w-4xl mx-auto">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Header with validation score */}
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">Verification des donnees</h2>
          <Badge variant={getStatusVariant()} className="text-sm px-3 py-1">
            {validation.score >= 90 && <CheckCircle2 className="h-4 w-4 mr-1" />}
            {validation.score >= 70 && validation.score < 90 && <AlertTriangle className="h-4 w-4 mr-1" />}
            {validation.score < 70 && <AlertCircle className="h-4 w-4 mr-1" />}
            Conformite: {validation.score}%
          </Badge>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}

        {validation.messages.length > 0 && (
          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-yellow-800 font-medium text-sm mb-2">Champs a completer:</p>
            <ul className="list-disc list-inside text-yellow-700 text-sm space-y-1">
              {validation.messages.map((msg, i) => <li key={i}>{msg}</li>)}
            </ul>
          </div>
        )}

        {/* Document info */}
        <div className="bg-white rounded-lg border p-6 space-y-4">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <span>Document</span>
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input
              label="N° Facture *"
              value={formData.invoiceNumber}
              onChange={(e) => handleChange('invoiceNumber', e.target.value)}
              placeholder="INV-2024-001"
            />
            <Input
              label="Date *"
              type="date"
              value={formData.invoiceDate}
              onChange={(e) => handleChange('invoiceDate', e.target.value)}
            />
            <Input
              label="Echeance"
              type="date"
              value={formData.dueDate}
              onChange={(e) => handleChange('dueDate', e.target.value)}
            />
          </div>
        </div>

        {/* Seller */}
        <div className="bg-white rounded-lg border p-6 space-y-4">
          <h3 className="font-semibold text-gray-900">Vendeur</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Denomination *"
              value={formData.sellerName}
              onChange={(e) => handleChange('sellerName', e.target.value)}
              placeholder="Nom de l'entreprise"
            />
            <Input
              label="SIRET *"
              value={formData.sellerSIRET}
              onChange={(e) => handleChange('sellerSIRET', e.target.value)}
              placeholder="14 chiffres"
              maxLength={14}
            />
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Adresse</label>
              <textarea
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                value={formData.sellerAddress}
                onChange={(e) => handleChange('sellerAddress', e.target.value)}
                rows={2}
              />
            </div>
          </div>
        </div>

        {/* Buyer */}
        <div className="bg-white rounded-lg border p-6 space-y-4">
          <h3 className="font-semibold text-gray-900">Acheteur</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Denomination *"
              value={formData.buyerName}
              onChange={(e) => handleChange('buyerName', e.target.value)}
              placeholder="Nom du client"
            />
            <Input
              label="SIRET (optionnel)"
              value={formData.buyerSIRET}
              onChange={(e) => handleChange('buyerSIRET', e.target.value)}
              placeholder="14 chiffres"
              maxLength={14}
            />
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Adresse</label>
              <textarea
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                value={formData.buyerAddress}
                onChange={(e) => handleChange('buyerAddress', e.target.value)}
                rows={2}
              />
            </div>
          </div>
        </div>

        {/* Line items */}
        <div className="bg-white rounded-lg border p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">Lignes de facture</h3>
            <Button type="button" variant="outline" size="sm" onClick={addItem}>
              <Plus className="h-4 w-4" />
              Ajouter
            </Button>
          </div>

          {formData.items.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-4">Aucune ligne. Cliquez sur "Ajouter" pour commencer.</p>
          ) : (
            <div className="space-y-3">
              {formData.items.map((item, index) => (
                <div key={item.id || index} className="grid grid-cols-12 gap-2 items-end p-3 bg-gray-50 rounded-lg">
                  <div className="col-span-4">
                    <Input
                      label={index === 0 ? "Designation" : ""}
                      value={item.designation}
                      onChange={(e) => handleItemChange(index, 'designation', e.target.value)}
                      placeholder="Description"
                    />
                  </div>
                  <div className="col-span-2">
                    <Input
                      label={index === 0 ? "Qte" : ""}
                      type="number"
                      value={item.quantity}
                      onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                      min="1"
                    />
                  </div>
                  <div className="col-span-2">
                    <Input
                      label={index === 0 ? "Prix unit." : ""}
                      type="number"
                      step="0.01"
                      value={item.unitPrice}
                      onChange={(e) => handleItemChange(index, 'unitPrice', e.target.value)}
                    />
                  </div>
                  <div className="col-span-2">
                    <Input
                      label={index === 0 ? "TVA %" : ""}
                      type="number"
                      value={item.vatRate}
                      onChange={(e) => handleItemChange(index, 'vatRate', e.target.value)}
                    />
                  </div>
                  <div className="col-span-2 flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-700">
                      {(item.montantHT || 0).toFixed(2)} EUR
                    </span>
                    <button
                      type="button"
                      onClick={() => removeItem(index)}
                      className="p-1 text-red-600 hover:bg-red-50 rounded"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Totals */}
          <div className="border-t pt-4 space-y-2">
            <div className="grid grid-cols-3 gap-4">
              <Input
                label="Total HT"
                type="number"
                step="0.01"
                value={formData.totalHT}
                onChange={(e) => handleChange('totalHT', parseFloat(e.target.value) || 0)}
              />
              <Input
                label="Total TVA"
                type="number"
                step="0.01"
                value={formData.totalTVA}
                onChange={(e) => handleChange('totalTVA', parseFloat(e.target.value) || 0)}
              />
              <Input
                label="Total TTC"
                type="number"
                step="0.01"
                value={formData.totalTTC}
                onChange={(e) => handleChange('totalTTC', parseFloat(e.target.value) || 0)}
              />
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="flex justify-end">
          <Button
            type="submit"
            size="lg"
            loading={loading}
            disabled={validation.score < 70}
          >
            Generer Facture-X
          </Button>
        </div>
      </form>
    </div>
  )
}

export default ReviewStep
