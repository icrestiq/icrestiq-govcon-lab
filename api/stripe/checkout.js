// api/stripe/checkout.js
// Vercel serverless function — runs server-side, keeps secret key safe
// Stripe secret key NEVER touches the browser

import Stripe from 'stripe'
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

// Map product IDs to Stripe Price IDs + payment config
// Update these after creating products in your Stripe dashboard
const PRODUCT_MAP = {
  'hw-fasteners': {
    priceId: process.env.STRIPE_PRICE_HW_FASTENERS || 'price_REPLACE_hw_fasteners',
    name: 'Hardware & Fasteners Niche Playbook',
    mode: 'payment',
  },
  'jan-san': {
    priceId: process.env.STRIPE_PRICE_JAN_SAN || 'price_REPLACE_jan_san',
    name: 'Janitorial & Sanitation Playbook',
    mode: 'payment',
  },
  'safety-ppe': {
    priceId: process.env.STRIPE_PRICE_SAFETY_PPE || 'price_REPLACE_safety_ppe',
    name: 'Safety & PPE Niche Playbook',
    mode: 'payment',
  },
  'mro-industrial': {
    priceId: process.env.STRIPE_PRICE_MRO || 'price_REPLACE_mro_industrial',
    name: 'MRO & Industrial Parts Playbook',
    mode: 'payment',
  },
  'mil-spec-bible': {
    priceId: process.env.STRIPE_PRICE_MIL_SPEC || 'price_REPLACE_mil_spec_bible',
    name: 'MIL-SPEC Packaging Bible™',
    mode: 'payment',
  },
  'founding-member': {
    priceId: process.env.STRIPE_PRICE_FOUNDING || 'price_REPLACE_founding_member',
    name: 'Founding Member — Lifetime Access',
    mode: 'payment',
  },
  'lab-monthly': {
    priceId: process.env.STRIPE_PRICE_LAB_MONTHLY || 'price_REPLACE_lab_monthly',
    name: 'iCrestiQ GovCon Lab — $57/mo',
    mode: 'subscription',
  },
  'lab-pro-monthly': {
    priceId: process.env.STRIPE_PRICE_LAB_PRO || 'price_REPLACE_lab_pro_monthly',
    name: 'iCrestiQ GovCon Lab Pro — $107/mo',
    mode: 'subscription',
  },
}

export default async function handler(req, res) {  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const { productId, userId, userEmail, mode } = req.body

    if (!productId || !userId) {
      return res.status(400).json({ error: 'Missing productId or userId' })
    }

    const product = PRODUCT_MAP[productId]
    if (!product) {
      return res.status(404).json({ error: `Unknown product: ${productId}` })
    }

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://govconlab.com'

    // ── Payment methods ────────────────────────────────────
    // Klarna and Affirm enabled here alongside standard cards
    // These must also be enabled in your Stripe Dashboard → Settings → Payment Methods
    const paymentMethodTypes = product.mode === 'subscription'
      ? ['card']          // Klarna/Affirm not available for subscriptions
      : ['card', 'klarna', 'affirm']

    // ── Build session config ───────────────────────────────
    const sessionConfig = {
      mode: product.mode,
      payment_method_types: paymentMethodTypes,
      line_items: [{ price: product.priceId, quantity: 1 }],
      customer_email: userEmail || undefined,
      client_reference_id: userId,
      metadata: {
        userId,
        productId,
        productName: product.name,
      },
      success_url: `${baseUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}&product=${productId}`,
      cancel_url: `${baseUrl}/store`,
      // Collect billing address for tax purposes
      billing_address_collection: 'auto',
      // Allow promo codes
      allow_promotion_codes: true,
    }

    // Subscription-specific config
    if (product.mode === 'subscription') {
      sessionConfig.subscription_data = {
        metadata: { userId, productId },
        trial_period_days: 0,
      }
    }

    const session = await stripe.checkout.sessions.create(sessionConfig)

    return res.status(200).json({ sessionId: session.id, url: session.url })
  } catch (err) {
    console.error('Stripe checkout error:', err)
    return res.status(500).json({ error: err.message })
  }
}
