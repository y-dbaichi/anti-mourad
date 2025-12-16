const AdmZip = require('adm-zip');
const { v4: uuidv4 } = require('uuid');
const { extractTextFromPDF } = require('./pdfService');
const { extractInvoiceData } = require('./groqService');
const { generateFactureX } = require('./xmlService');
const { embedXmlInPdf } = require('./pdfA3Service');
const { validateInvoiceData } = require('./validationService');
const Invoice = require('../models/Invoice');
const Analytics = require('../models/Analytics');

/**
 * Batch Processing Service
 * Handles multiple PDF uploads and processing
 */

/**
 * Process a ZIP file containing multiple PDFs
 */
const processZipFile = async (zipBuffer, userId, options = {}) => {
  const batchId = uuidv4();
  const results = {
    batchId,
    total: 0,
    successful: 0,
    failed: 0,
    invoices: [],
    errors: []
  };

  try {
    const zip = new AdmZip(zipBuffer);
    const entries = zip.getEntries();

    // Filter PDF files
    const pdfEntries = entries.filter(entry =>
      !entry.isDirectory &&
      entry.entryName.toLowerCase().endsWith('.pdf')
    );

    results.total = pdfEntries.length;

    if (results.total === 0) {
      throw new Error('Aucun fichier PDF trouve dans l\'archive');
    }

    // Process each PDF
    for (const entry of pdfEntries) {
      const startTime = Date.now();
      try {
        const pdfBuffer = entry.getData();
        const fileName = entry.entryName;

        // Extract text
        const pdfData = await extractTextFromPDF(pdfBuffer);

        if (!pdfData.text || pdfData.text.trim().length === 0) {
          throw new Error('PDF vide ou non lisible (image?)');
        }

        // Extract invoice data with AI
        const extractedData = await extractInvoiceData(pdfData.text);

        // Validate
        const validation = validateInvoiceData(extractedData, options.profile || 'comfort');

        // Generate XML
        const xml = generateFactureX(extractedData, options.profile || 'comfort');

        // Generate PDF/A-3 if requested
        let pdfA3Base64 = null;
        if (options.generatePdfA3) {
          const pdfA3Buffer = await embedXmlInPdf(pdfBuffer, xml, extractedData.invoiceNumber);
          pdfA3Base64 = pdfA3Buffer.toString('base64');
        }

        // Save to database
        const invoice = new Invoice({
          userId,
          invoiceNumber: extractedData.invoiceNumber || `BATCH-${batchId.substring(0, 8)}-${results.successful + 1}`,
          originalFileName: fileName,
          originalPdfBase64: options.storePdf ? pdfBuffer.toString('base64') : null,
          extractedData,
          xmlContent: xml,
          pdfA3Base64,
          profile: options.profile || 'comfort',
          status: validation.isValid ? 'validated' : 'draft',
          validationErrors: [...validation.errors, ...validation.warnings],
          batchId
        });

        await invoice.save();

        // Record analytics
        const processingTime = Date.now() - startTime;
        await Analytics.recordConversion(userId, true, processingTime, pdfData.numPages);
        if (extractedData.totalHT || extractedData.totalTTC) {
          await Analytics.recordFinancial(userId, extractedData.totalHT || 0, extractedData.totalTTC || 0);
        }

        results.successful++;
        results.invoices.push({
          id: invoice._id,
          fileName,
          invoiceNumber: invoice.invoiceNumber,
          status: invoice.status,
          validation: {
            isValid: validation.isValid,
            errorsCount: validation.errors.length,
            warningsCount: validation.warnings.length
          }
        });

      } catch (error) {
        results.failed++;
        results.errors.push({
          fileName: entry.entryName,
          error: error.message
        });

        // Record failed conversion
        await Analytics.recordConversion(userId, false, Date.now() - startTime, 0);
      }
    }

    return results;

  } catch (error) {
    console.error('Batch processing error:', error);
    throw error;
  }
};

/**
 * Process multiple PDF buffers
 */
