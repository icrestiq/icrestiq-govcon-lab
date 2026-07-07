// api/stripe/discounts.js
// Vercel serverless function — lets the admin panel create, list, and
// toggle real Stripe promotion codes. Gated to Supabase users whose
// profiles.role === 'admin'.

import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function requireAdmin(req) {
  const authHeader = req.headers.authorization || ''
  const token = authHeader.replace('Bearer ', '').trim()
  if (!token) return null

  const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token)
  if (userError || !user) return null

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profileError || profile?.role !== 'admin') return null
  return user
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') return res.status(200).end()

  const admin = await requireAdmin(req)
  if (!admin) {
    return res.status(403).json({ error: 'Admin access required' })
  }

  if (req.method === 'GET') {
    try {
      const promoCodes = await stripe.promotionCodes.list({
        limit: 50,
        expand: ['data.coupon'],
      })

      const codes = promoCodes.data.map(pc => ({
        id: pc.id,
        code: pc.code,
        active: pc.active,
        timesRedeemed: pc.times_redeemed,
        maxRedemptions: pc.max_redemptions,
        expiresAt: pc.expires_at,
        percentOff: pc.coupon?.percent_off ?? null,
        amountOff: pc.coupon?.amount_off ? pc.coupon.amount_off / 100 : null,
        duration: pc.coupon?.duration,
      }))

      codes.sort((a, b) => (b.expiresAt || 0) - (a.expiresAt || 0))

      return res.status(200).json({ codes })
    } catch (err) {
      console.error('List discounts error:', err)
      return res.status(500).json({ error: err.message })
    }
  }

  if (req.method === 'POST') {
    try {
      const {
        code,
        percentOff,
        amountOff,
        duration,
        durationInMonths,
        maxRedemptions,
        expiresAt,
      } = req.body

      if (!code || !code.trim()) {
        return res.status(400).json({ error: 'Missing discount code' })
      }
      if (!percentOff && !amountOff) {
        return res.status(400).json({ error: 'Set either a percent-off or a dollar-off amount' })
      }

      const couponConfig = {
        duration: duration || 'once',
        name: code.trim().toUpperCase(),
      }

      if (percentOff) {
        couponConfig.percent_off = Number(percentOff)
      } else if (amountOff) {
        couponConfig.amount_off = Math.round(Number(amountOff) * 100)
        couponConfig.currency = 'usd'
      }

      if (couponConfig.duration === 'repeating') {
        couponConfig.duration_in_months = Number(durationInMonths) || 3
      }

      const coupon = await stripe.coupons.create(couponConfig)

      const promoConfig = {
        coupon: coupon.id,
        code: code.trim().toUpperCase(),
      }
      if (maxRedemptions) promoConfig.max_redemptions = Number(maxRedemptions)
      if (expiresAt) promoConfig.expires_at = Math.floor(new Date(expiresAt).getTime() / 1000)

      const promotionCode = await stripe.promotionCodes.create(promoConfig)

      return res.status(200).json({
        id: promotionCode.id,
        code: promotionCode.code,
      })
    } catch (err) {
      console.error('Create discount error:', err)
      return res.status(500).json({ error: err.message })
    }
  }

  if (req.method === 'PATCH') {
    try {
      const { id, active } = req.body
      if (!id || typeof active !== 'boolean') {
        return res.status(400).json({ error: 'Missing id or active flag' })
      }
      const updated = await stripe.promotionCodes.update(id, { active })
      return res.status(200).json({ id: updated.id, active: updated.active })
    } catch (err) {
      console.error('Toggle discount error:', err)
      return res.status(500).json({ error: err.message })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
