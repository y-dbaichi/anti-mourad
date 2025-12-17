// Ollama Local LLM Service for PDF text extraction analysis
// This is the on-premise alternative to groqService.js

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.1:8b';
const OLLAMA_TIMEOUT = parseInt(process.env.OLLAMA_TIMEOUT) || 300000; // 5 minutes default

const extractInvoiceData = async (pdfText) => {
  const prompt = `Extract ALL invoice information from the following PDF text. Return ONLY valid JSON.

PDF Text:
${pdfText}

Extract these fields carefully (use null if not found):
{
  "invoiceNumber": "exact invoice/facture number",
  "invoiceDate": "YYYY-MM-DD format",
  "dueDate": "YYYY-MM-DD format or null",
  "supplierName": "company name of seller/vendor",
  "supplierAddress": "full address of seller",
  "supplierVAT": "VAT/SIRET/SIREN number of seller",
  "buyerName": "buyer/client name",
  "buyerAddress": "buyer address",
  "buyerVAT": "buyer VAT/SIRET if present",
  "items": [
    {
      "description": "product/service description",
      "quantity": number (default 1),
      "unitPrice": number,
      "discount": number (0 if none),
      "vatRate": number (TVA rate: 0, 5.5, 10, or 20),
      "montantHT": number (HT amount for this line),
      "montantTTC": number (TTC amount for this line)
    }
  ],
  "subtotal": number (Total HT),
  "taxAmount": number (Total TVA),
  "total": number (Total TTC),
  "currency": "EUR" or "USD"
}

IMPORTANT RULES:
1. SELLER is the company ISSUING the invoice (look for "Fournisseur", "Vendeur", "From")
2. BUYER is the company RECEIVING the invoice (look for "Client", "Acheteur", "To")
3. NEVER concatenate seller and buyer names together
4. Each address has its own postal code - use this to separate addresses
5. Extract actual amounts from the PDF, don't calculate
6. For French invoices: SIRET = 14 digits, VAT = FR + 11 chars

Return ONLY the JSON object, no markdown, no explanation.`;

  try {
    // AbortController for timeout (local LLM can be slow on CPU)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), OLLAMA_TIMEOUT);

    const response = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt: prompt,
        stream: false,
        options: {
          temperature: 0.1,
          num_predict: 2000
        }
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ollama API error: ${errorText}`);
    }

    const data = await response.json();
    const aiResponse = data.response || '';

    // Extract JSON from response
    let jsonString = aiResponse.trim();
    if (jsonString.startsWith('```')) {
      jsonString = jsonString
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();
    }

    const jsonMatch = jsonString.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Could not extract JSON from AI response');
    }

    const invoiceData = JSON.parse(jsonMatch[0]);

    // Transform to internal format (same as groqService)
    return {
      invoiceNumber: invoiceData.invoiceNumber || '',
      invoiceDate: invoiceData.invoiceDate || new Date().toISOString().split('T')[0],
      dueDate: invoiceData.dueDate || invoiceData.invoiceDate || new Date().toISOString().split('T')[0],
      currency: invoiceData.currency || 'EUR',

      sellerName: invoiceData.supplierName || '',
      sellerAddress: invoiceData.supplierAddress || '',
      sellerSIRET: invoiceData.supplierVAT || '',
      sellerCountry: 'FR',

      buyerName: invoiceData.buyerName || '',
      buyerAddress: invoiceData.buyerAddress || '',
      buyerSIRET: invoiceData.buyerVAT || '',
      buyerCountry: 'FR',

      items: (invoiceData.items || []).map((item, index) => ({
        id: `item-${Date.now()}-${index}`,
        designation: item.description || '',
        quantity: item.quantity || 1,
        unitPrice: parseFloat(item.unitPrice) || 0,
        discount: parseFloat(item.discount) || 0,
        vatRate: parseFloat(item.vatRate) || 20,
        montantHT: parseFloat(item.montantHT) || 0,
        montantTTC: parseFloat(item.montantTTC) || 0
      })),

      totalHT: parseFloat(invoiceData.subtotal) || 0,
      totalTVA: parseFloat(invoiceData.taxAmount) || 0,
      totalTTC: parseFloat(invoiceData.total) || 0
    };

  } catch (error) {
    console.error('Ollama extraction error:', error);
    throw error;
  }
};

// Health check to verify Ollama is running
const checkOllamaHealth = async () => {
  try {
    const response = await fetch(`${OLLAMA_URL}/api/tags`);
    if (!response.ok) return { healthy: false, error: 'Ollama not responding' };

    const data = await response.json();
    const models = data.models || [];
    const hasModel = models.some(m => m.name.includes(OLLAMA_MODEL.split(':')[0]));

    return {
      healthy: true,
      models: models.map(m => m.name),
      hasRequiredModel: hasModel,
      requiredModel: OLLAMA_MODEL
    };
  } catch (error) {
    return { healthy: false, error: error.message };
  }
};

module.exports = { extractInvoiceData, checkOllamaHealth };
