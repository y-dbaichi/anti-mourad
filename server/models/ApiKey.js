const mongoose = require('mongoose');
const crypto = require('crypto');

const apiKeySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  key: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    default: 'Default Key'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastUsed: {
    type: Date,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Generate API key
apiKeySchema.statics.generateKey = function() {
  return 'fx_' + crypto.randomBytes(24).toString('hex');
};

// Find by key and update last used
apiKeySchema.statics.findByKey = async function(key) {
  const apiKey = await this.findOne({ key, isActive: true }).populate('userId');
  if (apiKey) {
    apiKey.lastUsed = new Date();
    await apiKey.save();
  }
  return apiKey;
};

module.exports = mongoose.model('ApiKey', apiKeySchema);
