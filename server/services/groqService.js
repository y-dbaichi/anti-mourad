// Groq AI Service for PDF text extraction analysis

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
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 2000,
        temperature: 0.1
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Groq API error: ${errorText}`);
    }

    const data = await response.json();
    const aiResponse = data.choices[0]?.message?.content || '';

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

    // Transform to internal format
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
    console.error('Groq extraction error:', error);
    throw error;
  }
};

module.exports = { extractInvoiceData };
