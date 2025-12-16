const express = require('express');
const multer = require('multer');
const { protect } = require('../middleware/auth');
const Invoice = require('../models/Invoice');
const Analytics = require('../models/Analytics');
const { extractTextFromBase64, extractTextFromPDF } = require('../services/pdfService');
const { extractInvoiceData } = require('../services/groqService');
const { generateFactureX } = require('../services/xmlService');
const { embedXmlInPdf } = require('../services/pdfA3Service');
const { validateInvoiceData, validateXmlStructure, recommendProfile } = require('../services/validationService');
const { generateExport } = require('../services/exportService');
const { processZipFile, processMultiplePdfs, getBatchStatus, exportBatchAsZip } = require('../services/batchService');
const { sendConversionNotification, sendBatchNotification } = require('../services/emailService');
const Subscription = require('../models/Subscription');

const router = express.Router();

// Multer configuration for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf' || file.mimetype === 'application/zip' || file.mimetype === 'application/x-zip-compressed') {
      cb(null, true);
    } else {
      cb(new Error('Seuls les fichiers PDF et ZIP sont acceptes'));
    }
  }
});

// @route   GET /api/invoices
// @desc    Get user's invoice history
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      search,
      startDate,
      endDate,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const query = { userId: req.user._id };

    // Filters
    if (status) query.status = status;
    if (search) {
      query.$or = [
        { invoiceNumber: { $regex: search, $options: 'i' } },
        { 'extractedData.sellerName': { $regex: search, $options: 'i' } },
        { 'extractedData.buyerName': { $regex: search, $options: 'i' } }
      ];
    }
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

    const [invoices, total] = await Promise.all([
      Invoice.find(query)
        .select('-originalPdfBase64 -xmlContent -pdfA3Base64')
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit)),
      Invoice.countDocuments(query)
    ]);

    res.json({
      success: true,
      invoices,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('Get invoices error:', error);
    res.status(500).json({ error: 'Erreur lors de la recuperation des factures' });
  }
});

// @route   GET /api/invoices/:id
// @desc    Get single invoice details
// @access  Private
router.get('/:id', protect, async (req, res) => {
  try {
    const invoice = await Invoice.findOne({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!invoice) {
      return res.status(404).json({ error: 'Facture non trouvee' });
    }

    res.json({
      success: true,
      invoice
    });

  } catch (error) {
    console.error('Get invoice error:', error);
    res.status(500).json({ error: 'Erreur lors de la recuperation de la facture' });
  }
});

// @route   POST /api/invoices/convert
// @desc    Convert a PDF to Facture-X (full process)
// @access  Private
router.post('/convert', protect, async (req, res) => {
  try {
    const { pdfBase64, profile = 'comfort', generatePdfA3 = true, notify = false } = req.body;

    if (!pdfBase64) {
      return res.status(400).json({ error: 'PDF base64 requis' });
    }

    // Check subscription limit
    const subscription = await Subscription.findOne({ userId: req.user._id });
    if (subscription && !subscription.canConvert()) {
      return res.status(429).json({
        error: 'Limite de conversions atteinte',
        limit: subscription.conversionsLimit,
        used: subscription.conversionsUsed
      });
    }

    const startTime = Date.now();
    const pdfBuffer = Buffer.from(pdfBase64, 'base64');

    // Extract text
    const pdfData = await extractTextFromPDF(pdfBuffer);
    if (!pdfData.text || pdfData.text.trim().length === 0) {
      return res.status(422).json({ error: 'PDF vide ou base sur des images' });
    }

    // Extract invoice data with AI
    const extractedData = await extractInvoiceData(pdfData.text);

    // Recommend profile if not specified
    const recommendedProfile = recommendProfile(extractedData);
    const finalProfile = profile || recommendedProfile;

    // Validate
    const validation = validateInvoiceData(extractedData, finalProfile);

    // Generate XML
    const xml = generateFactureX(extractedData, finalProfile);

    // Validate XML structure
    const xmlValidation = validateXmlStructure(xml);

    // Generate PDF/A-3 if requested
    let pdfA3Base64 = null;
    if (generatePdfA3) {
      const pdfA3Buffer = await embedXmlInPdf(pdfBuffer, xml, extractedData.invoiceNumber);
      pdfA3Base64 = pdfA3Buffer.toString('base64');
    }

    // Save to database
    const invoice = new Invoice({
      userId: req.user._id,
      invoiceNumber: extractedData.invoiceNumber || `INV-${Date.now()}`,
      originalPdfBase64: pdfBase64,
      extractedData,
      xmlContent: xml,
      pdfA3Base64,
      profile: finalProfile,
      status: validation.isValid ? 'validated' : 'draft',
      validationErrors: [...validation.errors, ...validation.warnings]
    });

    await invoice.save();

    // Update subscription usage
    if (subscription) {
      await subscription.incrementConversions();
    }

    // Record analytics
    const processingTime = Date.now() - startTime;
    await Analytics.recordConversion(req.user._id, true, processingTime, pdfData.numPages);
    if (extractedData.totalHT || extractedData.totalTTC) {
      await Analytics.recordFinancial(req.user._id, extractedData.totalHT || 0, extractedData.totalTTC || 0);
    }

    // Send notification if requested
    if (notify) {
      sendConversionNotification(req.user, invoice).catch(console.error);
    }

    res.json({
      success: true,
      invoice: {
        id: invoice._id,
        invoiceNumber: invoice.invoiceNumber,
        status: invoice.status,
        profile: invoice.profile
      },
      extractedData,
      validation,
      xmlValidation,
      xml,
      pdfA3Base64,
      processingTime,
      recommendedProfile
    });

  } catch (error) {
    console.error('Convert error:', error);
    res.status(500).json({ error: 'Erreur lors de la conversion', message: error.message });
  }
});

// @route   POST /api/invoices/batch
// @desc    Process multiple PDFs (upload or ZIP)
// @access  Private
router.post('/batch', protect, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Fichier requis' });
    }

    const options = {
      profile: req.body.profile || 'comfort',
      generatePdfA3: req.body.generatePdfA3 !== 'false',
      storePdf: req.body.storePdf !== 'false'
    };

    let results;

    if (req.file.mimetype === 'application/zip' || req.file.mimetype === 'application/x-zip-compressed') {
      // Process ZIP file
      results = await processZipFile(req.file.buffer, req.user._id, options);
    } else {
      // Single PDF
      results = await processMultiplePdfs([{
        buffer: req.file.buffer,
        name: req.file.originalname
      }], req.user._id, options);
    }

    // Send batch notification
    if (results.total > 1) {
      sendBatchNotification(req.user, results).catch(console.error);
    }

    res.json({
      success: true,
      ...results
    });

  } catch (error) {
    console.error('Batch error:', error);
    res.status(500).json({ error: 'Erreur lors du traitement par lot', message: error.message });
  }
});

