const mongoose = require('mongoose');

const invoiceSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  invoiceNumber: {
    type: String,
    required: true
  },
  // Original PDF info
  originalFileName: {
    type: String
  },
  originalPdfBase64: {
    type: String // Store original PDF for re-processing
  },
  // Extracted data
  extractedData: {
    sellerName: String,
    sellerAddress: String,
    sellerSIRET: String,
    sellerVAT: String,
    buyerName: String,
    buyerAddress: String,
    buyerSIRET: String,
    invoiceDate: String,
    dueDate: String,
    totalHT: Number,
    totalTTC: Number,
    currency: { type: String, default: 'EUR' },
    items: [{
      designation: String,
      quantity: Number,
      unitPrice: Number,
      vatRate: Number,
      montantHT: Number
    }]
  },
  // Generated outputs
  xmlContent: {
    type: String
  },
  pdfA3Base64: {
    type: String // PDF/A-3 with embedded XML
  },
  // Processing info
  profile: {
    type: String,
    enum: ['minimum', 'basic', 'comfort', 'extended'],
    default: 'comfort'
  },
  status: {
    type: String,
    enum: ['draft', 'validated', 'exported', 'failed'],
    default: 'draft'
  },
  validationErrors: [{
    field: String,
    message: String,
    severity: { type: String, enum: ['error', 'warning'] }
  }],
  // Batch info
  batchId: {
    type: String,
    index: true
  },
  // Export history
  exports: [{
    format: { type: String, enum: ['xml', 'pdfa3', 'json', 'csv', 'sage', 'cegid', 'quadra'] },
    exportedAt: { type: Date, default: Date.now }
  }],
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update timestamp on save
invoiceSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Index for faster queries
invoiceSchema.index({ userId: 1, createdAt: -1 });
invoiceSchema.index({ userId: 1, status: 1 });

module.exports = mongoose.model('Invoice', invoiceSchema);
