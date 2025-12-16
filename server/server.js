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
    version: '1.0.0',
    description: 'PDF to Facture-X conversion API',
    endpoints: {
      auth: {
        'POST /api/auth/register': 'Register new user',
        'POST /api/auth/login': 'Login user',
        'GET /api/auth/me': 'Get current user (requires auth)'
      },
      facturex: {
        'POST /api/facturex/extract': 'Extract data from PDF (requires auth)',
        'POST /api/facturex/validate': 'Validate invoice data',
        'POST /api/facturex/generate': 'Generate Facture-X XML'
      },
      publicApi: {
        'POST /api/v1/convert': 'Convert PDF to Facture-X (requires API key)',
        'POST /api/v1/validate': 'Validate invoice data (requires API key)',
        'GET /api/v1/usage': 'Get API usage stats (requires API key)'
      },
      apiKeys: {
        'GET /api/keys': 'Get user API keys (requires auth)',
        'POST /api/keys': 'Create new API key (requires auth)',
        'DELETE /api/keys/:id': 'Delete API key (requires auth)'
      },
      stripe: {
        'GET /api/stripe/products': 'Get available plans',
        'POST /api/stripe/create-checkout': 'Create checkout session (requires auth)',
        'POST /api/stripe/create-portal': 'Create billing portal (requires auth)'
      }
    }
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
  console.log(`
========================================
   FormatX API Server
========================================
   Port: ${PORT}
   Mode: ${process.env.NODE_ENV || 'development'}
   Docs: http://localhost:${PORT}/api/docs
========================================
  `);
});
