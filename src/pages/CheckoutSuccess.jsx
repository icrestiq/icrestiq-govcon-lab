import { useEffect, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { CheckCircle, ArrowRight, Download, MessageSquare } from 'lucide-react'
import styles from './CheckoutResult.module.css'

const PRODUCT_CONTENT = {
  'hw-fasteners':    { name: 'Hardware & Fasteners Niche Playbook',   type: 'digital' },
  'jan-san':         { name: 'Janitorial & Sanitation Playbook',       type: 'digital' },
  'safety-ppe':      { name: 'Safety & PPE Niche Playbook',            type: 'digital' },
  'mro-industrial':  { name: 'MRO & Industrial Parts Playbook',        type: 'digital' },
  'mil-spec-bible':  { name: 'MIL-SPEC Packaging Bible™',              type: 'digital' },
  'founding-member': { name: 'Founding Member — Lifetime Access',      type: 'membership' },
  'lab-monthly':     { name: 'iCrestiQ GovCon Lab — $57/mo Membership',         type: 'membership' },
  'lab-pro-monthly': { name: 'iCrestiQ GovCon Lab Pro — $107/mo Membership',     type: 'membership' },
}

export default function CheckoutSuccess() {
  const [params] = useSearchParams()
  const productId = params.get('product')
  const sessionId = params.get('session_id')
  const product = PRODUCT_CONTENT[productId] || { name: 'Your purchase', type: 'digital' }
  const [countdown, setCountdown] = useState(10)

  useEffect(() => {
    if (countdown <= 0) return
    const t = setTimeout(() => setCountdown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [countdown])

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        {/* Success icon */}
        <div className={styles.iconWrap}>
          <CheckCircle size={48} strokeWidth={1.5} />
        </div>

        <div className={styles.badge}>
          <span className="online-dot" />
          Payment Confirmed
        </div>

        <h1 className={styles.title}>You're in.</h1>
        <p className={styles.product}>{product.name}</p>

        <p className={styles.message}>
          {product.type === 'membership'
            ? 'Your membership is active. Full access to the community, courses, and intel digest is unlocked.'
            : 'Your purchase is confirmed. Check your email for the download link, or access it directly from your dashboard.'
          }
        </p>

        {sessionId && (
          <p className={styles.orderId}>
            Order ref: <span className="mono">{sessionId.slice(-12).toUpperCase()}</span>
          </p>
        )}

        <hr className="divider" />

        {/* Next steps */}
        <div className={styles.nextSteps}>
          <div className={styles.nextLabel}>What's next</div>

          {product.type === 'membership' ? (
            <>
              <Link to="/chat" className={styles.nextItem}>
                <MessageSquare size={18} style={{ color: 'var(--green)' }} />
                <div>
                  <div className={styles.nextTitle}>Join the Community Rooms</div>
                  <div className={styles.nextSub}>Introduce yourself in #general</div>
                </div>
                <ArrowRight size={16} className={styles.nextArrow} />
              </Link>
              <Link to="/store" className={styles.nextItem}>
                <Download size={18} style={{ color: 'var(--green)' }} />
                <div>
                  <div className={styles.nextTitle}>Explore the Store</div>
                  <div className={styles.nextSub}>Members get first access to new drops</div>
                </div>
                <ArrowRight size={16} className={styles.nextArrow} />
              </Link>
            </>
          ) : (
            <>
              <Link to="/dashboard" className={styles.nextItem}>
                <Download size={18} style={{ color: 'var(--green)' }} />
                <div>
                  <div className={styles.nextTitle}>Access Your Purchase</div>
                  <div className={styles.nextSub}>Available in your dashboard under My Purchases</div>
                </div>
                <ArrowRight size={16} className={styles.nextArrow} />
              </Link>
              <Link to="/chat" className={styles.nextItem}>
                <MessageSquare size={18} style={{ color: 'var(--green)' }} />
                <div>
                  <div className={styles.nextTitle}>Jump into the Community</div>
                  <div className={styles.nextSub}>Share questions in #rfq-help or #general</div>
                </div>
                <ArrowRight size={16} className={styles.nextArrow} />
              </Link>
            </>
          )}
        </div>

        <Link to="/dashboard" className="btn btn-primary w-full" style={{ justifyContent: 'center', marginTop: 'var(--sp-6)' }}>
          Go to Dashboard →
        </Link>

        <p className={styles.emailNote}>
          A receipt has been sent to your email by Stripe. Questions? Post in #general or email us.
        </p>
      </div>
    </div>
  )
}
