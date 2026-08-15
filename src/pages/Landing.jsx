import { useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Shield, Zap, MessageSquare, ShoppingBag, TrendingUp, Lock, Mail, MapPin, FileText, Check } from 'lucide-react'
import { TIERS, FOUNDING } from './Membership'
import MemberCount from '../components/MemberCount'
import Testimonials from '../components/Testimonials'
import RecentWins from '../components/RecentWins'
import DigestSignup from '../components/DigestSignup'
import FoundingSpotsCounter, { useFoundingSpotsRemaining } from '../components/FoundingSpotsCounter'
import ProofSection from '../components/ProofSection'
import SampleOutputStrip from '../components/SampleOutputStrip'
import styles from './Landing.module.css'

const FEATURES = [
  {
    icon: MessageSquare,
    title: 'Live Community Rooms',
    desc: 'Post a quote you\u2019re unsure about in RFQ Help and get feedback before you submit it — real operators, not a forum full of theory.',
    color: '#4F6BED', bg: '#EBF4FF',
  },
  {
    icon: ShoppingBag,
    title: 'GovCon Playbook Store',
    desc: 'A step-by-step playbook for quoting fasteners, janitorial supplies, or safety gear — built from solicitations we\u2019ve actually bid.',
    color: '#38A169', bg: '#F0FFF4',
  },
  {
    icon: TrendingUp,
    title: 'Courses & Training',
    desc: 'Start with registering your entity, end with quoting your first RFQ — in the order you\u2019ll actually need it.',
    color: '#C05621', bg: '#FFFAF0',
  },
  {
    icon: Zap,
    title: 'Automations & Workflows',
    desc: 'Prompts and automations you can paste straight into your own Make.com or HubSpot setup — no coding required.',
    color: '#C9A84C', bg: '#FFFFF0',
  },
{
    icon: FileText,
    title: 'Proposal Builder',
    desc: 'Fill in one form and you\u2019ll have a print-ready proposal — cover letter, technical approach, past performance, and pricing.',
    color: '#1F3864', bg: '#EEF1F8',
  },
  {
    icon: Shield,
    title: 'Compliance Framework',
    desc: 'MIL-SPEC packaging guides and DFARS checklists you can hand straight to a contracting officer.',
    color: '#6B46C1', bg: '#FAF5FF',
  },
  {
    icon: Lock,
    title: 'Vendor Intel Channels',
    desc: 'Vendor leads and pricing notes from the Vendor Intel room — operators sourcing hardware, fasteners, and safety gear right now.',
    color: '#C53030', bg: '#FFF5F5',
  },
]

// Verified 2026-08-03 against the live products list in Supabase (via
// AdminPanel screenshot) — these 9 niche playbooks are confirmed ACTIVE.
// "Tools & Equipment" was in the original ticker but has no matching
// product anywhere in the live list (active or hidden), so it's dropped
// rather than guessed at. If it's actually planned, add it back as 'soon'.
const NICHES = [
  { name: 'Hardware & Fasteners', status: 'active' },
  { name: 'Janitorial & Sanitation', status: 'active' },
  { name: 'Safety & PPE', status: 'active' },
  { name: 'MRO & Industrial Parts', status: 'active' },
  { name: 'Medical & Lab Supplies', status: 'active' },
  { name: 'Office & Facilities', status: 'active' },
  { name: 'IT & Electronics', status: 'active' },
  { name: 'Courier & Trucking', status: 'active' },
  { name: 'Landscaping & Grounds Maintenance', status: 'active' },
]

// Short, homepage-teaser feature summaries. Pulled from the real feature lists in
// Membership.jsx (see TIERS / FOUNDING import above) — this only controls which of
// those already-true bullets get surfaced here, not the underlying price/period/name
// data, so the two pages can't drift out of sync on the numbers that matter.
const PRICING_SUMMARY = {
  Free: [TIERS[0].features[1], TIERS[0].features[3], TIERS[0].features[0]],
  'Lab Member': [TIERS[1].features[1], TIERS[1].features[2], TIERS[1].features[4]],
  'Lab Pro': [TIERS[2].features[1], TIERS[2].features[2], TIERS[2].features[4]],
}
const FOUNDING_SUMMARY = ['Lifetime access to everything', 'Private Founding Members chat room', 'First 25 spots only']

const PRICING_CTAS = {
  Free: 'Create free account',
  'Lab Member': 'Join the Lab',
  'Lab Pro': 'Go Pro',
}

const PAYMENT_LABELS = ['Visa', 'Mastercard', 'Amex', 'Klarna', 'Affirm', 'Apple Pay', 'Google Pay']