const processMultiplePdfs = async (pdfFiles, userId, options = {}) => {
  const batchId = uuidv4();
  const results = {
    batchId,
    total: pdfFiles.length,
    successful: 0,
    failed: 0,
    invoices: [],
    errors: []
  };

  for (const file of pdfFiles) {
    const startTime = Date.now();
    try {
      const pdfBuffer = Buffer.isBuffer(file.buffer) ? file.buffer : Buffer.from(file.buffer, 'base64');

      // Extract text
      const pdfData = await extractTextFromPDF(pdfBuffer);

      if (!pdfData.text || pdfData.text.trim().length === 0) {
        throw new Error('PDF vide ou non lisible');
      }

      // Extract invoice data with AI
      const extractedData = await extractInvoiceData(pdfData.text);

      // Validate
      const validation = validateInvoiceData(extractedData, options.profile || 'comfort');

      // Generate XML
      const xml = generateFactureX(extractedData, options.profile || 'comfort');

      // Generate PDF/A-3 if requested
      let pdfA3Base64 = null;
      if (options.generatePdfA3) {
        const pdfA3Buffer = await embedXmlInPdf(pdfBuffer, xml, extractedData.invoiceNumber);
        pdfA3Base64 = pdfA3Buffer.toString('base64');
      }

      // Save to database
      const invoice = new Invoice({
        userId,
        invoiceNumber: extractedData.invoiceNumber || `BATCH-${batchId.substring(0, 8)}-${results.successful + 1}`,
        originalFileName: file.name || `invoice-${results.successful + 1}.pdf`,
        originalPdfBase64: options.storePdf ? pdfBuffer.toString('base64') : null,
        extractedData,
        xmlContent: xml,
        pdfA3Base64,
        profile: options.profile || 'comfort',
        status: validation.isValid ? 'validated' : 'draft',
        validationErrors: [...validation.errors, ...validation.warnings],
        batchId
      });

      await invoice.save();

      // Record analytics
      const processingTime = Date.now() - startTime;
      await Analytics.recordConversion(userId, true, processingTime, pdfData.numPages);
      if (extractedData.totalHT || extractedData.totalTTC) {
        await Analytics.recordFinancial(userId, extractedData.totalHT || 0, extractedData.totalTTC || 0);
      }

      results.successful++;
      results.invoices.push({
        id: invoice._id,
        fileName: file.name,
        invoiceNumber: invoice.invoiceNumber,
        status: invoice.status,
        validation: {
          isValid: validation.isValid,
          errorsCount: validation.errors.length,
          warningsCount: validation.warnings.length
        }
      });

    } catch (error) {
      results.failed++;
      results.errors.push({
        fileName: file.name || `file-${results.failed}`,
        error: error.message
      });

      await Analytics.recordConversion(userId, false, Date.now() - startTime, 0);
    }
  }

  return results;
};

/**
 * Get batch status
 */
const getBatchStatus = async (batchId, userId) => {
  const invoices = await Invoice.find({ batchId, userId })
    .select('invoiceNumber originalFileName status validationErrors createdAt')
    .sort({ createdAt: 1 });

  const stats = {
    total: invoices.length,
    validated: invoices.filter(i => i.status === 'validated').length,
    draft: invoices.filter(i => i.status === 'draft').length,
    failed: invoices.filter(i => i.status === 'failed').length,
    exported: invoices.filter(i => i.status === 'exported').length
  };

  return {
    batchId,
    stats,
    invoices
  };
};

/**
 * Export batch as ZIP
 */
const exportBatchAsZip = async (batchId, userId, format = 'xml') => {
  const invoices = await Invoice.find({ batchId, userId });

  if (invoices.length === 0) {
    throw new Error('Aucune facture trouvee pour ce lot');
  }

  const zip = new AdmZip();

  for (const invoice of invoices) {
    const fileName = `${invoice.invoiceNumber.replace(/[^a-zA-Z0-9]/g, '-')}`;

    switch (format) {
      case 'xml':
        if (invoice.xmlContent) {
          zip.addFile(`${fileName}.xml`, Buffer.from(invoice.xmlContent, 'utf-8'));
        }
        break;
      case 'pdfa3':
        if (invoice.pdfA3Base64) {
          zip.addFile(`${fileName}.pdf`, Buffer.from(invoice.pdfA3Base64, 'base64'));
        }
        break;
      case 'both':
        if (invoice.xmlContent) {
          zip.addFile(`xml/${fileName}.xml`, Buffer.from(invoice.xmlContent, 'utf-8'));
        }
        if (invoice.pdfA3Base64) {
          zip.addFile(`pdf/${fileName}.pdf`, Buffer.from(invoice.pdfA3Base64, 'base64'));
        }
        break;
    }

    // Mark as exported
    invoice.exports.push({ format, exportedAt: new Date() });
    invoice.status = 'exported';
    await invoice.save();

    // Record export
    await Analytics.recordExport(userId, format);
  }

  return zip.toBuffer();
};

module.exports = {
  processZipFile,
  processMultiplePdfs,
  getBatchStatus,
  exportBatchAsZip
};
