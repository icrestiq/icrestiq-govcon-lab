import { useState, useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { UserPlus } from 'lucide-react'
import styles from './Auth.module.css'

// Open-redirect guard: only ever navigate to a same-origin, root-relative
// path. Rejects protocol-relative URLs ("//evil.com" — browsers treat the
// leading // as "same scheme, different host") and absolute URLs
// ("https://evil.com", "javascript:...") by requiring exactly one leading
// slash, not two, and nothing before it.
function isSafeNextPath(next) {
  return typeof next === 'string' && next.startsWith('/') && !next.startsWith('//')
}

const RESEND_COOLDOWN_SECONDS = 60

export default function Register() {
  const { signUp, resendConfirmation } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const next = searchParams.get('next')
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    username: '',
    email: '',
    password: '',
    confirm: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Which post-signUp state to show, if any. null = still on the form.
  // 'pending'  = new signup, no session yet — waiting on email confirmation.
  // 'existing' = signUp() reported an empty identities array — this email
  //              is already registered; Supabase itself doesn't send a
  //              new confirmation email in this case, since doing so would
  //              let anyone confirm which addresses already have accounts.
  const [postSubmitState, setPostSubmitState] = useState(null)
  // Preserves exactly what the user typed, for the echoed address and for
  // the resend call — set once at submit time, never re-derived from form
  // state afterward so it can't drift if the user somehow edits the
  // (unmounted) form fields.
  const [submittedEmail, setSubmittedEmail] = useState('')

  const [resendCooldown, setResendCooldown] = useState(0)
  const [resendStatus, setResendStatus] = useState('idle') // idle | sending | sent | error
  const [resendError, setResendError] = useState('')

  useEffect(() => {
    if (resendCooldown === 0) return
    const t = setTimeout(() => setResendCooldown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [resendCooldown])

  function set(field) {
    return e => setForm(f => ({ ...f, [field]: e.target.value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (!form.firstName.trim()) {
      setError('First name is required.')
      return
    }
    if (form.password !== form.confirm) {
      setError('Passwords do not match.')
      return
    }
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    setLoading(true)
    try {
      const result = await signUp(form.email, form.password, {
        username: form.username || `${form.firstName.toLowerCase()}${form.lastName ? '_' + form.lastName.toLowerCase() : ''}`,
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
      })

      if (result.session) {
        // mailer_autoconfirm — signed in immediately, exactly as before.
        // This path must not regress no matter what else changes below.
        navigate(isSafeNextPath(next) ? next : '/dashboard')
        return
      }

      setSubmittedEmail(form.email)

      const identities = result.user?.identities
      if (result.user && Array.isArray(identities) && identities.length === 0) {
        // Confirmation is on, and this email already has an account.
        // Supabase deliberately returns this shape instead of an error so
        // a signup attempt can't be used to enumerate registered emails —
        // treating it as a fresh signup would tell an existing member
        // "check your email" for a message that will never arrive.
        setPostSubmitState('existing')
      } else {
        setPostSubmitState('pending')
      }
    } catch (err) {
      setError(err.message || 'Registration failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handleResend() {
    setResendStatus('sending')
    setResendError('')
    try {
      await resendConfirmation(submittedEmail)
      setResendStatus('sent')
    } catch (err) {
      setResendStatus('error')
      const msg = err.message || ''
      setResendError(
        /rate.?limit/i.test(msg)
          ? 'Too many emails requested — please wait a few minutes before trying again.'
          : (msg || 'Could not resend the email. Please try again.')
      )
    } finally {
      // Cooldown applies after every press, success or failure — the
      // point is to stop rapid re-pressing, since Supabase rate-limits
      // this hard and a user mashing the button just gets an opaque
      // failure instead of an email.
      setResendCooldown(RESEND_COOLDOWN_SECONDS)
    }
  }

  if (postSubmitState === 'pending') {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <div className={styles.header}>
            <Link to="/" className={styles.logo}>
              <div className={styles.logoMark}>iQ</div>
              <span className={styles.logoText}>iCrestiQ GovCon Lab</span>
            </Link>
            <h1 className={styles.title}>Check your email</h1>
            <p className={styles.sub}>
              We sent a confirmation link to <strong>{submittedEmail}</strong>. Click the link in
              that email to activate your account.
            </p>
          </div>

          <button
            type="button"
            className="btn btn-ghost w-full"
            disabled={resendCooldown > 0 || resendStatus === 'sending'}
            onClick={handleResend}
            style={{ justifyContent: 'center' }}
          >
            {resendStatus === 'sending'
              ? <div className="spinner" />
              : resendCooldown > 0
                ? `Resend email (${resendCooldown}s)`
                : 'Resend email'}
          </button>

          {resendStatus === 'sent' && (
            <div className="alert alert-success" style={{ marginTop: 'var(--sp-4)' }}>
              Sent — check your inbox.
            </div>
          )}
          {resendStatus === 'error' && (
            <div className="alert alert-error" style={{ marginTop: 'var(--sp-4)' }}>
              {resendError}
            </div>
          )}

          <p style={{
            textAlign: 'center',
            fontSize: '0.8125rem',
            color: 'var(--text-muted)',
            marginTop: 'var(--sp-4)',
          }}>
            Don't see it? Check your spam or junk folder — mail from a brand-new sending domain
            sometimes lands there.
          </p>

          <p className={styles.switchLink}>
            <Link to="/login">Back to sign in →</Link>
          </p>
        </div>
      </div>
    )
  }

  if (postSubmitState === 'existing') {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <div className={styles.header}>
            <Link to="/" className={styles.logo}>
              <div className={styles.logoMark}>iQ</div>
              <span className={styles.logoText}>iCrestiQ GovCon Lab</span>
            </Link>
            <h1 className={styles.title}>Account already exists</h1>
            <p className={styles.sub}>
              If an account already exists for <strong>{submittedEmail}</strong>, you can sign in
              below.
            </p>
          </div>

          <p className={styles.switchLink}>
            <Link to="/login">Go to sign in →</Link>
            {' · '}
            <Link to="/forgot-password">Reset your password →</Link>
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
          <h1 className={styles.title}>Join the Lab</h1>
          <p className={styles.sub}>Create your iCrestiQ GovCon Lab account</p>
        </div>

        {error && (
          <div className="alert alert-error" style={{ marginBottom: 'var(--sp-5)' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* First & Last Name row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-3)' }}>
            <div className="field">
              <label className="label">First Name</label>
              <input
                type="text"
                className="input"
                placeholder="Keith"
                value={form.firstName}
                onChange={set('firstName')}
                required
              />
            </div>
            <div className="field">
              <label className="label">Last Name</label>
              <input
                type="text"
                className="input"
                placeholder="Atkinson"
                value={form.lastName}
                onChange={set('lastName')}
              />
            </div>
          </div>

          <div className="field">
            <label className="label">Username</label>
            <input
              type="text"
              className="input"
              placeholder="your_handle (optional)"
              value={form.username}
              onChange={set('username')}
              minLength={3}
            />
          </div>

          <div className="field">
            <label className="label">Email</label>
            <input
              type="email"
              className="input"
              placeholder="you@example.com"
              value={form.email}
              onChange={set('email')}
              required
            />
          </div>

          <div className="field">
            <label className="label">Password</label>
            <input
              type="password"
              className="input"
              placeholder="Min. 8 characters"
              value={form.password}
              onChange={set('password')}
              required
            />
          </div>

          <div className="field">
            <label className="label">Confirm Password</label>
            <input
              type="password"
              className="input"
              placeholder="Repeat your password"
              value={form.confirm}
              onChange={set('confirm')}
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary w-full"
            disabled={loading}
            style={{ justifyContent: 'center', marginTop: 'var(--sp-2)' }}
          >
            {loading ? <div className="spinner" /> : <><UserPlus size={16} /> Create Account</>}
          </button>
        </form>

        <p className={styles.switchLink}>
          Already have an account?{' '}
          <Link to={isSafeNextPath(next) ? `/login?next=${encodeURIComponent(next)}` : '/login'}>Sign in →</Link>
        </p>

        <p style={{
          textAlign: 'center',
          fontSize: '0.6875rem',
          color: 'var(--text-muted)',
          marginTop: 'var(--sp-4)',
          fontFamily: 'var(--font-mono)',
          lineHeight: 1.5,
        }}>
          By creating an account you agree to receive emails from iCrestiQ GovCon Lab.
          Unsubscribe anytime.
        </p>
      </div>
    </div>
  )
}