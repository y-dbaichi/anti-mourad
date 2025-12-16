// Vercel serverless function entry point
let app;
let loadError = null;

try {
  app = require('../server/api/index.js');
} catch (error) {
  loadError = error;
  // Create minimal express app for error reporting
  const express = require('express');
  app = express();

  app.use((req, res) => {
    res.status(500).json({
      error: 'Failed to load server',
      message: loadError.message,
      stack: loadError.stack
    });
  });
}

// Export handler for Vercel
module.exports = app;