// @route   POST /api/invoices/batch/multiple
// @desc    Process multiple PDF files
// @access  Private
router.post('/batch/multiple', protect, upload.array('files', 50), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'Fichiers requis' });
    }

    const options = {
      profile: req.body.profile || 'comfort',
      generatePdfA3: req.body.generatePdfA3 !== 'false',
      storePdf: req.body.storePdf !== 'false'
    };

    const pdfFiles = req.files.map(f => ({
      buffer: f.buffer,
      name: f.originalname
    }));

    const results = await processMultiplePdfs(pdfFiles, req.user._id, options);

    // Send batch notification
    sendBatchNotification(req.user, results).catch(console.error);

    res.json({
      success: true,
      ...results
    });

  } catch (error) {
    console.error('Batch multiple error:', error);
    res.status(500).json({ error: 'Erreur lors du traitement', message: error.message });
  }
});

// @route   GET /api/invoices/batch/:batchId
// @desc    Get batch status
// @access  Private
router.get('/batch/:batchId', protect, async (req, res) => {
  try {
    const status = await getBatchStatus(req.params.batchId, req.user._id);
    res.json({
      success: true,
      ...status
    });
  } catch (error) {
    console.error('Batch status error:', error);
    res.status(500).json({ error: 'Erreur lors de la recuperation du statut' });
  }
});

