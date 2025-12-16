// Vercel serverless function entry point
let app;

try {
  app = require('../server/api/index.js');
} catch (error) {
  console.error('Failed to load server:', error);
  // Create minimal express app for error reporting
  const express = require('express');
  app = express();

  app.use((req, res) => {
    res.status(500).json({
      error: 'Server initialization failed',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  });
}

// Export handler for Vercel
module.exports = app;
