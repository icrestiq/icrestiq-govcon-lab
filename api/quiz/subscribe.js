// api/quiz/subscribe.js
// Subscribes a /go quiz taker through the SAME double opt-in pipeline as
// the homepage digest form (api/digest/subscribe.js -> api/digest/confirm.js):
// insert a pending row in digest_subscribers, email a confirm link, and let
// api/digest/confirm.js send the "5 free GovCon tools" welcome email (Gmail
// SMTP) and apply ConvertKit tags once the visitor actually confirms.
//
// This replaces an earlier version that called ConvertKit directly and
// never touched digest_subscribers — which meant quiz takers got Kit's own
// native "confirm your subscription" email (a form-level Kit setting) but
// never the 5 tools, since that delivery has only ever been driven by this
// app's own Supabase + Gmail flow, not a Kit automation.
//
// BOT PROTECTION — same as before (honeypot + fill-time + Turnstile). Not
// porting api/digest/subscribe.js's Gmail-dot-spam/MX-record checks here;
// add them later if the quiz sees the same bot volume that form did.

import { createClient } from '@supabase/supabase-js'
import nodemailer from 'nodemailer'
import crypto from 'crypto'
import { SITE_URL } from '../_lib/site-url.js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
})

const TURNSTILE_SECRET_KEY = process.env.TURNSTILE_SECRET_KEY
const MIN_FILL_TIME_MS = 1500

function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

async function verifyTurnstile(token, remoteIp) {
  if (!token) return false
  const params = new URLSearchParams()
  params.append('secret', TURNSTILE_SECRET_KEY)
  params.append('response', token)
  if (remoteIp) params.append('remoteip', remoteIp)

  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: params,
    })
    const data = await res.json()
    return data.success === true
  } catch (err) {
    console.error('Turnstile verification error:', err)
    return false
  }
}

function confirmEmailCopy(confirmUrl) {
  return {
    subject: 'Confirm your email to get your 5 free GovCon tools',
    text: [
      `Thanks for taking the "Is Government Contracting Right For You?" quiz.`,
      ``,
      `One thing first: we only send your 5 free GovCon tools — and add you to Monday's digest of real federal solicitations — once you've confirmed this email address. Click below to verify.`,
      ``,
      confirmUrl,
      ``,
      `Didn't take this quiz? Ignore this email and you won't be added — nothing else happens.`,
    ].join('\n'),
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const email = (req.body?.email || '').trim().toLowerCase()
    const firstName = (req.body?.firstName || '').trim()
    const result = typeof req.body?.result === 'string' ? req.body.result : null
    const company = req.body?.company
    const renderedAt = req.body?.renderedAt
    const turnstileToken = req.body?.turnstileToken

    // --- Bot check 1: honeypot -------------------------------------
    if ((company || '').trim()) {
      return res.status(200).json({ status: 'check-email' })
    }

    // --- Bot check 2: minimum fill time ------------------------------
    const renderTime = Number(renderedAt)
    if (renderTime && Date.now() - renderTime < MIN_FILL_TIME_MS) {
      return res.status(200).json({ status: 'check-email' })
    }

    // --- Bot check 3: Turnstile challenge -----------------------------
    if (TURNSTILE_SECRET_KEY) {
      const remoteIp = (req.headers['x-forwarded-for'] || '').split(',')[0].trim()
      const turnstileOk = await verifyTurnstile(turnstileToken, remoteIp)
      if (!turnstileOk) {
        return res.status(400).json({ error: 'Please complete the verification challenge and try again.' })
      }
    } else {
      console.warn('TURNSTILE_SECRET_KEY not configured — skipping Turnstile verification for quiz subscribe')
    }

    if (!firstName) {
      return res.status(400).json({ error: 'First name is required' })
    }
    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'Enter a valid email address.' })
    }

    const { data: existing, error: lookupError } = await supabase
      .from('digest_subscribers')
      .select('id, confirmed')
      .eq('email', email)
      .maybeSingle()

    if (lookupError) throw lookupError

    if (existing?.confirmed) {
      return res.status(200).json({ status: 'already-confirmed' })
    }

    const token = crypto.randomBytes(24).toString('hex')

    if (existing) {
      const { error } = await supabase
        .from('digest_subscribers')
        .update({ confirm_token: token, source: 'go-quiz', first_name: firstName, quiz_result: result })
        .eq('id', existing.id)
      if (error) throw error
    } else {
      const { error } = await supabase
        .from('digest_subscribers')
        .insert({ email, source: 'go-quiz', confirmed: false, confirm_token: token, first_name: firstName, quiz_result: result })
      if (error) throw error
    }

    const confirmUrl = `${SITE_URL}/api/digest/confirm?token=${token}`
    const copy = confirmEmailCopy(confirmUrl)

    if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
      await transporter.sendMail({
        from: process.env.GMAIL_USER,
        to: email,
        subject: copy.subject,
        text: copy.text,
      })
    } else {
      console.warn('Gmail SMTP not configured — quiz confirmation email not sent')
    }

    return res.status(200).json({ status: 'check-email' })
  } catch (err) {
    console.error('Quiz subscribe error:', err)
    return res.status(500).json({ error: 'Something went wrong. Please try again.' })
  }
}
