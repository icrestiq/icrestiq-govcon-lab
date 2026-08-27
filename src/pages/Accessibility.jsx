import { Link } from 'react-router-dom'
import { MapPin, Mail } from 'lucide-react'
import useDocumentTitle from '../hooks/useDocumentTitle'
import styles from './About.module.css'

export default function Accessibility() {
  useDocumentTitle('Accessibility — iCrestiQ GovCon Lab')
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
        <div className={styles.eyebrow}>Accessibility</div>
        <h1 className={styles.heading}>Our accessibility commitment</h1>
        <p className={styles.body}>
          iCrestiQ LLC is working to make GovCon Lab accessible to the widest possible audience,
          including people who use assistive technology such as screen readers, screen
          magnification, voice control, or keyboard-only navigation.
        </p>
        <p className={styles.body}>
          Our technical accessibility target is <strong>WCAG 2.2 Level AA</strong>, the current
          Web Content Accessibility Guidelines published by the W3C. We review and improve the
          site against these guidelines on an ongoing basis — accessibility work is never fully
          "done," and this statement reflects effort and intent, not a claim of complete or
          certified compliance.
        </p>
        <p className={styles.body}>
          If you use assistive technology and run into something on GovCon Lab that doesn't work
          the way you'd expect, or that gets in the way of using the site, please let us know.
          Specifics help — the page you were on, what you were trying to do, and what happened
          instead.
        </p>

        <p className={styles.disclosure}>
          This statement describes our ongoing efforts, not a guarantee that every page or
          feature is fully accessible at all times, and it is not a legal or certification
          document.
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
