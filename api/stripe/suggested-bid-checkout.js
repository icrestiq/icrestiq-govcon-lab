// api/stripe/suggested-bid-checkout.js
// Creates a one-time Stripe Checkout Session for the per-use "Suggested
// Bid" feature. Price is looked up server-side from the caller's actual
// membership_tier — never trust a client-supplied amount for a real charge.

import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Search cap is tier-differentiated too — Founding's lifetime tier buys
// deeper supplier/shipping research, not just a lower price.
const TIER_PRICING = {
  member: { amountCents: 200, searchCap: 5 },
  // Legacy tier, no longer sold (see TIER_LABELS in lib/tier.js) — any
  // account still carrying it is grandfathered at Lab Member pricing
  // rather than losing access outright.
  pro: { amountCents: 200, searchCap: 5 },
  founding: { amountCents: 100, searchCap: 8 },
  // Not a real membership tier — role='admin' testing this feature on
  // their own account. Free, same search depth as Founding, and skips
  // Stripe entirely below (see isAdmin branch) so testing doesn't require
  // charging a real card for nothing.
  admin: { amountCents: 0, searchCap: 8 },
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const { opportunityId, userId } = req.body
    if (!opportunityId || !userId) {
      return res.status(400).json({ error: 'Missing opportunityId or userId' })
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, email, membership_tier, stripe_customer_id, role')
      .eq('id', userId)
      .single()
    if (profileError || !profile) {
      return res.status(404).json({ error: 'Profile not found' })
    }

    const isAdmin = profile.role === 'admin'
    const tierKey = isAdmin ? 'admin' : profile.membership_tier
    const pricing = TIER_PRICING[tierKey]
    if (!pricing) {
      return res.status(403).json({ error: 'Suggested Bid is available to Lab Member and Founding members only' })
    }

    const { data: opportunity, error: oppError } = await supabase
      .from('opportunities')
      .select('id, title')
      .eq('id', opportunityId)
      .single()
    if (oppError || !opportunity) {
      return res.status(404).json({ error: 'Opportunity not found' })
    }

    // The unique (profile_id, opportunity_id) constraint on bid_requests
    // means a straight insert would fail on a retry. Reuse the row if the
    // prior attempt failed/was refunded, or if checkout was started but
    // never completed ('pending' — e.g. the member closed the Stripe tab
    // without paying, which has no webhook to ever move it along
    // otherwise). Block only when a request is genuinely already paid,
    // in progress, or completed for this opportunity.
    const { data: existing } = await supabase
      .from('bid_requests')
      .select('id, status')
      .eq('profile_id', userId)
      .eq('opportunity_id', opportunityId)
      .maybeSingle()

    let bidRequestId
    if (existing) {
      if (!['failed', 'refunded', 'pending'].includes(existing.status)) {
        return res.status(409).json({ error: `A Suggested Bid request already exists for this opportunity (status: ${existing.status})` })
      }
      const { error: resetError } = await supabase
        .from('bid_requests')
        .update({
          status: 'pending',
          membership_tier_at_purchase: tierKey,
          amount_charged_cents: pricing.amountCents,
          search_cap_used: pricing.searchCap,
          error_message: null,
          suggested_bid: null,
          supplier_research: null,
          completed_at: null,
        })
        .eq('id', existing.id)
      if (resetError) throw resetError
      bidRequestId = existing.id
    } else {
      const { data: created, error: insertError } = await supabase
        .from('bid_requests')
        .insert({
          profile_id: userId,
          opportunity_id: opportunityId,
          membership_tier_at_purchase: tierKey,
          amount_charged_cents: pricing.amountCents,
          search_cap_used: pricing.searchCap,
        })
        .select('id')
        .single()
      if (insertError) throw insertError
      bidRequestId = created.id
    }

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://govconlab.com'

    // Admin testing this feature on their own account — skip Stripe
    // entirely (nothing to charge) and hand straight off to generation,
    // the same server-to-server call the webhook makes after a real
    // payment. The frontend doesn't need to know the difference: it just
    // redirects to whatever `url` comes back and polls bid_requests.
    if (isAdmin) {
      const { error: markPaidError } = await supabase
        .from('bid_requests')
        .update({ status: 'paid' })
        .eq('id', bidRequestId)
      if (markPaidError) throw markPaidError

      try {
        await fetch(`${process.env.SUPABASE_FUNCTIONS_URL || 'https://zohrpargudmogfywciik.supabase.co/functions/v1'}/generate_suggested_bid`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bidRequestId }),
        })
      } catch (triggerErr) {
        console.error('Failed to trigger generate_suggested_bid (admin path):', triggerErr.message, { bidRequestId })
      }

      return res.status(200).json({ url: `${baseUrl}/opportunities?bid_request=${bidRequestId}` })
    }

    // Dynamic per-tier price via price_data — no pre-created Stripe Price
    // object needed, unlike the catalog products in api/stripe/checkout.js.
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      customer: profile.stripe_customer_id || undefined,
      customer_email: profile.stripe_customer_id ? undefined : profile.email,
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: { name: `Suggested Bid — ${opportunity.title}`.slice(0, 250) },
          unit_amount: pricing.amountCents,
        },
        quantity: 1,
      }],
      client_reference_id: userId,
      metadata: {
        feature: 'suggested_bid',
        bidRequestId,
        userId,
        opportunityId,
      },
      success_url: `${baseUrl}/opportunities?bid_request=${bidRequestId}`,
      cancel_url: `${baseUrl}/opportunities`,
    })

    const { error: updateSessionError } = await supabase
      .from('bid_requests')
      .update({ stripe_checkout_session_id: session.id })
      .eq('id', bidRequestId)
    if (updateSessionError) {
      console.error('Failed to record session id on bid_request:', updateSessionError)
    }

    return res.status(200).json({ url: session.url })
  } catch (err) {
    console.error('Suggested Bid checkout error:', err)
    return res.status(500).json({ error: err.message })
  }
}
