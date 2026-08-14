// api/digest/send-reminders.js
// Triggered every 5 minutes by Vercel Cron (see vercel.json). Sends two
// waves of reminder emails to subscribers who haven't confirmed:
//   - 15 minutes after signup (reminder_15m_sent_at)
//   - 24 hours after signup (reminder_24h_sent_at)
//
// Both waves are idempotent — each subscriber gets at most one 15m email
// and one 24h email, tracked via the two timestamp columns added
// 2026-08-14. A subscriber who confirms in between simply won't match the
// `confirmed = false` filter on the next run.
//
// This endpoint is NOT public. It checks the Authorization header against
// CRON_SECRET, which Vercel automatically sends as a Bearer token for
// requests it triggers via the `crons` config in vercel.json. Requires a
// CRON_SECRET env var to be set in the Vercel dashboard (Production scope
// at minimum) — see chat notes 2026-08-14 for setup steps.

import { createClient } from '@supabase/supabase-js'
import nodemailer from 'nodemailer'
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

// Cap per-run volume so a single invocation can't run long or send a huge
// burst through the Gmail relay at once. At every-5-minutes, this easily
// keeps up with normal signup volume; raise it only if a real backlog
// builds up (e.g. after Gmail SMTP was down for a while).
const MAX_PER_WAVE = 25

const FIFTEEN_MIN_MS = 15 * 60 * 1000
const TWENTY_FOUR_H_MS = 24 * 60 * 60 * 1000

function reminderCopyFor(source, wave) {
  const isSample = source === 'sample-proposal'
  const whatTheyAskedFor = isSample
    ? 'the full 14-page sample proposal'
    : "Monday's digest of real federal product solicitations"

  const subject =
    wave === '15m'
      ? 'Quick thing — we need you to confirm your GovCon Lab digest'
      : "Last call — you're not on the list yet"

  const bodyLines = (confirmUrl) => {
    const lines = [
      `Hi,`,
      ``,
      `You recently requested ${whatTheyAskedFor} at GovCon Lab — but we still need one quick step to finish setting it up.`,
      ``,
      `Click below to confirm your subscription:`,
      confirmUrl,
      ``,
      `If the button doesn't work, copy and paste this link into your browser:`,
      confirmUrl,
      ``,
      `Didn't see our first email? Check your Spam folder and your Promotions tab (if you use Gmail) — and consider adding hello@icrestiq.com to your contacts so future emails land in your primary inbox.`,
    ]
    if (wave === '24h') {
      lines.push(
        ``,
        `This is the last reminder we'll send — after this we'll assume you'd rather not be on the list, and that's completely fine.`
      )
    }
    lines.push(``, `Thanks,`, `Keith Atkinson`, `iCrestiQ / GovCon Lab`)
    return lines
  }

  return { subject, bodyLines }
}

async function sendWave({ wave, windowMs, timestampColumn }) {
  const cutoff = new Date(Date.now() - windowMs).toISOString()

  const { data: rows, error } = await supabase
    .from('digest_subscribers')
    .select('id, email, source, confirm_token, created_at')
    .eq('confirmed', false)
    .is(timestampColumn, null)
    .not('confirm_token', 'is', null)
    .lte('created_at', cutoff)
    .order('created_at', { ascending: true })
    .limit(MAX_PER_WAVE)

  if (error) {
    console.error(`send-reminders (${wave}) query error:`, error)
    return { wave, attempted: 0, sent: 0, failed: 0, errors: [String(error.message || error)] }
  }

  let sent = 0
  let failed = 0
  let permanentlyRejected = 0
  const errors = []

  for (const row of rows || []) {
    try {
      const confirmUrl = `${SITE_URL}/api/digest/confirm?token=${row.confirm_token}`
      const copy = reminderCopyFor(row.source, wave)

      await transporter.sendMail({
        from: process.env.GMAIL_USER,
        to: row.email,
        subject: copy.subject,
        text: copy.bodyLines(confirmUrl).join('\n'),
      })

      const { error: updateError } = await supabase
        .from('digest_subscribers')
        .update({ [timestampColumn]: new Date().toISOString() })
        .eq('id', row.id)

      if (updateError) throw updateError
      sent += 1
    } catch (err) {
      failed += 1
      errors.push(`${row.email}: ${err?.message || err}`)
      console.error(`send-reminders (${wave}) error for ${row.email}:`, err)

      // A 5xx SMTP response (e.g. 550/553/554) means the receiving server
      // has permanently rejected the address — malformed syntax, no such
      // mailbox, no such domain. Retrying this on the next cron run can
      // never succeed; it only repeats the same rejected RCPT TO against
      // Gmail's SMTP relay every 5 minutes forever, which risks the
      // sending account being flagged for abuse. Stamp the timestamp
      // column so we stop trying, same as a successful send.
      //
      // A 4xx response, or no response code at all (network blip, auth
      // hiccup, timeout), is treated as transient and left unstamped so
      // it's retried on the next run.
      const code = err?.responseCode
      const isPermanent = typeof code === 'number' && code >= 500 && code < 600

      if (isPermanent) {
        permanentlyRejected += 1
        const { error: updateError } = await supabase
          .from('digest_subscribers')
          .update({ [timestampColumn]: new Date().toISOString() })
          .eq('id', row.id)
        if (updateError) {
          console.error(`send-reminders (${wave}) failed to stamp permanent-rejection for ${row.email}:`, updateError)
        }
      }
    }
  }

  return { wave, attempted: (rows || []).length, sent, failed, permanentlyRejected, errors }
}

export default async function handler(req, res) {
  const authHeader = req.headers.authorization
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    const results = []
    results.push(
      await sendWave({
        wave: '15m',
        windowMs: FIFTEEN_MIN_MS,
        timestampColumn: 'reminder_15m_sent_at',
      })
    )
    results.push(
      await sendWave({
        wave: '24h',
        windowMs: TWENTY_FOUR_H_MS,
        timestampColumn: 'reminder_24h_sent_at',
      })
    )

    return res.status(200).json({ ok: true, results })
  } catch (err) {
    console.error('send-reminders fatal error:', err)
    return res.status(500).json({ error: 'Something went wrong.' })
  }
}