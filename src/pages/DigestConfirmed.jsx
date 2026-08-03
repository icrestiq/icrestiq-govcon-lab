import { Link, useSearchParams } from 'react-router-dom'
import { CheckCircle, XCircle } from 'lucide-react'
import styles from './Auth.module.css'

export default function DigestConfirmed() {
  const [params] = useSearchParams()
  const ok = params.get('status') === 'ok'

  return (
    <div className={styles.page}>
      <div className={styles.card} style={{ textAlign: 'center' }}>
        <div className={styles.header}>
          <Link to="/" className={styles.logo}>
            <div className={styles.logoMark}>iQ</div>
            <span className={styles.logoText}>iCrestiQ GovCon Lab</span>
          </Link>
          {ok ? (
            <>
              <CheckCircle size={40} style={{ color: 'var(--gold)', margin: '0 auto var(--sp-4)' }} />
              <h1 className={styles.title}>You're confirmed</h1>
              <p className={styles.sub}>
                Monday's digest of real federal product solicitations is on its way to your inbox each week.
                Unsubscribe anytime with one click from any digest email.
              </p>
            </>
          ) : (
            <>
              <XCircle size={40} style={{ color: 'var(--red)', margin: '0 auto var(--sp-4)' }} />
              <h1 className={styles.title}>That link didn't work</h1>
              <p className={styles.sub}>
                It may have already been used, or it's expired. Head back to the homepage and sign up again.
              </p>
            </>
          )}
        </div>
        <Link to="/" className="btn btn-primary w-full" style={{ justifyContent: 'center' }}>
          Back to GovCon Lab
        </Link>
      </div>
    </div>
  )
}
