// src/pages/Directory.jsx
// Market Intelligence Redesign, Phase 4 — public, unauthenticated
// directory of member companies who've opted in and been approved (see
// directory_listings' RLS: anon can only ever read status = 'approved'
// rows). A public route, not wrapped in ProtectedRoute or TierRoute —
// this is the lead-gen/discoverability surface, the opposite of gated.

import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Building2, Search, ExternalLink, Mail } from 'lucide-react'
import { supabase } from '../lib/supabase'
import useDocumentTitle from '../hooks/useDocumentTitle'
import styles from './Directory.module.css'

export default function Directory() {
  useDocumentTitle('Business Directory — GovCon Lab')
  const [listings, setListings] = useState(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data, error } = await supabase
        .from('directory_listings')
        .select('id, company_name, cage_code, website, naics_codes, set_aside_certifications, capabilities_summary, contact_email')
        .eq('status', 'approved')
        .order('company_name')
      if (cancelled) return
      if (error) { console.error('Failed to load directory:', error); setListings([]); return }
      setListings(data || [])
    })()
    return () => { cancelled = true }
  }, [])

  const filtered = useMemo(() => {
    if (!listings) return []
    const term = search.trim().toLowerCase()
    if (!term) return listings
    return listings.filter((l) =>
      l.company_name.toLowerCase().includes(term) ||
      (l.cage_code || '').toLowerCase().includes(term) ||
      (l.naics_codes || []).some((c) => c.toLowerCase().includes(term))
    )
  }, [listings, search])

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.iconWrap}>
          <Building2 size={22} />
        </div>
        <h1 className={styles.title}>Business Directory</h1>
        <p className={styles.sub}>
          GovCon Lab members' businesses, discoverable by anyone — buyers, teaming partners, and other contractors.
        </p>
      </div>

      <div className={styles.searchRow}>
        <Search size={14} />
        <input
          className="input"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by company name, CAGE code, or NAICS code…"
        />
      </div>

      {listings === null && <p className={styles.empty}>Loading directory…</p>}

      {listings !== null && listings.length === 0 && (
        <p className={styles.empty}>No listings yet — be the first. Members can add a free listing from their Profile page.</p>
      )}

      {listings !== null && listings.length > 0 && filtered.length === 0 && (
        <p className={styles.empty}>No listings match "{search}".</p>
      )}

      {filtered.length > 0 && (
        <div className={styles.grid}>
          {filtered.map((l) => (
            <div key={l.id} className={`card ${styles.listingCard}`}>
              <h3 className={styles.listingName}>{l.company_name}</h3>
              <div className={styles.metaRow}>
                {l.cage_code && <span className="badge badge-navy">CAGE {l.cage_code}</span>}
                {(l.set_aside_certifications || []).map((cert) => (
                  <span key={cert} className="badge badge-green">{cert}</span>
                ))}
              </div>
              {l.naics_codes?.length > 0 && (
                <p className={styles.naicsLine}>NAICS: {l.naics_codes.join(', ')}</p>
              )}
              {l.capabilities_summary && <p className={styles.capabilities}>{l.capabilities_summary}</p>}
              <div className={styles.linkRow}>
                {l.website && (
                  <a href={l.website} target="_blank" rel="noopener noreferrer" className={styles.link}>
                    Website <ExternalLink size={12} />
                  </a>
                )}
                {l.contact_email && (
                  <a href={`mailto:${l.contact_email}`} className={styles.link}>
                    <Mail size={12} /> Contact
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <p className={styles.cta}>
        Have a business you want listed? <Link to="/register">Join GovCon Lab</Link> and add your free listing from your profile.
      </p>
    </div>
  )
}
