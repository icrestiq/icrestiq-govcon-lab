// api/quiz/subscribe.js
// Subscribes a /go quiz taker to ConvertKit via the shared helper — same
// CONVERTKIT_API_KEY/CONVERTKIT_FORM_ID already configured in Vercel and
// already used by api/convertkit/subscribe.js (member signup) and
// api/digest/confirm.js (digest confirmation). No key or numeric tag ID
// is ever sent to the browser; the quiz's client-side JS only talks to
// this endpoint, never to ConvertKit directly.
//
// Doesn't require firstName (unlike api/convertkit/subscribe.js) — the
// quiz only collects an email, matching what was actually asked for.
//
// BOT PROTECTION — same pattern as api/digest/subscribe.js, since this
// endpoint has the same shape of exposure (a public POST target, visible
// in this page's own unminified inline JS, that a bot could hit directly
// without ever touching the quiz UI):
//   1. Honeypot field (`company`) — silent fake-success on any value.
//   2. Minimum fill time (`renderedAt`) — silent fake-success if the quiz
//      + email step somehow completed in under MIN_FILL_TIME_MS.
//   3. Cloudflare Turnstile (`turnstileToken`) — the real challenge; a
//      missing/failed token is a genuine error so the widget can prompt a
//      retry, not a silent fake-success.

import { subscribeToConvertKit } from '../_lib/convertkit.js'

const TURNSTILE_SECRET_KEY = process.env.TURNSTILE_SECRET_KEY
const MIN_FILL_TIME_MS = 1500

// Same site key already live on Login/Register/ForgotPassword and the
// original /go digest form — this is just the server-side half of that
// same widget, reused here.
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

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const { email, firstName, result, company, renderedAt, turnstileToken } = req.body

    // --- Bot check 1: honeypot -------------------------------------
    // Real visitors never populate this field. Silent fake-success so a
    // bot doesn't learn to look for and skip this specific field.
    if ((company || '').trim()) {
      return res.status(200).json({ message: 'Subscribed' })
    }

    // --- Bot check 2: minimum fill time ------------------------------
    const renderTime = Number(renderedAt)
    if (renderTime && Date.now() - renderTime < MIN_FILL_TIME_MS) {
      return res.status(200).json({ message: 'Subscribed' })
    }

    // --- Bot check 3: Turnstile challenge -----------------------------
    // A real error, not a silent fake-success, so the widget can prompt
    // an actual retry. Skipped (fail-open) only if the secret isn't
    // configured — it already is, per api/digest/subscribe.js using the
    // same env var, so this should be active from first deploy.
    if (TURNSTILE_SECRET_KEY) {
      const remoteIp = (req.headers['x-forwarded-for'] || '').split(',')[0].trim()
      const turnstileOk = await verifyTurnstile(turnstileToken, remoteIp)
      if (!turnstileOk) {
        return res.status(400).json({ error: 'Please complete the verification challenge and try again.' })
      }
    } else {
      console.warn('TURNSTILE_SECRET_KEY not configured — skipping Turnstile verification for quiz subscribe')
    }

    if (!firstName || typeof firstName !== 'string' || !firstName.trim()) {
      return res.status(400).json({ error: 'First name is required' })
    }
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'Email is required' })
    }

    const tags = ['govcon-lab', 'quiz-taker', 'weekly-rfq-report']
    // Optional per-result tag (e.g. quiz-result-growing) — lets email
    // follow-ups be segmented by result type later without a schema change.
    if (result && typeof result === 'string') {
      tags.push(`quiz-result-${result.toLowerCase().replace(/_/g, '-')}`)
    }

    const outcome = await subscribeToConvertKit({
      email,
      firstName: firstName.trim(),
      fields: { source: 'go-quiz', quiz_result: result || 'unknown' },
      tags,
    })

    if (outcome.skipped) {
      // ConvertKit env vars not configured — don't block the quiz result
      // over a config gap, just say so plainly in the response.
      return res.status(200).json({ message: 'ConvertKit not configured, skipped' })
    }
    if (!outcome.ok) {
      console.error('Quiz ConvertKit subscribe error:', outcome)
      return res.status(502).json({ error: 'Could not subscribe. Please try again.' })
    }

    return res.status(200).json({ message: 'Subscribed' })
  } catch (err) {
    console.error('Quiz subscribe error:', err)
    return res.status(500).json({ error: 'Something went wrong. Please try again.' })
  }
}
