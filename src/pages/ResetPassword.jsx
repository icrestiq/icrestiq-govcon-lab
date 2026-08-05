import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { KeyRound } from 'lucide-react'
import styles from './Auth.module.css'

const MIN_PASSWORD_LENGTH = 8 // matches the minimum already enforced on Register

// Timeout for the "checking" state — if nothing has resolved a real
// session by then, treat the link as invalid rather than spinning
// forever. 5s is generous for a code exchange round trip but short
// enough that a genuinely broken link doesn't leave someone staring at a
// spinner indefinitely.
const SESSION_CHECK_TIMEOUT_MS = 5000

export default function ResetPassword() {
  const navigate = useNavigate()
  // 'checking' | 'ready' | 'invalid' | 'success'
  const [status, setStatus] = useState('checking')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let settled = false

    function resolve(hasSession) {
      if (settled) return
      settled = true
      setStatus(hasSession ? 'ready' : 'invalid')
    }

    // Covers the hash-based (implicit) flow: Supabase's client
    // auto-detects #access_token=...&type=recovery in the URL fragment
    // on load (detectSessionInUrl is on by default) and fires this once
    // it's done restoring that session. This is the "wait for Supabase
    // to finish" signal — we don't just check once and assume it's
    // already settled, since that check could race the client's own
    // internal hash processing.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session)) {
        resolve(true)
      }
    })

    async function checkSession() {
      try {
        // Covers the PKCE / code-based flow: the emailed link has
        // ?code=... in the query string instead of a hash, and that
        // needs an explicit exchange — it does not happen automatically
        // the way the hash-based flow does.
        const params = new URLSearchParams(window.location.search)
        const code = params.get('code')
        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
          if (exchangeError) throw exchangeError
        }

        const { data: { session } } = await supabase.auth.getSession()
        if (session) resolve(true)
      } catch (err) {
        console.error('Password recovery session error:', err)
        // Don't resolve(false) here directly — let the timeout below be
        // the single source of "give up," so a slow-but-working
        // onAuthStateChange event isn't cut off by an error on this
        // particular check.
      }
    }
    checkSession()

    const timeout = setTimeout(() => resolve(false), SESSION_CHECK_TIMEOUT_MS)

    return () => {
      settled = true
      subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`)
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }

    setSubmitting(true)
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) throw updateError
      setStatus('success')
    } catch (err) {
      setError(err.message || 'Could not update your password. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  // On success, send them wherever they actually have access — dashboard
  // if updateUser() left them with a real session (the normal case), or
  // sign-in if for some reason it didn't.
  useEffect(() => {
    if (status !== 'success') return
    const t = setTimeout(async () => {
      const { data: { session } } = await supabase.auth.getSession()
      navigate(session ? '/dashboard' : '/login')
    }, 2000)
    return () => clearTimeout(t)
  }, [status, navigate])

  if (status === 'checking') {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <div className={styles.header}>
            <Link to="/" className={styles.logo}>
              <div className={styles.logoMark}>iQ</div>
              <span className={styles.logoText}>iCrestiQ GovCon Lab</span>
            </Link>
            <h1 className={styles.title}>Verifying your link…</h1>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--sp-6) 0' }}>
            <div className="spinner" />
          </div>
        </div>
      </div>
    )
  }

  if (status === 'invalid') {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <div className={styles.header}>
            <Link to="/" className={styles.logo}>
              <div className={styles.logoMark}>iQ</div>
              <span className={styles.logoText}>iCrestiQ GovCon Lab</span>
            </Link>
            <h1 className={styles.title}>Link expired or invalid</h1>
            <p className={styles.sub}>
              This password reset link is no longer valid — it may have expired or already been
              used.
            </p>
          </div>

          <p className={styles.switchLink}>
            <Link to="/forgot-password">Request a new link →</Link>
          </p>
        </div>
      </div>
    )
  }

  if (status === 'success') {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <div className={styles.header}>
            <Link to="/" className={styles.logo}>
              <div className={styles.logoMark}>iQ</div>
              <span className={styles.logoText}>iCrestiQ GovCon Lab</span>
            </Link>
            <h1 className={styles.title}>Password updated</h1>
            <p className={styles.sub}>Taking you to your dashboard…</p>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--sp-4) 0' }}>
            <div className="spinner" />
          </div>
        </div>
      </div>
    )
  }

  // status === 'ready'
  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.header}>
          <Link to="/" className={styles.logo}>
            <div className={styles.logoMark}>iQ</div>
            <span className={styles.logoText}>iCrestiQ GovCon Lab</span>
          </Link>
          <h1 className={styles.title}>Set a new password</h1>
          <p className={styles.sub}>Choose a new password for your account.</p>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label className="label">New Password</label>
            <input
              type="password"
              className="input"
              placeholder={`Min. ${MIN_PASSWORD_LENGTH} characters`}
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label className="label">Confirm Password</label>
            <input
              type="password"
              className="input"
              placeholder="Repeat your new password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              required
            />
          </div>
          <button
            type="submit"
            className="btn btn-primary w-full"
            disabled={submitting}
            style={{ justifyContent: 'center', marginTop: 'var(--sp-2)' }}
          >
            {submitting ? <div className="spinner" /> : <><KeyRound size={16} /> Update Password</>}
          </button>
        </form>
      </div>
    </div>
  )
}