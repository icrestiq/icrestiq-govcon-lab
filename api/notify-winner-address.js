// api/notify-winner-address.js
// Called by the Supabase monthly_rewards Edge Function when the #1 winner
// has no shipping address on file (e.g. they're a free-tier member who
// never went through Stripe checkout). Sends them a plain email asking
// them to reply with their shipping address so we can send their prize
// t-shirt manually. Uses the same Gmail SMTP setup as notify-report.js.

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

  // Same shared-secret pattern as notify-report.js, so random traffic
  // can't trigger emails.
  const secret = req.headers['x-webhook-secret']
  if (process.env.REPORT_WEBHOOK_SECRET && secret !== process.env.REPORT_WEBHOOK_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    const { username, email, month } = req.body || {}
    if (!email) return res.status(400).json({ error: 'No winner email provided' })

    const adminEmail = process.env.ADMIN_ALERT_EMAIL || process.env.GMAIL_USER

    // Email to the winner
    await transporter.sendMail({
      from: process.env.GMAIL_USER,
      to: email,
      subject: `🎉 You're #1 this month in GovCon Lab — send us your shipping address!`,
      text: [
        `Hi ${username || 'there'},`,
        ``,
        `You were the top contributor in GovCon Lab for ${month} — congratulations! As part of your reward, we'd like to send you a free GovCon Lab t-shirt.`,
        ``,
        `Just reply to this email with your shipping address (name, street address, city, state, ZIP) and we'll get it sent out.`,
        ``,
        `Thanks for being part of the community.`,
        `— iCrestiQ GovCon Lab`,
      ].join('\n'),
    })

    // Heads-up to admin so it doesn't get missed
    await transporter.sendMail({
      from: process.env.GMAIL_USER,
      to: adminEmail,
      subject: `Rewards: ${username || email} needs a shipping address`,
      text: [
        `${username || email} won #1 in GovCon Lab for ${month} but has no address on file (no Stripe customer / no saved shipping address).`,
        ``,
        `An email was sent to them at ${email} asking them to reply with their address.`,
        `Once you have it, place the Printify order manually for their t-shirt.`,
      ].join('\n'),
    })

    return res.status(200).json({ sent: true })
  } catch (err) {
    console.error('Winner address notification error:', err)
    return res.status(200).json({ sent: false, error: err.message })
  }
}