// @route   GET /api/invoices/batch/:batchId/export
// @desc    Export batch as ZIP
// @access  Private
router.get('/batch/:batchId/export', protect, async (req, res) => {
  try {
    const { format = 'xml' } = req.query;
    const zipBuffer = await exportBatchAsZip(req.params.batchId, req.user._id, format);

    res.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="batch-${req.params.batchId}.zip"`
    });
    res.send(zipBuffer);

  } catch (error) {
    console.error('Batch export error:', error);
    res.status(500).json({ error: 'Erreur lors de l\'export' });
  }
});

// @route   PUT /api/invoices/:id
// @desc    Update invoice data
// @access  Private
router.put('/:id', protect, async (req, res) => {
  try {
    const { extractedData, profile, regenerate = false } = req.body;

    const invoice = await Invoice.findOne({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!invoice) {
      return res.status(404).json({ error: 'Facture non trouvee' });
    }

    // Update extracted data
    if (extractedData) {
      invoice.extractedData = { ...invoice.extractedData, ...extractedData };
    }

    // Update profile if specified
    if (profile) {
      invoice.profile = profile;
    }

    // Revalidate
    const validation = validateInvoiceData(invoice.extractedData, invoice.profile);
    invoice.validationErrors = [...validation.errors, ...validation.warnings];
    invoice.status = validation.isValid ? 'validated' : 'draft';

    // Regenerate XML if requested
    if (regenerate) {
      invoice.xmlContent = generateFactureX(invoice.extractedData, invoice.profile);

      // Regenerate PDF/A-3 if we have the original PDF
      if (invoice.originalPdfBase64) {
        const pdfBuffer = Buffer.from(invoice.originalPdfBase64, 'base64');
        const pdfA3Buffer = await embedXmlInPdf(pdfBuffer, invoice.xmlContent, invoice.invoiceNumber);
        invoice.pdfA3Base64 = pdfA3Buffer.toString('base64');
      }
    }

    await invoice.save();

    res.json({
      success: true,
      invoice: {
        id: invoice._id,
        invoiceNumber: invoice.invoiceNumber,
        status: invoice.status,
        profile: invoice.profile,
        extractedData: invoice.extractedData,
        validationErrors: invoice.validationErrors
      },
      validation
    });

  } catch (error) {
    console.error('Update invoice error:', error);
    res.status(500).json({ error: 'Erreur lors de la mise a jour' });
  }
});

// @route   DELETE /api/invoices/:id
// @desc    Delete an invoice
// @access  Private
router.delete('/:id', protect, async (req, res) => {
  try {
    const invoice = await Invoice.findOneAndDelete({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!invoice) {
      return res.status(404).json({ error: 'Facture non trouvee' });
    }

    res.json({
      success: true,
      message: 'Facture supprimee'
    });

  } catch (error) {
    console.error('Delete invoice error:', error);
    res.status(500).json({ error: 'Erreur lors de la suppression' });
  }
});

// @route   GET /api/invoices/:id/xml
// @desc    Download invoice XML
// @access  Private
router.get('/:id/xml', protect, async (req, res) => {
  try {
    const invoice = await Invoice.findOne({
      _id: req.params.id,
      userId: req.user._id
    }).select('invoiceNumber xmlContent');

    if (!invoice || !invoice.xmlContent) {
      return res.status(404).json({ error: 'XML non trouve' });
    }

    // Record export
    await Analytics.recordExport(req.user._id, 'xml');

    const fileName = `facture-x-${invoice.invoiceNumber.replace(/[^a-zA-Z0-9]/g, '-')}.xml`;
    res.set({
      'Content-Type': 'application/xml; charset=utf-8',
      'Content-Disposition': `attachment; filename="${fileName}"`
    });
    res.send(invoice.xmlContent);

  } catch (error) {
    console.error('Download XML error:', error);
    res.status(500).json({ error: 'Erreur lors du telechargement' });
  }
});

// @route   GET /api/invoices/:id/pdf
// @desc    Download invoice PDF/A-3
// @access  Private
router.get('/:id/pdf', protect, async (req, res) => {
  try {
    const invoice = await Invoice.findOne({
      _id: req.params.id,
      userId: req.user._id
    }).select('invoiceNumber pdfA3Base64');

    if (!invoice || !invoice.pdfA3Base64) {
      return res.status(404).json({ error: 'PDF non trouve' });
    }

    // Record export
    await Analytics.recordExport(req.user._id, 'pdfa3');

    const fileName = `facture-x-${invoice.invoiceNumber.replace(/[^a-zA-Z0-9]/g, '-')}.pdf`;
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${fileName}"`
    });
    res.send(Buffer.from(invoice.pdfA3Base64, 'base64'));

  } catch (error) {
    console.error('Download PDF error:', error);
    res.status(500).json({ error: 'Erreur lors du telechargement' });
  }
});

// @route   POST /api/invoices/export
// @desc    Export multiple invoices to accounting format
// @access  Private
router.post('/export', protect, async (req, res) => {
  try {
    const { invoiceIds, format = 'csv' } = req.body;

    if (!invoiceIds || !Array.isArray(invoiceIds) || invoiceIds.length === 0) {
      return res.status(400).json({ error: 'IDs de factures requis' });
    }

    const invoices = await Invoice.find({
      _id: { $in: invoiceIds },
      userId: req.user._id
    });

    if (invoices.length === 0) {
      return res.status(404).json({ error: 'Aucune facture trouvee' });
    }

    const { content, mimeType, extension } = generateExport(invoices, format);

    // Record export for each invoice
    for (const invoice of invoices) {
      await Analytics.recordExport(req.user._id, format);
      invoice.exports.push({ format, exportedAt: new Date() });
      await invoice.save();
    }

    const fileName = `export-${format}-${new Date().toISOString().split('T')[0]}.${extension}`;
    res.set({
      'Content-Type': `${mimeType}; charset=utf-8`,
      'Content-Disposition': `attachment; filename="${fileName}"`
    });
    res.send(content);

  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ error: 'Erreur lors de l\'export', message: error.message });
  }
});

module.exports = router;
