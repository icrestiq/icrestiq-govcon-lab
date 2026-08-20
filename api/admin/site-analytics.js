// api/admin/site-analytics.js
// Admin-only read of Vercel Web Analytics: total site visits, /go landing
// page visits specifically, and referrer breakdowns for each. Calls
// Vercel's own Web Analytics REST API server-side with VERCEL_API_TOKEN —
// that token is a Vercel account credential, so it's never sent to the
// browser; the client only ever calls this endpoint.
//
// Requires Web Analytics to actually be enabled on the project (Vercel
// dashboard → Analytics tab, or `vercel project web-analytics`) — that's
// an account-level action outside what an API token can do. Nothing is
// tracked, and this returns zeros, until that's turned on.

import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Not secrets — same project/team IDs already used throughout this repo's
// Vercel MCP calls, just hardcoded here since there's no reason to
// duplicate them into env vars.
const VERCEL_PROJECT_ID = 'prj_0ZX9Hrvp0WTNJ7NtQL0lYEfLTHc9'
const VERCEL_TEAM_ID = 'team_RCzsnGGDUPxqhHjGRNNPzp9a'

async function requireAdmin(req) {
  const authHeader = req.headers.authorization || ''
  const token = authHeader.replace('Bearer ', '').trim()
  if (!token) return null

  const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token)
  if (userError || !user) return null

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profileError || profile?.role !== 'admin') return null
  return user
}

async function vercelAnalytics(path, params) {
  const apiToken = process.env.VERCEL_API_TOKEN
  if (!apiToken) throw new Error('VERCEL_API_TOKEN is not configured')

  const url = new URL(`https://api.vercel.com/v1/query/web-analytics/${path}`)
  url.searchParams.set('teamId', VERCEL_TEAM_ID)
  url.searchParams.set('projectId', VERCEL_PROJECT_ID)
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${apiToken}` },
  })
  if (!res.ok) {
    const body = await res.text()
    // "Web Analytics not found" is the real message Vercel returns when
    // it's simply never been enabled for this project — surfaced as-is so
    // the admin panel can show a clear "not enabled yet" state instead of
    // a generic error.
    throw new Error(`Vercel Analytics API ${res.status}: ${body.slice(0, 300)}`)
  }
  return res.json()
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const admin = await requireAdmin(req)
  if (!admin) return res.status(403).json({ error: 'Admin access required' })

  const days = Math.min(Math.max(parseInt(req.query.days, 10) || 30, 1), 365)
  const until = new Date()
  const since = new Date(until)
  since.setDate(since.getDate() - days)
  const sinceStr = since.toISOString().slice(0, 10)
  const untilStr = until.toISOString().slice(0, 10)

  try {
    const [totalCount, goCount, referrers, goReferrers] = await Promise.all([
      vercelAnalytics('visits/count', { since: sinceStr, until: untilStr }),
      vercelAnalytics('visits/count', { since: sinceStr, until: untilStr, filter: "requestPath eq '/go'" }),
      vercelAnalytics('visits/aggregate', { since: sinceStr, until: untilStr, by: 'referrerHostname', limit: '15' }),
      vercelAnalytics('visits/aggregate', { since: sinceStr, until: untilStr, by: 'referrerHostname', limit: '15', filter: "requestPath eq '/go'" }),
    ])

    return res.status(200).json({
      since: sinceStr,
      until: untilStr,
      totalVisits: totalCount?.data?.visitors ?? totalCount?.data?.count ?? 0,
      goVisits: goCount?.data?.visitors ?? goCount?.data?.count ?? 0,
      referrers: referrers?.data || [],
      goReferrers: goReferrers?.data || [],
    })
  } catch (err) {
    console.error('site-analytics error:', err)
    const notEnabled = /not found/i.test(err.message)
    return res.status(notEnabled ? 200 : 500).json(
      notEnabled
        ? { enabled: false, error: 'Web Analytics is not enabled for this project yet.' }
        : { error: err.message || 'Failed to load analytics' }
    )
  }
}
