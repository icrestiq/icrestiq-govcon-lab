import { useState, useRef } from 'react'
import Turnstile from './Turnstile'
import styles from './DigestSignup.module.css'

export default function DigestSignup() {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [company, setCompany] = useState('') // honeypot — real visitors never fill this
  const [status, setStatus] = useState('idle') // idle | loading | check-email | already-confirmed | error
  const [error, setError] = useState('')
  const [captchaToken, setCaptchaToken] = useState('')
  const renderedAt = useRef(Date.now())
  const turnstileRef = useRef(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!captchaToken) {
      setError('Please complete the verification challenge.')
      setStatus('error')
      return
    }
    setStatus('loading')
    try {
      const res = await fetch('/api/digest/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName,
          lastName,
          email,
          source: 'homepage',
          company, // honeypot field — should always be empty for real users
          renderedAt: renderedAt.current,
          turnstileToken: captchaToken,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Something went wrong. Please try again.')
      setStatus(data.status === 'already-confirmed' ? 'already-confirmed' : 'check-email')
    } catch (err) {
      setError(err.message)
      setStatus('error')
      // Turnstile tokens are single-use — whether the server rejected this
      // one or something else failed, it's already spent, so the widget
      // needs a fresh challenge before the next submit attempt can work.
      turnstileRef.current?.reset()
      setCaptchaToken('')
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
            Check your inbox and click the confirmation link — you'll only start getting Monday's digest
            (and your 5 free tools) once you've verified your email.
          </p>
        ) : status === 'already-confirmed' ? (
          <p className={styles.confirmMessage}>
            That email is already confirmed. Monday's digest is on its way.
          </p>
        ) : (
          <form className={styles.form} onSubmit={handleSubmit}>
            {/*
              Honeypot field. Visually hidden and pulled out of tab order so
              real visitors never see or reach it, but bots that blindly
              fill every input on the page will populate it — which flags
              the submission as automated server-side (see api/digest/
              subscribe.js). Do not add `display: none` or `type="hidden"`;
              some bots skip fields styled that way. Off-screen positioning
              plus aria-hidden is the more robust pattern.
            */}
            <div aria-hidden="true" style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, overflow: 'hidden' }}>
              <label htmlFor="digest-company">Company (leave this blank)</label>
              <input
                id="digest-company"
                name="company"
                type="text"
                tabIndex={-1}
                autoComplete="off"
                value={company}
                onChange={e => setCompany(e.target.value)}
              />
            </div>

            <input
              type="text"
              required
              placeholder="First name"
              className={`input ${styles.input}`}
              value={firstName}
              onChange={e => setFirstName(e.target.value)}
              disabled={status === 'loading'}
            />
            <input
              type="text"
              placeholder="Last name"
              className={`input ${styles.input}`}
              value={lastName}
              onChange={e => setLastName(e.target.value)}
              disabled={status === 'loading'}
            />
            <input
              type="email"
              required
              placeholder="you@example.com"
              className={`input ${styles.input}`}
              value={email}
              onChange={e => setEmail(e.target.value)}
              disabled={status === 'loading'}
            />
            <Turnstile ref={turnstileRef} onVerify={setCaptchaToken} />
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
