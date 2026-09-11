// api/stripe/launch-checkout.js
// Public, no-login checkout for the self-serve tiers sold on the /launch
// landing page (Quick Scan, Bid-Match Report, Bid-Match + Strategy Call).
// Unlike api/stripe/checkout.js, this never requires a Supabase account —
// /launch is a static page outside the SPA with no auth of its own.
//
// Uses Embedded Checkout (ui_mode: 'embedded') rather than the classic
// hosted redirect, so the payment form mounts directly on /launch instead
// of sending the buyer to checkout.stripe.com — returns a client_secret for
// the page to mount with Stripe.js instead of a url to redirect to. Stripe
// still fully hosts and collects the card data inside its own iframe;
// nothing payment-related ever touches our own code or servers.
// Prices are a fixed server-side map (like suggested-bid-checkout.js's
// TIER_PRICING) — never trust a client-supplied amount for a real charge.
// The flagship $1,497 GovCon Launch Package is intentionally NOT sold here:
// it stays behind the free fit call (Calendly) so Keith can screen fit
// before charging that much.

import Stripe from 'stripe'
import { SITE_URL } from '../_lib/site-url.js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

const TIERS = {
  'quick-scan': { name: 'GovCon Quick Scan', amountCents: 9700 },
  'bid-match-report': { name: 'Bid-Match Report', amountCents: 19700 },
  'bid-match-strategy': { name: 'Bid-Match Report + Strategy Call', amountCents: 39700 },
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const { tier } = req.body || {}
    const pricing = TIERS[tier]
    if (!pricing) {
      return res.status(400).json({ error: 'Unknown tier' })
    }

    const session = await stripe.checkout.sessions.create({
      ui_mode: 'embedded',
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: { name: pricing.name },
          unit_amount: pricing.amountCents,
        },
        quantity: 1,
      }],
      metadata: { feature: 'launch_package', tier },
      // Embedded Checkout takes a single return_url instead of separate
      // success/cancel URLs — Stripe redirects the whole page here itself
      // once payment completes (this isn't reachable until then).
      return_url: `${SITE_URL}/launch/thank-you?session_id={CHECKOUT_SESSION_ID}&tier=${tier}`,
      billing_address_collection: 'auto',
    })

    return res.status(200).json({ clientSecret: session.client_secret })
  } catch (err) {
    console.error('Launch checkout error:', err)
    return res.status(500).json({ error: err.message })
  }
}
