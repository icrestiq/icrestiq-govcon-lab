import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Package, CheckCircle, ShoppingCart } from 'lucide-react'
import { supabase } from '../lib/supabase'
import styles from './ProductDetail.module.css'

export default function ProductDetail() {
  const { productId } = useParams()
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

  if (loading) return (
    <div style={{ padding: 'var(--sp-8)', color: 'var(--text-secondary)' }}>
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
        {/* Left: product info */}
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
        </div>

        {/* Right: purchase card */}
        <div className={styles.purchaseCard}>
          <div className={styles.price}>
            {product.price === 0 ? (
              <span className={styles.amount}>FREE</span>
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

          {product.price > 0 && (
            <button className="btn btn-primary
