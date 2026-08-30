// api/stripe/portal.js
// Opens Stripe's hosted billing portal
// Members can update payment method, view invoices, cancel subscription

import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { requireAuthenticatedUser } from '../_lib/auth.js'
import { createBillingPortalForUser } from '../_lib/stripe-portal.js'

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

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://govconlab.com'
    const session = await createBillingPortalForUser({
      supabaseAdmin: supabase,
      stripeClient: stripe,
      userId: user.id,
      returnUrl: `${baseUrl}/dashboard`,
    })

    if (!session) {
      return res.status(404).json({ error: 'No active subscription found for this user.' })
    }

    return res.status(200).json({ url: session.url })
  } catch (err) {
    console.error('Portal session error:', err)
    return res.status(500).json({ error: err.message })
  }
}
