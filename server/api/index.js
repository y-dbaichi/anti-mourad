require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('../config/db');

// Import routes
const authRoutes = require('../routes/auth');
const facturexRoutes = require('../routes/facturex');
const apiRoutes = require('../routes/api');
const apiKeysRoutes = require('../routes/apiKeys');
const stripeRoutes = require('../routes/stripe');

const app = express();

// Connect to MongoDB
connectDB();

// CORS configuration
app.use(cors({
  origin: process.env.CLIENT_URL || '*',
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
    description: 'PDF to Facture-X conversion API'
  });
});

// 404 handler for API routes
app.use('/api/*', (req, res) => {
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

// Export for Vercel
module.exports = app;
