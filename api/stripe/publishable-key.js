// api/stripe/publishable-key.js
// A Stripe publishable key is not a secret — it's meant to ship to the
// browser (Stripe's own docs put it directly in client-side code). The SPA
// reads it at build time via import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY
// (see src/lib/stripe.js), but /launch is a static file outside the Vite
// build, so it has no way to read that env var directly — this just hands
// it the same key over a tiny public endpoint instead of duplicating it as
// a hardcoded literal in the static page (which would go stale on rotation).

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const key = process.env.VITE_STRIPE_PUBLISHABLE_KEY
  if (!key) return res.status(500).json({ error: 'Publishable key not configured' })

  return res.status(200).json({ key })
}
