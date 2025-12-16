const ApiKey = require('../models/ApiKey');
const Subscription = require('../models/Subscription');

// Validate API key for public API routes
const validateApiKey = async (req, res, next) => {
  const apiKey = req.headers['x-api-key'] || req.headers.authorization?.replace('Bearer ', '');

  if (!apiKey) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'API key is required. Include X-API-Key header.'
    });
  }

  // Check if it's a valid API key format
  if (!apiKey.startsWith('fx_')) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid API key format. Keys must start with fx_'
    });
  }

  try {
    const keyDoc = await ApiKey.findByKey(apiKey);

    if (!keyDoc) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid or inactive API key'
      });
    }

    // Get subscription for rate limiting
    const subscription = await Subscription.findOne({ userId: keyDoc.userId._id });

    if (!subscription) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'No subscription found for this API key'
      });
    }

    // Check if can convert
    if (!subscription.canConvert()) {
      return res.status(429).json({
        error: 'Rate limit exceeded',
        message: 'Monthly conversion limit reached. Upgrade your plan.',
        limit: subscription.conversionsLimit,
        used: subscription.conversionsUsed
      });
    }

    // Attach to request
    req.apiUser = keyDoc.userId;
    req.subscription = subscription;

    next();
  } catch (error) {
    console.error('API Key validation error:', error);
    return res.status(500).json({
      error: 'Server error',
      message: 'Failed to validate API key'
    });
  }
};

module.exports = { validateApiKey };
