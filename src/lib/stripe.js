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
export const STRIPE_PRICES = {
  // One-time products
  'hw-fasteners':    { priceId: 'price_1ToUtRBhEghNkTanlZLz2dpe', mode: 'payment' },
  'jan-san':         { priceId: 'price_1ToUx6BhEghNkTanhrifbRDK', mode: 'payment' },
  'safety-ppe':      { priceId: 'price_1ToUxdBhEghNkTantcq8Cfza', mode: 'payment' },
  'mro-industrial':  { priceId: 'price_1ToUyQBhEghNkTan25MWAqlt', mode: 'payment' },
  'mil-spec-bible':  { priceId: 'price_1ToUzfBhEghNkTanQUmlZOui', mode: 'payment' },
  'founding-member': { priceId: 'price_1ToV0DBhEghNkTanDhn3HKDS', mode: 'payment' },

  // Subscriptions
  'lab-monthly':     { priceId: 'price_1ToV0dBhEghNkTanLss0PFNL', mode: 'subscription' },
  'lab-pro-monthly': { priceId: 'price_1ToV1PBhEghNkTanb5bdAIMX', mode: 'subscription' },
}

// ── Checkout helper ──────────────────────────────────────────
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