// api/notion/stale-quote-alert.js
// Triggered daily by Vercel Cron (see vercel.json). Checks the "Open Quotes"
// data source in the GovCon Command Center Notion workspace for quotes that
// have sat at Status = Sent for STALE_THRESHOLD_DAYS or more, and sends a
// follow-up digest by email and/or Slack.
//
// This is a single-tenant tool against Keith's own live Notion workspace,
// not a per-customer feature — there's no per-connection "quotes database"
// column like there is for Opportunities, so it just uses whichever
// notion_connections row is active. Add a real per-customer quotes database
// selector before offering this more broadly.
//
// Not public. Checks the Authorization header against CRON_SECRET, same as
// api/digest/send-reminders.js.

import { createClient } from '@supabase/supabase-js'
import nodemailer from 'nodemailer'

const NOTION_VERSION = '2022-06-28'
const OPEN_QUOTES_DATABASE_ID = '585192f4-0b08-4171-bcc6-c03847f6b4d4'
const STALE_THRESHOLD_DAYS = 3
const DEFAULT_ALERT_EMAIL = 'keith.atkinson.010@gmail.com'

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

function titleText(page, propName) {
  return page.properties?.[propName]?.title?.[0]?.plain_text || '(untitled)'
}

function pageUrl(page) {
  return `https://www.notion.so/${page.id.replace(/-/g, '')}`
}

async function findStaleQuotes(accessToken) {
  const queryRes = await fetch(
    `https://api.notion.com/v1/databases/${OPEN_QUOTES_DATABASE_ID}/query`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Notion-Version': NOTION_VERSION,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        filter: { property: 'Status', select: { equals: 'Sent' } },
      }),
    }
  )

  if (queryRes.status === 401) {
    const err = new Error('Notion connection revoked')
    err.revoked = true
    throw err
  }
  if (!queryRes.ok) {
    const body = await queryRes.text().catch(() => '')
    throw new Error(`Notion query failed: ${queryRes.status} ${body}`)
  }

  const { results } = await queryRes.json()
  const now = Date.now()

  return (results || [])
    .map((page) => {
      const quoteDate = page.properties?.['Quote Date']?.date?.start
      const daysSince = quoteDate
        ? Math.floor((now - new Date(quoteDate).getTime()) / 86400000)
        : null
      return { page, quoteDate, daysSince }
    })
    .filter((q) => q.daysSince !== null && q.daysSince >= STALE_THRESHOLD_DAYS)
    .sort((a, b) => b.daysSince - a.daysSince)
}

async function sendEmailDigest(staleQuotes) {
  const to = process.env.STALE_QUOTE_ALERT_EMAIL || DEFAULT_ALERT_EMAIL
  const lines = [
    `${staleQuotes.length} quote(s) have been sitting at "Sent" for ${STALE_THRESHOLD_DAYS}+ days without a follow-up:`,
    '',
    ...staleQuotes.map(
      (q) => `- ${titleText(q.page, 'Name')} — ${q.daysSince} days (sent ${q.quoteDate}) — ${pageUrl(q.page)}`
    ),
  ]

  await transporter.sendMail({
    from: process.env.GMAIL_USER,
    to,
    subject: `Follow up: ${staleQuotes.length} quote(s) awaiting a response`,
    text: lines.join('\n'),
  })
}

async function sendSlackDigest(staleQuotes) {
  const webhookUrl = process.env.SLACK_STALE_QUOTES_WEBHOOK_URL
  if (!webhookUrl) {
    console.warn('stale-quote-alert: SLACK_STALE_QUOTES_WEBHOOK_URL not set, skipping Slack send')
    return false
  }

  const text = [
    `*${staleQuotes.length} quote(s) awaiting follow-up* (Sent ${STALE_THRESHOLD_DAYS}+ days ago)`,
    ...staleQuotes.map(
      (q) => `• <${pageUrl(q.page)}|${titleText(q.page, 'Name')}> — ${q.daysSince} days`
    ),
  ].join('\n')

  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Slack webhook failed: ${res.status} ${body}`)
  }
  return true
}

export default async function handler(req, res) {
  const authHeader = req.headers.authorization
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    const { data: rows, error: tokenError } = await supabase.rpc('get_notion_access_token', {
      p_profile_id: '404be639-e000-493d-a998-f7a60c289902',
    })
    if (tokenError) throw tokenError
    const row = rows?.[0]
    if (!row || row.status !== 'active') {
      return res.status(200).json({ ok: true, skipped: 'no active Notion connection' })
    }

    let staleQuotes
    try {
      staleQuotes = await findStaleQuotes(row.access_token)
    } catch (err) {
      if (err.revoked) {
        await supabase.rpc('mark_notion_connection_revoked', { p_profile_id: '404be639-e000-493d-a998-f7a60c289902' })
        return res.status(200).json({ ok: true, skipped: 'Notion connection was revoked' })
      }
      throw err
    }

    if (staleQuotes.length === 0) {
      return res.status(200).json({ ok: true, staleCount: 0 })
    }

    const emailResult = await sendEmailDigest(staleQuotes).then(() => true).catch((err) => {
      console.error('stale-quote-alert email send failed:', err)
      return false
    })
    const slackResult = await sendSlackDigest(staleQuotes).catch((err) => {
      console.error('stale-quote-alert Slack send failed:', err)
      return false
    })

    return res.status(200).json({
      ok: true,
      staleCount: staleQuotes.length,
      sent: { email: emailResult, slack: slackResult },
    })
  } catch (err) {
    console.error('stale-quote-alert fatal error:', err)
    return res.status(500).json({ error: 'Something went wrong.' })
  }
}
