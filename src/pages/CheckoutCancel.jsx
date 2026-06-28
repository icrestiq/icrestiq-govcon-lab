import { Link } from 'react-router-dom'
import { XCircle, ArrowLeft, ShoppingBag } from 'lucide-react'
import styles from './CheckoutResult.module.css'

export default function CheckoutCancel() {
  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.iconWrapCancel}>
          <XCircle size={48} strokeWidth={1.5} />
        </div>

        <h1 className={styles.title}>Checkout cancelled</h1>
        <p className={styles.message}>
          No worries — nothing was charged. Your cart is still ready when you are.
        </p>

        <hr className="divider" />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)', marginTop: 'var(--sp-2)' }}>
          <Link to="/store" className="btn btn-primary w-full" style={{ justifyContent: 'center' }}>
            <ShoppingBag size={16} />
            Return to Store
          </Link>
          <Link to="/dashboard" className="btn btn-ghost w-full" style={{ justifyContent: 'center' }}>
            <ArrowLeft size={16} />
            Back to Dashboard
          </Link>
        </div>

        <p className={styles.emailNote}>
          Have a question before purchasing? Post in #general or reach out directly.
        </p>
      </div>
    </div>
  )
}
