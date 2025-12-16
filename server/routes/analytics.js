const express = require('express');
const { protect } = require('../middleware/auth');
const Analytics = require('../models/Analytics');
const Invoice = require('../models/Invoice');
const Subscription = require('../models/Subscription');

const router = express.Router();

// @route   GET /api/analytics/dashboard
// @desc    Get dashboard analytics data
// @access  Private
router.get('/dashboard', protect, async (req, res) => {
  try {
    const { period = '30d' } = req.query;

    // Calculate date range
    const endDate = new Date();
    endDate.setHours(23, 59, 59, 999);
    const startDate = new Date();

    switch (period) {
      case '7d':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(startDate.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(startDate.getDate() - 90);
        break;
      case '12m':
        startDate.setMonth(startDate.getMonth() - 12);
        break;
      default:
        startDate.setDate(startDate.getDate() - 30);
    }
    startDate.setHours(0, 0, 0, 0);

    // Get aggregated analytics
    const analytics = await Analytics.getAnalytics(req.user._id, startDate, endDate);
    const summary = analytics[0] || {
      totalConversions: 0,
      successfulConversions: 0,
      failedConversions: 0,
      totalPages: 0,
      avgProcessingTime: 0,
      xmlExports: 0,
      pdfa3Exports: 0,
      csvExports: 0,
      totalHT: 0,
      totalTTC: 0,
      invoiceCount: 0,
      dailyData: []
    };

    // Get subscription info
    const subscription = await Subscription.findOne({ userId: req.user._id });
    const usage = subscription ? {
      plan: subscription.plan,
      used: subscription.conversionsUsed,
      limit: subscription.conversionsLimit,
      remaining: subscription.conversionsLimit - subscription.conversionsUsed,
      percentUsed: Math.round((subscription.conversionsUsed / subscription.conversionsLimit) * 100),
      periodEnd: subscription.currentPeriodEnd
    } : null;

    // Get recent invoices count by status
    const statusCounts = await Invoice.aggregate([
      { $match: { userId: req.user._id, createdAt: { $gte: startDate } } },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    const invoicesByStatus = {
      draft: 0,
      validated: 0,
      exported: 0,
      failed: 0
    };
    statusCounts.forEach(s => {
      invoicesByStatus[s._id] = s.count;
    });

    // Format daily data for charts
    const dailyStats = summary.dailyData.map(d => ({
      date: d.date,
      conversions: d.conversions.total,
      successful: d.conversions.successful,
      failed: d.conversions.failed,
      totalHT: d.financials.totalHT,
      totalTTC: d.financials.totalTTC
    })).sort((a, b) => new Date(a.date) - new Date(b.date));

    res.json({
      success: true,
      period,
      summary: {
        conversions: {
          total: summary.totalConversions,
          successful: summary.successfulConversions,
          failed: summary.failedConversions,
          successRate: summary.totalConversions > 0
            ? Math.round((summary.successfulConversions / summary.totalConversions) * 100)
            : 0
        },
        processing: {
          totalPages: summary.totalPages,
          avgTime: Math.round(summary.avgProcessingTime)
        },
        exports: {
          xml: summary.xmlExports,
          pdfa3: summary.pdfa3Exports,
          csv: summary.csvExports,
          total: summary.xmlExports + summary.pdfa3Exports + summary.csvExports
        },
        financial: {
          totalHT: summary.totalHT,
          totalTTC: summary.totalTTC,
          invoiceCount: summary.invoiceCount,
          avgInvoice: summary.invoiceCount > 0
            ? Math.round(summary.totalTTC / summary.invoiceCount)
            : 0
        },
        invoicesByStatus
      },
      usage,
      dailyStats
    });

  } catch (error) {
    console.error('Dashboard analytics error:', error);
    res.status(500).json({ error: 'Erreur lors de la recuperation des statistiques' });
  }
});

// @route   GET /api/analytics/usage
// @desc    Get detailed usage statistics
// @access  Private
router.get('/usage', protect, async (req, res) => {
  try {
    const subscription = await Subscription.findOne({ userId: req.user._id });

    if (!subscription) {
      return res.json({
        success: true,
        usage: {
          plan: 'free',
          used: 0,
          limit: 10,
          remaining: 10,
          percentUsed: 0,
          history: []
        }
      });
    }

    // Get last 12 months usage
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    const monthlyUsage = await Analytics.aggregate([
      {
        $match: {
          userId: req.user._id,
          date: { $gte: twelveMonthsAgo }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$date' },
            month: { $month: '$date' }
          },
          conversions: { $sum: '$conversions.total' },
          successful: { $sum: '$conversions.successful' },
          failed: { $sum: '$conversions.failed' }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    res.json({
      success: true,
      usage: {
        plan: subscription.plan,
        status: subscription.status,
        used: subscription.conversionsUsed,
        limit: subscription.conversionsLimit,
        remaining: subscription.conversionsLimit - subscription.conversionsUsed,
        percentUsed: Math.round((subscription.conversionsUsed / subscription.conversionsLimit) * 100),
        periodStart: subscription.currentPeriodStart,
        periodEnd: subscription.currentPeriodEnd,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd
      },
      monthlyHistory: monthlyUsage.map(m => ({
        month: `${m._id.year}-${String(m._id.month).padStart(2, '0')}`,
        total: m.conversions,
        successful: m.successful,
        failed: m.failed
      }))
    });

  } catch (error) {
    console.error('Usage analytics error:', error);
    res.status(500).json({ error: 'Erreur lors de la recuperation de l\'utilisation' });
  }
});

// @route   GET /api/analytics/exports
// @desc    Get export statistics
// @access  Private
router.get('/exports', protect, async (req, res) => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const exportStats = await Analytics.aggregate([
      {
        $match: {
          userId: req.user._id,
          date: { $gte: thirtyDaysAgo }
        }
      },
      {
        $group: {
          _id: null,
          xml: { $sum: '$exports.xml' },
          pdfa3: { $sum: '$exports.pdfa3' },
          csv: { $sum: '$exports.csv' },
          sage: { $sum: '$exports.sage' },
          cegid: { $sum: '$exports.cegid' },
          quadra: { $sum: '$exports.quadra' }
        }
      }
    ]);

    const stats = exportStats[0] || {
      xml: 0,
      pdfa3: 0,
      csv: 0,
      sage: 0,
      cegid: 0,
      quadra: 0
    };

    // Get recent exports from invoices
    const recentExports = await Invoice.aggregate([
      { $match: { userId: req.user._id } },
      { $unwind: '$exports' },
      { $sort: { 'exports.exportedAt': -1 } },
      { $limit: 20 },
      {
        $project: {
          invoiceNumber: 1,
          format: '$exports.format',
          exportedAt: '$exports.exportedAt'
        }
      }
    ]);

    res.json({
      success: true,
      stats,
      total: Object.values(stats).reduce((a, b) => a + b, 0),
      recentExports
    });

  } catch (error) {
    console.error('Export analytics error:', error);
    res.status(500).json({ error: 'Erreur lors de la recuperation des exports' });
  }
});

// @route   GET /api/analytics/financial
// @desc    Get financial statistics
// @access  Private
router.get('/financial', protect, async (req, res) => {
  try {
    const { period = '30d' } = req.query;

    const endDate = new Date();
    const startDate = new Date();

    switch (period) {
      case '7d':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(startDate.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(startDate.getDate() - 90);
        break;
      case '12m':
        startDate.setMonth(startDate.getMonth() - 12);
        break;
      default:
        startDate.setDate(startDate.getDate() - 30);
    }

    // Get financial summary from invoices
    const financialData = await Invoice.aggregate([
      {
        $match: {
          userId: req.user._id,
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: null,
          totalHT: { $sum: '$extractedData.totalHT' },
          totalTTC: { $sum: '$extractedData.totalTTC' },
          count: { $sum: 1 },
          avgHT: { $avg: '$extractedData.totalHT' },
          avgTTC: { $avg: '$extractedData.totalTTC' },
          minHT: { $min: '$extractedData.totalHT' },
          maxHT: { $max: '$extractedData.totalHT' }
        }
      }
    ]);

    const summary = financialData[0] || {
      totalHT: 0,
      totalTTC: 0,
      count: 0,
      avgHT: 0,
      avgTTC: 0,
      minHT: 0,
      maxHT: 0
    };

    // Get top clients by amount
    const topClients = await Invoice.aggregate([
      {
        $match: {
          userId: req.user._id,
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: '$extractedData.buyerName',
          totalTTC: { $sum: '$extractedData.totalTTC' },
          count: { $sum: 1 }
        }
      },
      { $sort: { totalTTC: -1 } },
      { $limit: 10 }
    ]);

    // Get monthly trend
    const monthlyTrend = await Invoice.aggregate([
      {
        $match: {
          userId: req.user._id,
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          totalHT: { $sum: '$extractedData.totalHT' },
          totalTTC: { $sum: '$extractedData.totalTTC' },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    res.json({
      success: true,
      period,
      summary: {
        totalHT: Math.round(summary.totalHT * 100) / 100,
        totalTTC: Math.round(summary.totalTTC * 100) / 100,
        totalVAT: Math.round((summary.totalTTC - summary.totalHT) * 100) / 100,
        invoiceCount: summary.count,
        avgInvoice: Math.round(summary.avgTTC * 100) / 100,
        minInvoice: Math.round(summary.minHT * 100) / 100,
        maxInvoice: Math.round(summary.maxHT * 100) / 100
      },
      topClients: topClients.map(c => ({
        name: c._id || 'Non specifie',
        totalTTC: Math.round(c.totalTTC * 100) / 100,
        invoiceCount: c.count
      })),
      monthlyTrend: monthlyTrend.map(m => ({
        month: `${m._id.year}-${String(m._id.month).padStart(2, '0')}`,
        totalHT: Math.round(m.totalHT * 100) / 100,
        totalTTC: Math.round(m.totalTTC * 100) / 100,
        count: m.count
      }))
    });

  } catch (error) {
    console.error('Financial analytics error:', error);
    res.status(500).json({ error: 'Erreur lors de la recuperation des donnees financieres' });
  }
});

module.exports = router;
