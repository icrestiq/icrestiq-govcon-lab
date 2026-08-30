import { Link } from 'react-router-dom'
import { MapPin, Mail } from 'lucide-react'
import useDocumentTitle from '../hooks/useDocumentTitle'
import styles from './About.module.css'

export default function About() {
  useDocumentTitle('About — iCrestiQ GovCon Lab')
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
        <div className={styles.eyebrow}>About</div>
        <h1 className={styles.heading}>Who's behind GovCon Lab</h1>
        <p className={styles.body}>
          GovCon Lab is run by iCrestiQ LLC, a small federal supplier based in Easley, South Carolina.
          We bid DIBBS and SAM.gov opportunities for hardware, fasteners, safety gear, and MRO —
          the same commodity work taught inside the Lab.
        </p>
        <p className={styles.body}>
          Everything here comes from that day-to-day sourcing work, not from theory.
        </p>
        <p className={styles.body}>
          iCrestiQ LLC also operates{' '}
          <a href="https://icrestiq.com" target="_blank" rel="noopener noreferrer" className={styles.link}>iCrestiQ Sourcing</a>
          {' '}(icrestiq.com), the federal supply business this course is drawn from, and{' '}
          <a href="https://icrestiqcommercial.com" target="_blank" rel="noopener noreferrer" className={styles.link}>iCrestiQ Commercial</a>
          {' '}(icrestiqcommercial.com), which sells commercial equipment to construction
          contractors, businesses, and government entities outside the federal-contracting
          process taught here.
        </p>
        <Link to="/#founder" className={styles.link}>Meet the founder →</Link>

        <p className={styles.disclosure}>
          Greg and Riley are illustrated guides we use to teach. GovCon Lab is run by Keith
          Atkinson of iCrestiQ LLC, an active federal supplier.
        </p>
      </main>

      <div className={styles.contact}>
        <div className={styles.contactItem}>
          <MapPin size={14} style={{ color: 'var(--gold)' }} aria-hidden="true" />
          Easley, South Carolina
        </div>
        <a href="mailto:hello@icrestiq.com" className={styles.contactItem}>
          <Mail size={14} style={{ color: 'var(--gold)' }} aria-hidden="true" />
          hello@icrestiq.com
        </a>
      </div>
    </div>
  )
}
