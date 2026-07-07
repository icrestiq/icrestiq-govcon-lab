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

// Maps each Stripe Price ID to the membership_tier value this app's
// existing database constraint actually allows: free, member, pro,
// founding, admin.
const PRICE_TO_TIER = {
  'price_1Tq8oWBhEghNkTanlBCEKH0E': 'member',
  'price_1Tq8paBhEghNkTanEVCjaTex': 'pro',
  'price_1Tq8qBBhEghNkTanqKQ4VJyj': 'founding',
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

        // NOTE: orders.id is a UUID primary key with its own default
        // generator — do NOT pass Stripe's session.id (e.g. "cs_live_...")
        // into it, that's what stripe_session_id is for.
        const { error: orderError } = await supabase.from('orders').insert({
          user_id: userId,
          product_id: productId,
          amount: session.amount_total / 100,
          status: 'paid',
          stripe_session_id: session.id,
          payment_method: session.payment_method_types?.[0] || 'card',
          created_at: new Date().toISOString(),
        })
        if (orderError) {
          console.error('Failed to insert order:', orderError.message, { userId, productId, sessionId: session.id })
          throw new Error(`Order insert failed: ${orderError.message}`)
        }

        const { error: purchaseError } = await supabase.from('user_purchases').upsert({
          user_id: userId,
          product_id: productId,
          purchased_at: new Date().toISOString(),
        })
        if (purchaseError) {
          console.error('Failed to record purchase:', purchaseError.message, { userId, productId })
          throw new Error(`Purchase upsert failed: ${purchaseError.message}`)
        }

        if (productId === 'founding-member') {
          const { error: tierError } = await supabase
            .from('profiles')
            .update({
              role: 'founding',
              membership_tier: 'founding',
            })
            .eq('id', userId)
          if (tierError) {
            console.error('Failed to set founding tier:', tierError.message, { userId })
            throw new Error(`Founding tier update failed: ${tierError.message}`)
          }
        }

        console.log(`Order recorded: ${productName} for user ${userId}`)
        break
      }

      // — Subscription activated ——————
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object
        const userId = subscription.metadata?.userId

        if (!userId) {
          console.warn(`Subscription ${subscription.id} has no userId in metadata — skipping tier update`)
          break
        }

        const priceId = subscription.items.data[0]?.price?.id
        const tier = PRICE_TO_TIER[priceId] || 'member'
        const isActive = subscription.status === 'active' || subscription.status === 'trialing'

        const periodEndUnix = subscription.current_period_end || subscription.items?.data?.[0]?.current_period_end
        const periodEndISO = periodEndUnix ? new Date(periodEndUnix * 1000).toISOString() : null

        const { error: subError } = await supabase.from('profiles').update({
          membership_tier: isActive ? tier : 'free',
          stripe_customer_id: subscription.customer,
          stripe_subscription_id: subscription.id,
          subscription_status: subscription.status,
          subscription_period_end: periodEndISO,
        }).eq('id', userId)

        if (subError) {
          console.error('Failed to update subscription tier:', subError.message, { userId, tier, status: subscription.status })
          throw new Error(`Subscription tier update failed: ${subError.message}`)
        }

        console.log(`Subscription ${subscription.status} for user ${userId} — tier: ${tier}`)
        break
      }

      // — Subscription cancelled / expired ——————
      case 'customer.subscription.deleted': {
        const subscription = event.data.object
        const userId = subscription.metadata?.userId
        if (!userId) {
          console.warn(`Cancelled subscription ${subscription.id} has no userId in metadata — skipping tier reset`)
          break
        }

        const { error: cancelError } = await supabase.from('profiles').update({
          membership_tier: 'free',
          subscription_status: 'cancelled',
          stripe_subscription_id: null,
        }).eq('id', userId)

        if (cancelError) {
          console.error('Failed to reset tier on cancellation:', cancelError.message, { userId })
          throw new Error(`Cancellation tier reset failed: ${cancelError.message}`)
        }

        console.log(`Subscription cancelled for user ${userId}`)
        break
      }

      // — Payment failed ——————
      case 'invoice.payment_failed': {
        const invoice = event.data.object
        const customerId = invoice.customer

        const { data: profile, error: lookupError } = await supabase
          .from('profiles')
          .select('id')
          .eq('stripe_customer_id', customerId)
          .single()

        if (lookupError) {
          console.error('Failed to look up profile for failed payment:', lookupError.message, { customerId })
          break
        }

        if (profile) {
          const { error: statusError } = await supabase.from('profiles').update({
            subscription_status: 'past_due',
          }).eq('id', profile.id)
          if (statusError) {
            console.error('Failed to mark subscription past_due:', statusError.message, { userId: profile.id })
          }
        }

        console.log(`Payment failed for customer ${customerId}`)
        break
      }

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    return res.status(200).json({ received: true })
  } catch (err) {
    console.error('Webhook handler error:', err.message)
    // Return 500 so Stripe automatically retries this event —
    // silently returning 200 on a failed DB write hides real problems.
    return res.status(500).json({ error: 'Webhook processing failed', message: err.message })
  }
}

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', chunk => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

export const config = { api: { bodyParser: false } }
