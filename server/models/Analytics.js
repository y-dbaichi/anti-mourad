const mongoose = require('mongoose');

const analyticsSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  // Daily stats
  date: {
    type: Date,
    required: true,
    index: true
  },
  // Conversion metrics
  conversions: {
    total: { type: Number, default: 0 },
    successful: { type: Number, default: 0 },
    failed: { type: Number, default: 0 }
  },
  // Processing metrics
  processing: {
    totalPagesProcessed: { type: Number, default: 0 },
    averageProcessingTime: { type: Number, default: 0 }, // in ms
    totalProcessingTime: { type: Number, default: 0 }
  },
  // Export metrics
  exports: {
    xml: { type: Number, default: 0 },
    pdfa3: { type: Number, default: 0 },
    csv: { type: Number, default: 0 },
    sage: { type: Number, default: 0 },
    cegid: { type: Number, default: 0 },
    quadra: { type: Number, default: 0 }
  },
  // Financial metrics (from invoices processed)
  financials: {
    totalHT: { type: Number, default: 0 },
    totalTTC: { type: Number, default: 0 },
    invoiceCount: { type: Number, default: 0 }
  },
  // API usage
  apiCalls: {
    total: { type: Number, default: 0 },
    extract: { type: Number, default: 0 },
    validate: { type: Number, default: 0 },
    generate: { type: Number, default: 0 }
  }
});

// Compound index for efficient queries
analyticsSchema.index({ userId: 1, date: -1 });

// Static method to record a conversion
analyticsSchema.statics.recordConversion = async function(userId, success, processingTime, pagesProcessed) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const update = {
    $inc: {
      'conversions.total': 1,
      [`conversions.${success ? 'successful' : 'failed'}`]: 1,
      'processing.totalPagesProcessed': pagesProcessed || 0,
      'processing.totalProcessingTime': processingTime || 0
    }
  };

  const result = await this.findOneAndUpdate(
    { userId, date: today },
    update,
    { upsert: true, new: true }
  );

  // Update average processing time
  if (result.conversions.total > 0) {
    result.processing.averageProcessingTime =
      result.processing.totalProcessingTime / result.conversions.total;
    await result.save();
  }

  return result;
};

// Static method to record an export
analyticsSchema.statics.recordExport = async function(userId, format) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return await this.findOneAndUpdate(
    { userId, date: today },
    { $inc: { [`exports.${format}`]: 1 } },
    { upsert: true, new: true }
  );
};

// Static method to record financial data
analyticsSchema.statics.recordFinancial = async function(userId, totalHT, totalTTC) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return await this.findOneAndUpdate(
    { userId, date: today },
    {
      $inc: {
        'financials.totalHT': totalHT || 0,
        'financials.totalTTC': totalTTC || 0,
        'financials.invoiceCount': 1
      }
    },
    { upsert: true, new: true }
  );
};

// Static method to get analytics for a period
analyticsSchema.statics.getAnalytics = async function(userId, startDate, endDate) {
  return await this.aggregate([
    {
      $match: {
        userId: new mongoose.Types.ObjectId(userId),
        date: { $gte: startDate, $lte: endDate }
      }
    },
    {
      $group: {
        _id: null,
        totalConversions: { $sum: '$conversions.total' },
        successfulConversions: { $sum: '$conversions.successful' },
        failedConversions: { $sum: '$conversions.failed' },
        totalPages: { $sum: '$processing.totalPagesProcessed' },
        avgProcessingTime: { $avg: '$processing.averageProcessingTime' },
        xmlExports: { $sum: '$exports.xml' },
        pdfa3Exports: { $sum: '$exports.pdfa3' },
        csvExports: { $sum: '$exports.csv' },
        totalHT: { $sum: '$financials.totalHT' },
        totalTTC: { $sum: '$financials.totalTTC' },
        invoiceCount: { $sum: '$financials.invoiceCount' },
        dailyData: { $push: '$$ROOT' }
      }
    }
  ]);
};

module.exports = mongoose.model('Analytics', analyticsSchema);
