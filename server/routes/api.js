const express = require('express');
const { validateApiKey } = require('../middleware/apiKey');
const { extractTextFromBase64 } = require('../services/pdfService');
const { extractInvoiceData } = require('../services/groqService');
const { generateFactureX } = require('../services/xmlService');
const { validateInvoiceData } = require('../utils/validators');

const router = express.Router();

// @route   POST /api/v1/convert
// @desc    Convert PDF to Facture-X (Public API)
// @access  API Key required
router.post('/convert', validateApiKey, async (req, res) => {
  try {
    const { pdfBase64, profile = 'comfort', autoValidate = true } = req.body;

    if (!pdfBase64) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Missing required field: pdfBase64'
      });
    }

    // Extract text from PDF
    console.log('[API] Extracting text from PDF...');
    const pdfData = await extractTextFromBase64(pdfBase64);

    if (!pdfData.text || pdfData.text.trim().length === 0) {
      return res.status(422).json({
        error: 'Unprocessable Entity',
        message: 'Could not extract text from PDF. Ensure it contains readable text.'
      });
    }

    // Analyze with AI
    console.log('[API] Analyzing with Groq AI...');
    const extractedData = await extractInvoiceData(pdfData.text);

    // Generate XML
    console.log('[API] Generating Facture-X XML...');
    const xml = generateFactureX(extractedData, profile);
    const fileName = `facture-x-${extractedData.invoiceNumber?.replace(/[^a-zA-Z0-9]/g, '-') || Date.now()}.xml`;

    // Validate if requested
    let validation = null;
    if (autoValidate) {
      validation = validateInvoiceData(extractedData);
    }

    // Increment usage
    await req.subscription.incrementConversions();

    res.json({
      success: true,
      data: {
        extractedData,
        factureX: {
          xml,
          profile,
          fileName
        },
        validation: validation || { message: 'Validation skipped (autoValidate=false)' }
      },
      meta: {
        apiVersion: '1.0',
        creditsRemaining: req.subscription.conversionsLimit - req.subscription.conversionsUsed
      }
    });

  } catch (error) {
    console.error('[API] Convert error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
});

// @route   POST /api/v1/validate
// @desc    Validate invoice data (Public API)
// @access  API Key required
router.post('/validate', validateApiKey, async (req, res) => {
  try {
    const { invoiceData, xml } = req.body;

    if (!invoiceData && !xml) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Provide either invoiceData or xml to validate'
      });
    }

    // For now, only validate invoice data
    // XML validation would require additional parsing
    const validation = validateInvoiceData(invoiceData || {});

    res.json({
      success: true,
      validation,
      meta: {
        apiVersion: '1.0'
      }
    });

  } catch (error) {
    console.error('[API] Validate error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
});

// @route   GET /api/v1/usage
// @desc    Get API usage stats
// @access  API Key required
router.get('/usage', validateApiKey, async (req, res) => {
  try {
    res.json({
      success: true,
      usage: {
        plan: req.subscription.plan,
        conversionsUsed: req.subscription.conversionsUsed,
        conversionsLimit: req.subscription.conversionsLimit,
        conversionsRemaining: req.subscription.conversionsLimit - req.subscription.conversionsUsed,
        periodEnd: req.subscription.currentPeriodEnd
      }
    });
  } catch (error) {
    console.error('[API] Usage error:', error);
    res.status(500).json({ error: 'Failed to get usage' });
  }
});

module.exports = router;
