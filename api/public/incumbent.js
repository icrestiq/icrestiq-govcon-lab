// api/public/incumbent.js
// Market Intelligence Redesign, Phase 2 — free "incumbent/recent awards"
// teaser on a matched opportunity, shown before a member pays for a
// Suggested Bid. Reuses the exact same USASpending spending_by_award query
// shape the generate_suggested_bid Edge Function's fetchHistoricalAwards()
// already runs for the paid Suggested Bid's price-range research (see that
// function in the generate_suggested_bid Edge Function) — just called from
// a public route instead of from inside the paid generation flow, and with
// a soft agency-name match layered on top to surface a likely incumbent
// rather than just a flat list of NAICS-wide recent awards.

function normalize(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const { naicsCode, agency } = req.query
  if (!naicsCode) return res.status(400).json({ error: 'Missing naicsCode' })

  try {
    const threeYearsAgo = new Date()
    threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - 3)
    const usaRes = await fetch('https://api.usaspending.gov/api/v2/search/spending_by_award/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filters: {
          naics_codes: { require: [String(naicsCode)] },
          time_period: [{ start_date: threeYearsAgo.toISOString().slice(0, 10), end_date: new Date().toISOString().slice(0, 10) }],
          award_type_codes: ['A', 'B', 'C', 'D'],
        },
        fields: ['Award ID', 'Recipient Name', 'Award Amount', 'Awarding Agency', 'Start Date'],
        sort: 'Start Date',
        order: 'desc',
        limit: 10,
        page: 1,
      }),
    })
    if (!usaRes.ok) throw new Error(`USASpending returned ${usaRes.status}`)
    const json = await usaRes.json()
    const results = Array.isArray(json?.results) ? json.results : []

    // Loose substring match either direction — SAM.gov's opportunity
    // agency text ("Department of the Navy") and USASpending's Awarding
    // Agency text don't share one canonical format, so an exact match
    // would miss real hits. A false-positive here is low-stakes (still a
    // real recent NAICS-code award, just possibly a different sub-agency)
    // and every result is labeled a "likely" incumbent, never certain.
    const agencyNorm = normalize(agency)
    const agencyMatches = agencyNorm
      ? results.filter((r) => {
          const a = normalize(r['Awarding Agency'])
          return a && (a.includes(agencyNorm) || agencyNorm.includes(a))
        })
      : []

    const toAward = (r) => ({
      recipient: r['Recipient Name'] || null,
      amount: r['Award Amount'] ?? null,
      agency: r['Awarding Agency'] || null,
      date: r['Start Date'] || null,
    })

    const likelyIncumbent = agencyMatches.length > 0 ? toAward(agencyMatches[0]) : null
    const recentAwards = (agencyMatches.length > 0 ? agencyMatches : results).slice(0, 5).map(toAward)

    // Public route, data doesn't change minute to minute — cache at the edge.
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400')

    return res.status(200).json({
      likelyIncumbent,
      agencyMatched: agencyMatches.length > 0,
      recentAwards,
    })
  } catch (err) {
    console.error('Incumbent lookup error:', err)
    return res.status(500).json({ error: 'Could not load incumbent data' })
  }
}
