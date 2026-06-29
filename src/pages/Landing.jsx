import { Link } from 'react-router-dom'
import { Shield, Zap, MessageSquare, ShoppingBag, TrendingUp, Lock, Phone, Mail, MapPin } from 'lucide-react'
import styles from './Landing.module.css'

const FEATURES = [
  {
    icon: MessageSquare,
    title: 'Live Community Rooms',
    desc: 'Real-time chat with active GovCon operators. RFQ help, vendor intel, win announcements — the inner circle.',
    color: '#4F6BED', bg: '#EBF4FF',
  },
  {
    icon: ShoppingBag,
    title: 'GovCon Playbook Store',
    desc: 'Niche-specific sourcing playbooks, bid tools, and templates built from real DIBBS and SAM.gov experience.',
    color: '#38A169', bg: '#F0FFF4',
  },
  {
    icon: TrendingUp,
    title: 'Courses & Training',
    desc: 'Step-by-step curriculum from entity setup through AI-powered RFQ pipelines. Learn the system, run the system.',
    color: '#C05621', bg: '#FFFAF0',
  },
  {
    icon: Zap,
    title: 'AI-Powered Workflows',
    desc: 'Automation blueprints for Make.com, HubSpot CRM routing, and PDF-to-quote pipelines.',
    color: '#C9A84C', bg: '#FFFFF0',
  },
  {
    icon: Shield,
    title: 'Compliance Framework',
    desc: 'MIL-SPEC packaging guides, DFARS compliance checklists, and vendor qualification templates.',
    color: '#6B46C1', bg: '#FAF5FF',
  },
  {
    icon: Lock,
    title: 'Members-Only Intel',
    desc: 'Insider sourcing channels, vendor lists, and niche category breakdowns not available anywhere else.',
    color: '#C53030', bg: '#FFF5F5',
  },
]

const NICHES = [
  'Hardware & Fasteners', 'Janitorial & Sanitation',
  'Safety & PPE', 'MRO & Industrial Parts',
  'Medical Supplies', 'Tools & Equipment',
  'Office & Facilities', 'IT & Electronics',
]

export default function Landing() {
  return (
    <div className={styles.page}>
      {/* Nav */}
      <nav className={styles.nav}>
        <div className={styles.navLogo}>
          <div className={styles.logoMark}>iQ</div>
          <div>
            <div className={styles.logoText}>GovCon Lab</div>
            <div className={styles.logoSub}>by iCrestiQ</div>
          </div>
        </div>
        <div className={styles.navActions}>
          <Link to="/login" className="btn btn-ghost hide-mobile">Sign In</Link>
          <Link to="/register" className="btn btn-primary">Join the Lab</Link>
        </div>
      </nav>

      {/* Hero */}
      <section className={styles.hero}>
        <div className={styles.heroGrid} aria-hidden="true" />
        <div className={styles.heroContent}>
          <div className={styles.heroBadge}>
            <span className="online-dot" />
            <span>Community is live</span>
          </div>
          <h1 className={styles.heroTitle}>
            The government is always purchasing.
            <span className={styles.heroAccent}>It might as well be from us.</span>
          </h1>
          <p className={styles.heroSub}>
            iCrestiQ GovCon Lab is the private community and resource hub for serious government
            contracting operators. Real playbooks. Real automation. Real results.
          </p>
          <div className={styles.heroActions}>
            <Link to="/register" className="btn btn-primary" style={{ fontSize: '1rem', padding: '14px 28px' }}>
              Access the Lab →
            </Link>
            <Link to="/login" className="btn btn-ghost">Already a member</Link>
          </div>
          <div className={styles.heroStats}>
            <div className={styles.stat}>
              <span className={styles.statNum}>$7.5T+</span>
              <span className={styles.statLabel}>Annual gov spending</span>
            </div>
            <div className={styles.statDivider} />
            <div className={styles.stat}>
              <span className={styles.statNum}>8</span>
              <span className={styles.statLabel}>Active niche playbooks</span>
            </div>
            <div className={styles.statDivider} />
            <div className={styles.stat}>
              <span className={styles.statNum}>DIBBS</span>
              <span className={styles.statLabel}>Primary platform focus</span>
            </div>
          </div>
        </div>
      </section>

      {/* Niche ticker */}
      <div className={styles.ticker}>
        <div className={styles.tickerLabel}>ACTIVE NICHES</div>
        <div className={styles.tickerItems}>
          {[...NICHES, ...NICHES].map((n, i) => (
            <span key={i} className={styles.tickerItem}>• {n}</span>
          ))}
        </div>
      </div>

      {/* Features */}
      <section className={styles.features}>
        <div className={styles.sectionHeader}>
          <span className="badge badge-navy">What's inside</span>
          <h2 className={styles.sectionTitle}>Everything you need to run a lean GovCon operation</h2>
        </div>
        <div className={styles.featureGrid}>
          {FEATURES.map(({ icon: Icon, title, desc, color, bg }) => (
            <div key={title} className={`card card-hover ${styles.featureCard}`}>
              <div className={styles.featureIcon} style={{ background: bg, border: `1px solid ${color}30`, color }}>
                <Icon size={22} />
              </div>
              <h3 className={styles.featureTitle}>{title}</h3>
              <p className={styles.featureDesc}>{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className={styles.cta}>
        <div className={styles.ctaInner}>
          <h2 className={styles.ctaTitle}>Stop watching. Start sourcing.</h2>
          <p className={styles.ctaSub}>
            Join the GovCon Lab and get immediate access to the community, store, and growing course library.
          </p>
          <Link to="/register" className="btn btn-gold" style={{ fontSize: '1rem', padding: '14px 32px' }}>
            Create Your Account →
          </Link>
        </div>
      </section>

      {/* Contact */}
      <section className={styles.contact}>
        <div className={styles.contactInner}>
          <div>
            <div className={styles.contactLabel}>Location</div>
            <div className={styles.contactValue}>
              <MapPin size={14} style={{ display: 'inline', marginRight: 6, color: 'var(--gold)' }} />
              Easley, South Carolina
            </div>
          </div>
          <div>
            <div className={styles.contactLabel}>Phone</div>
            <a href="tel:8646318250" className={styles.contactLink}>
              <Phone size={14} style={{ display: 'inline', marginRight: 6, color: 'var(--gold)' }} />
              (864) 631-8250
            </a>
          </div>
          <div>
            <div className={styles.contactLabel}>Email</div>
            <a href="mailto:keith@icrestiq.com" className={styles.contactLink}>
              <Mail size={14} style={{ display: 'inline', marginRight: 6, color: 'var(--gold)' }} />
              keith@icrestiq.com
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className={styles.footer}>
        <div className={styles.footerLogo}>
          <div className={styles.logoMark} style={{ background: 'rgba(255,255,255,0.15)', color: '#FFFFFF' }}>iQ</div>
          <span className={styles.footerText}>© 2025 iCrestiQ LLC · Easley, South Carolina · All rights reserved.</span>
        </div>
        <div className={styles.footerRight}>govconlab.com</div>
      </footer>
    </div>
  )
}
