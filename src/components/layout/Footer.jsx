
// Shared footer component — appears on all pages
import { MapPin, Mail } from 'lucide-react'
import styles from './Footer.module.css'

export default function Footer() {
  return (
    <footer className={`${styles.footer} no-print`}>
      <div className={styles.contact}>
        <div className={styles.contactItem}>
          <MapPin size={13} />
          <span>Easley, South Carolina</span>
        </div>
        <div className={styles.contactItem}>
          <Mail size={13} />
          <a href="mailto:hello@icrestiq.com">hello@icrestiq.com</a>
        </div>
      </div>
      <div className={styles.copy}>
        © {new Date().getFullYear()} iCrestiQ LLC · All rights reserved · govconlab.com
      </div>
    </footer>
  )
}