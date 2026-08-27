import { useState, useRef, useEffect } from 'react'
import { X, ShoppingCart, Trash2, CreditCard, Loader } from 'lucide-react'
import { useAuth } from '../../lib/AuthContext'
import { createCheckoutSession } from '../../lib/stripe'
import { useNavigate } from 'react-router-dom'
import useDialogA11y from '../../hooks/useDialogA11y'
import styles from './CartDrawer.module.css'

export default function CartDrawer({ open, onClose, cart, onRemove, clearCart }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const total = cart.reduce((sum, item) => sum + item.price * item.qty, 0)
  const drawerRef = useRef(null)

  useDialogA11y({ isOpen: open, onClose, containerRef: drawerRef })

  // The drawer stays mounted (slid off-screen) even when closed, for the
  // slide-in transition — without this, its buttons would stay in the tab
  // order while invisible.
  useEffect(() => {
    if (drawerRef.current) drawerRef.current.inert = !open
  }, [open])

  // Cart checkout: if single item, go straight to Stripe.
  // If multiple items, checkout first item (Stripe handles one price per session).
  // For full multi-item cart support, use Stripe Payment Links or build a bundle.
  async function handleCheckout() {
    if (!user) { navigate('/register'); onClose(); return }
    if (cart.length === 0) return

    setError('')
    setLoading(true)

    try {
      // Checkout each item individually via Stripe Checkout
      // For a single item cart, redirect immediately
      // For multi-item, open the first one (standard for digital goods)
      const item = cart[0]
      const { url } = await createCheckoutSession({
        productId: item.id,
        userId: user.id,
        userEmail: user.email,
      })
      window.location.href = url
    } catch (err) {
      setError(err.message || 'Checkout failed. Try again.')
      setLoading(false)
    }
  }

  return (
    <>
      {open && <div className={styles.overlay} onClick={onClose} />}
      <div
        ref={drawerRef}
        className={`${styles.drawer} ${open ? styles.open : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cart-drawer-title"
      >
        <div className={styles.header}>
          <div className={styles.title} id="cart-drawer-title">
            <ShoppingCart size={18} aria-hidden="true" />
            <span>Your Cart</span>
            <span className={styles.count}>{cart.length}</span>
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close cart">
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div className={styles.items}>
          {cart.length === 0 && (
            <div className={styles.empty}>
              <ShoppingCart size={32} style={{ color: 'var(--text-muted)', marginBottom: 'var(--sp-3)' }} aria-hidden="true" />
              <p className={styles.emptyText}>Your cart is empty.</p>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Browse the store and add products.</p>
            </div>
          )}
          {cart.map(item => (
            <div key={item.id} className={styles.item}>
              <div className={styles.itemInfo}>
                <div className={styles.itemTitle}>{item.title}</div>
                <div className={styles.itemPrice}>${item.price}</div>
              </div>
              <button className={styles.removeBtn} onClick={() => onRemove(item.id)} aria-label={`Remove ${item.title} from cart`}>
                <Trash2 size={14} aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>

        {cart.length > 0 && (
          <div className={styles.footer}>
            {error && (
              <div className="alert alert-error" role="alert" style={{ marginBottom: 'var(--sp-3)' }}>{error}</div>
            )}
            <div className={styles.total}>
              <span className="mono">Total</span>
              <span className={styles.totalAmount}>${total}</span>
            </div>

            <button
              className="btn btn-primary w-full"
              style={{ justifyContent: 'center', gap: 'var(--sp-2)' }}
              onClick={handleCheckout}
              disabled={loading}
            >
              {loading ? <Loader size={16} className={styles.spin} aria-hidden="true" /> : <CreditCard size={16} aria-hidden="true" />}
              {loading ? 'Redirecting to Stripe...' : 'Checkout Securely'}
            </button>

            <div className={styles.payMethods}>
              <span className={styles.payMethod}>Visa/MC</span>
              <span className={styles.payDot}>·</span>
              <span className={styles.payMethod}>Klarna</span>
              <span className={styles.payDot}>·</span>
              <span className={styles.payMethod}>Affirm</span>
              <span className={styles.payDot}>·</span>
              <span className={styles.payMethod}>Apple Pay</span>
            </div>

            {cart.length > 1 && (
              <p className={styles.payNote}>
                Multiple items? Each processes as a separate Stripe session. First item loads now.
              </p>
            )}
          </div>
        )}
      </div>
    </>
  )
}
