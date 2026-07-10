// api/notify-report.js
// Called by a Supabase Database Webhook whenever a new row is inserted
// into message_reports. Sends Keith a plain email alert via Gmail SMTP
// (using a Google "App Password" — not a new third-party email service).

import nodemailer from 'nodemailer'
import { createClient } from '@supabase/supabase-js'

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

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  // Supabase Database Webhooks send a simple secret in a custom header —
  // this is optional but recommended so random internet traffic can't
  // trigger emails to your inbox.
  const secret = req.headers['x-webhook-secret']
  if (process.env.REPORT_WEBHOOK_SECRET && secret !== process.env.REPORT_WEBHOOK_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    const report = req.body?.record
    if (!report) return res.status(400).json({ error: 'No report payload received' })

    const { data: message } = await supabase
      .from('messages')
      .select('content, username, room_id')
      .eq('id', report.message_id)
      .single()

    const { data: reporterProfile } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', report.reporter_id)
      .single()

    const adminEmail = process.env.ADMIN_ALERT_EMAIL || process.env.GMAIL_USER

    await transporter.sendMail({
      from: process.env.GMAIL_USER,
      to: adminEmail,
      subject: `New content report — ${report.reason}`,
      text: [
        `A member reported a post in GovCon Lab.`,
        ``,
        `Reason: ${report.reason}`,
        `Reported by: ${reporterProfile?.username || 'unknown'}`,
        `Room: ${message?.room_id || 'unknown'}`,
        `Original poster: ${message?.username || 'unknown'}`,
        `Post content: "${message?.content || '(message not found — may already be deleted)'}"`,
        ``,
        `Review it here: https://icrestiq-govcon-lab.vercel.app/admin`,
      ].join('\n'),
    })

    return res.status(200).json({ sent: true })
  } catch (err) {
    console.error('Report notification error:', err)
    // Don't fail loudly to Supabase's webhook retry system over an email hiccup
    return res.status(200).json({ sent: false, error: err.message })
  }
}
