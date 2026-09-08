// src/pages/Markets.jsx
// Market Intelligence Redesign, Phase 2 — browsable NAICS-sector view of
// all currently-open opportunities (not just this member's own matches),
// mirroring Mindy's "Start Exploring" market categories. opportunities'
// own RLS allows any authenticated user to SELECT (confirmed live via
// pg_policies, 2026-09-08 — "Authenticated users can view opportunities",
// qual: true), so this queries the table directly rather than needing a
// server-side aggregate route like the incumbent/stats ones.
//
// Phase 5 addition: a state-level map view. opportunities has no
// dedicated location column, but sam_gov_ingest already stores SAM.gov's
// full placeOfPerformance object inside raw_payload (confirmed live via
// direct query 2026-09-08 — used by generate_suggested_bid's own
// formatPlaceOfPerformance() for the exact same field). Selected via a
// nested PostgREST path (raw_payload->placeOfPerformance->state->>code)
// rather than fetching the whole raw_payload blob, which can be several
// KB per row. Only ~16% of open opportunities carry a place of
// performance at all (382 of 2323 as of the same check) — the map
// necessarily only shows that subset, called out on the page itself.

import { useEffect, useMemo, useState } from 'react'
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { Compass, ExternalLink, ChevronLeft, Map as MapIcon, Grid3x3 } from 'lucide-react'
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

// State-level centroids only — opportunities carries city/state, not
// lat/lon, and geocoding every city would need a paid API. A bubble per
// state (sized by count) is the honest resolution of the data actually
// available, same principle as Markets' own sector counts being a recent
// sample rather than a precise live total.
const STATE_CENTROIDS = {
  AL: { name: 'Alabama', lat: 32.8, lon: -86.8 }, AK: { name: 'Alaska', lat: 64.2, lon: -149.5 },
  AZ: { name: 'Arizona', lat: 34.2, lon: -111.9 }, AR: { name: 'Arkansas', lat: 34.9, lon: -92.4 },
  CA: { name: 'California', lat: 37.2, lon: -119.7 }, CO: { name: 'Colorado', lat: 39.0, lon: -105.5 },
  CT: { name: 'Connecticut', lat: 41.6, lon: -72.7 }, DE: { name: 'Delaware', lat: 39.0, lon: -75.5 },
  DC: { name: 'Washington DC', lat: 38.9, lon: -77.0 }, FL: { name: 'Florida', lat: 28.6, lon: -82.4 },
  GA: { name: 'Georgia', lat: 32.6, lon: -83.4 }, HI: { name: 'Hawaii', lat: 20.3, lon: -156.4 },
  ID: { name: 'Idaho', lat: 44.4, lon: -114.6 }, IL: { name: 'Illinois', lat: 40.0, lon: -89.2 },
  IN: { name: 'Indiana', lat: 39.9, lon: -86.3 }, IA: { name: 'Iowa', lat: 42.0, lon: -93.5 },
  KS: { name: 'Kansas', lat: 38.5, lon: -98.4 }, KY: { name: 'Kentucky', lat: 37.5, lon: -85.3 },
  LA: { name: 'Louisiana', lat: 31.0, lon: -92.0 }, ME: { name: 'Maine', lat: 45.4, lon: -69.2 },
  MD: { name: 'Maryland', lat: 39.0, lon: -76.7 }, MA: { name: 'Massachusetts', lat: 42.3, lon: -71.8 },
  MI: { name: 'Michigan', lat: 44.3, lon: -85.4 }, MN: { name: 'Minnesota', lat: 46.3, lon: -94.3 },
  MS: { name: 'Mississippi', lat: 32.7, lon: -89.7 }, MO: { name: 'Missouri', lat: 38.5, lon: -92.5 },
  MT: { name: 'Montana', lat: 46.9, lon: -110.4 }, NE: { name: 'Nebraska', lat: 41.5, lon: -99.8 },
  NV: { name: 'Nevada', lat: 39.3, lon: -116.6 }, NH: { name: 'New Hampshire', lat: 43.7, lon: -71.6 },
  NJ: { name: 'New Jersey', lat: 40.1, lon: -74.7 }, NM: { name: 'New Mexico', lat: 34.4, lon: -106.1 },
  NY: { name: 'New York', lat: 42.9, lon: -75.5 }, NC: { name: 'North Carolina', lat: 35.6, lon: -79.4 },
  ND: { name: 'North Dakota', lat: 47.5, lon: -100.5 }, OH: { name: 'Ohio', lat: 40.4, lon: -82.8 },
  OK: { name: 'Oklahoma', lat: 35.6, lon: -97.5 }, OR: { name: 'Oregon', lat: 44.0, lon: -120.6 },
  PA: { name: 'Pennsylvania', lat: 41.0, lon: -77.6 }, RI: { name: 'Rhode Island', lat: 41.7, lon: -71.6 },
  SC: { name: 'South Carolina', lat: 33.9, lon: -80.9 }, SD: { name: 'South Dakota', lat: 44.4, lon: -100.2 },
  TN: { name: 'Tennessee', lat: 35.9, lon: -86.4 }, TX: { name: 'Texas', lat: 31.5, lon: -99.3 },
  UT: { name: 'Utah', lat: 39.3, lon: -111.7 }, VT: { name: 'Vermont', lat: 44.0, lon: -72.7 },
  VA: { name: 'Virginia', lat: 37.5, lon: -78.7 }, WA: { name: 'Washington', lat: 47.4, lon: -120.5 },
  WV: { name: 'West Virginia', lat: 38.6, lon: -80.6 }, WI: { name: 'Wisconsin', lat: 44.6, lon: -89.9 },
  WY: { name: 'Wyoming', lat: 42.9, lon: -107.5 },
  PR: { name: 'Puerto Rico', lat: 18.2, lon: -66.5 }, GU: { name: 'Guam', lat: 13.4, lon: 144.8 },
  VI: { name: 'U.S. Virgin Islands', lat: 18.3, lon: -64.9 }, AS: { name: 'American Samoa', lat: -14.3, lon: -170.7 },
  MP: { name: 'Northern Mariana Islands', lat: 15.2, lon: 145.7 },
}

