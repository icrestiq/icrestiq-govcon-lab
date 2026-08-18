// api/sam-gov-alert.js
// Called by the Supabase sam_gov_ingest and match_opportunities Edge
// Functions whenever a run fails. Sends Keith a plain email alert via
// Gmail SMTP — same pattern as api/notify-report.js (Google "App
// Password", not a new third-party email service).

import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
})

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const secret = req.headers['x-webhook-secret']
  if (process.env.REPORT_WEBHOOK_SECRET && secret !== process.env.REPORT_WEBHOOK_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    const { source, message, details } = req.body || {}
    if (!source || !message) return res.status(400).json({ error: 'Missing source or message' })

    const adminEmail = process.env.ADMIN_ALERT_EMAIL || process.env.GMAIL_USER

    await transporter.sendMail({
      from: process.env.GMAIL_USER,
      to: adminEmail,
      subject: `[GovCon Lab] ${source} failed`,
      text: [
        `The "${source}" Edge Function hit an error.`,
        ``,
        `Error: ${message}`,
        details ? `\nDetails:\n${JSON.stringify(details, null, 2)}` : '',
        ``,
        `Supabase Edge Function logs: https://supabase.com/dashboard/project/zohrpargudmogfywciik/functions/${source}/logs`,
      ].join('\n'),
    })

    return res.status(200).json({ sent: true })
  } catch (err) {
    console.error('sam-gov-alert error:', err)
    // Don't fail loudly back to the caller over an email hiccup — the
    // caller (an Edge Function's own error path) should still return its
    // original error response either way.
    return res.status(200).json({ sent: false, error: err.message })
  }
}
