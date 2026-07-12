// api/generate-certificate.js
// Fills in the name/date on the certificate-template.pdf and emails it
// as an attachment to the monthly #1 rewards winner.
// Called by the Supabase monthly_rewards Edge Function.

import nodemailer from 'nodemailer'
import { PDFDocument, rgb } from 'pdf-lib'
import fs from 'fs'
import path from 'path'

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
})

// Exact coordinates measured from the template PDF (in points, bottom-left origin)
const NAME_BASELINE_Y = 383
const NAME_FONT_SIZE = 50
const NAME_CENTER_X = 413.6

const DATE_BASELINE_Y = 40
const DATE_FONT_SIZE = 17
const DATE_START_X = 350.4

const BG_COLOR = rgb(249 / 255, 248 / 255, 246 / 255)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const secret = req.headers['x-webhook-secret']
  if (process.env.REPORT_WEBHOOK_SECRET && secret !== process.env.REPORT_WEBHOOK_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    const { name, email, month } = req.body || {}
    if (!name || !email) return res.status(400).json({ error: 'Missing name or email' })

    const dateLabel = month || new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' })

    const templatePath = path.join(process.cwd(), 'public', 'certificate-template.pdf')
    const templateBytes = fs.readFileSync(templatePath)

    const pdfDoc = await PDFDocument.load(templateBytes)
    const page = pdfDoc.getPages()[0]
    const font = await pdfDoc.embedFont('Helvetica-Bold')

    // Cover the "Name here" placeholder with a background-colored rectangle
   page.drawRectangle({
      x: 60,
      y: 364,
      width: page.getWidth() - 120,
      height: 70,
      color: BG_COLOR,
    })

    const nameWidth = font.widthOfTextAtSize(name.toUpperCase(), NAME_FONT_SIZE)
    page.drawText(name.toUpperCase(), {
      x: NAME_CENTER_X - nameWidth / 2,
      y: NAME_BASELINE_Y,
      size: NAME_FONT_SIZE,
      font,
      color: rgb(0, 0, 0),
    })

    // Cover the "Date here" placeholder
    page.drawRectangle({
      x: DATE_START_X - 5,
      y: 28,
      width: 220,
      height: 35,
      color: BG_COLOR,
    })

    page.drawText(dateLabel, {
      x: DATE_START_X,
      y: DATE_BASELINE_Y,
      size: DATE_FONT_SIZE,
      font,
      color: rgb(0, 0, 0),
    })

    const finishedPdfBytes = await pdfDoc.save()

    await transporter.sendMail({
      from: process.env.GMAIL_USER,
      to: email,
      subject: `🏆 Your Certificate of Appreciation — GovCon Lab`,
      text: [
        `Hi ${name},`,
        ``,
        `Congratulations again on being the Top Contributor in GovCon Lab for ${dateLabel}! Your certificate of appreciation is attached.`,
        ``,
        `Thank you for being part of the community.`,
        `— iCrestiQ GovCon Lab`,
      ].join('\n'),
      attachments: [
        {
          filename: `GovCon-Lab-Certificate-${name.replace(/\s+/g, '-')}.pdf`,
          content: Buffer.from(finishedPdfBytes),
        },
      ],
    })

    return res.status(200).json({ sent: true })
  } catch (err) {
    console.error('Certificate generation error:', err)
    return res.status(200).json({ sent: false, error: err.message })
  }
}
