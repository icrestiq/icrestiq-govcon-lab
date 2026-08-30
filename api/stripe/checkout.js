// api/stripe/checkout.js
// Vercel serverless function — runs server-side, keeps secret key safe

import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { requireAuthenticatedUser } from '../_lib/auth.js'
import { buildCheckoutSessionConfig } from '../_lib/stripe-checkout.js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const user = await requireAuthenticatedUser(req, supabase)
    if (!user) {
      return res.status(401).json({ error: 'Authentication required' })
    }

    const { productId } = req.body || {}

    if (!productId) {
      return res.status(400).json({ error: 'Missing productId' })
    }

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
    const sessionConfig = buildCheckoutSessionConfig({ product, user, baseUrl })

    const session = await stripe.checkout.sessions.create(sessionConfig)

    return res.status(200).json({ sessionId: session.id, url: session.url })
  } catch (err) {
    console.error('Stripe checkout error:', err)
    return res.status(500).json({ error: err.message })
  }
}
