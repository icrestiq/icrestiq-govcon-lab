// api/digest/subscribe.js
// Public endpoint for the homepage "Weekly RFQ digest" email capture, and
// also used by the /sample page's "get the full 14-page PDF" form (source:
// 'sample-proposal'). The confirmation email copy below branches on
// `source` so a sample-page visitor isn't told they're getting "5 free
// tools" when they actually asked for the sample PDF.
//
// Double opt-in: stores confirmed=false and emails a confirmation link.
// Sends via the same Gmail SMTP relay already used in api/notify-report.js —
// no new third-party service, no marketing platform, no tracking pixel.

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

function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

// Confirmation-email copy, keyed by source. Anything not explicitly listed
// here falls back to the original 'homepage' digest copy — this is the
// same tolerant-default pattern already used elsewhere in this file for
// `source` when it's missing from the request body entirely.
function confirmationCopyFor(source) {
  if (source === 'sample-proposal') {
    return {
      subject: 'Confirm to get the full 14-page sample proposal',
      bodyLines: (confirmUrl) => [
        `One click and we'll send you the full 14-page sample proposal — the actual, unedited output of the GovCon Lab Proposal Builder.`,
        `Confirm and the PDF link arrives immediately.`,
        ``,
        confirmUrl,
        ``,
        `Didn't ask for this? Ignore this email and you won't be added.`,
      ],
    }
  }

  return {
    subject: 'Confirm your GovCon Lab weekly digest',
    bodyLines: (confirmUrl) => [
      `One click and you're on the list for Monday's digest of real federal product solicitations.`,
      `Confirm and your 5 free tools arrive immediately.`,
      ``,
      confirmUrl,
      ``,
      `Didn't ask for this? Ignore this email and you won't be added.`,
    ],
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
    const source = req.body?.source || 'homepage'

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
        .update({ confirm_token: token, source })
        .eq('id', existing.id)
      if (error) throw error
    } else {
      const { error } = await supabase
        .from('digest_subscribers')
        .insert({ email, source, confirmed: false, confirm_token: token })
      if (error) throw error
    }

    const confirmUrl = `${SITE_URL}/api/digest/confirm?token=${token}`
    const copy = confirmationCopyFor(source)

    if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
      await transporter.sendMail({
        from: process.env.GMAIL_USER,
        to: email,
        subject: copy.subject,
        text: copy.bodyLines(confirmUrl).join('\n'),
      })
    } else {
      console.warn('Gmail SMTP not configured — confirmation email not sent')
    }

    return res.status(200).json({ status: 'check-email' })
  } catch (err) {
    console.error('digest subscribe error:', err)
    return res.status(500).json({ error: 'Something went wrong. Please try again.' })
  }
}
