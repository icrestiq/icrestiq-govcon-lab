// api/public/stats.js
// Market Intelligence Redesign, Phase 1 — site-wide aggregate stats for
// the public marketing pages (Landing.jsx's PlatformStats bar), styled
// after GovScraper/Mindy's homepage stat bars. Has to be a server route
// rather than a direct client query like MemberCount.jsx's: opportunities/
// opportunity_matches/deals are gated behind is_paid_member()/profile_id
// RLS (see the Sourcing Pipeline CRM project note), so an anon client
// can't read them at all. This uses the service-role key to compute
// aggregate counts only — no row-level content is ever returned.

import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const [
      { count: opportunitiesTracked, error: oppErr },
      { count: matchesMade, error: matchErr },
      { data: dealRows, error: dealErr },
    ] = await Promise.all([
      supabaseAdmin.from('opportunities').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('opportunity_matches').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('deals').select('value_estimate, deal_stages(stage_type)'),
    ])
    if (oppErr) throw oppErr
    if (matchErr) throw matchErr
    if (dealErr) throw dealErr

    // Same won/lost/declined-vs-active split as Pipeline.jsx's ReportsTab,
    // just summed across every member's deals instead of one profile_id.
    let wonCount = 0, lostCount = 0, declinedCount = 0, pursuedValue = 0
    for (const d of dealRows || []) {
      const stageType = d.deal_stages?.stage_type || 'active'
      if (stageType === 'won') wonCount += 1
      else if (stageType === 'lost') lostCount += 1
      else if (stageType === 'declined') declinedCount += 1
      pursuedValue += Number(d.value_estimate) || 0
    }
    const closedCount = wonCount + lostCount + declinedCount
    const winRate = closedCount > 0 ? Math.round((wonCount / closedCount) * 100) : null

    // Public, unauthenticated route — cache at Vercel's edge so page views
    // don't each hit the service-role client directly.
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=1800')

    return res.status(200).json({
      opportunitiesTracked: opportunitiesTracked || 0,
      matchesMade: matchesMade || 0,
      dealsTracked: (dealRows || []).length,
      dealsWon: wonCount,
      winRate,
      pursuedValue: Math.round(pursuedValue),
    })
  } catch (err) {
    console.error('Public stats error:', err)
    return res.status(500).json({ error: 'Could not load stats' })
  }
}
