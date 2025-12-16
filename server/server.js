require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');

// Import routes
const authRoutes = require('./routes/auth');
const facturexRoutes = require('./routes/facturex');
const apiRoutes = require('./routes/api');
const apiKeysRoutes = require('./routes/apiKeys');
const stripeRoutes = require('./routes/stripe');
const invoicesRoutes = require('./routes/invoices');
const analyticsRoutes = require('./routes/analytics');

const app = express();

// Connect to MongoDB
connectDB();

// CORS configuration
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true
}));

// Stripe webhook needs raw body - must be before express.json()
app.use('/api/stripe/webhook', express.raw({ type: 'application/json' }));

// Body parser
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/facturex', facturexRoutes);
app.use('/api/v1', apiRoutes);
app.use('/api/keys', apiKeysRoutes);
app.use('/api/stripe', stripeRoutes);
app.use('/api/invoices', invoicesRoutes);
app.use('/api/analytics', analyticsRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV
  });
});

// API docs endpoint
app.get('/api/docs', (req, res) => {
  res.json({
    name: 'FormatX API',
    version: '2.0.0',
    description: 'PDF to Facture-X conversion API with batch processing and analytics',
    endpoints: {
      auth: {
        'POST /api/auth/register': 'Register new user',
        'POST /api/auth/login': 'Login user',
        'GET /api/auth/me': 'Get current user (requires auth)'
      },
      facturex: {
        'POST /api/facturex/extract': 'Extract data from PDF',
        'POST /api/facturex/validate': 'Validate invoice data',
        'POST /api/facturex/generate': 'Generate Facture-X XML'
      },
      invoices: {
        'GET /api/invoices': 'Get invoice history (requires auth)',
        'GET /api/invoices/:id': 'Get single invoice (requires auth)',
        'POST /api/invoices/convert': 'Full PDF to Facture-X conversion (requires auth)',
        'POST /api/invoices/batch': 'Batch process ZIP file (requires auth)',
        'POST /api/invoices/batch/multiple': 'Batch process multiple PDFs (requires auth)',
        'GET /api/invoices/:id/xml': 'Download XML (requires auth)',
        'GET /api/invoices/:id/pdf': 'Download PDF/A-3 (requires auth)',
        'POST /api/invoices/export': 'Export to accounting format (requires auth)'
      },
      analytics: {
        'GET /api/analytics/dashboard': 'Get dashboard statistics (requires auth)',
        'GET /api/analytics/usage': 'Get usage statistics (requires auth)',
        'GET /api/analytics/exports': 'Get export statistics (requires auth)',
        'GET /api/analytics/financial': 'Get financial statistics (requires auth)'
      },
      publicApi: {
        'POST /api/v1/convert': 'Convert PDF to Facture-X (requires API key)',
        'POST /api/v1/validate': 'Validate invoice data (requires API key)',
        'GET /api/v1/usage': 'Get API usage stats (requires API key)'
      },
      stripe: {
        'GET /api/stripe/products': 'Get available plans',
        'POST /api/stripe/create-checkout': 'Create checkout session (requires auth)',
        'POST /api/stripe/create-portal': 'Create billing portal (requires auth)'
      }
    },
    exportFormats: ['xml', 'pdfa3', 'csv', 'json', 'sage', 'cegid', 'quadra', 'fec'],
    facturexProfiles: ['minimum', 'basic', 'comfort', 'extended']
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log('\n========================================');
  console.log('   FormatX API Server v2.0');
  console.log('========================================');
  console.log('   Port:', PORT);
  console.log('   Mode:', process.env.NODE_ENV || 'development');
  console.log('   Docs: http://localhost:' + PORT + '/api/docs');
  console.log('========================================\n');
});
