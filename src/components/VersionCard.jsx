import { useState } from 'react'
import { Tag, ChevronDown, ChevronUp } from 'lucide-react'
import { SITE_VERSION, CHANGELOG } from '../data/changelog'
import styles from './VersionCard.module.css'

// Collapsed to just the version badge by default — the changelog itself
// only renders once expanded, so this stays a one-line footprint no
// matter how many entries accumulate over time.
export default function VersionCard() {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className={`card ${styles.card}`}>
      <button type="button" className={styles.top} onClick={() => setExpanded((v) => !v)}>
        <span className={styles.versionBadge}>
          <Tag size={13} /> v{SITE_VERSION}
        </span>
        <span className={styles.toggleLabel}>
          {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          {expanded ? 'Hide changelog' : 'What\'s new'}
        </span>
      </button>

      {expanded && CHANGELOG.map((entry, i) => (
        <div key={entry.version} className={`${styles.entry} ${i === 0 ? styles.entryFirst : ''}`}>
          <div className={styles.entryHead}>v{entry.version} — {entry.date}</div>
          <ul className={styles.notes}>
            {entry.notes.map((note, j) => <li key={j}>{note}</li>)}
          </ul>
        </div>
      ))}
    </div>
  )
}
