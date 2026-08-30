
// Shared footer component — appears on all pages
import { Link } from 'react-router-dom'
import { MapPin, Mail } from 'lucide-react'
import SocialLinks from '../SocialLinks'
import styles from './Footer.module.css'

export default function Footer() {
  return (
    <footer className={`${styles.footer} no-print`}>
      <div className={styles.topRow}>
        <div className={styles.contact}>
          <div className={styles.contactItem}>
            <MapPin size={13} aria-hidden="true" />
            <span>Easley, South Carolina</span>
          </div>
          <div className={styles.contactItem}>
            <Mail size={13} aria-hidden="true" />
            <a href="mailto:hello@icrestiq.com">hello@icrestiq.com</a>
          </div>
          <SocialLinks size={16} style={{ color: 'rgba(255,255,255,0.6)' }} linkClassName={styles.socialLink} />
        </div>
        <div className={styles.copy}>
          © {new Date().getFullYear()} iCrestiQ LLC · All rights reserved · govconlab.com
        </div>
      </div>

      <nav className={styles.policyLinks} aria-label="Policies">
        <Link to="/policies">Policies</Link>
        <Link to="/accessibility">Accessibility</Link>
      </nav>

      <nav className={styles.policyLinks} aria-label="Related iCrestiQ sites">
        <a href="https://icrestiq.com" target="_blank" rel="noopener noreferrer">iCrestiQ Sourcing</a>
        <a href="https://icrestiqcommercial.com" target="_blank" rel="noopener noreferrer">iCrestiQ Commercial</a>
      </nav>
    </footer>
  )
}