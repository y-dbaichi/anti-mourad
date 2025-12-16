const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  plan: {
    type: String,
    enum: ['free', 'pro', 'business'],
    default: 'free'
  },
  status: {
    type: String,
    enum: ['active', 'past_due', 'canceled', 'trialing'],
    default: 'active'
  },
  conversionsLimit: {
    type: Number,
    default: 10
  },
  conversionsUsed: {
    type: Number,
    default: 0
  },
  stripeCustomerId: {
    type: String,
    default: null
  },
  stripeSubscriptionId: {
    type: String,
    default: null
  },
  stripePriceId: {
    type: String,
    default: null
  },
  currentPeriodStart: {
    type: Date,
    default: null
  },
  currentPeriodEnd: {
    type: Date,
    default: null
  },
  cancelAtPeriodEnd: {
    type: Boolean,
    default: false
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update timestamp on save
subscriptionSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Reset conversions if new billing period
subscriptionSchema.methods.checkAndResetConversions = function() {
  if (this.currentPeriodEnd && new Date() > this.currentPeriodEnd) {
    this.conversionsUsed = 0;
    // For free tier, just reset monthly
    if (this.plan === 'free') {
      const now = new Date();
      this.currentPeriodStart = now;
      this.currentPeriodEnd = new Date(now.setMonth(now.getMonth() + 1));
    }
  }
  return this;
};

// Check if can convert
subscriptionSchema.methods.canConvert = function() {
  return this.conversionsUsed < this.conversionsLimit && this.status === 'active';
};

// Increment conversion count
subscriptionSchema.methods.incrementConversions = async function() {
  this.conversionsUsed += 1;
  await this.save();
  return this;
};

module.exports = mongoose.model('Subscription', subscriptionSchema);
