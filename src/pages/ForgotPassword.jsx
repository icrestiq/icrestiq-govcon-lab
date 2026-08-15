import { useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Mail } from 'lucide-react'
import Turnstile from '../components/Turnstile'
import styles from './Auth.module.css'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [captchaToken, setCaptchaToken] = useState('')
  const [captchaError, setCaptchaError] = useState('')
  const turnstileRef = useRef(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setCaptchaError('')

    // A missing/expired token is checked and surfaced separately from the
    // resetPasswordForEmail call below — that's fine to show, unlike a
    // real result from the reset call itself (see the comment there).
    if (!captchaToken) {
      setCaptchaError('Please complete the verification challenge.')
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
        captchaToken,
      })
      // Deliberately not branching UI on error — the whole point of this
      // page is to never reveal whether an address is registered, even
      // when Supabase itself would tell us. A real problem (bad SMTP
      // config, rate limiting) is logged for debugging but never becomes
      // a different message shown to the visitor, since that difference
      // is itself the information leak.
      if (error) console.error('resetPasswordForEmail error:', error)
    } catch (err) {
      console.error('resetPasswordForEmail error:', err)
    } finally {
      setLoading(false)
      setSubmitted(true)
    }
  }

  if (submitted) {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <div className={styles.header}>
            <Link to="/" className={styles.logo}>
              <div className={styles.logoMark}>iQ</div>
              <span className={styles.logoText}>iCrestiQ GovCon Lab</span>
            </Link>
            <h1 className={styles.title}>Check your email</h1>
          </div>

          <div className="alert alert-success">
            If that address has an account, we've sent a reset link.
          </div>

          <p className={styles.switchLink}>
            <Link to="/login">Back to sign in →</Link>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.header}>
          <Link to="/" className={styles.logo}>
            <div className={styles.logoMark}>iQ</div>
            <span className={styles.logoText}>iCrestiQ GovCon Lab</span>
          </Link>
          <h1 className={styles.title}>Reset your password</h1>
          <p className={styles.sub}>Enter your email and we'll send you a link to reset it.</p>
        </div>

        {captchaError && <div className="alert alert-error" style={{ marginBottom: 'var(--sp-4)' }}>{captchaError}</div>}

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label className="label">Email</label>
            <input
              type="email"
              className="input"
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </div>

          <Turnstile ref={turnstileRef} onVerify={setCaptchaToken} />

          <button
            type="submit"
            className="btn btn-primary w-full"
            disabled={loading}
            style={{ justifyContent: 'center', marginTop: 'var(--sp-2)' }}
          >
            {loading ? <div className="spinner" /> : <><Mail size={16} /> Send Reset Link</>}
          </button>
        </form>

        <p className={styles.switchLink}>
          <Link to="/login">Back to sign in →</Link>
        </p>
      </div>
    </div>
  )
}