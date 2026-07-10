import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { createCheckoutSession } from '../lib/stripe'
import { Check, Zap, Crown, Star, Tag } from 'lucide-react'
import styles from './Membership.module.css'

const TIERS = [
  {
    id: null,
    productId: null,
    name: 'Free',
    price: '$0',
    period: 'forever',
    icon: Star,
    iconColor: '#C9A84C', iconBg: '#FFFFF0',
    badge: null,
    description: 'Get started with the foundation.',
    features: [
      'GovCon Mastery Foundation Course (23 lessons)',
      'Public community feed — read only',
      'Sample playbook chapter',
      'Weekly GovCon intel email',
      'Access to merch store',
    ],
    cta: 'Get Started Free',
    ctaLink: '/register',
    disabled: false,
  },
  {
    id: 'lab-monthly',
    productId: 'lab-monthly',
    name: 'Lab Member',
    price: '$57',
    period: '/month',
    icon: Zap,
    iconColor: '#4F6BED', iconBg: '#EBF4FF',
    badge: 'Most Popular',
    badgeType: 'navy',
    badgeColor: '#1B2A4A', badgeBg: '#E8ECF5',
    description: 'Full access for serious operators.',
    features: [
      'Everything in Free',
      'Full community — all 6 chat rooms',
      'Weekly RFQ Opportunity Digest',
      'Complete course library access',
      'Members-only vendor intel threads',
      'Win board + peer accountability',
      'New playbook drops quarterly',
      'Cancel anytime',
    ],
    cta: 'Join the Lab',
    highlight: true,
  },
  {
    id: 'lab-pro-monthly',
    productId: 'lab-pro-monthly',
    name: 'Lab Pro',
    price: '$107',
    period: '/month',
    icon: Crown,
    iconColor: '#6B46C1', iconBg: '#FAF5FF',
    badge: 'Best Value',
    badgeType: 'amber',
    badgeColor: '#92620A', badgeBg: '#FFF0CC',
    description: 'For operators scaling fast.',
    features: [
      'Everything in Lab Member',
      'Monthly live Q&A with Keith',
      'Priority support in chat',
      'Early access to new tools + automations',
      'Make.com workflow library',
      'Pro-only sourcing intel channel',
      'Niche deep-dive each month',
      'Cancel anytime',
    ],
    cta: 'Go Pro',
    highlight: false,
  },
]

const FOUNDING = {
  productId: 'founding-member',
  name: 'Founding Member',
  price: '$297',
  period: 'one-time · lifetime access',
  description: 'Lock in everything — forever. No monthly fees, ever. First 25 spots only.',
  features: [
    'Lifetime Lab Pro access — never pay monthly',
    'Name on the Founding Members wall',
    'Direct input on product roadmap',
    'All future course drops included',
    'Founding badge in community',
  ],
}

