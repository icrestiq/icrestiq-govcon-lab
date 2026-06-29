import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { UserPlus } from 'lucide-react'
import styles from './Auth.module.css'

export default function Register() {
  const { signUp } = useAuth()
  const navigate = useNavigate()
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
      await signUp(form.email, form.password, {
        username: form.username || `${form.firstName.toLowerCase()}${form.lastName ? '_' + form.lastName.toLowerCase() : ''}`,
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
      })
      navigate('/dashboard')
    } catch (err) {
      setError(err.message || 'Registration failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.header}>
          <Link to="/" className={styles.logo}>
            <div className={styles.logoMark}>iQ</div>
            <span className={styles.logoText}>GovCon Lab</span>
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
          <Link to="/login">Sign in →</Link>
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
