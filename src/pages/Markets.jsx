// src/pages/Markets.jsx
// Market Intelligence Redesign, Phase 2 — browsable NAICS-sector view of
// all currently-open opportunities (not just this member's own matches),
// mirroring Mindy's "Start Exploring" market categories. opportunities'
// own RLS allows any authenticated user to SELECT (confirmed live via
// pg_policies, 2026-09-08 — "Authenticated users can view opportunities",
// qual: true), so this queries the table directly rather than needing a
// server-side aggregate route like the incumbent/stats ones.

import { useEffect, useMemo, useState } from 'react'
import { Compass, ExternalLink, ChevronLeft } from 'lucide-react'
import { supabase } from '../lib/supabase'
import useDocumentTitle from '../hooks/useDocumentTitle'
import styles from './Markets.module.css'

// The 20 official 2-digit NAICS sectors (2022 structure). Three sectors
// span multiple 2-digit codes (Manufacturing, Retail Trade, Transportation
// & Warehousing) — each of those codes maps to the same sector name below
// rather than being split into three separate cards, matching how NAICS
// itself groups them.
const SECTOR_NAMES = {
  '11': 'Agriculture, Forestry, Fishing and Hunting',
  '21': 'Mining, Quarrying, and Oil and Gas Extraction',
  '22': 'Utilities',
  '23': 'Construction',
  '31': 'Manufacturing', '32': 'Manufacturing', '33': 'Manufacturing',
  '42': 'Wholesale Trade',
  '44': 'Retail Trade', '45': 'Retail Trade',
  '48': 'Transportation and Warehousing', '49': 'Transportation and Warehousing',
  '51': 'Information',
  '52': 'Finance and Insurance',
  '53': 'Real Estate and Rental and Leasing',
  '54': 'Professional, Scientific, and Technical Services',
  '55': 'Management of Companies and Enterprises',
  '56': 'Administrative and Support and Waste Management Services',
  '61': 'Educational Services',
  '62': 'Health Care and Social Assistance',
  '71': 'Arts, Entertainment, and Recreation',
  '72': 'Accommodation and Food Services',
  '81': 'Other Services (except Public Administration)',
  '92': 'Public Administration',
}

// A rough recent-window sample, not an exhaustive live count — fetching
// every open opportunity's full row for an exact count isn't worth the
// payload size for a browse page. Ordered by newest first so the sample
// (and therefore the sector counts) skews toward what's actually
// currently postable, not whatever's oldest in the table.
const SAMPLE_LIMIT = 2000

export default function Markets() {
  useDocumentTitle('Markets — GovCon Lab')
  const [opportunities, setOpportunities] = useState(null)
  const [selectedSector, setSelectedSector] = useState(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const nowIso = new Date().toISOString()
      const { data, error } = await supabase
        .from('opportunities')
        .select('id, title, agency, naics_code, response_deadline, sam_gov_url, estimated_value, created_at')
        .or(`response_deadline.is.null,response_deadline.gte.${nowIso}`)
        .order('created_at', { ascending: false })
        .limit(SAMPLE_LIMIT)
      if (cancelled) return
      if (error) { console.error('Failed to load opportunities for Markets:', error); setOpportunities([]); return }
      setOpportunities(data || [])
    })()
    return () => { cancelled = true }
  }, [])

  const sectorCounts = useMemo(() => {
    if (!opportunities) return []
    const counts = {}
    for (const o of opportunities) {
      const prefix = o.naics_code?.slice(0, 2)
      const name = prefix && SECTOR_NAMES[prefix]
      if (!name) continue
      if (!counts[name]) counts[name] = 0
      counts[name] += 1
    }
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
  }, [opportunities])

  const sectorOpportunities = useMemo(() => {
    if (!opportunities || !selectedSector) return []
    return opportunities
      .filter((o) => SECTOR_NAMES[o.naics_code?.slice(0, 2)] === selectedSector)
      .sort((a, b) => {
        const aTime = a.response_deadline ? new Date(a.response_deadline).getTime() : Infinity
        const bTime = b.response_deadline ? new Date(b.response_deadline).getTime() : Infinity
        return aTime - bTime
      })
      .slice(0, 20)
  }, [opportunities, selectedSector])

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.iconWrap}>
          <Compass size={22} />
        </div>
        <h1 className={styles.title}>Markets</h1>
        <p className={styles.sub}>
          Browse currently open SAM.gov opportunities by industry sector — beyond just what's matched to your saved NAICS codes.
        </p>
      </div>

      {opportunities === null && <p className={styles.empty}>Loading markets…</p>}

      {opportunities !== null && !selectedSector && (
        <>
          {sectorCounts.length === 0 ? (
            <p className={styles.empty}>No open opportunities found right now — check back soon.</p>
          ) : (
            <div className={styles.grid}>
              {sectorCounts.map((s) => (
                <button key={s.name} type="button" className={`card card-hover ${styles.sectorCard}`} onClick={() => setSelectedSector(s.name)}>
                  <span className={styles.sectorCount}>{s.count.toLocaleString()}</span>
                  <span className={styles.sectorName}>{s.name}</span>
                  <span className={styles.sectorHint}>open opportunities · Explore →</span>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {selectedSector && (
        <div>
          <button type="button" className="btn btn-ghost" onClick={() => setSelectedSector(null)} style={{ marginBottom: 'var(--sp-4)' }}>
            <ChevronLeft size={14} /> All markets
          </button>
          <h2 className={styles.sectorHeading}>{selectedSector}</h2>
          <p className={styles.sectorSubheading}>{sectorOpportunities.length} of {sectorCounts.find((s) => s.name === selectedSector)?.count || 0} open opportunities, soonest deadline first</p>

          <div className={styles.list}>
            {sectorOpportunities.map((o) => (
              <div key={o.id} className={styles.oppRow}>
                <div className={styles.oppInfo}>
                  <span className={styles.oppTitle}>{o.title}</span>
                  <span className={styles.oppMeta}>
                    {o.agency || 'Agency not listed'}
                    {o.naics_code && ` · NAICS ${o.naics_code}`}
                    {o.estimated_value != null && ` · Est. $${Number(o.estimated_value).toLocaleString()}`}
                  </span>
                </div>
                {o.sam_gov_url && (
                  <a href={o.sam_gov_url} target="_blank" rel="noopener noreferrer" className={styles.oppLink}>
                    View <ExternalLink size={13} />
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
