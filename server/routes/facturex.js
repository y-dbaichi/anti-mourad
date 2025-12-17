const express = require('express');
const { protect, optionalAuth } = require('../middleware/auth');
const { extractTextFromBase64 } = require('../services/pdfService');
const { extractInvoiceData, checkHealth, getAvailableModes } = require('../services/extractionService');
const { generateFactureX } = require('../services/xmlService');
const { validateInvoiceData } = require('../utils/validators');
const Subscription = require('../models/Subscription');

const router = express.Router();

// @route   GET /api/facturex/modes
// @desc    Get available extraction modes
// @access  Public
router.get('/modes', async (req, res) => {
  try {
    const modes = await getAvailableModes();
    const health = await checkHealth();

    res.json({
      success: true,
      modes,
      health
    });
  } catch (error) {
    console.error('Modes error:', error);
    res.status(500).json({ error: 'Failed to get extraction modes' });
  }
});

// @route   POST /api/facturex/extract
// @desc    Extract text from PDF and analyze with AI
// @access  Private (or public with limits)
router.post('/extract', optionalAuth, async (req, res) => {
  try {
    const { pdfBase64, extractionMode = 'cloud' } = req.body;

    if (!pdfBase64) {
      return res.status(400).json({ error: 'PDF base64 data is required' });
    }

    // Validate extraction mode
    if (!['cloud', 'local'].includes(extractionMode)) {
      return res.status(400).json({ error: 'Invalid extraction mode. Use "cloud" or "local".' });
    }

    // Check subscription if user is logged in
    if (req.user) {
      const subscription = await Subscription.findOne({ userId: req.user._id });
      if (subscription && !subscription.canConvert()) {
        return res.status(429).json({
          error: 'Conversion limit reached',
          message: 'You have reached your monthly conversion limit. Upgrade your plan.',
          limit: subscription.conversionsLimit,
          used: subscription.conversionsUsed
        });
      }
    }

    // Extract text from PDF
    console.log('Extracting text from PDF...');
    const pdfData = await extractTextFromBase64(pdfBase64);

    if (!pdfData.text || pdfData.text.trim().length === 0) {
      return res.status(422).json({
        error: 'Could not extract text from PDF',
        message: 'The PDF appears to be empty or image-based. Please use a text-based PDF.'
      });
    }

    // Analyze with AI (using selected mode)
    console.log(`Analyzing with AI (${extractionMode} mode)...`);
    const startTime = Date.now();
    const extractedData = await extractInvoiceData(pdfData.text, extractionMode);
    const extractionTime = Date.now() - startTime;

    // Validate extracted data
    const validation = validateInvoiceData(extractedData);

    // Increment conversion count if user is logged in
    if (req.user) {
      const subscription = await Subscription.findOne({ userId: req.user._id });
      if (subscription) {
        await subscription.incrementConversions();
      }
    }

    res.json({
      success: true,
      data: extractedData,
      validation,
      pdfInfo: {
        pages: pdfData.numPages,
        textLength: pdfData.text.length
      },
      extractionMode,
      extractionTime
    });

  } catch (error) {
    console.error('Extract error:', error);
    res.status(500).json({
      error: 'Extraction failed',
      message: error.message
    });
  }
});

// @route   POST /api/facturex/validate
// @desc    Validate invoice data
// @access  Public
router.post('/validate', async (req, res) => {
  try {
    const invoiceData = req.body;

    if (!invoiceData || Object.keys(invoiceData).length === 0) {
      return res.status(400).json({ error: 'Invoice data is required' });
    }

    const validation = validateInvoiceData(invoiceData);

    res.json({
      success: true,
      validation
    });

  } catch (error) {
    console.error('Validation error:', error);
    res.status(500).json({
      error: 'Validation failed',
      message: error.message
    });
  }
});

// @route   POST /api/facturex/generate
// @desc    Generate Facture-X XML
// @access  Public (validation done client-side)
router.post('/generate', async (req, res) => {
  try {
    const { invoiceData, profile = 'comfort', preview = false } = req.body;

    if (!invoiceData) {
      return res.status(400).json({ error: 'Invoice data is required' });
    }

    // Validate required fields
    if (!invoiceData.invoiceNumber) {
      return res.status(400).json({ error: 'Invoice number is required' });
    }
    if (!invoiceData.sellerName) {
      return res.status(400).json({ error: 'Seller name is required' });
    }
    if (!invoiceData.sellerSIRET) {
      return res.status(400).json({ error: 'Seller SIRET/VAT is required' });
    }
    if (!invoiceData.buyerName) {
      return res.status(400).json({ error: 'Buyer name is required' });
    }

    // Generate XML
    const xml = generateFactureX(invoiceData, profile);

    if (preview) {
      // Return as text for preview
      res.set('Content-Type', 'text/plain; charset=utf-8');
      return res.send(xml);
    }

    // Return as downloadable file
    const fileName = `facture-x-${invoiceData.invoiceNumber.replace(/[^a-zA-Z0-9]/g, '-')}.xml`;

    res.set({
      'Content-Type': 'application/xml; charset=utf-8',
      'Content-Disposition': `attachment; filename="${fileName}"`
    });

    res.send(xml);

  } catch (error) {
    console.error('Generate error:', error);
    res.status(500).json({
      error: 'XML generation failed',
      message: error.message
    });
  }
});

// @route   GET /api/facturex/usage
// @desc    Get user's conversion usage
// @access  Private
router.get('/usage', protect, async (req, res) => {
  try {
    const subscription = await Subscription.findOne({ userId: req.user._id });

    if (!subscription) {
      return res.status(404).json({ error: 'No subscription found' });
    }

    // Check and reset if new period
    await subscription.checkAndResetConversions();
    await subscription.save();

    res.json({
      success: true,
      usage: {
        plan: subscription.plan,
        used: subscription.conversionsUsed,
        limit: subscription.conversionsLimit,
        remaining: subscription.conversionsLimit - subscription.conversionsUsed,
        periodEnd: subscription.currentPeriodEnd
      }
    });

  } catch (error) {
    console.error('Usage error:', error);
    res.status(500).json({ error: 'Failed to get usage' });
  }
});

module.exports = router;
