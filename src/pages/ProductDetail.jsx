import { useState, useEffect } from 'react'
import { useParams, useLocation, Link } from 'react-router-dom'
import { ArrowLeft, Package, ShoppingCart } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { isFoundingMember } from '../lib/tier'
import FounderBadge from '../components/FounderBadge'
import SampleOutputStrip from '../components/SampleOutputStrip'
import styles from './ProductDetail.module.css'

export default function ProductDetail() {
  const { productId } = useParams()
  const location = useLocation()
  const { user, profile, isAdmin } = useAuth()
  const founder = isFoundingMember(profile, isAdmin)
  const nextParam = `?next=${encodeURIComponent(location.pathname)}`
  const [product, setProduct] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadProduct()
  }, [productId])

  async function loadProduct() {
    try {
      const { data } = await supabase
        .from('products')
        .select('*')
        .eq('id', productId)
        .single()
      setProduct(data || null)
    } catch {
      setProduct(null)
    } finally {
      setLoading(false)
    }
  }

  // Matches on the product record itself — name or slug containing
  // "Proposal Builder" (case-insensitive). Checks every plausible field
  // name (name, slug, title) rather than assuming the schema, and never
  // an id or price, so this doesn't break if the record is renamed or
  // re-priced.
  const isProposalBuilderPlaybook = Boolean(
    product &&
    [product.name, product.slug, product.title]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes('proposal builder'))
  )

  if (loading) return (
    <div style={{ padding: 'var(--sp-8)' }}>
      <p>Loading...</p>
    </div>
  )

  if (!product) return (
    <div style={{ padding: 'var(--sp-8)', color: 'var(--text-secondary)' }}>
      <Link to="/store" className="btn btn-ghost" style={{ marginBottom: 'var(--sp-5)' }}>
        <ArrowLeft size={16} /> Back to Store
      </Link>
      <p>Product not found.</p>
    </div>
  )

  return (
    <div className={styles.page}>
      <Link to="/store" className="btn btn-ghost" style={{ marginBottom: 'var(--sp-6)', display: 'inline-flex' }}>
        <ArrowLeft size={16} /> Back to Store
      </Link>

      <div className={styles.grid}>
        <div className={styles.info}>
          <div className={styles.badges}>
            <span className="badge badge-blue">{product.category}</span>
            {product.badge && <span className="badge badge-green">{product.badge}</span>}
          </div>

          {product.thumbnail_url && (
            <img
              src={product.thumbnail_url}
              alt={product.title}
              style={{ width: '100%', borderRadius: 10, marginBottom: 'var(--sp-5)', objectFit: 'cover', aspectRatio: '4/3' }}
            />
          )}

          <h1 className={styles.title}>{product.title}</h1>
          <p className={styles.desc}>{product.description}</p>

          {product.long_description && (
            <div className={styles.longDesc}>
              {product.long_description.split('\n').map((line, i) => (
                <p key={i}>{line}</p>
              ))}
            </div>
          )}

          {isProposalBuilderPlaybook && (
            <div style={{ marginTop: 'var(--sp-6)' }}>
              <SampleOutputStrip />
            </div>
          )}
        </div>

        <div className={styles.purchaseCard}>
          {founder && product.price > 0 && (
            <div style={{ marginBottom: 'var(--sp-3)' }}>
              <FounderBadge tier="founding" size="lg" />
            </div>
          )}

          <div className={styles.price}>
            {product.price === 0 || founder ? (
              <span className={styles.amount}>{founder && product.price > 0 ? 'INCLUDED' : 'FREE'}</span>
            ) : (
              <>
                <span className={styles.currency}>$</span>
                <span className={styles.amount}>{product.price}</span>
              </>
            )}
          </div>

          {product.tag_line && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: 'var(--sp-4)' }}>
              <Package size={14} />
              {product.tag_line}
            </div>
          )}

          {product.price > 0 && !founder && (
            user ? (
              <button className="btn btn-primary w-full" style={{ justifyContent: 'center', fontSize: '1rem', padding: '14px' }}>
                <ShoppingCart size={18} />
                Add to Cart
              </button>
            ) : (
              <Link to={`/register${nextParam}`} className="btn btn-primary w-full" style={{ justifyContent: 'center', fontSize: '1rem', padding: '14px' }}>
                <ShoppingCart size={18} />
                Add to Cart
              </Link>
            )
          )}

          {(product.price === 0 || founder) && (
            user ? (
              <button className="btn btn-primary w-full" style={{ justifyContent: 'center', fontSize: '1rem', padding: '14px' }}>
                {founder && product.price > 0 ? 'Access Now — Included' : 'Access Free'}
              </button>
            ) : (
              <Link to={`/register${nextParam}`} className="btn btn-primary w-full" style={{ justifyContent: 'center', fontSize: '1rem', padding: '14px' }}>
                {founder && product.price > 0 ? 'Access Now — Included' : 'Access Free'}
              </Link>
            )
          )}

          <p className={styles.note}>
            {founder && product.price > 0
              ? 'Included with your Founding Membership — no charge.'
              : 'Secure checkout. Instant digital delivery upon payment confirmation.'}
          </p>
        </div>
      </div>
    </div>
  )
}
