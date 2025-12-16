const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const Subscription = require('../models/Subscription');
const { generateToken, protect } = require('../middleware/auth');

const router = express.Router();

// @route   POST /api/auth/register
// @desc    Register a new user
// @access  Public
router.post('/register', [
  body('email').isEmail().withMessage('Please enter a valid email'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password, fullName } = req.body;

    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists with this email' });
    }

    // Create user
    const user = await User.create({
      email,
      password,
      fullName
    });

    // Create free subscription
    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    await Subscription.create({
      userId: user._id,
      plan: 'free',
      status: 'active',
      conversionsLimit: 10,
      conversionsUsed: 0,
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd
    });

    // Generate token
    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      user: {
        id: user._id,
        email: user.email,
        fullName: user.fullName
      },
      token
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Server error during registration' });
  }
});

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
router.post('/login', [
  body('email').isEmail().withMessage('Please enter a valid email'),
  body('password').exists().withMessage('Password is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate token
    const token = generateToken(user._id);

    res.json({
      success: true,
      user: {
        id: user._id,
        email: user.email,
        fullName: user.fullName
      },
      token
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error during login' });
  }
});

// @route   GET /api/auth/me
// @desc    Get current user
// @access  Private
router.get('/me', protect, async (req, res) => {
  try {
    const subscription = await Subscription.findOne({ userId: req.user._id });

    res.json({
      success: true,
      user: {
        id: req.user._id,
        email: req.user.email,
        fullName: req.user.fullName,
        createdAt: req.user.createdAt
      },
      subscription: subscription ? {
        plan: subscription.plan,
        status: subscription.status,
        conversionsLimit: subscription.conversionsLimit,
        conversionsUsed: subscription.conversionsUsed,
        currentPeriodEnd: subscription.currentPeriodEnd
      } : null
    });

  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   PUT /api/auth/profile
// @desc    Update user profile
// @access  Private
router.put('/profile', protect, [
  body('fullName').optional().trim(),
  body('email').optional().isEmail()
], async (req, res) => {
  try {
    const { fullName, email } = req.body;
    const updates = {};

    if (fullName) updates.fullName = fullName;
    if (email && email !== req.user.email) {
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({ error: 'Email already in use' });
      }
      updates.email = email;
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      updates,
      { new: true }
    );

    res.json({
      success: true,
      user: {
        id: user._id,
        email: user.email,
        fullName: user.fullName
      }
    });

  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
