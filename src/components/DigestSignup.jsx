import { useState } from 'react'
import styles from './DigestSignup.module.css'

export default function DigestSignup() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState('idle') // idle | loading | check-email | already-confirmed | error
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setStatus('loading')
    try {
      const res = await fetch('/api/digest/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, source: 'homepage' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Something went wrong. Please try again.')
      setStatus(data.status === 'already-confirmed' ? 'already-confirmed' : 'check-email')
    } catch (err) {
      setError(err.message)
      setStatus('error')
    }
  }

  return (
    <section className={styles.digest}>
      <div className={styles.inner}>
        <div className={styles.eyebrow}>Free every Monday</div>
        <h2 className={styles.heading}>See what the government was actually buying last week.</h2>
        <p className={styles.body}>
          A short weekly digest of real federal product solicitations — solicitation numbers, agencies,
          deadlines, and which ones are worth your time. No charge, no card. Unsubscribe in one click.
        </p>

        {status === 'check-email' ? (
          <p className={styles.confirmMessage}>
            Check your inbox — click the confirmation link and you're on the list.
          </p>
        ) : status === 'already-confirmed' ? (
          <p className={styles.confirmMessage}>
            That email is already confirmed. Monday's digest is on its way.
          </p>
        ) : (
          <form className={styles.form} onSubmit={handleSubmit}>
            <input
              type="email"
              required
              placeholder="you@example.com"
              className={`input ${styles.input}`}
              value={email}
              onChange={e => setEmail(e.target.value)}
              disabled={status === 'loading'}
            />
            <button type="submit" className="btn btn-primary" disabled={status === 'loading'}>
              {status === 'loading' ? <div className="spinner" /> : "Send me Monday's digest"}
            </button>
          </form>
        )}

        {status === 'error' && <p className={styles.errorMessage}>{error}</p>}

        <p className={styles.upsellNote}>
          The paid version includes the full list, quote templates, and my notes on what I bid.
        </p>
      </div>
    </section>
  )
}
