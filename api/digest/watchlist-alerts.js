// api/digest/watchlist-alerts.js
// Market Intelligence Redesign, Phase 3 — the first personalized digest
// this platform has ever sent. Distinct from api/digest/subscribe.js's
// free "What the Government Bought Last Week" broadcast (unpersonalized,
// sent to digest_subscribers regardless of membership) and from the daily
// match_opportunities cron (AI-scored matching against a member's main
// naics_codes/psc_codes profile fields, viewed in-app only, never
// emailed). This is a lighter-weight parallel signal: a member can watch
// extra NAICS/PSC codes via naics_watchlist without full AI scoring, and
// gets a plain email whenever a new opportunity posts on one of them.
//
// Triggered daily by Vercel Cron (see vercel.json). Same CRON_SECRET
// Bearer-token gate as send-reminders.js/stale-quote-alert.js — this
// endpoint is not public.

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

// Same volume-capping principle as send-reminders.js — bounds run
// duration and burst volume against the Gmail relay in one invocation.
const MAX_PROFILES_PER_RUN = 50
const TWENTY_FOUR_H_MS = 24 * 60 * 60 * 1000

function emailBody(profileFirstName, opportunities) {
  const greeting = profileFirstName ? `Hi ${profileFirstName},` : 'Hi,'
  const items = opportunities.map((o) => {
    const deadline = o.response_deadline
      ? new Date(o.response_deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      : 'No deadline listed'
    return [
      `${o.title}`,
      `${o.agency || 'Agency not listed'} · ${o.watched_code_label} · Deadline: ${deadline}`,
      o.sam_gov_url || `${SITE_URL}/opportunities`,
    ].join('\n')
  }).join('\n\n')

  return [
    greeting,
    '',
    `${opportunities.length} new SAM.gov opportunit${opportunities.length === 1 ? 'y has' : 'ies have'} posted on your watched codes:`,
    '',
    items,
    '',
    `Manage your watchlist: ${SITE_URL}/profile`,
  ].join('\n')
}

export default async function handler(req, res) {
  const authHeader = req.headers.authorization
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    const { data: watchRows, error: watchError } = await supabase
      .from('naics_watchlist')
      .select('id, profile_id, code, code_type, last_alerted_at, profiles(email, first_name)')
      .limit(2000)
    if (watchError) throw watchError

    const byProfile = new Map()
    for (const row of watchRows || []) {
      if (!row.profiles?.email) continue
      if (!byProfile.has(row.profile_id)) byProfile.set(row.profile_id, [])
      byProfile.get(row.profile_id).push(row)
    }

    let emailsSent = 0
    let profilesProcessed = 0

    for (const [profileId, rows] of byProfile) {
      if (profilesProcessed >= MAX_PROFILES_PER_RUN) break
      profilesProcessed += 1

      const foundById = new Map()
      const rowsToStamp = []

      for (const row of rows) {
        const cutoff = row.last_alerted_at && new Date(row.last_alerted_at).getTime() > Date.now() - TWENTY_FOUR_H_MS
          ? row.last_alerted_at
          : new Date(Date.now() - TWENTY_FOUR_H_MS).toISOString()

        const column = row.code_type === 'psc' ? 'psc_code' : 'naics_code'
        const { data: matches, error: matchError } = await supabase
          .from('opportunities')
          .select('id, title, agency, response_deadline, sam_gov_url, created_at')
          .eq(column, row.code)
          .gt('created_at', cutoff)
          .limit(20)
        if (matchError) {
          console.error(`Watchlist lookup failed for code ${row.code}:`, matchError)
          continue
        }

        rowsToStamp.push(row.id)
        for (const o of matches || []) {
          if (!foundById.has(o.id)) {
            foundById.set(o.id, { ...o, watched_code_label: `${row.code_type.toUpperCase()} ${row.code}` })
          }
        }
      }

      if (foundById.size === 0) {
        // Still worth stamping — otherwise a watched code with zero
        // recent hits would keep growing its lookback window forever
        // instead of settling into the normal rolling 24h cutoff.
        if (rowsToStamp.length > 0) {
          await supabase.from('naics_watchlist').update({ last_alerted_at: new Date().toISOString() }).in('id', rowsToStamp)
        }
        continue
      }

      const profile = rows[0].profiles
      const opportunities = Array.from(foundById.values())

      try {
        await transporter.sendMail({
          from: process.env.GMAIL_USER,
          to: profile.email,
          subject: `${opportunities.length} new opportunit${opportunities.length === 1 ? 'y' : 'ies'} on your GovCon Lab watchlist`,
          text: emailBody(profile.first_name, opportunities),
        })
        emailsSent += 1
        await supabase.from('naics_watchlist').update({ last_alerted_at: new Date().toISOString() }).in('id', rowsToStamp)
      } catch (mailErr) {
        // Non-fatal — leave last_alerted_at untouched so the next run
        // retries the same window rather than silently losing this
        // profile's alert to a transient SMTP hiccup.
        console.error(`Failed to send watchlist alert to profile ${profileId}:`, mailErr)
      }
    }

    return res.status(200).json({ ok: true, profilesProcessed, emailsSent })
  } catch (err) {
    console.error('Watchlist alerts run failed:', err)
    return res.status(500).json({ error: err.message || 'Watchlist alerts run failed' })
  }
}
