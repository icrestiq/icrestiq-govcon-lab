// api/launch/intake.js
// Public, no-login endpoint for the intake form shown on the /launch
// thank-you page after a self-serve tier purchase. Emails the answers to
// Keith so he can start the manual research work.
//
// Anyone can find this URL, so before sending any email we re-verify the
// sessionId directly against Stripe (real, paid, and actually a
// launch_package purchase) rather than trusting the client — that's what
// keeps this from being an open spam-my-inbox endpoint, without needing a
// captcha or a database record.

import Stripe from 'stripe'
import nodemailer from 'nodemailer'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
})

const TIER_LABELS = {
  'quick-scan': 'Quick Scan ($97)',
  'bid-match-report': 'Bid-Match Report ($197)',
  'bid-match-strategy': 'Bid-Match Report + Strategy Call ($397)',
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const { sessionId, answers } = req.body || {}
    if (!sessionId || !answers) {
      return res.status(400).json({ error: 'Missing sessionId or answers' })
    }

    const required = ['sells', 'location', 'naics', 'certifications', 'samGov']
    for (const field of required) {
      if (!answers[field] || !String(answers[field]).trim()) {
        return res.status(400).json({ error: `Missing required field: ${field}` })
      }
    }

    let session
    try {
      session = await stripe.checkout.sessions.retrieve(sessionId)
    } catch (stripeErr) {
      return res.status(400).json({ error: 'Could not verify that order. Please email hello@icrestiq.com instead.' })
    }

    if (session.payment_status !== 'paid' || session.metadata?.feature !== 'launch_package') {
      return res.status(403).json({ error: 'This order could not be verified as paid.' })
    }

    const tier = session.metadata?.tier
    const tierLabel = TIER_LABELS[tier] || tier || 'Unknown tier'

    await transporter.sendMail({
      from: process.env.GMAIL_USER,
      to: process.env.ADMIN_ALERT_EMAIL || process.env.GMAIL_USER,
      subject: `Intake form — ${tierLabel} — ${session.customer_details?.email || 'unknown email'}`,
      text: [
        `New intake form submitted on the /launch thank-you page.`,
        ``,
        `Tier: ${tierLabel}`,
        `Customer email: ${session.customer_details?.email || 'unknown'}`,
        `Customer name: ${session.customer_details?.name || 'unknown'}`,
        `Stripe session: ${session.id}`,
        ``,
        `1) What does your business sell?`,
        answers.sells,
        ``,
        `2) Where are you located, and where can you perform work?`,
        answers.location,
        ``,
        `3) NAICS code(s)?`,
        answers.naics,
        ``,
        `4) Set-aside certifications?`,
        answers.certifications,
        ``,
        `5) Registered in SAM.gov?`,
        answers.samGov,
        ``,
        `6) Anything to exclude?`,
        answers.exclusions?.trim() || '(none given)',
      ].join('\n'),
    })

    return res.status(200).json({ sent: true })
  } catch (err) {
    console.error('Launch intake error:', err)
    return res.status(500).json({ error: 'Something went wrong submitting your answers. Please email hello@icrestiq.com instead.' })
  }
}
