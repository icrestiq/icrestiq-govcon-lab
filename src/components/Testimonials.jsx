import { TESTIMONIALS } from '../data/testimonials'
import styles from './Testimonials.module.css'

export default function Testimonials() {
  const approved = TESTIMONIALS.filter(t => t.permissionOnFile)
  if (approved.length === 0) return null

  return (
    <section className={styles.testimonials}>
      <div className={styles.sectionHeader}>
        <div className="section-rule" />
        <span className="badge badge-navy">In their words</span>
        <h2 className={styles.sectionTitle}>What members are saying</h2>
      </div>
      <div className={styles.grid}>
        {approved.map((t, i) => (
          <div key={i} className={`card ${styles.card}`}>
            <p className={styles.quote}>&ldquo;{t.quote}&rdquo;</p>
            <div className={styles.attribution}>
              <span className={styles.name}>{t.memberName}</span>
              {t.company && <span className={styles.company}>{t.company}</span>}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
