import { Link } from 'react-router-dom'
import useDocumentTitle from '../hooks/useDocumentTitle'
import { POLICIES } from '../data/policies'
import styles from './PolicyPage.module.css'

export default function PoliciesIndex() {
  useDocumentTitle('Policies — iCrestiQ GovCon Lab')

  return (
    <div className={styles.page}>
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <nav className={styles.nav}>
        <Link to="/" className={styles.navLogo}>
          <div className={styles.logoMark}>iQ</div>
          <div>
            <div className={styles.logoText}>iCrestiQ GovCon Lab</div>
            <div className={styles.logoSub}>by iCrestiQ LLC</div>
          </div>
        </Link>
        <div className={styles.navActions}>
          <Link to="/login" className="btn btn-ghost hide-mobile">Sign In</Link>
          <Link to="/register" className="btn btn-primary">Join the Lab</Link>
        </div>
      </nav>

      <main id="main-content" className={styles.content}>
        <div className={styles.eyebrow}>Legal</div>
        <h1 className={styles.heading}>Policies</h1>
        <p className={styles.intro}>
          The full set of policies that govern GovCon Lab, all effective {POLICIES[0].effectiveDate}.
          Select a policy below to read it in full.
        </p>

        <div className={styles.policyList}>
          {POLICIES.map((p) => (
            <Link key={p.slug} to={`/policies/${p.slug}`} className={styles.policyCard}>
              <div className={styles.policyCardTitle}>{p.label}</div>
              {p.summary && <div className={styles.policyCardSummary}>{p.summary}</div>}
            </Link>
          ))}
          <Link to="/accessibility" className={styles.policyCard}>
            <div className={styles.policyCardTitle}>Accessibility Statement</div>
            <div className={styles.policyCardSummary}>Our accessibility target and how to reach us about barriers you encounter.</div>
          </Link>
        </div>
      </main>
    </div>
  )
}
