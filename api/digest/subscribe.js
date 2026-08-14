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
//
// BOT PROTECTION (added after a batch of confirmation emails bounced or
// went permanently unconfirmed — see chat notes 2026-08-14):
//   1. Honeypot field (`company`) — real visitors never see or fill this
//      field. Any value present means a bot filled every field on the
//      form, so we silently return success without inserting a row or
//      sending mail. Silent (not an error) so the bot doesn't learn to
//      adapt.
//   2. Minimum fill time (`renderedAt`) — the client sends the timestamp
//      the form first rendered. Scripted submissions that fire in well
//      under a second get rejected; a real person takes at least ~1.5s to
//      read the field and type an email.
//   3. MX record check — before inserting a row or sending mail, verify
//      the email's domain actually has mail servers. This catches typo'd
//      or nonexistent domains (e.g. a signup for "webshoppe.net" that
//      doesn't resolve) immediately, instead of silently bouncing later
//      and burning a wasted send. It does NOT catch a nonexistent mailbox
//      on a real domain (e.g. gmail.com always has MX records even if the
//      specific address doesn't exist) — that class of failure still
//      surfaces as a bounce and needs the reminder-flow bounce handling.

import { createClient } from '@supabase/supabase-js'
import nodemailer from 'nodemailer'
import crypto from 'crypto'
import dns from 'dns'
import { SITE_URL } from '../_lib/site-url.js'

const resolveMx = dns.promises.resolveMx

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

const MIN_FILL_TIME_MS = 1500

function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

// Returns true if the domain has at least one MX record (or, failing that,
// an A record — some small domains route mail without a dedicated MX
// record, which is a valid RFC 5321 fallback).
async function domainCanReceiveMail(domain) {
  try {
    const records = await resolveMx(domain)
    if (records && records.length > 0) return true
  } catch (err) {
    // ENOTFOUND / ENODATA means no MX record — fall through to the
    // A-record check below rather than failing immediately.
  }
  try {
    const aRecords = await dns.promises.resolve4(domain)
    return Array.isArray(aRecords) && aRecords.length > 0
  } catch (err) {
    return false
  }
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

    // --- Bot check 1: honeypot -------------------------------------
    // Real visitors never populate this field (it's visually hidden and
    // removed from tab order). Any non-empty value means a bot filled
    // every input on the form. Return a fake success so the bot doesn't
    // learn to look for and skip this specific field.
    const honeypot = (req.body?.company || '').trim()
    if (honeypot) {
      return res.status(200).json({ status: 'check-email' })
    }

    // --- Bot check 2: minimum fill time ------------------------------
    // The client sends the timestamp the form rendered. A submission
    // arriving in under MIN_FILL_TIME_MS is almost certainly scripted.
    const renderedAt = Number(req.body?.renderedAt)
    if (renderedAt && Date.now() - renderedAt < MIN_FILL_TIME_MS) {
      return res.status(200).json({ status: 'check-email' })
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'Enter a valid email address.' })
    }

    // --- Bot check 3: MX record validation ---------------------------
    const domain = email.split('@')[1]
    const canReceive = await domainCanReceiveMail(domain)
    if (!canReceive) {
      return res.status(400).json({
        error: `We couldn't verify that "${domain}" can receive email. Double-check for a typo.`,
      })
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