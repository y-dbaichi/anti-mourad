// SIRET validation using Luhn algorithm
const validateSIRET = (siret) => {
  if (!siret) return false;

  const cleaned = siret.replace(/\s/g, '');
  if (!/^\d{14}$/.test(cleaned)) return false;

  let sum = 0;
  for (let i = 0; i < 14; i++) {
    let digit = parseInt(cleaned[i]);
    if (i % 2 === 1) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }

  return sum % 10 === 0;
};

// French VAT number validation
const validateFrenchVAT = (vat) => {
  if (!vat || typeof vat !== 'string') return false;

  const cleaned = vat.replace(/\s/g, '').toUpperCase();

  // French VAT: FR + 2 chars (key) + 9 digits (SIREN)
  if (!/^FR[0-9A-Z]{2}\d{9}$/.test(cleaned)) return false;

  // Validate the key
  const key = cleaned.substring(2, 4);
  const siren = cleaned.substring(4);

  // Calculate expected key
  const sirenNum = parseInt(siren);
  const expectedKey = (12 + 3 * (sirenNum % 97)) % 97;

  // Key can be numeric or alphanumeric
  if (/^\d{2}$/.test(key)) {
    return parseInt(key) === expectedKey;
  }

  return true; // Accept alphanumeric keys without validation
};

// Generic EU VAT format check
const validateEUVAT = (vat) => {
  if (!vat || typeof vat !== 'string') return false;

  const cleaned = vat.replace(/\s/g, '').toUpperCase();
  return /^[A-Z]{2}[0-9A-Z]{2,12}$/.test(cleaned);
};

// Date validation
const validateDate = (dateStr) => {
  if (!dateStr) return false;

  const date = new Date(dateStr);
  return date instanceof Date && !isNaN(date.getTime());
};

// Amount validation
const validateAmount = (amount) => {
  const num = parseFloat(amount);
  return !isNaN(num) && num >= 0;
};

// Invoice data validation
const validateInvoiceData = (data) => {
  const errors = [];
  const warnings = [];

  // Required fields
  if (!data.invoiceNumber?.trim()) {
    errors.push({ field: 'invoiceNumber', message: 'Invoice number is required' });
  }

  if (!data.invoiceDate || !validateDate(data.invoiceDate)) {
    errors.push({ field: 'invoiceDate', message: 'Valid invoice date is required' });
  }

  if (!data.sellerName?.trim()) {
    errors.push({ field: 'sellerName', message: 'Seller name is required' });
  }

  if (!data.sellerSIRET?.trim()) {
    errors.push({ field: 'sellerSIRET', message: 'Seller SIRET/VAT is required' });
  } else if (data.sellerSIRET.length === 14 && !validateSIRET(data.sellerSIRET)) {
    errors.push({ field: 'sellerSIRET', message: 'Invalid SIRET number (Luhn check failed)' });
  }

  if (!data.buyerName?.trim()) {
    errors.push({ field: 'buyerName', message: 'Buyer name is required' });
  }

  // Warnings (recommended but not required)
  if (!data.sellerAddress?.trim()) {
    warnings.push({ field: 'sellerAddress', message: 'Seller address is recommended' });
  }

  if (!data.buyerAddress?.trim()) {
    warnings.push({ field: 'buyerAddress', message: 'Buyer address is recommended' });
  }

  if (!data.dueDate) {
    warnings.push({ field: 'dueDate', message: 'Due date is recommended' });
  }

  // Amount validation
  if (!validateAmount(data.totalHT)) {
    errors.push({ field: 'totalHT', message: 'Valid total HT amount is required' });
  }

  if (!validateAmount(data.totalTTC)) {
    errors.push({ field: 'totalTTC', message: 'Valid total TTC amount is required' });
  }

  // Calculate score
  const totalChecks = 12;
  const errorWeight = 1;
  const warningWeight = 0.3;
  const deductions = errors.length * errorWeight + warnings.length * warningWeight;
  const score = Math.max(0, Math.round(((totalChecks - deductions) / totalChecks) * 100));

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    score
  };
};

module.exports = {
  validateSIRET,
  validateFrenchVAT,
  validateEUVAT,
  validateDate,
  validateAmount,
  validateInvoiceData
};
