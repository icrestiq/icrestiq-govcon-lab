// api/digest/confirm.js
// Public endpoint hit by the confirmation link in the digest signup email.
// Marks the row confirmed=true, invalidates the token so the link can't be
// reused, sends the welcome email with the 5 free tools (best-effort, never
// blocks the redirect), then redirects to a plain result page.

import { createClient } from '@supabase/supabase-js'
import nodemailer from 'nodemailer'

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

const DOWNLOAD_BASE = 'https://www.govconlab.com/downloads/starter-kit'

const TOOLS = [
  {
    file: '01_Compliance_Matrix_Template.docx',
    label: 'Compliance Matrix Template',
    desc: 'Map every RFP requirement to your proposal before you submit.',
  },
  {
    file: '02_SAM_UEI_Registration_Checklist.docx',
    label: 'SAM.gov & UEI Registration Checklist',
    desc: 'Get registered as a federal contractor, step by step.',
  },
  {
    file: '03_DIBBS_DLA_Quick_Start_Guide.docx',
    label: 'DIBBS/DLA Quick-Start Guide',
    desc: 'Start bidding DLA solicitations the right way.',
  },
  {
    file: '04_Capability_Statement_Template.docx',
    label: 'Capability Statement Template',
    desc: 'A one-page capability statement, ready to fill in.',
  },
  {
    file: '05_GovCon_Accounting_Starter_Sheet.xlsx',
    label: 'GovCon Accounting Starter Sheet',
    desc: 'Track income, expenses, and job costing from day one.',
  },
]

function welcomeText() {
  const lines = [
    `Thanks for confirming. Here are your 5 free GovCon tools:`,
    ``,
  ]
  for (const t of TOOLS) {
    lines.push(`${t.label} — ${t.desc}`)
    lines.push(`${DOWNLOAD_BASE}/${t.file}`)
    lines.push(``)
  }
  lines.push(`When you're ready to go further, GovCon Lab membership adds the Proposal Builder, community rooms, and the foundation course: https://www.govconlab.com/membership`)
  return lines.join('\n')
}

function welcomeHtml() {
  const rows = TOOLS.map(
    (t) => `
      <tr>
        <td style="padding:14px 0;border-bottom:1px solid #DDE1EA;">
          <a href="${DOWNLOAD_BASE}/${t.file}" style="color:#1B2A4A;font-weight:600;font-size:15px;text-decoration:underline;">${t.label}</a>
          <div style="color:#4A5568;font-size:13px;margin-top:4px;">${t.desc}</div>
        </td>
      </tr>`
  ).join('')

  return `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#1B2A4A;">
    <p style="font-size:16px;line-height:1.55;">Thanks for confirming. Here are your 5 free GovCon tools:</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:12px 0;">
      ${rows}
    </table>
    <p style="font-size:14px;line-height:1.55;color:#4A5568;">
      When you're ready to go further, <a href="https://www.govconlab.com/membership" style="color:#1B2A4A;">GovCon Lab membership</a>
      adds the Proposal Builder, community rooms, and the foundation course.
    </p>
  </div>`
}

async function sendWelcomeIfNeeded(row) {
  // If welcome_sent_at is already set, skip — already sent.
  // If the column doesn't exist yet (migration not run), row.welcome_sent_at
  // is simply undefined here, so this falls through and sends — that's the
  // intended tolerant behavior.
  if (row?.welcome_sent_at) return

  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    console.warn('Gmail SMTP not configured — welcome email not sent')
    return
  }

  await transporter.sendMail({
    from: process.env.GMAIL_USER,
    to: row.email,
    subject: 'Your 5 free GovCon tools',
    text: welcomeText(),
    html: welcomeHtml(),
  })

  try {
    const { error } = await supabase
      .from('digest_subscribers')
      .update({ welcome_sent_at: new Date().toISOString() })
      .eq('id', row.id)
    if (error) throw error
  } catch (colErr) {
    // Tolerate a missing welcome_sent_at column (migration not run yet) —
    // the email still sent successfully, this only affects idempotency
    // tracking on the next confirm attempt.
    console.error('digest welcome_sent_at update error (column may not exist yet):', colErr)
  }
}

export default async function handler(req, res) {
  // Canonical www domain — see matching note in subscribe.js. Update
  // NEXT_PUBLIC_SITE_URL in the Vercel dashboard if it's currently set to
  // the raw *.vercel.app domain; this fallback only covers it being unset.
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.govconlab.com'
  const token = req.query?.token

  if (!token || typeof token !== 'string') {
    return res.redirect(302, `${baseUrl}/digest-confirmed?status=invalid`)
  }

  try {
    const { data, error } = await supabase
      .from('digest_subscribers')
      .update({
        confirmed: true,
        confirm_token: null,
        confirmed_at: new Date().toISOString(),
      })
      .eq('confirm_token', token)
      .select()
      .maybeSingle()

    if (error || !data) {
      return res.redirect(302, `${baseUrl}/digest-confirmed?status=invalid`)
    }

    // Best-effort welcome email. Awaited so the function doesn't exit before
    // nodemailer finishes, but any failure here is caught and logged only —
    // it never changes the redirect the visitor sees.
    try {
      await sendWelcomeIfNeeded(data)
    } catch (mailErr) {
      console.error('digest welcome email error:', mailErr)
    }

    return res.redirect(302, `${baseUrl}/digest-confirmed?status=ok`)
  } catch (err) {
    console.error('digest confirm error:', err)
    return res.redirect(302, `${baseUrl}/digest-confirmed?status=invalid`)
  }
}