// A rough recent-window sample, not an exhaustive live count — fetching
// every open opportunity's full row for an exact count isn't worth the
// payload size for a browse page. Ordered by newest first so the sample
// (and therefore the sector/state counts) skews toward what's actually
// currently postable, not whatever's oldest in the table.
const SAMPLE_LIMIT = 2000

function OpportunityList({ opportunities }) {
  return (
    <div className={styles.list}>
      {opportunities.map((o) => (
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
  )
}

function sortByDeadline(list) {
  return [...list].sort((a, b) => {
    const aTime = a.response_deadline ? new Date(a.response_deadline).getTime() : Infinity
    const bTime = b.response_deadline ? new Date(b.response_deadline).getTime() : Infinity
    return aTime - bTime
  })
}

export default function Markets() {
  useDocumentTitle('Markets — GovCon Lab')
  const [opportunities, setOpportunities] = useState(null)
  const [viewMode, setViewMode] = useState('sectors')
  const [selectedSector, setSelectedSector] = useState(null)
  const [selectedState, setSelectedState] = useState(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const nowIso = new Date().toISOString()
      const { data, error } = await supabase
        .from('opportunities')
        .select('id, title, agency, naics_code, response_deadline, sam_gov_url, estimated_value, created_at, pop_state:raw_payload->placeOfPerformance->state->>code')
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
    return sortByDeadline(opportunities.filter((o) => SECTOR_NAMES[o.naics_code?.slice(0, 2)] === selectedSector)).slice(0, 20)
  }, [opportunities, selectedSector])

  const stateCounts = useMemo(() => {
    if (!opportunities) return []
    const counts = {}
    for (const o of opportunities) {
      const code = o.pop_state?.toUpperCase()
      if (!code || !STATE_CENTROIDS[code]) continue
      if (!counts[code]) counts[code] = 0
      counts[code] += 1
    }
    return Object.entries(counts).map(([code, count]) => ({ code, count, ...STATE_CENTROIDS[code] }))
  }, [opportunities])

  const stateOpportunities = useMemo(() => {
    if (!opportunities || !selectedState) return []
    return sortByDeadline(opportunities.filter((o) => o.pop_state?.toUpperCase() === selectedState)).slice(0, 20)
  }, [opportunities, selectedState])

  const maxStateCount = Math.max(1, ...stateCounts.map((s) => s.count))

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.iconWrap}>
          <Compass size={22} />
        </div>
        <h1 className={styles.title}>Markets</h1>
        <p className={styles.sub}>
          Browse currently open SAM.gov opportunities by industry sector or place of performance — beyond just what's matched to your saved NAICS codes.
        </p>
      </div>

      <div className={styles.viewToggle}>
        <button type="button" className={`${styles.viewToggleBtn} ${viewMode === 'sectors' ? styles.viewToggleActive : ''}`} onClick={() => setViewMode('sectors')}>
          <Grid3x3 size={14} /> By Sector
        </button>
        <button type="button" className={`${styles.viewToggleBtn} ${viewMode === 'map' ? styles.viewToggleActive : ''}`} onClick={() => setViewMode('map')}>
          <MapIcon size={14} /> By Map
        </button>
      </div>

      {opportunities === null && <p className={styles.empty}>Loading markets…</p>}

      {opportunities !== null && viewMode === 'sectors' && !selectedSector && (
        sectorCounts.length === 0 ? (
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
        )
      )}

      {viewMode === 'sectors' && selectedSector && (
        <div>
          <button type="button" className="btn btn-ghost" onClick={() => setSelectedSector(null)} style={{ marginBottom: 'var(--sp-4)' }}>
            <ChevronLeft size={14} /> All markets
          </button>
          <h2 className={styles.sectorHeading}>{selectedSector}</h2>
          <p className={styles.sectorSubheading}>{sectorOpportunities.length} of {sectorCounts.find((s) => s.name === selectedSector)?.count || 0} open opportunities, soonest deadline first</p>
          <OpportunityList opportunities={sectorOpportunities} />
        </div>
      )}

      {opportunities !== null && viewMode === 'map' && (
        <div>
          <p className={styles.mapNote}>
            Only opportunities with a listed place of performance are shown here — most SAM.gov notices don't specify one, so this is a partial view, not every open opportunity.
          </p>
          <div className={styles.mapWrap}>
            <MapContainer center={[39.5, -98.5]} zoom={4} scrollWheelZoom={true} style={{ height: '100%', width: '100%' }}>
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {stateCounts.map((s) => (
                <CircleMarker
                  key={s.code}
                  center={[s.lat, s.lon]}
                  radius={8 + (s.count / maxStateCount) * 22}
                  pathOptions={{ color: '#1B2A4A', fillColor: '#4F6BED', fillOpacity: 0.6, weight: 1.5 }}
                  eventHandlers={{ click: () => setSelectedState(s.code) }}
                >
                  <Popup>
                    <strong>{s.name}</strong><br />
                    {s.count} open {s.count === 1 ? 'opportunity' : 'opportunities'}<br />
                    <button type="button" onClick={() => setSelectedState(s.code)} style={{ marginTop: 4, cursor: 'pointer' }}>View list →</button>
                  </Popup>
                </CircleMarker>
              ))}
            </MapContainer>
          </div>

          {selectedState && (
            <div style={{ marginTop: 'var(--sp-6)' }}>
              <button type="button" className="btn btn-ghost" onClick={() => setSelectedState(null)} style={{ marginBottom: 'var(--sp-4)' }}>
                <ChevronLeft size={14} /> Hide list
              </button>
              <h2 className={styles.sectorHeading}>{STATE_CENTROIDS[selectedState]?.name || selectedState}</h2>
              <p className={styles.sectorSubheading}>{stateOpportunities.length} of {stateCounts.find((s) => s.code === selectedState)?.count || 0} open opportunities, soonest deadline first</p>
              <OpportunityList opportunities={stateOpportunities} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
