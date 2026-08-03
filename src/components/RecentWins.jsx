import { RECENT_WINS } from '../data/wins'
import styles from './RecentWins.module.css'

export default function RecentWins() {
  if (RECENT_WINS.length === 0) return null

  return (
    <section className={styles.wins}>
      <div className={styles.sectionHeader}>
        <div className="section-rule" />
        <span className="badge badge-navy">Recent wins</span>
        <h2 className={styles.sectionTitle}>Real awards, real solicitation numbers</h2>
      </div>
      <div className={styles.grid}>
        {RECENT_WINS.map((w, i) => (
          <div key={i} className={`card ${styles.card}`}>
            {w.memberName && <div className={styles.member}>{w.memberName}</div>}
            <div className={styles.solNumber}>{w.solicitationNumber}</div>
            <div className={styles.agency}>{w.agency}</div>
            {w.summary && <p className={styles.summary}>{w.summary}</p>}
          </div>
        ))}
      </div>
    </section>
  )
}
