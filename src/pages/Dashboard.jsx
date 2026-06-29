import { Link } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { MessageSquare, ShoppingBag, TrendingUp, ArrowRight, Zap } from 'lucide-react'
import styles from './Dashboard.module.css'

// Each resource gets a distinct color matching GovCon Mastery style
const RESOURCES = [
  { label: 'DIBBS Portal',           url: 'https://www.dibbs.bsm.dla.mil/',        tag: 'Procurement',   color: 'blue'   },
  { label: 'SAM.gov',                url: 'https://sam.gov/',                       tag: 'Registration',  color: 'green'  },
  { label: 'BidNet Direct',          url: 'https://www.bidnet.com/',                tag: 'State/Local',   color: 'purple' },
  { label: 'GovSpend',               url: 'https://www.govspend.com/',              tag: 'Intel',         color: 'orange' },
  { label: 'FPDS-NG',                url: 'https://www.fpds.gov/',                  tag: 'Awards Data',   color: 'red'    },
  { label: 'Beta SAM Opportunities', url: 'https://sam.gov/search/?index=opp',     tag: 'Solicitations', color: 'teal'   },
]

const QUICK_LINKS = [
  { to: '/chat',  icon: MessageSquare, label: 'Community Rooms', desc: 'Jump into live discussions',   color: '#4F6BED' },
  { to: '/store', icon: ShoppingBag,   label: 'GovCon Store',    desc: 'Playbooks, tools & templates', color: '#38A169' },
]

// Color map for resource pills
const PILL_COLORS = {
  blue:   { bg: '#EBF4FF', color: '#2B6CB0', border: '#BEE3F8' },
  green:  { bg: '#F0FFF4', color: '#276749', border: '#9AE6B4' },
  purple: { bg: '#FAF5FF', color: '#6B46C1', border: '#D6BCFA' },
  orange: { bg: '#FFFAF0', color: '#C05621', border: '#FBD38D' },
  red:    { bg: '#FFF5F5', color: '#C53030', border: '#FEB2B2' },
  teal:   { bg: '#E6FFFA', color: '#234E52', border: '#81E6D9' },
}

export default function Dashboard() {
  const { profile } = useAuth()
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <p className={styles.greeting}>{greeting},</p>
          <h1 className={styles.name}>{profile?.first_name || profile?.username || 'Operator'}</h1>
          <p className={styles.tagline}>The government is always purchasing. Let's make sure it's from us.</p>
        </div>
        <div className={styles.statusBadge}>
          <span className="online-dot" />
          <span className="mono">System Active</span>
        </div>
      </div>

      {/* Quick links */}
      <div className={styles.quickLinks}>
        {QUICK_LINKS.map(({ to, icon: Icon, label, desc, color }) => (
          <Link key={to} to={to} className={`card card-hover ${styles.quickCard}`}>
            <div className={styles.quickIcon} style={{ background: color + '15', border: `1px solid ${color}30`, color }}>
              <Icon size={24} />
            </div>
            <div className={styles.quickInfo}>
              <div className={styles.quickLabel}>{label}</div>
              <div className={styles.quickDesc}>{desc}</div>
            </div>
            <ArrowRight size={18} className={styles.quickArrow} />
          </Link>
        ))}
      </div>

      {/* Ops Principle */}
      <div className={styles.principle}>
        <div className={styles.principleIcon}><Zap size={18} /></div>
        <div>
          <div className={styles.principleLabel}>iCrestiQ Operating Principle</div>
          <div className={styles.principleText}>
            Systems over hustle. Relationships over transactions. Compliance over speed. AI is our force multiplier.
          </div>
        </div>
      </div>

      {/* Gov Resources */}
      <div className={styles.section}>
        <div className={styles.sectionHead}>
          <TrendingUp size={16} />
          <h2 className={styles.sectionTitle}>GovCon Quick Links</h2>
        </div>
        <div className={styles.resourceGrid}>
          {RESOURCES.map(({ label, url, tag, color }) => {
            const pill = PILL_COLORS[color]
            return (
              <a key={label} href={url} target="_blank" rel="noopener noreferrer"
                className={`card card-hover ${styles.resource}`}>
                <div className={styles.resourceLabel}>{label}</div>
                <span className={styles.pill} style={{
                  background: pill.bg,
                  color: pill.color,
                  border: `1px solid ${pill.border}`,
                }}>
                  {tag}
                </span>
              </a>
            )
          })}
        </div>
      </div>
    </div>
  )
}
