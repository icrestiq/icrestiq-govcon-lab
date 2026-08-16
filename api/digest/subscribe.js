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
//   3. Cloudflare Turnstile (`turnstileToken`) — added 2026-08-15 after
//      most of that bot volume turned out to trace back to the /go
//      landing page specifically. The three heuristics above are all
//      trivial for a real scripted bot to clear (wait 1.5s, skip the
//      hidden field); Turnstile is the actual challenge. A missing/failed
//      token is a real error, not a silent fake-success, so the widget
//      can prompt the visitor to retry. See verifyTurnstile() below.
//   4. Gmail dot-spam pattern — addresses like "an.s.on..c.h.a.u.9@gmail.com"
//      that abuse Gmail's dot-insensitivity to look like unique real people.
//      See looksLikeGmailDotSpam() below for the detection logic.
//   5. MX record check — before inserting a row or sending mail, verify
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

const TURNSTILE_SECRET_KEY = process.env.TURNSTILE_SECRET_KEY

// Verifies a Turnstile token against Cloudflare's siteverify API. This is
// the real bot gate — the honeypot/fill-time/dot-spam checks below are
// heuristics a scripted bot can trivially clear (wait a couple seconds,
// never touch the hidden field), which is how the 2026-08-14 bot wave got
// through in the first place; most of that volume came via the /go
// landing page's form. Turnstile is the same site key already live on
// Login/Register/ForgotPassword (0x4AAAAAAEQ5qXqIODs9pgvr) — this is just
// the server-side half of that same widget, reused here.
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

// Detects the "dot-spam" pattern seen in a batch of bot signups on
// 2026-08-14 — addresses like "an.s.on..c.h.a.u.9@gmail.com". Gmail (and
// Google Workspace / googlemail.com) ignores dots in the local part of an
// address entirely, so these all route to a normal-looking inbox that
// isn't the one that signed up, or to no one at all. Real Gmail addresses
// almost never have more than 1-2 dots; bots generating "unique-looking"
// variants of a base address tend to sprinkle a dot near every letter,
// producing a high dot-to-length ratio or literal consecutive dots (which
// is invalid syntax and always hard-bounces on Gmail's own SMTP relay).
//
// Only applied to gmail.com / googlemail.com — dot-insensitivity is a
// Gmail-specific quirk, so this check would misfire on other providers
// where dots are meaningful and dense-looking names are just names.
const GMAIL_DOMAINS = new Set(['gmail.com', 'googlemail.com'])

function looksLikeGmailDotSpam(localPart, domain) {
  if (!GMAIL_DOMAINS.has(domain)) return false

  // Consecutive dots are invalid RFC 5321 syntax — Gmail hard-rejects
  // these at SMTP time every time. No point ever sending.
  if (localPart.includes('..')) return true

  const segments = localPart.split('.').filter(Boolean)
  if (segments.length < 3) return false // 1-2 dots is normal, don't flag

  const dotCount = (localPart.match(/\./g) || []).length
  const ratio = dotCount / localPart.length
  const avgSegmentLen = segments.reduce((sum, s) => sum + s.length, 0) / segments.length

  // Repeated identical segment (e.g. "fc.fc.f.db") is a strong bot tell
  // on its own, regardless of overall length or ratio.
  const hasDuplicateSegment = new Set(segments).size < segments.length

  // A real address like "jane.q.public" has a handful of dots but each
  // segment is still a recognizable word or initial of reasonable length.
  // The bot pattern seen here chops the local part into many 1-2 char
  // fragments — average segment length around 1.5-2 chars, vs 3+ for a
  // typical real name segment.
  return dotCount >= 4 || ratio >= 0.3 || avgSegmentLen <= 2.2 || hasDuplicateSegment
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
        `Thanks for requesting the full 14-page sample proposal — the actual, unedited output of the GovCon Lab Proposal Builder.`,
        ``,
        `One thing first: we only send it once you've confirmed this email address. Click below to verify, and the PDF link arrives right after.`,
        ``,
        confirmUrl,
        ``,
        `Didn't ask for this? Ignore this email and you won't be added — nothing else happens.`,
      ],
    }
  }

  return {
    subject: 'Confirm your GovCon Lab weekly digest',
    bodyLines: (confirmUrl) => [
      `Thanks for signing up for Monday's digest of real federal product solicitations.`,
      ``,
      `One thing first: we only add you to the list — and send your 5 free tools — once you've confirmed this email address. Click below to verify.`,
      ``,
      confirmUrl,
      ``,
      `Didn't ask for this? Ignore this email and you won't be added — nothing else happens.`,
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
    const firstName = (req.body?.firstName || '').trim()
    const lastName = (req.body?.lastName || '').trim()

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

    // --- Bot check 3: Turnstile challenge -----------------------------
    // Unlike the two checks above, a missing/failed token is a real error,
    // not a silent fake-success — the widget needs the visitor to actually
    // retry, same as Login/Register/ForgotPassword. Skipped entirely if
    // TURNSTILE_SECRET_KEY isn't configured yet, same fail-open pattern as
    // the Gmail SMTP check further down, so this endpoint keeps accepting
    // real signups while the secret is being added rather than going dark
    // the moment this code deploys.
    if (TURNSTILE_SECRET_KEY) {
      const remoteIp = (req.headers['x-forwarded-for'] || '').split(',')[0].trim()
      const turnstileOk = await verifyTurnstile(req.body?.turnstileToken, remoteIp)
      if (!turnstileOk) {
        return res.status(400).json({ error: 'Please complete the verification challenge and try again.' })
      }
    } else {
      console.warn('TURNSTILE_SECRET_KEY not configured — skipping Turnstile verification for digest subscribe')
    }

    if (!firstName) {
      return res.status(400).json({ error: 'First name is required.' })
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'Enter a valid email address.' })
    }

    // --- Bot check 4: Gmail dot-spam pattern -------------------------
    // Applied before the MX check since it's a cheap in-memory check and
    // Gmail always has valid MX records anyway, so the MX check alone
    // would never catch this pattern. Silent fake-success, same reasoning
    // as the honeypot check above.
    const [localPart, emailDomain] = email.split('@')
    if (looksLikeGmailDotSpam(localPart, emailDomain)) {
      return res.status(200).json({ status: 'check-email' })
    }

    // --- Bot check 5: MX record validation ---------------------------
    const canReceive = await domainCanReceiveMail(emailDomain)
    if (!canReceive) {
      return res.status(400).json({
        error: `We couldn't verify that "${emailDomain}" can receive email. Double-check for a typo.`,
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
        .update({ confirm_token: token, source, first_name: firstName, last_name: lastName || null })
        .eq('id', existing.id)
      if (error) throw error
    } else {
      const { error } = await supabase
        .from('digest_subscribers')
        .insert({ email, source, confirmed: false, confirm_token: token, first_name: firstName, last_name: lastName || null })
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