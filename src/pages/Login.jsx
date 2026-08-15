import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { LogIn, Eye, EyeOff } from 'lucide-react'
import Turnstile from '../components/Turnstile'
import styles from './Auth.module.css'

// Open-redirect guard: only ever navigate to a same-origin, root-relative
// path. Rejects protocol-relative URLs ("//evil.com" — browsers treat the
// leading // as "same scheme, different host") and absolute URLs
// ("https://evil.com", "javascript:...") by requiring exactly one leading
// slash, not two, and nothing before it.
function isSafeNextPath(next) {
  return typeof next === 'string' && next.startsWith('/') && !next.startsWith('//')
}

// Supabase's error for this case doesn't have a stable code on every
// client version, so this matches on the message text the user described
// ("commonly Email not confirmed") as the primary signal, and also checks
// a structured `code` field in case the installed client sets one — belt
// and suspenders, but the text match alone is sufficient and is what's
// actually verified below.
function isEmailNotConfirmedError(err) {
  return err?.code === 'email_not_confirmed' || /email not confirmed/i.test(err?.message || '')
}

const RESEND_COOLDOWN_SECONDS = 60

export default function Login() {
  const { signIn, resendConfirmation } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const next = searchParams.get('next')
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Set only when signIn() fails specifically because the email isn't
  // confirmed yet — holds the email that was actually submitted, for the
  // resend call. Every other login error still goes through setError()
  // below, untouched.
  const [unconfirmedEmail, setUnconfirmedEmail] = useState(null)

  const [resendCooldown, setResendCooldown] = useState(0)
  const [resendStatus, setResendStatus] = useState('idle') // idle | sending | sent | error
  const [resendError, setResendError] = useState('')

  const [captchaToken, setCaptchaToken] = useState('')
  const turnstileRef = useRef(null)
  const [showPassword, setShowPassword] = useState(false)

  useEffect(() => {
    if (resendCooldown === 0) return
    const t = setTimeout(() => setResendCooldown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [resendCooldown])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setUnconfirmedEmail(null)

    if (!captchaToken) {
      setError('Please complete the verification challenge.')
      return
    }

    setLoading(true)
    try {
      await signIn(form.email, form.password, captchaToken)
      navigate(isSafeNextPath(next) ? next : '/dashboard')
    } catch (err) {
      if (isEmailNotConfirmedError(err)) {
        setUnconfirmedEmail(form.email)
      } else {
        setError(err.message || 'Sign in failed. Check your credentials.')
      }
      // Single-use token — reset the widget so the next attempt gets a
      // fresh one, whether this failed on credentials or the captcha itself.
      turnstileRef.current?.reset()
      setCaptchaToken('')
    } finally {
      setLoading(false)
    }
  }

  async function handleResend() {
    setResendStatus('sending')
    setResendError('')
    try {
      await resendConfirmation(unconfirmedEmail)
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
      setResendCooldown(RESEND_COOLDOWN_SECONDS)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.header}>
          <Link to="/" className={styles.logo}>
            <div className={styles.logoMark}>iQ</div>
            <span className={styles.logoText}>iCrestiQ GovCon Lab</span>
          </Link>
          <h1 className={styles.title}>Welcome back</h1>
          <p className={styles.sub}>Sign in to your iCrestiQ GovCon Lab account</p>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        {unconfirmedEmail && (
          <div className="alert alert-error">
            <div>
              Your account exists, but <strong>{unconfirmedEmail}</strong> hasn't been confirmed
              yet. Check your email for the confirmation link.
            </div>
            <button
              type="button"
              className="btn btn-ghost"
              disabled={resendCooldown > 0 || resendStatus === 'sending'}
              onClick={handleResend}
              style={{ justifyContent: 'center', marginTop: 'var(--sp-3)' }}
            >
              {resendStatus === 'sending'
                ? <div className="spinner" />
                : resendCooldown > 0
                  ? `Resend confirmation email (${resendCooldown}s)`
                  : 'Resend confirmation email'}
            </button>
            {resendStatus === 'sent' && (
              <div className="alert alert-success" style={{ marginTop: 'var(--sp-3)' }}>
                Sent — check your inbox.
              </div>
            )}
            {resendStatus === 'error' && (
              <div style={{ color: 'var(--red)', fontSize: '0.8125rem', marginTop: 'var(--sp-2)' }}>
                {resendError}
              </div>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label className="label">Email</label>
            <input
              type="email"
              className="input"
              placeholder="you@example.com"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              required
            />
          </div>
          <div className="field">
            <label className="label">Password</label>
            <div className={styles.passwordWrap}>
              <input
                type={showPassword ? 'text' : 'password'}
                className="input"
                placeholder="Your password"
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                required
                style={{ paddingRight: 40 }}
              />
              <button
                type="button"
                className={styles.passwordToggle}
                onClick={() => setShowPassword(s => !s)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
            <Link to="/forgot-password" style={{ display: 'inline-block', fontSize: '0.8125rem', marginTop: 'var(--sp-2)' }}>
              Forgot your password?
            </Link>
          </div>

          <Turnstile ref={turnstileRef} onVerify={setCaptchaToken} />

          <button
            type="submit"
            className="btn btn-primary w-full"
            disabled={loading}
            style={{ justifyContent: 'center', marginTop: 'var(--sp-2)' }}
          >
            {loading ? <div className="spinner" /> : <><LogIn size={16} /> Sign In</>}
          </button>
        </form>

        <p className={styles.switchLink}>
          Don't have an account?{' '}
          <Link to={isSafeNextPath(next) ? `/register?next=${encodeURIComponent(next)}` : '/register'}>Join the Lab →</Link>
        </p>
      </div>
    </div>
  )
}