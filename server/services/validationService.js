const { XMLParser } = require('fast-xml-parser');

/**
 * Facture-X Schema Validation Service
 * Validates XML against Facture-X EN 16931 requirements
 */

// Required fields by profile
const PROFILE_REQUIREMENTS = {
  minimum: {
    required: [
      'invoiceNumber',
      'invoiceDate',
      'sellerName',
      'buyerName',
      'totalTTC',
      'currency'
    ],
    optional: []
  },
  basic: {
    required: [
      'invoiceNumber',
      'invoiceDate',
      'sellerName',
      'sellerAddress',
      'buyerName',
      'buyerAddress',
      'totalHT',
      'totalTTC',
      'currency'
    ],
    optional: ['dueDate', 'sellerSIRET', 'buyerSIRET']
  },
  comfort: {
    required: [
      'invoiceNumber',
      'invoiceDate',
      'sellerName',
      'sellerAddress',
      'sellerSIRET',
      'buyerName',
      'buyerAddress',
      'totalHT',
      'totalTTC',
      'currency',
      'items'
    ],
    optional: ['dueDate', 'buyerSIRET', 'sellerVAT', 'buyerVAT']
  },
  extended: {
    required: [
      'invoiceNumber',
      'invoiceDate',
      'sellerName',
      'sellerAddress',
      'sellerSIRET',
      'sellerVAT',
      'buyerName',
      'buyerAddress',
      'totalHT',
      'totalTTC',
      'currency',
      'items',
      'dueDate'
    ],
    optional: ['buyerSIRET', 'buyerVAT', 'paymentTerms', 'bankDetails']
  }
};

// Validation rules
const VALIDATION_RULES = {
  invoiceNumber: {
    pattern: /^.{1,100}$/,
    message: 'Le numero de facture doit contenir entre 1 et 100 caracteres'
  },
  invoiceDate: {
    pattern: /^\d{4}-\d{2}-\d{2}$/,
    message: 'La date de facture doit etre au format AAAA-MM-JJ'
  },
  dueDate: {
    pattern: /^\d{4}-\d{2}-\d{2}$/,
    message: 'La date d\'echeance doit etre au format AAAA-MM-JJ'
  },
  sellerSIRET: {
    pattern: /^(\d{14}|[A-Z]{2}\d{9,13})$/,
    message: 'Le SIRET vendeur doit contenir 14 chiffres ou un numero de TVA valide'
  },
  buyerSIRET: {
    pattern: /^(\d{14}|[A-Z]{2}\d{9,13})?$/,
    message: 'Le SIRET acheteur doit contenir 14 chiffres ou un numero de TVA valide'
  },
  currency: {
    pattern: /^[A-Z]{3}$/,
    message: 'La devise doit etre un code ISO 4217 (ex: EUR, USD)'
  },
  totalHT: {
    validate: (v) => typeof v === 'number' && v >= 0,
    message: 'Le total HT doit etre un nombre positif'
  },
  totalTTC: {
    validate: (v) => typeof v === 'number' && v >= 0,
    message: 'Le total TTC doit etre un nombre positif'
  }
};

// Item validation rules
const ITEM_RULES = {
  designation: {
    required: true,
    message: 'La designation de l\'article est requise'
  },
  quantity: {
    validate: (v) => typeof v === 'number' && v > 0,
    message: 'La quantite doit etre un nombre positif'
  },
  unitPrice: {
    validate: (v) => typeof v === 'number' && v >= 0,
    message: 'Le prix unitaire doit etre un nombre positif ou zero'
  },
  vatRate: {
    validate: (v) => typeof v === 'number' && v >= 0 && v <= 100,
    message: 'Le taux de TVA doit etre entre 0 et 100'
  }
};

/**
 * Validate invoice data against Facture-X requirements
 */
