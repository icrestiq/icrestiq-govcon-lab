// api/stripe/webhook.js
// Receives events from Stripe after successful payment
// Updates Supabase: creates orders, grants membership access

import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

// Use service role key here (bypasses RLS) — server-side only, never exposed
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Maps each Stripe Price ID to the exact membership_tier value allowed
// by the database (Phase 1 migration created a strict enum: free,
// lab_member, lab_pro, founding_member). Reading the tier from the
// actual Stripe price ID — rather than guessing from a metadata slug —
// means this stays correct even if product IDs or slugs change later.
const PRICE_TO_TIER = {
  'price_1Tq8oWBhEghNkTanlBCEKH0E': 'lab_member',
  'price_1Tq8paBhEghNkTanEVCjaTex': 'lab_pro',
  'price_1Tq8qBBhEghNkTanqKQ4VJyj': 'founding_member',
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const sig = req.headers['stripe-signature']
  const rawBody = await getRawBody(req)

  let event
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    )
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message)
    return res.status(400).json({ error: `Webhook Error: ${err.message}` })
  }

  try {
    switch (event.type) {

      // — One-time payment completed ——————
      case 'checkout.session.completed': {
        const session = event.data.object
        if (session.payment_status !== 'paid') break

        const { userId, productId, productName } = session.metadata

        // Record the order
        await supabase.from('orders').insert({
          id: session.id,
          user_id: userId,
          product_id: productId,
          amount: session.amount_total / 100,
          status: 'paid',
          stripe_session_id: session.id,
          payment_method: session.payment_method_types?.[0] || 'card',
          created_at: new Date().toISOString(),
        })

        // Grant product access
        await supabase.from('user_purchases').upsert({
          user_id: userId,
          product_id: productId,
          purchased_at: new Date().toISOString(),
        })

        // If founding member purchase — upgrade to founding_member tier
        if (productId === 'founding-member') {
          await supabase
            .from('profiles')
            .update({
              role: 'founding',
              membership_tier: 'founding_member',
              tier_updated_at: new Date().toISOString(),
            })
            .eq('id', userId)
        }

        console.log(`Order recorded: ${productName} for user ${userId}`)
        break
      }

      // — Subscription activated ——————
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object
        const userId = subscription.metadata?.userId

        if (!userId) break

       const priceId = subscription.items.data[0]?.price?.id
        const tier = PRICE_TO_TIER[priceId] || 'lab_member'
        const isActive = subscription.status === 'active' || subscription.status === 'trialing'

        // Some Stripe API versions place current_period_end on the
        // subscription object directly; others place it per-item instead.
        // Check both, and never let a missing value crash the whole update.
        const periodEndUnix = subscription.current_period_end || subscription.items?.data?.[0]?.current_period_end
        const periodEndISO = periodEndUnix ? new Date(periodEndUnix * 1000).toISOString() : null

        await supabase.from('profiles').update({
          membership_tier: isActive ? tier : 'free',
          stripe_customer_id: subscription.customer,
          stripe_subscription_id: subscription.id,
          subscription_status: subscription.status,
          subscription_period_end: periodEndISO,
          tier_updated_at: new Date().toISOString(),
        }).eq('id', userId)

        console.log(`Subscription ${subscription.status} for user ${userId} — tier: ${tier}`)
        break
      }

      // — Subscription cancelled / expired ——————
      case 'customer.subscription.deleted': {
        const subscription = event.data.object
        const userId = subscription.metadata?.userId
        if (!userId) break

        await supabase.from('profiles').update({
          membership_tier: 'free',
          subscription_status: 'cancelled',
          stripe_subscription_id: null,
          tier_updated_at: new Date().toISOString(),
        }).eq('id', userId)

        console.log(`Subscription cancelled for user ${userId}`)
        break
      }

      // — Payment failed ——————
      case 'invoice.payment_failed': {
        const invoice = event.data.object
        const customerId = invoice.customer

        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('stripe_customer_id', customerId)
          .single()

        if (profile) {
          await supabase.from('profiles').update({
            subscription_status: 'past_due',
          }).eq('id', profile.id)
        }

        console.log(`Payment failed for customer ${customerId}`)
        break
      }

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    return res.status(200).json({ received: true })
  } catch (err) {
    console.error('Webhook handler error:', err)
    return res.status(500).json({ error: 'Webhook processing failed' })
  }
}

// Vercel requires raw body for Stripe signature verification
async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', chunk => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

// CRITICAL: Tell Vercel NOT to parse the body
// Stripe needs the raw bytes to verify the webhook signature
export const config = { api: { bodyParser: false } }