export default function Membership() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(null)
  const [error, setError] = useState('')
  const [discountCode, setDiscountCode] = useState('')
  const [codeApplied, setCodeApplied] = useState(false)
  const [codeError, setCodeError] = useState('')

  // Valid discount codes — add more in Stripe dashboard
  const DISCOUNT_CODES = {
    'GOVCON10': 10,
    'LAUNCH10': 10,
    'ICRESTIQ10': 10,
  }

  function applyCode() {
    setCodeError('')
    const code = discountCode.trim().toUpperCase()
    if (DISCOUNT_CODES[code]) {
      setCodeApplied(true)
      setCodeError('')
    } else {
      setCodeApplied(false)
      setCodeError('Invalid code. Try again.')
    }
  }

  function getDiscountedPrice(price) {
    if (!codeApplied || price === '$0') return price
    const num = parseInt(price.replace('$', ''))
    const discounted = Math.round(num * 0.90)
    return `$${discounted}`
  }

  async function handleCheckout(productId) {
    if (!user) { navigate('/register'); return }
    setError('')
    setLoading(productId)
    try {
      const { url } = await createCheckoutSession({
        productId,
        userId: user.id,
        userEmail: user.email,
        // Stripe coupon applied at checkout level
        discountCode: codeApplied ? discountCode.trim().toUpperCase() : null,
      })
      window.location.href = url
    } catch (err) {
      setError(err.message || 'Checkout failed. Please try again.')
      setLoading(null)
    }
  }

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <span className="badge badge-navy">Membership</span>
        <h1 className={styles.title}>Choose your level</h1>
        <p className={styles.sub}>
          The government is always purchasing. The only question is whether it's from you.
        </p>

        {/* Discount code box */}
        <div className={styles.discountBox}>
          <Tag size={15} style={{ color: 'var(--gold)', flexShrink: 0 }} />
          <input
            className={styles.discountInput}
            placeholder="Have a promo code? Enter it here"
            value={discountCode}
            onChange={e => { setDiscountCode(e.target.value); setCodeApplied(false); setCodeError('') }}
            onKeyDown={e => e.key === 'Enter' && applyCode()}
          />
          <button className="btn btn-primary" style={{ padding: '8px 16px', fontSize: '0.875rem' }} onClick={applyCode}>
            Apply
          </button>
        </div>
        {codeApplied && (
          <div className="alert alert-success" style={{ maxWidth: 480, margin: '0 auto var(--sp-4)', textAlign: 'center' }}>
            ✓ Code applied — 10% off your membership
          </div>
        )}
        {codeError && (
          <div className="alert alert-error" style={{ maxWidth: 480, margin: '0 auto var(--sp-4)', textAlign: 'center' }}>
            {codeError}
          </div>
        )}

        {/* Payment method badges — colored */}
        <div className={styles.payBadges}>
          {[
            { label: 'Visa',        color: '#1A1F71', bg: '#EEF0FF' },
            { label: 'Mastercard',  color: '#EB001B', bg: '#FFF0F0' },
            { label: 'Amex',        color: '#2E77BC', bg: '#EBF4FF' },
            { label: 'Klarna',      color: '#FF6CA0', bg: '#FFF0F6' },
            { label: 'Affirm',      color: '#4A3728', bg: '#FFF8F0' },
            { label: 'Apple Pay',   color: '#1B2A4A', bg: '#F0F2F8' },
            { label: 'Google Pay',  color: '#4285F4', bg: '#EBF4FF' },
          ].map(({ label, color, bg }) => (
            <span key={label} className={styles.payBadge} style={{
              background: bg,
              color,
              border: `1px solid ${color}30`,
              fontWeight: 700,
            }}>{label}</span>
          ))}
        </div>
      </div>

      {error && (
        <div className="alert alert-error" style={{ maxWidth: 640, margin: '0 auto var(--sp-6)' }}>
          {error}
        </div>
      )}

      {/* Tier cards */}
      <div className={styles.grid}>
        {TIERS.map(tier => {
          const Icon = tier.icon
          const isLoading = loading === tier.productId
          const isCurrent = profile?.membership_tier === tier.id
          const displayPrice = codeApplied ? getDiscountedPrice(tier.price) : tier.price

          return (
            <div key={tier.name} className={`${styles.tierCard} ${tier.highlight ? styles.tierHighlight : ''}`}>
              {tier.badge && (
                <div className={styles.tierBadgeWrap}>
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    padding: '4px 12px',
                    borderRadius: '100px',
                    fontSize: '0.6875rem',
                    fontWeight: 800,
                    fontFamily: 'var(--font-display)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    background: tier.badgeBg || '#E8ECF5',
                    color: tier.badgeColor || '#1B2A4A',
                    border: `1.5px solid ${tier.badgeColor || '#1B2A4A'}40`,
                    boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
                  }}>{tier.badge}</span>
                </div>
              )}

              <div className={styles.tierIcon} style={{ background: tier.iconBg, border: `1px solid ${tier.iconColor}30`, color: tier.iconColor }}>
                <Icon size={22} />
              </div>

              <div className={styles.tierName}>{tier.name}</div>
              <div className={styles.tierPriceRow}>
                {codeApplied && tier.price !== '$0' && (
                  <span className={styles.tierPriceOriginal}>{tier.price}</span>
                )}
                <span className={styles.tierPrice}>{displayPrice}</span>
                <span className={styles.tierPeriod}>{tier.period}</span>
              </div>
              <p className={styles.tierDesc}>{tier.description}</p>

              <ul className={styles.featureList}>
                {tier.features.map(f => (
                  <li key={f} className={styles.featureItem}>
                    <Check size={14} style={{ color: 'var(--navy)', flexShrink: 0 }} />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              {/* CTA */}
              {tier.ctaLink ? (
                <button
                  className={`btn btn-ghost ${styles.tierCta}`}
                  onClick={() => navigate(tier.ctaLink)}
                >
                  {tier.cta}
                </button>
              ) : (
                <button
                  className={`btn ${tier.highlight ? 'btn-primary' : 'btn-ghost'} ${styles.tierCta}`}
                  disabled={isCurrent || isLoading}
                  onClick={() => tier.productId && handleCheckout(tier.productId)}
                >
                  {isLoading ? <div className="spinner" /> : isCurrent ? 'Current Plan' : tier.cta}
                </button>
              )}

              {tier.productId && (
                <p className={styles.klarnaNote}>
                  Pay with Klarna or Affirm at checkout
                </p>
              )}
            </div>
          )
        })}

        {/* Founding Member — 4th card, styled dark/gold to stand out as the premium option */}
        <div className={styles.founderTierCard}>
          <div className={styles.tierBadgeWrap}>
            <span className={styles.founderBadge}>
              <Star size={11} />
              Limited — 25 Spots
            </span>
          </div>

          <div className={styles.founderIcon}>
            <Crown size={22} />
          </div>

          <div className={styles.founderName}>{FOUNDING.name}</div>
          <div className={styles.tierPriceRow}>
            <span className={styles.founderPrice}>{FOUNDING.price}</span>
          </div>
          <p className={styles.founderPeriod}>{FOUNDING.period}</p>
          <p className={styles.founderDesc}>{FOUNDING.description}</p>

          <ul className={styles.featureList}>
            {FOUNDING.features.map(f => (
              <li key={f} className={styles.featureItem} style={{ color: 'rgba(255,255,255,0.85)' }}>
                <Check size={14} style={{ color: 'var(--gold)', flexShrink: 0 }} />
                <span>{f}</span>
              </li>
            ))}
          </ul>

          <button
            className={`btn ${styles.founderCta}`}
            disabled={loading === FOUNDING.productId}
            onClick={() => handleCheckout(FOUNDING.productId)}
          >
            {loading === FOUNDING.productId ? <div className="spinner" /> : 'Claim Founding Spot →'}
          </button>

          <p className={styles.klarnaNote} style={{ color: 'rgba(255,255,255,0.5)' }}>
            Split into installments with Affirm at checkout
          </p>
        </div>
      </div>

      {/* Guarantee */}
      <div className={styles.guarantee}>
        <div className={styles.guaranteeInner}>
          <span className={styles.guaranteeIcon}>🛡</span>
          <div>
            <div className={styles.guaranteeTitle}>No risk. Cancel anytime.</div>
            <div className={styles.guaranteeSub}>
              Monthly memberships cancel with one click from your billing portal. No contracts, no questions asked.
              Founding Member purchases are final due to the lifetime nature of the offer.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
