// api/stripe/checkout.js
// Vercel serverless function — runs server-side, keeps secret key safe

import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const { productId, userId, userEmail } = req.body

    if (!productId || !userId) {
      return res.status(400).json({ error: 'Missing productId or userId' })
    }

    // Look up the product in Supabase by its UUID
    const { data: product, error } = await supabase
      .from('products')
      .select('id, title, price, stripe_price_id, is_subscription')
      .eq('id', productId)
      .single()

    if (error || !product) {
      return res.status(404).json({ error: `Product not found: ${productId}` })
    }

    if (!product.stripe_price_id) {
      return res.status(400).json({ error: `No Stripe price configured for: ${product.title}` })
    }

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://govconlab.com'

    // Determine mode from the product's is_subscription flag (Phase 1 —
    // replaces the old guess-from-price-ID-text logic, which never
    // actually matched real Stripe price IDs like price_1Tq8...)
    const mode = product.is_subscription ? 'subscription' : 'payment'

    const paymentMethodTypes = mode === 'subscription'
      ? ['card']
      : ['card', 'klarna', 'affirm']

    const sessionConfig = {
      mode,
      payment_method_types: paymentMethodTypes,
      line_items: [{ price: product.stripe_price_id, quantity: 1 }],
      customer_email: userEmail || undefined,
      client_reference_id: userId,
      metadata: {
        userId,
        productId,
        productName: product.title,
      },
      success_url: `${baseUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}&product=${productId}`,
      cancel_url: `${baseUrl}/store`,
      billing_address_collection: 'auto',
      allow_promotion_codes: true,
    }

   if (mode === 'subscription') {
      sessionConfig.subscription_data = {
        metadata: { userId, productId },
      }
    }

    const session = await stripe.checkout.sessions.create(sessionConfig)

    return res.status(200).json({ sessionId: session.id, url: session.url })
  } catch (err) {
    console.error('Stripe checkout error:', err)
    return res.status(500).json({ error: err.message })
  }
}
