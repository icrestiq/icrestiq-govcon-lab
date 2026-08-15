// api/notify-winner-address.js
// Called by the Supabase monthly_rewards Edge Function for every #1
// winner. Sends them a plain email asking them to reply with their
// shipping address and t-shirt size — the order is always placed
// manually by an admin after they reply, never automatically. Uses the
// same Gmail SMTP setup as notify-report.js.

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
    const { username, email, month, couponCode } = req.body || {}
    if (!email) return res.status(400).json({ error: 'No winner email provided' })

    const adminEmail = process.env.ADMIN_ALERT_EMAIL || process.env.GMAIL_USER

    // Coupon creation can fail independently of this email (see
    // monthly_rewards Edge Function) — couponCode may be null. Don't print
    // a broken "Code: null" line if so; just skip the block entirely.
    const couponBlock = couponCode
      ? [
          ``,
          `🎁 YOUR REWARD: 20% off anything in the GovCon Lab store`,
          `CODE: ${couponCode}`,
          `(one-time use — enter it at checkout)`,
          ``,
        ]
      : [``]

    // Email to the winner
    await transporter.sendMail({
      from: process.env.GMAIL_USER,
      to: email,
      subject: `🎉 You're #1 this month in GovCon Lab — your discount code + a free t-shirt!`,
      text: [
        `Hi ${username || 'there'},`,
        ``,
        `You were the top contributor in GovCon Lab for ${month} — congratulations!`,
        ...couponBlock,
        `We'd also like to send you a free GovCon Lab t-shirt. Just reply to this email with your shipping address (name, street address, city, state, ZIP) and your t-shirt size (S/M/L/XL/2XL) and we'll get it sent out.`,
        ``,
        `Thanks for being part of the community.`,
        `— iCrestiQ GovCon Lab`,
      ].join('\n'),
    })

    // Heads-up to admin so it doesn't get missed
    await transporter.sendMail({
      from: process.env.GMAIL_USER,
      to: adminEmail,
      subject: `Rewards: ${username || email} won #1 for ${month}`,
      text: [
        `${username || email} won #1 in GovCon Lab for ${month}.`,
        couponCode ? `Discount code sent to them: ${couponCode} (20% off, one-time use).` : `Note: coupon creation failed for this winner — they were not sent a discount code.`,
        ``,
        `An email was sent to them at ${email} asking them to reply with their shipping address and t-shirt size.`,
        `Once you have their reply, place the Printify order manually for their t-shirt.`,
      ].join('\n'),
    })

    return res.status(200).json({ sent: true })
  } catch (err) {
    console.error('Winner address notification error:', err)
    return res.status(200).json({ sent: false, error: err.message })
  }
}
