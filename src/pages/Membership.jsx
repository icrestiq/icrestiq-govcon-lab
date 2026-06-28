import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { createCheckoutSession } from '../lib/stripe'
import { Check, Zap, Crown, Star } from 'lucide-react'
import styles from './Membership.module.css'

const TIERS = [
  {
    id: null,
    productId: null,
    name: 'Free',
    price: '$0',
    period: 'forever',
    icon: Star,
    badge: null,
    description: 'Get started with the foundation.',
    features: [
      'GovCon Mastery Foundation Course (23 lessons)',
      'Public community feed (read-only)',
      'Sample playbook chapter',
      'Weekly GovCon intel email',
      'Access to merch store',
    ],
    cta: 'Current Plan',
    disabled: true,
  },
  {
    id: 'lab-monthly',
    productId: 'lab-monthly',
    name: 'Lab Member',
    price: '$47',
    period: '/month',
    icon: Zap,
    badge: 'Most Popular',
    badgeType: 'green',
    description: 'Full access for serious operators.',
    features: [
      'Everything in Free',
      'Full community — all 6 chat rooms',
      'Weekly RFQ Opportunity Digest',
      'Complete course library access',
      'Members-only vendor intel threads',
      'Win board + peer accountability',
      'New playbook drops (quarterly)',
      'Cancel anytime',
    ],
    cta: 'Join the Lab',
    highlight: true,
  },
  {
    id: 'lab-pro-monthly',
    productId: 'lab-pro-monthly',
    name: 'Lab Pro',
    price: '$97',
    period: '/month',
    icon: Crown,
    badge: 'Best Value',
    badgeType: 'blue',
    description: 'For operators scaling fast.',
    features: [
      'Everything in Lab Member',
      'Monthly live Q&A / office hours with Keith',
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
    'Lifetime Lab Pro access',
    'Name in the Founding Members wall',
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

  async function handleCheckout(productId) {
    if (!user) { navigate('/register'); return }
    setError('')
    setLoading(productId)
    try {
      const { url } = await createCheckoutSession({
        productId,
        userId: user.id,
        userEmail: user.email,
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
        <div className="badge badge-green">Membership</div>
        <h1 className={styles.title}>Choose your level</h1>
        <p className={styles.sub}>
          The government is always purchasing. The only question is whether it's from you.
        </p>

        {/* Payment method badges */}
        <div className={styles.payBadges}>
          <span className={styles.payBadge}>Visa / MC / Amex</span>
          <span className={styles.payBadge}>Klarna — Pay in 4</span>
          <span className={styles.payBadge}>Affirm — Installments</span>
          <span className={styles.payBadge}>Apple Pay</span>
          <span className={styles.payBadge}>Google Pay</span>
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

          return (
            <div key={tier.name} className={`${styles.tierCard} ${tier.highlight ? styles.tierHighlight : ''}`}>
              {tier.badge && (
                <div className={styles.tierBadgeWrap}>
                  <span className={`badge badge-${tier.badgeType}`}>{tier.badge}</span>
                </div>
              )}

              <div className={styles.tierIcon}>
                <Icon size={22} />
              </div>

              <div className={styles.tierName}>{tier.name}</div>
              <div className={styles.tierPriceRow}>
                <span className={styles.tierPrice}>{tier.price}</span>
                <span className={styles.tierPeriod}>{tier.period}</span>
              </div>
              <p className={styles.tierDesc}>{tier.description}</p>

              <ul className={styles.featureList}>
                {tier.features.map(f => (
                  <li key={f} className={styles.featureItem}>
                    <Check size={14} style={{ color: 'var(--green)', flexShrink: 0 }} />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              <button
                className={`btn ${tier.highlight ? 'btn-primary' : 'btn-ghost'} ${styles.tierCta}`}
                disabled={tier.disabled || isCurrent || isLoading}
                onClick={() => tier.productId && handleCheckout(tier.productId)}
              >
                {isLoading ? <div className="spinner" /> : isCurrent ? 'Current Plan' : tier.cta}
              </button>

              {tier.productId && (
                <p className={styles.klarnaNote}>
                  Pay with Klarna or Affirm at checkout
                </p>
              )}
            </div>
          )
        })}
      </div>

      {/* Founding Member offer */}
      <div className={styles.foundingCard}>
        <div className={styles.foundingLeft}>
          <div className={styles.foundingBadge}>
            <Star size={14} />
            Limited — 25 spots
          </div>
          <h2 className={styles.foundingTitle}>{FOUNDING.name}</h2>
          <p className={styles.foundingDesc}>{FOUNDING.description}</p>
          <ul className={styles.foundingFeatures}>
            {FOUNDING.features.map(f => (
              <li key={f} className={styles.featureItem}>
                <Check size={13} style={{ color: 'var(--green)', flexShrink: 0 }} />
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className={styles.foundingRight}>
          <div className={styles.foundingPrice}>
            <span className={styles.foundingAmount}>{FOUNDING.price}</span>
            <span className={styles.foundingPeriod}>{FOUNDING.period}</span>
          </div>
          <button
            className={`btn btn-primary ${styles.foundingCta}`}
            disabled={loading === FOUNDING.productId}
            onClick={() => handleCheckout(FOUNDING.productId)}
          >
            {loading === FOUNDING.productId ? <div className="spinner" /> : 'Claim Founding Spot →'}
          </button>
          <p className={styles.klarnaNote} style={{ textAlign: 'center' }}>
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
              Monthly memberships cancel with one click from your billing portal. No contracts. No questions.
              Founding Member purchases are final due to the lifetime access nature of the offer.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