export default function Landing() {
  const foundingSpotsRemaining = useFoundingSpotsRemaining()
  const location = useLocation()

  useEffect(() => {
    if (!location.hash) return
    // Give the page a moment to finish its initial render before scrolling —
    // jumping on the same tick as navigation can land in the wrong spot.
    const id = location.hash.slice(1)
    const timer = setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 80)
    return () => clearTimeout(timer)
  }, [location.hash])

  return (
    <div className={styles.page}>
      {/* Nav */}
      <nav className={styles.nav}>
        <div className={styles.navLogo}>
          <div className={styles.logoMark}>iQ</div>
          <div>
            <div className={styles.logoText}>iCrestiQ GovCon Lab</div>
            <div className={styles.logoSub}>by iCrestiQ LLC</div>
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
          <div className={styles.heroEyebrow}>
            Federal product contracting · Taught by a supplier
          </div>
          <h1 className={styles.heroTitle}>
            The government is always buying.
            <span className={styles.heroAccent}>There&rsquo;s no reason it can&rsquo;t buy from you.</span>
          </h1>
          <p className={styles.heroSub}>
            GovCon Lab teaches small businesses how to find, quote and win federal contracts
            for real products — fasteners, safety gear, janitorial, MRO. Not theory. The same
            process we run at iCrestiQ every week.
          </p>
          <div className={styles.heroActions}>
            <Link to="/register" className={`btn ${styles.heroCtaPrimary}`} style={{ fontSize: '1rem', padding: '14px 28px' }}>
              Start free — no card required
            </Link>
            <Link to="/membership" className={styles.heroCtaSecondary}>
              See what&rsquo;s inside → $57/mo after the free tier
            </Link>
          </div>
          <MemberCount />
          <div className={styles.heroStats}>
            <div className={styles.stat}>
              <span className={styles.statNum}>$179B</span>
              <span className={styles.statLabel}>Awarded to small business, FY2025</span>
            </div>
            <div className={styles.statDivider} />
            <div className={styles.stat}>
              <span className={styles.statNum}>28%</span>
              <span className={styles.statLabel}>Of prime contract dollars to small biz</span>
            </div>
            <div className={styles.statDivider} />
            <div className={styles.stat}>
              <span className={styles.statNum}>85%</span>
              <span className={styles.statLabel}>Of DLA solicitations posted via DIBBS</span>
            </div>
            <div className={styles.statDivider} />
            <div className={styles.stat}>
              <span className={styles.statNum}>23</span>
              <span className={styles.statLabel}>Free lessons when you sign up</span>
            </div>
          </div>
          <div className={styles.statSource}>
            SBA FY2025 Small Business Procurement Scorecard · Defense Logistics Agency
          </div>
        </div>
      </section>

      <ProofSection />

      {/* Auto-scrolling niche ticker */}
      <div className={styles.ticker}>
        <div className={styles.tickerLabel}>Active niches</div>
        <div className={styles.tickerTrack}>
          <div className={styles.tickerInner}>
            {[...NICHES, ...NICHES, ...NICHES].map((n, i) => (
              <span key={i} className={`${styles.tickerItem} ${n.status === 'soon' ? styles.tickerItemSoon : ''}`}>
                <span className={styles.tickerDot} />
                {n.name}
                {n.status === 'soon' && <span className={styles.tickerSoonLabel}>Coming soon</span>}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Features */}
      <section className={styles.features}>
        <div className={styles.sectionHeader}>
          <div className="section-rule" />
          <span className="badge badge-navy">What's inside</span>
          <h2 className={styles.sectionTitle}>What you'll actually use, week after week</h2>
        </div>
        <div className={styles.featureGrid}>
          {FEATURES.map(({ icon: Icon, title, desc, color, bg }) => (
            <div key={title} className={`card card-hover ${styles.featureCard}`}>
              <div className={styles.featureIcon} style={{ background: bg, border: `1px solid ${color}35`, color }}>
                <Icon size={22} />
              </div>
              <h3 className={styles.featureTitle}>{title}</h3>
              <p className={styles.featureDesc}>{desc}</p>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 'var(--sp-8, 48px)' }}>
          <SampleOutputStrip />
        </div>
      </section>

      {/* Pricing */}
      <section className={styles.pricing}>
        <div className={styles.sectionHeader}>
          <span className="badge badge-navy">Pricing</span>
          <p className={styles.pricingIntro}>
            Start on the free tier. Upgrade when the Lab has already paid for itself.
          </p>
        </div>

        <div className={styles.pricingGrid}>
          {TIERS.map(tier => (
            <div key={tier.name} className={`${styles.pricingCard} ${tier.highlight ? styles.pricingCardHighlight : ''}`}>
              {tier.highlight && <span className={styles.pricingBadge}>{tier.badge}</span>}
              <div className={styles.pricingName}>{tier.name}</div>
              <div className={styles.pricingPriceRow}>
                <span className={styles.pricingPrice}>{tier.price}</span>
                <span className={styles.pricingPeriod}>{tier.period}</span>
              </div>
              <ul className={styles.pricingFeatureList}>
                {PRICING_SUMMARY[tier.name].map(f => (
                  <li key={f} className={styles.pricingFeatureItem}>
                    <Check size={14} style={{ color: 'var(--navy)', flexShrink: 0 }} />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <Link
                to={tier.ctaLink || '/membership'}
                className={`btn ${tier.highlight ? 'btn-primary' : 'btn-ghost'} ${styles.pricingCta}`}
              >
                {PRICING_CTAS[tier.name]}
              </Link>
            </div>
          ))}

          <div className={styles.pricingCard}>
            <div className={styles.pricingName}>{FOUNDING.name}</div>
            <div className={styles.pricingPriceRow}>
              <span className={styles.pricingPrice}>{FOUNDING.price}</span>
              <span className={styles.pricingPeriod}>once</span>
            </div>
            <ul className={styles.pricingFeatureList}>
              {FOUNDING_SUMMARY.map(f => (
                <li key={f} className={styles.pricingFeatureItem}>
                  <Check size={14} style={{ color: 'var(--navy)', flexShrink: 0 }} />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            {foundingSpotsRemaining === 0 ? (
              <button className={`btn btn-ghost ${styles.pricingCta}`} disabled>
                Founding membership closed
              </button>
            ) : (
              <Link to="/membership" className={`btn btn-ghost ${styles.pricingCta}`}>
                Claim a founding spot
              </Link>
            )}
            <FoundingSpotsCounter />
          </div>
        </div>

        <div className={styles.pricingPayRow}>
          <div className={styles.pricingPayLabels}>
            {PAYMENT_LABELS.map(label => (
              <span key={label} className={styles.pricingPayLabel}>{label}</span>
            ))}
          </div>
          <p className={styles.pricingPayNote}>Pay monthly, or split it with Klarna or Affirm.</p>
        </div>
      </section>

      {/* Founder */}
      <section id="founder" className={styles.founder}>
        <div className={styles.founderInner}>
          <div className={styles.founderPhoto}>
            <img
              src="/images/keith-atkinson.jpg"
              alt="Keith Atkinson, founder of iCrestiQ LLC"
              className={styles.founderPhotoImg}
            />
          </div>
          <div className={styles.founderContent}>
            <div className={styles.founderEyebrow}>Who runs this</div>
            <h2 className={styles.founderHeading}>I&rsquo;m Keith. I quote federal solicitations every week.</h2>
            <p className={styles.founderBody}>
              I run iCrestiQ Sourcing, a small federal supplier in Easley, South Carolina. We bid
              DIBBS and SAM.gov opportunities for hardware, fasteners, safety gear and MRO — the
              unglamorous commodity work that most GovCon training ignores completely.
            </p>
            <p className={styles.founderBody}>
              I built GovCon Lab because the courses I could find were written by consultants and
              former officials, not by anyone currently sending in quotes. Everything in here is
              the process I actually use, including the parts that didn&rsquo;t work.
            </p>
            <p className={styles.founderBody}>
              I&rsquo;ve quoted 15 solicitations this year.
            </p>
            <div className={styles.founderSignature}>Keith Atkinson · Founder, iCrestiQ LLC</div>
          </div>
        </div>
      </section>

      <Testimonials />
      <RecentWins />

      {/* CTA */}
      <section className={styles.cta}>
        <div className={styles.ctaInner}>
          <h2 className={styles.ctaTitle}>Stop watching. Start sourcing.</h2>
          <p className={styles.ctaSubTight}>
            Create a free account and you'll have the community, store, and course library today.
          </p>
          <p className={styles.ctaSub}>
            Your first few quotes will probably lose — that's normal here.
          </p>
          <Link to="/register" className="btn btn-gold" style={{ fontSize: '1rem', padding: '14px 32px' }}>
            Create Your Account →
          </Link>
        </div>
      </section>

      <DigestSignup />

      {/* Contact + Footer */}
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
            <div className={styles.contactLabel}>Email</div>
            <a href="mailto:hello@icrestiq.com" className={styles.contactLink}>
              <Mail size={14} style={{ display: 'inline', marginRight: 6, color: 'var(--gold)' }} />
              hello@icrestiq.com
            </a>
          </div>
          <div>
            <div className={styles.contactLabel}>Learn more</div>
            <Link to="/about" className={styles.contactLink}>
              About GovCon Lab →
            </Link>
            <Link to="/blog" className={styles.contactLink} style={{ display: 'block', marginTop: 4 }}>
              Blog →
            </Link>
          </div>
        </div>
      </section>

      <footer className={styles.footer}>
        <div className={styles.footerLogo}>
          <div className={styles.logoMarkSmall}>iQ</div>
          <span className={styles.footerText}>© {new Date().getFullYear()} iCrestiQ LLC · Easley, South Carolina · All rights reserved.</span>
        </div>
        <div className={styles.footerRight}>govconlab.com</div>
      </footer>
    </div>
  )
}
