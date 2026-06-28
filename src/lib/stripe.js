import { loadStripe } from '@stripe/stripe-js'

// Stripe publishable key - safe to expose on frontend
let stripePromise = null

export function getStripe() {
  if (!stripePromise) {
    stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY)
  }
  return stripePromise
}

// ── Price IDs ────────────────────────────────────────────────
// Create these in your Stripe dashboard → Products
// Then paste the price IDs here
export const STRIPE_PRICES = {
  // One-time products
  'hw-fasteners':    { priceId: 'price_REPLACE_hw_fasteners',   mode: 'payment' },
  'jan-san':         { priceId: 'price_REPLACE_jan_san',         mode: 'payment' },
  'safety-ppe':      { priceId: 'price_REPLACE_safety_ppe',      mode: 'payment' },
  'mro-industrial':  { priceId: 'price_REPLACE_mro_industrial',  mode: 'payment' },
  'mil-spec-bible':  { priceId: 'price_REPLACE_mil_spec_bible',  mode: 'payment' },
  'founding-member': { priceId: 'price_REPLACE_founding_member', mode: 'payment' },

  // Subscriptions
  'lab-monthly':     { priceId: 'price_REPLACE_lab_monthly',     mode: 'subscription' },
  'lab-pro-monthly': { priceId: 'price_REPLACE_lab_pro_monthly', mode: 'subscription' },
}

// ── Checkout helper ──────────────────────────────────────────
// Calls our serverless API route to create a Stripe Checkout session
export async function createCheckoutSession({ productId, userId, userEmail, mode }) {
  const res = await fetch('/api/stripe/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ productId, userId, userEmail, mode }),
  })

  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error || 'Checkout failed')
  }

  return res.json() // { sessionId, url }
}

// ── Subscription portal helper ────────────────────────────────
// Opens Stripe's hosted billing portal so members can manage/cancel
export async function createPortalSession({ userId }) {
  const res = await fetch('/api/stripe/portal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
  })

  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error || 'Portal session failed')
  }

  return res.json() // { url }
}
