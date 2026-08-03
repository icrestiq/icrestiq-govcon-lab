import { Link } from 'react-router-dom'
import styles from './ProofSection.module.css'

const QUOTES = [
  {
    id: 'army-corps',
    caption: 'U.S. Army Corps of Engineers — Industrial Hardware & Fasteners — Submitted May 2025',
    alt: 'Redacted SAM.gov quote proposal from iCrestiQ LLC to the U.S. Army Corps of Engineers for industrial hardware and fasteners',
    webp: '/images/proof/sam-quote-army-corps.webp',
    png: '/images/proof/sam-quote-army-corps.png',
    full: '/images/proof/sam-quote-army-corps-full.png',
    width: 1280,
    height: 854,
  },
  {
    id: 'navy-supply',
    caption: 'Naval Supply Systems Command — Electrical Supplies & Components — Submitted May 2025',
    alt: 'Redacted SAM.gov quote proposal from iCrestiQ LLC to the Naval Supply Systems Command for electrical supplies and components',
    webp: '/images/proof/sam-quote-navy-supply.webp',
    png: '/images/proof/sam-quote-navy-supply.png',
    full: '/images/proof/sam-quote-navy-supply-full.png',
    width: 1280,
    height: 853,
  },
]

export default function ProofSection() {
  return (
    <section className={styles.proof}>
      <div className={styles.sectionHeader}>
        <h2 className={styles.heading}>I quote these every week. Here&rsquo;s the receipt.</h2>
        <p className={styles.subline}>
          Two of the 15 federal solicitations I quoted this year. Pricing redacted — everything else is
          exactly what the government sees.
        </p>
      </div>

      <div className={styles.grid}>
        {QUOTES.map(q => (
          <div key={q.id} className={styles.card}>
            <a href={q.full} target="_blank" rel="noopener noreferrer" className={styles.imageLink}>
              <picture>
                <source srcSet={q.webp} type="image/webp" />
                <img
                  src={q.png}
                  alt={q.alt}
                  width={q.width}
                  height={q.height}
                  loading="lazy"
                  decoding="async"
                  className={styles.image}
                />
              </picture>
            </a>
            <div className={styles.caption}>{q.caption}</div>
          </div>
        ))}
      </div>

      <p className={styles.regLine}>
        CAGE 92LW9 · UEI CUDPXJPC6UB6 · Registered and active in SAM.gov.
      </p>

      <div className={styles.ctaRow}>
        <Link to="/register" className="btn btn-gold">
          Start free — no card required
        </Link>
      </div>
    </section>
  )
}
