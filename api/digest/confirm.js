// api/digest/confirm.js
// Public endpoint hit by the confirmation link in the digest signup email.
// Marks the row confirmed=true, sends the welcome email (best-effort, never
// blocks the redirect), then redirects to a plain result page.
//
// The welcome email branches on the subscriber's stored `source`: the
// homepage/default digest signup gets the 5 free starter-kit tools, while
// a 'sample-proposal' signup (from the /sample page's "get the full
// 14-page PDF" form) gets the sample PDF link instead. Without this branch,
// every subscriber — regardless of what they actually signed up for — was
// getting the 5-tools email, which is the bug this file fixes.
//
// NOTE: the confirm_token is intentionally NOT cleared after use. Many email
// clients and corporate security gateways (Outlook Safe Links, spam filters,
// etc.) auto-visit links inside incoming emails to scan them before the
// person ever clicks — which consumes a one-time token before the real
// visitor gets to it. Leaving the token valid means a second (real) click
// still confirms successfully instead of showing a false "invalid" page.
// This is low-risk: at worst, someone re-hits their own confirm link later
// and it just re-confirms an already-confirmed row. welcome_sent_at still
// prevents the welcome email from ever going out twice.

import { createClient } from '@supabase/supabase-js'
import nodemailer from 'nodemailer'
import { SITE_URL } from '../_lib/site-url.js'
import { subscribeToConvertKit } from '../_lib/convertkit.js'

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

const DOWNLOAD_BASE = `${SITE_URL}/downloads/starter-kit`
const SAMPLE_PDF_URL = `${SITE_URL}/images/samples/govcon-lab-sample-proposal.pdf`

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
  lines.push(`When you're ready to go further, GovCon Lab membership adds the Proposal Builder, community rooms, and the foundation course: ${SITE_URL}/membership`)
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
      When you're ready to go further, <a href="${SITE_URL}/membership" style="color:#1B2A4A;">GovCon Lab membership</a>
      adds the Proposal Builder, community rooms, and the foundation course.
    </p>
  </div>`
}

function sampleWelcomeText() {
  return [
    `Here's the full 14-page sample proposal — the actual, unedited output of the GovCon Lab Proposal Builder:`,
    ``,
    SAMPLE_PDF_URL,
    ``,
    `Same fictional example company shown on the page — all 14 pages, full size.`,
    ``,
    `When you're ready to build your own, GovCon Lab membership gets you the Proposal Builder itself, plus the community rooms: ${SITE_URL}/membership`,
  ].join('\n')
}

function sampleWelcomeHtml() {
  return `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#1B2A4A;">
    <p style="font-size:16px;line-height:1.55;">Here's the full 14-page sample proposal — the actual, unedited output of the GovCon Lab Proposal Builder.</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:12px 0;">
      <tr>
        <td style="padding:14px 0;border-bottom:1px solid #DDE1EA;">
          <a href="${SAMPLE_PDF_URL}" style="color:#1B2A4A;font-weight:600;font-size:15px;text-decoration:underline;">Open the full 14-page sample PDF</a>
          <div style="color:#4A5568;font-size:13px;margin-top:4px;">Same fictional example company shown on the page — all 14 pages, full size.</div>
        </td>
      </tr>
    </table>
    <p style="font-size:14px;line-height:1.55;color:#4A5568;">
      When you're ready to build your own, <a href="${SITE_URL}/membership" style="color:#1B2A4A;">GovCon Lab membership</a>
      gets you the Proposal Builder itself, plus the community rooms.
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

  const isSample = row?.source === 'sample-proposal'

  await transporter.sendMail({
    from: process.env.GMAIL_USER,
    to: row.email,
    subject: isSample ? 'Your full 14-page sample proposal' : 'Your 5 free GovCon tools',
    text: isSample ? sampleWelcomeText() : welcomeText(),
    html: isSample ? sampleWelcomeHtml() : welcomeHtml(),
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
  const token = req.query?.token

  if (!token || typeof token !== 'string') {
    return res.redirect(302, `${SITE_URL}/digest-confirmed?status=invalid`)
  }

  try {
    const { data, error } = await supabase
      .from('digest_subscribers')
      .update({
        confirmed: true,
        confirmed_at: new Date().toISOString(),
      })
      .eq('confirm_token', token)
      .select()
      .maybeSingle()

    if (error || !data) {
      return res.redirect(302, `${SITE_URL}/digest-confirmed?status=invalid`)
    }

    // Best-effort welcome email. Awaited so the function doesn't exit before
    // nodemailer finishes, but any failure here is caught and logged only —
    // it never changes the redirect the visitor sees.
    try {
      await sendWelcomeIfNeeded(data)
    } catch (mailErr) {
      console.error('digest welcome email error:', mailErr)
    }

    // Best-effort ConvertKit subscribe, same never-block-the-redirect
    // pattern. Confirmed digest subscribers previously had no path into
    // Kit at all, so the weekly RFQ digest itself had nowhere automated
    // to send from — this is what lets it go out as a Kit broadcast
    // instead of a manual email from a personal inbox. Tagged separately
    // from member-signup subscribers (api/convertkit/subscribe.js) so
    // they can still be segmented if ever needed.
    try {
      await subscribeToConvertKit({
        email: data.email,
        fields: { source: data.source || 'unknown', digest_confirmed_at: data.confirmed_at },
        tags: ['govcon-lab', 'digest-subscriber', `digest-source-${data.source || 'unknown'}`],
      })
    } catch (ckErr) {
      console.error('digest ConvertKit subscribe error:', ckErr)
    }

    // Pass source through so the confirmed landing page shows the right
    // content — a sample-proposal confirmer should see the PDF link, not
    // the 5 starter-kit tools (matching what the welcome email above just
    // sent them). Without this, the redirect always showed the same
    // generic tools list regardless of what was actually requested.
    const sourceParam = data?.source ? `&source=${encodeURIComponent(data.source)}` : ''
    return res.redirect(302, `${SITE_URL}/digest-confirmed?status=ok${sourceParam}`)
  } catch (err) {
    console.error('digest confirm error:', err)
    return res.redirect(302, `${SITE_URL}/digest-confirmed?status=invalid`)
  }
}