const express = require('express');
const { protect } = require('../middleware/auth');
const ApiKey = require('../models/ApiKey');

const router = express.Router();

// @route   GET /api/keys
// @desc    Get user's API keys
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    const keys = await ApiKey.find({ userId: req.user._id })
      .select('-__v')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      keys: keys.map(k => ({
        id: k._id,
        key: k.key.substring(0, 10) + '...' + k.key.substring(k.key.length - 4),
        name: k.name,
        isActive: k.isActive,
        lastUsed: k.lastUsed,
        createdAt: k.createdAt
      }))
    });

  } catch (error) {
    console.error('Get keys error:', error);
    res.status(500).json({ error: 'Failed to get API keys' });
  }
});

// @route   POST /api/keys
// @desc    Create new API key
// @access  Private
router.post('/', protect, async (req, res) => {
  try {
    const { name = 'Default Key' } = req.body;

    // Limit to 5 keys per user
    const keyCount = await ApiKey.countDocuments({ userId: req.user._id });
    if (keyCount >= 5) {
      return res.status(400).json({
        error: 'Maximum API keys reached',
        message: 'You can have a maximum of 5 API keys. Delete unused keys first.'
      });
    }

    const key = ApiKey.generateKey();

    const apiKey = await ApiKey.create({
      userId: req.user._id,
      key,
      name
    });

    // Return full key only on creation
    res.status(201).json({
      success: true,
      key: {
        id: apiKey._id,
        key: apiKey.key, // Full key shown only once!
        name: apiKey.name,
        isActive: apiKey.isActive,
        createdAt: apiKey.createdAt
      },
      message: 'Save this key securely. It will not be shown again.'
    });

  } catch (error) {
    console.error('Create key error:', error);
    res.status(500).json({ error: 'Failed to create API key' });
  }
});

// @route   PUT /api/keys/:id
// @desc    Update API key (name, active status)
// @access  Private
router.put('/:id', protect, async (req, res) => {
  try {
    const { name, isActive } = req.body;

    const apiKey = await ApiKey.findOne({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!apiKey) {
      return res.status(404).json({ error: 'API key not found' });
    }

    if (name !== undefined) apiKey.name = name;
    if (isActive !== undefined) apiKey.isActive = isActive;

    await apiKey.save();

    res.json({
      success: true,
      key: {
        id: apiKey._id,
        name: apiKey.name,
        isActive: apiKey.isActive
      }
    });

  } catch (error) {
    console.error('Update key error:', error);
    res.status(500).json({ error: 'Failed to update API key' });
  }
});

// @route   DELETE /api/keys/:id
// @desc    Delete API key
// @access  Private
router.delete('/:id', protect, async (req, res) => {
  try {
    const result = await ApiKey.findOneAndDelete({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!result) {
      return res.status(404).json({ error: 'API key not found' });
    }

    res.json({
      success: true,
      message: 'API key deleted'
    });

  } catch (error) {
    console.error('Delete key error:', error);
    res.status(500).json({ error: 'Failed to delete API key' });
  }
});

module.exports = router;
