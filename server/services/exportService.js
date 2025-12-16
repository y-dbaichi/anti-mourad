/**
 * Export Service - Generate various accounting formats
 */

/**
 * Generate CSV export for multiple invoices
 */
const generateCsvExport = (invoices) => {
  const headers = [
    'Numero Facture',
    'Date Facture',
    'Date Echeance',
    'Vendeur',
    'SIRET Vendeur',
    'Acheteur',
    'SIRET Acheteur',
    'Total HT',
    'TVA',
    'Total TTC',
    'Devise',
    'Statut'
  ];

  const rows = invoices.map(inv => {
    const data = inv.extractedData || {};
    const tva = (data.totalTTC || 0) - (data.totalHT || 0);
    return [
      data.invoiceNumber || inv.invoiceNumber || '',
      data.invoiceDate || '',
      data.dueDate || '',
      (data.sellerName || '').replace(/[,;]/g, ' '),
      data.sellerSIRET || '',
      (data.buyerName || '').replace(/[,;]/g, ' '),
      data.buyerSIRET || '',
      (data.totalHT || 0).toFixed(2),
      tva.toFixed(2),
      (data.totalTTC || 0).toFixed(2),
      data.currency || 'EUR',
      inv.status || 'draft'
    ];
  });

  const csvContent = [
    headers.join(';'),
    ...rows.map(row => row.join(';'))
  ].join('\n');

  return csvContent;
};

/**
 * Generate CSV export for line items
 */
const generateItemsCsvExport = (invoices) => {
  const headers = [
    'Numero Facture',
    'Ligne',
    'Designation',
    'Quantite',
    'Prix Unitaire HT',
    'Taux TVA',
    'Montant HT'
  ];

  const rows = [];
  invoices.forEach(inv => {
    const data = inv.extractedData || {};
    const items = data.items || [];
    items.forEach((item, index) => {
      rows.push([
        data.invoiceNumber || inv.invoiceNumber || '',
        index + 1,
        (item.designation || '').replace(/[,;]/g, ' '),
        item.quantity || 0,
        (item.unitPrice || 0).toFixed(2),
        (item.vatRate || 20) + '%',
        (item.montantHT || 0).toFixed(2)
      ]);
    });
  });

  const csvContent = [
    headers.join(';'),
    ...rows.map(row => row.join(';'))
  ].join('\n');

  return csvContent;
};

/**
 * Generate Sage format export
 * Format compatible with Sage 50/100
 */
const generateSageExport = (invoices) => {
  const lines = [];

  // Header line
  lines.push('*FAC');

  invoices.forEach(inv => {
    const data = inv.extractedData || {};
    const invoiceDate = (data.invoiceDate || new Date().toISOString().split('T')[0]).replace(/-/g, '');

    // General line (type G)
    lines.push([
      'G',
      data.invoiceNumber || '',
      invoiceDate,
      data.buyerName?.substring(0, 35) || '',
      (data.totalTTC || 0).toFixed(2),
      data.currency || 'EUR'
    ].join('\t'));

    // Detail lines (type D)
    const items = data.items || [];
    items.forEach((item, index) => {
      lines.push([
        'D',
        index + 1,
        item.designation?.substring(0, 60) || '',
        item.quantity || 1,
        (item.unitPrice || 0).toFixed(2),
        (item.vatRate || 20).toFixed(2),
        (item.montantHT || 0).toFixed(2)
      ].join('\t'));
    });

    // Total line (type T)
    const tva = (data.totalTTC || 0) - (data.totalHT || 0);
    lines.push([
      'T',
      (data.totalHT || 0).toFixed(2),
      tva.toFixed(2),
      (data.totalTTC || 0).toFixed(2)
    ].join('\t'));
  });

  lines.push('*FIN');
  return lines.join('\n');
};

/**
 * Generate Cegid format export
 * Format compatible with Cegid
 */
const generateCegidExport = (invoices) => {
  const lines = [];

  invoices.forEach(inv => {
    const data = inv.extractedData || {};
    const invoiceDate = (data.invoiceDate || new Date().toISOString().split('T')[0]).replace(/-/g, '');
    const dueDate = (data.dueDate || data.invoiceDate || new Date().toISOString().split('T')[0]).replace(/-/g, '');

    // Cegid PGI format
    lines.push([
      'VE', // Type: Vente
      data.invoiceNumber || '',
      invoiceDate,
      dueDate,
      data.buyerSIRET?.substring(0, 9) || '', // SIREN (9 first digits)
      data.buyerName?.substring(0, 35) || '',
      (data.totalHT || 0).toFixed(2),
      ((data.totalTTC || 0) - (data.totalHT || 0)).toFixed(2), // TVA
      (data.totalTTC || 0).toFixed(2),
      data.currency || 'EUR',
      '411000', // Default customer account
      '701000'  // Default sales account
    ].join(';'));
  });

  return lines.join('\n');
};

/**
 * Generate Quadratus (Cegid Quadra) format export
 */
