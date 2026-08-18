// api/stripe/refund-bid-request.js
// Called by the generate_suggested_bid Edge Function when generation
// fails after payment. Stripe operations stay on Vercel (where
// STRIPE_SECRET_KEY already lives, same as checkout.js/webhook.js)
// rather than adding a second copy of that secret to Supabase.

import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const secret = req.headers['x-webhook-secret']
  if (process.env.REPORT_WEBHOOK_SECRET && secret !== process.env.REPORT_WEBHOOK_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    const { bidRequestId } = req.body || {}
    if (!bidRequestId) return res.status(400).json({ error: 'Missing bidRequestId' })

    const { data: bidRequest, error: fetchError } = await supabase
      .from('bid_requests')
      .select('id, status, stripe_payment_intent_id')
      .eq('id', bidRequestId)
      .single()
    if (fetchError || !bidRequest) return res.status(404).json({ error: 'bid_requests row not found' })

    if (bidRequest.status === 'refunded') {
      return res.status(200).json({ refunded: true, alreadyRefunded: true })
    }
    if (!bidRequest.stripe_payment_intent_id) {
      return res.status(400).json({ error: 'No payment_intent on this bid_requests row — nothing to refund' })
    }

    await stripe.refunds.create({ payment_intent: bidRequest.stripe_payment_intent_id })

    const { error: updateError } = await supabase
      .from('bid_requests')
      .update({ status: 'refunded' })
      .eq('id', bidRequestId)
    if (updateError) throw updateError

    return res.status(200).json({ refunded: true })
  } catch (err) {
    console.error('Refund error:', err)
    return res.status(500).json({ error: err.message })
  }
}