const validateInvoiceData = (data, profile = 'comfort') => {
  const errors = [];
  const warnings = [];
  const requirements = PROFILE_REQUIREMENTS[profile] || PROFILE_REQUIREMENTS.comfort;

  // Check required fields
  for (const field of requirements.required) {
    if (field === 'items') {
      if (!data.items || !Array.isArray(data.items) || data.items.length === 0) {
        errors.push({
          field: 'items',
          message: 'Au moins un article est requis',
          severity: 'error'
        });
      }
    } else if (!data[field] && data[field] !== 0) {
      errors.push({
        field,
        message: `Le champ "${field}" est requis pour le profil ${profile}`,
        severity: 'error'
      });
    }
  }

  // Validate field formats
  for (const [field, rule] of Object.entries(VALIDATION_RULES)) {
    if (data[field] !== undefined && data[field] !== null && data[field] !== '') {
      if (rule.pattern && !rule.pattern.test(String(data[field]))) {
        errors.push({
          field,
          message: rule.message,
          severity: 'error'
        });
      }
      if (rule.validate && !rule.validate(data[field])) {
        errors.push({
          field,
          message: rule.message,
          severity: 'error'
        });
      }
    }
  }

  // Validate items
  if (data.items && Array.isArray(data.items)) {
    data.items.forEach((item, index) => {
      for (const [field, rule] of Object.entries(ITEM_RULES)) {
        if (rule.required && !item[field]) {
          errors.push({
            field: `items[${index}].${field}`,
            message: rule.message,
            severity: 'error'
          });
        }
        if (rule.validate && item[field] !== undefined && !rule.validate(item[field])) {
          errors.push({
            field: `items[${index}].${field}`,
            message: rule.message,
            severity: 'error'
          });
        }
      }
    });
  }

  // Business logic validations
  if (data.totalHT !== undefined && data.totalTTC !== undefined) {
    if (data.totalTTC < data.totalHT) {
      warnings.push({
        field: 'totalTTC',
        message: 'Le total TTC est inferieur au total HT (TVA negative?)',
        severity: 'warning'
      });
    }
  }

  // Date validations
  if (data.invoiceDate && data.dueDate) {
    const invoiceDate = new Date(data.invoiceDate);
    const dueDate = new Date(data.dueDate);
    if (dueDate < invoiceDate) {
      warnings.push({
        field: 'dueDate',
        message: 'La date d\'echeance est anterieure a la date de facture',
        severity: 'warning'
      });
    }
  }

  // SIRET checksum validation (French specific)
  if (data.sellerSIRET && /^\d{14}$/.test(data.sellerSIRET)) {
    if (!validateSiretChecksum(data.sellerSIRET)) {
      warnings.push({
        field: 'sellerSIRET',
        message: 'Le numero SIRET vendeur semble invalide (checksum incorrecte)',
        severity: 'warning'
      });
    }
  }

  // Items total validation
  if (data.items && data.items.length > 0 && data.totalHT !== undefined) {
    const calculatedHT = data.items.reduce((sum, item) => {
      return sum + (item.montantHT || (item.quantity * item.unitPrice) || 0);
    }, 0);

    const diff = Math.abs(calculatedHT - data.totalHT);
    if (diff > 0.01) { // Allow 1 cent tolerance for rounding
      warnings.push({
        field: 'totalHT',
        message: `Le total HT (${data.totalHT}) ne correspond pas a la somme des lignes (${calculatedHT.toFixed(2)})`,
        severity: 'warning'
      });
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    profile,
    summary: {
      errorsCount: errors.length,
      warningsCount: warnings.length,
      checkedFields: Object.keys(VALIDATION_RULES).length + requirements.required.length
    }
  };
};

/**
 * Validate SIRET checksum using Luhn algorithm
 */
const validateSiretChecksum = (siret) => {
  if (!/^\d{14}$/.test(siret)) return false;

  let sum = 0;
  for (let i = 0; i < 14; i++) {
    let digit = parseInt(siret[i], 10);
    if (i % 2 === 0) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  return sum % 10 === 0;
};

/**
 * Validate generated XML structure
 */
const validateXmlStructure = (xmlContent) => {
  const errors = [];

  try {
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_'
    });

    const parsed = parser.parse(xmlContent);

    // Check root element
    const root = parsed['rsm:CrossIndustryInvoice'];
    if (!root) {
      errors.push({
        field: 'root',
        message: 'Element racine CrossIndustryInvoice manquant',
        severity: 'error'
      });
      return { isValid: false, errors };
    }

    // Check context
    const context = root['rsm:ExchangedDocumentContext'];
    if (!context) {
      errors.push({
        field: 'context',
        message: 'ExchangedDocumentContext manquant',
        severity: 'error'
      });
    }

    // Check exchanged document
    const doc = root['rsm:ExchangedDocument'];
    if (!doc) {
      errors.push({
        field: 'document',
        message: 'ExchangedDocument manquant',
        severity: 'error'
      });
    } else {
      if (!doc['ram:ID']) {
        errors.push({
          field: 'invoiceNumber',
          message: 'ID de facture manquant dans ExchangedDocument',
          severity: 'error'
        });
      }
    }

    // Check transaction
    const transaction = root['rsm:SupplyChainTradeTransaction'];
    if (!transaction) {
      errors.push({
        field: 'transaction',
        message: 'SupplyChainTradeTransaction manquant',
        severity: 'error'
      });
    } else {
      // Check agreement
      const agreement = transaction['ram:ApplicableHeaderTradeAgreement'];
      if (!agreement) {
        errors.push({
          field: 'agreement',
          message: 'ApplicableHeaderTradeAgreement manquant',
          severity: 'error'
        });
      } else {
        if (!agreement['ram:SellerTradeParty']) {
          errors.push({
            field: 'seller',
            message: 'SellerTradeParty manquant',
            severity: 'error'
          });
        }
        if (!agreement['ram:BuyerTradeParty']) {
          errors.push({
            field: 'buyer',
            message: 'BuyerTradeParty manquant',
            severity: 'error'
          });
        }
      }

      // Check settlement
      const settlement = transaction['ram:ApplicableHeaderTradeSettlement'];
      if (!settlement) {
        errors.push({
          field: 'settlement',
          message: 'ApplicableHeaderTradeSettlement manquant',
          severity: 'error'
        });
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      structure: {
        hasContext: !!context,
        hasDocument: !!doc,
        hasTransaction: !!transaction
      }
    };

  } catch (error) {
    errors.push({
      field: 'xml',
      message: `Erreur de parsing XML: ${error.message}`,
      severity: 'error'
    });
    return { isValid: false, errors };
  }
};

/**
 * Get profile recommendation based on data completeness
 */
const recommendProfile = (data) => {
  const hasItems = data.items && Array.isArray(data.items) && data.items.length > 0;
  const hasSellerSIRET = !!data.sellerSIRET;
  const hasSellerVAT = !!data.sellerVAT;
  const hasDueDate = !!data.dueDate;

  if (hasItems && hasSellerSIRET && hasSellerVAT && hasDueDate) {
    return 'extended';
  } else if (hasItems && hasSellerSIRET) {
    return 'comfort';
  } else if (data.sellerAddress && data.buyerAddress) {
    return 'basic';
  }
  return 'minimum';
};

module.exports = {
  validateInvoiceData,
  validateXmlStructure,
  validateSiretChecksum,
  recommendProfile,
  PROFILE_REQUIREMENTS,
  VALIDATION_RULES
};
