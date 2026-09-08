import { useEffect, useState } from 'react'
import { Radar } from 'lucide-react'
import styles from './PlatformStats.module.css'

// Same principle as MemberCount.jsx's DISPLAY_THRESHOLD — a small real
// number reads worse than no number, and this platform's Sourcing
// Pipeline CRM has had exactly one active user historically, so several
// of these will start well below their threshold. Each stat is gated
// independently rather than showing the whole bar or nothing, so early
// stats (opportunities/matches, which come from SAM.gov ingestion volume
// rather than member activity) can appear before deal-based ones do.
const THRESHOLDS = {
  opportunitiesTracked: 100,
  matchesMade: 20,
  dealsWon: 3,
  pursuedValue: 10000,
}

export default function PlatformStats() {
  const [stats, setStats] = useState(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/public/stats')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (!cancelled && data) setStats(data) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  if (!stats) return null

  const items = [
    stats.opportunitiesTracked >= THRESHOLDS.opportunitiesTracked && {
      value: stats.opportunitiesTracked.toLocaleString(),
      label: 'SAM.gov opportunities tracked',
    },
    stats.matchesMade >= THRESHOLDS.matchesMade && {
      value: stats.matchesMade.toLocaleString(),
      label: 'Opportunities matched to members',
    },
    stats.dealsWon >= THRESHOLDS.dealsWon && {
      value: stats.dealsWon.toLocaleString(),
      label: 'Contracts won by members',
    },
    stats.pursuedValue >= THRESHOLDS.pursuedValue && {
      value: `$${Math.round(stats.pursuedValue / 1000).toLocaleString()}K+`,
      label: 'In contract value pursued',
    },
  ].filter(Boolean)

  if (items.length === 0) return null

  return (
    <div className={styles.bar}>
      <div className={styles.label}>
        <Radar size={13} /> Live platform activity
      </div>
      <div className={styles.grid}>
        {items.map((item) => (
          <div key={item.label} className={styles.stat}>
            <span className={styles.value}>{item.value}</span>
            <span className={styles.statLabel}>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
