const express = require('express');
const { protect } = require('../middleware/auth');
const { stripe, PRODUCTS } = require('../config/stripe');
const Subscription = require('../models/Subscription');

const router = express.Router();

// @route   GET /api/stripe/products
// @desc    Get available products/plans
// @access  Public
router.get('/products', (req, res) => {
  res.json({
    success: true,
    products: Object.values(PRODUCTS)
  });
});

// @route   POST /api/stripe/create-checkout
// @desc    Create Stripe checkout session
// @access  Private
router.post('/create-checkout', protect, async (req, res) => {
  try {
    const { planId } = req.body;

    const product = PRODUCTS[planId];
    if (!product || !product.priceId) {
      return res.status(400).json({ error: 'Invalid plan selected' });
    }

    // Get or create customer
    let subscription = await Subscription.findOne({ userId: req.user._id });
    let customerId = subscription?.stripeCustomerId;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: req.user.email,
        metadata: { userId: req.user._id.toString() }
      });
      customerId = customer.id;

      if (subscription) {
        subscription.stripeCustomerId = customerId;
        await subscription.save();
      }
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      line_items: [{
        price: product.priceId,
        quantity: 1
      }],
      mode: 'subscription',
      success_url: `${process.env.CLIENT_URL}/dashboard?success=true`,
      cancel_url: `${process.env.CLIENT_URL}/pricing?canceled=true`,
      metadata: {
        userId: req.user._id.toString(),
        planId: product.id
      }
    });

    res.json({
      success: true,
      url: session.url
    });

  } catch (error) {
    console.error('Checkout error:', error);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

// @route   POST /api/stripe/create-portal
// @desc    Create Stripe customer portal session
// @access  Private
router.post('/create-portal', protect, async (req, res) => {
  try {
    const subscription = await Subscription.findOne({ userId: req.user._id });

    if (!subscription?.stripeCustomerId) {
      return res.status(400).json({ error: 'No billing account found' });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: subscription.stripeCustomerId,
      return_url: `${process.env.CLIENT_URL}/dashboard`
    });

    res.json({
      success: true,
      url: session.url
    });

  } catch (error) {
    console.error('Portal error:', error);
    res.status(500).json({ error: 'Failed to create portal session' });
  }
});

// @route   POST /api/stripe/webhook
// @desc    Handle Stripe webhooks
// @access  Public (verified by signature)
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const signature = req.headers['stripe-signature'];

  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (error) {
    console.error('Webhook signature verification failed:', error.message);
    return res.status(400).send(`Webhook Error: ${error.message}`);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const userId = session.metadata?.userId;
        const planId = session.metadata?.planId;

        if (userId && planId) {
          const product = PRODUCTS[planId];
          await Subscription.findOneAndUpdate(
            { userId },
            {
              plan: planId,
              status: 'active',
              stripeCustomerId: session.customer,
              stripeSubscriptionId: session.subscription,
              stripePriceId: product?.priceId,
              conversionsLimit: product?.conversionsPerMonth || 10,
              conversionsUsed: 0,
              updatedAt: new Date()
            },
            { upsert: true }
          );
          console.log(`[Webhook] Subscription activated for user ${userId}: ${planId}`);
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        await Subscription.findOneAndUpdate(
          { stripeSubscriptionId: subscription.id },
          {
            status: subscription.status,
            currentPeriodStart: new Date(subscription.current_period_start * 1000),
            currentPeriodEnd: new Date(subscription.current_period_end * 1000),
            cancelAtPeriodEnd: subscription.cancel_at_period_end,
            updatedAt: new Date()
          }
        );
        console.log(`[Webhook] Subscription updated: ${subscription.id}`);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        await Subscription.findOneAndUpdate(
          { stripeSubscriptionId: subscription.id },
          {
            plan: 'free',
            status: 'canceled',
            stripeSubscriptionId: null,
            stripePriceId: null,
            conversionsLimit: 10,
            updatedAt: new Date()
          }
        );
        console.log(`[Webhook] Subscription canceled: ${subscription.id}`);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        if (invoice.subscription) {
          await Subscription.findOneAndUpdate(
            { stripeSubscriptionId: invoice.subscription },
            { status: 'past_due', updatedAt: new Date() }
          );
          console.log(`[Webhook] Payment failed for subscription: ${invoice.subscription}`);
        }
        break;
      }
    }

    res.json({ received: true });

  } catch (error) {
    console.error('Webhook handler error:', error);
    res.status(500).json({ error: 'Webhook handler failed' });
  }
});

module.exports = router;