const generateQuadraExport = (invoices) => {
  const lines = [];

  invoices.forEach(inv => {
    const data = inv.extractedData || {};
    const invoiceDate = data.invoiceDate || new Date().toISOString().split('T')[0];
    const [year, month, day] = invoiceDate.split('-');

    // Quadra Compta format
    // M = Mouvement
    lines.push([
      'M',
      'VE', // Journal Ventes
      `${day}${month}${year.substring(2)}`, // Date JJMMAA
      '411000', // Compte client
      data.buyerName?.substring(0, 24) || '',
      'D', // Debit
      (data.totalTTC || 0).toFixed(2).replace('.', ','),
      data.invoiceNumber || '',
      data.currency || 'E' // E = EUR
    ].join('\t'));

    // Contrepartie TVA
    const tva = (data.totalTTC || 0) - (data.totalHT || 0);
    if (tva > 0) {
      lines.push([
        'M',
        'VE',
        `${day}${month}${year.substring(2)}`,
        '445710', // Compte TVA collectee
        'TVA collectee',
        'C', // Credit
        tva.toFixed(2).replace('.', ','),
        data.invoiceNumber || '',
        data.currency || 'E'
      ].join('\t'));
    }

    // Contrepartie ventes
    lines.push([
      'M',
      'VE',
      `${day}${month}${year.substring(2)}`,
      '701000', // Compte ventes
      'Ventes de marchandises',
      'C', // Credit
      (data.totalHT || 0).toFixed(2).replace('.', ','),
      data.invoiceNumber || '',
      data.currency || 'E'
    ].join('\t'));
  });

  return lines.join('\n');
};

/**
 * Generate JSON export
 */
const generateJsonExport = (invoices) => {
  const exportData = invoices.map(inv => ({
    invoiceNumber: inv.invoiceNumber,
    status: inv.status,
    profile: inv.profile,
    createdAt: inv.createdAt,
    data: inv.extractedData,
    validation: inv.validationErrors
  }));

  return JSON.stringify(exportData, null, 2);
};

/**
 * Generate FEC (Fichier des Ecritures Comptables) format
 * Required format for French tax authorities
 */
const generateFecExport = (invoices, companyInfo = {}) => {
  const lines = [];

  // FEC Header
  const headers = [
    'JournalCode',
    'JournalLib',
    'EcritureNum',
    'EcritureDate',
    'CompteNum',
    'CompteLib',
    'CompAuxNum',
    'CompAuxLib',
    'PieceRef',
    'PieceDate',
    'EcritureLib',
    'Debit',
    'Credit',
    'EcritureLet',
    'DateLet',
    'ValidDate',
    'Montantdevise',
    'Idevise'
  ];
  lines.push(headers.join('\t'));

  let ecritureNum = 1;

  invoices.forEach(inv => {
    const data = inv.extractedData || {};
    const invoiceDate = (data.invoiceDate || new Date().toISOString().split('T')[0]).replace(/-/g, '');

    // Debit: Client account
    lines.push([
      'VE', // Journal code
      'Ventes', // Journal lib
      ecritureNum.toString().padStart(8, '0'),
      invoiceDate,
      '411000', // Client account
      'Clients',
      data.buyerSIRET?.substring(0, 9) || '',
      data.buyerName?.substring(0, 35) || '',
      data.invoiceNumber || '',
      invoiceDate,
      `Facture ${data.invoiceNumber || ''}`,
      (data.totalTTC || 0).toFixed(2).replace('.', ','),
      '0,00',
      '', '', '',
      (data.totalTTC || 0).toFixed(2).replace('.', ','),
      data.currency || 'EUR'
    ].join('\t'));

    // Credit: TVA account
    const tva = (data.totalTTC || 0) - (data.totalHT || 0);
    if (tva > 0) {
      lines.push([
        'VE',
        'Ventes',
        ecritureNum.toString().padStart(8, '0'),
        invoiceDate,
        '445710',
        'TVA collectee',
        '', '',
        data.invoiceNumber || '',
        invoiceDate,
        `TVA Facture ${data.invoiceNumber || ''}`,
        '0,00',
        tva.toFixed(2).replace('.', ','),
        '', '', '',
        tva.toFixed(2).replace('.', ','),
        data.currency || 'EUR'
      ].join('\t'));
    }

    // Credit: Sales account
    lines.push([
      'VE',
      'Ventes',
      ecritureNum.toString().padStart(8, '0'),
      invoiceDate,
      '701000',
      'Ventes de marchandises',
      '', '',
      data.invoiceNumber || '',
      invoiceDate,
      `Ventes Facture ${data.invoiceNumber || ''}`,
      '0,00',
      (data.totalHT || 0).toFixed(2).replace('.', ','),
      '', '', '',
      (data.totalHT || 0).toFixed(2).replace('.', ','),
      data.currency || 'EUR'
    ].join('\t'));

    ecritureNum++;
  });

  return lines.join('\n');
};

/**
 * Get export by format
 */
const generateExport = (invoices, format) => {
  switch (format.toLowerCase()) {
    case 'csv':
      return {
        content: generateCsvExport(invoices),
        mimeType: 'text/csv',
        extension: 'csv'
      };
    case 'csv-items':
      return {
        content: generateItemsCsvExport(invoices),
        mimeType: 'text/csv',
        extension: 'csv'
      };
    case 'json':
      return {
        content: generateJsonExport(invoices),
        mimeType: 'application/json',
        extension: 'json'
      };
    case 'sage':
      return {
        content: generateSageExport(invoices),
        mimeType: 'text/plain',
        extension: 'txt'
      };
    case 'cegid':
      return {
        content: generateCegidExport(invoices),
        mimeType: 'text/csv',
        extension: 'csv'
      };
    case 'quadra':
      return {
        content: generateQuadraExport(invoices),
        mimeType: 'text/plain',
        extension: 'txt'
      };
    case 'fec':
      return {
        content: generateFecExport(invoices),
        mimeType: 'text/plain',
        extension: 'txt'
      };
    default:
      throw new Error(`Format d'export non supporte: ${format}`);
  }
};

module.exports = {
  generateCsvExport,
  generateItemsCsvExport,
  generateJsonExport,
  generateSageExport,
  generateCegidExport,
  generateQuadraExport,
  generateFecExport,
  generateExport
};
