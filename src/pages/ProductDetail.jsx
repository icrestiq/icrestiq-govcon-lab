import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Package, CheckCircle, ShoppingCart } from 'lucide-react'
import styles from './ProductDetail.module.css'

// Same demo products as Store
const DEMO_PRODUCTS = {
  'hw-fasteners': {
    id: 'hw-fasteners',
    title: 'Hardware & Fasteners Niche Playbook',
    price: 97,
    category: 'Playbooks',
    badge: 'Bestseller',
    description: 'Complete sourcing guide for DIBBS hardware and fastener categories. NSN lookup strategies, vendor qualification, and pricing frameworks.',
    long_description: `This playbook is built from real iCrestiQ sourcing operations on DIBBS — not theory, not guesswork. If you're serious about winning hardware and fastener contracts, this is the operating manual.

Inside you'll find:
- Category breakdown of high-velocity hardware NSNs
- Approved vendor sourcing channels and qualification criteria
- Pricing band analysis and margin targets by NSN class
- DIBBS-specific bid submission workflow
- Quality inspection checkpoints and MIL-SPEC cross-references
- Full appendix with supplier contacts and NSN reference tables`,
    includes: [
      '70+ page PDF playbook',
      'Full supplier appendix',
      'NSN reference table',
      'Pricing band worksheet',
      'Lifetime access + updates',
    ],
  },
  'mil-spec-bible': {
    id: 'mil-spec-bible',
    title: 'MIL-SPEC Packaging Bible™',
    price: 147,
    category: 'Tools',
    badge: 'Popular',
    description: 'The definitive guide to military packaging compliance.',
    long_description: `Military packaging compliance is the #1 reason new contractors get their shipments rejected. This guide eliminates that risk entirely.

The MIL-SPEC Packaging Bible™ covers every major military packaging standard with plain-English explanations, decision trees, and practical examples you can use immediately.

Includes the Bid & Quote Tool™ — a custom Excel workbook that calculates packaging costs automatically and generates compliant quote summaries.`,
    includes: [
      'Complete MIL-SPEC packaging guide',
      'MIL-STD-2073 compliance checklist',
      'Marking & labeling requirements',
      'Bid & Quote Tool™ Excel workbook',
      'SVG graphic reference suite',
    ],
  },
}

export default function ProductDetail() {
  const { productId } = useParams()
  const [product, setProduct] = useState(null)

  useEffect(() => {
    // Try local demo data
    setProduct(DEMO_PRODUCTS[productId] || null)
    // In production: fetch from Supabase
  }, [productId])

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
          <h1 className={styles.title}>{product.title}</h1>
          <p className={styles.desc}>{product.description}</p>
          {product.long_description && (
            <div className={styles.longDesc}>
              {product.long_description.split('\n').map((line, i) =>
                line.startsWith('- ') ? null : <p key={i}>{line}</p>
              )}
            </div>
          )}
        </div>

        {/* Right: purchase card */}
        <div className={styles.purchaseCard}>
          <div className={styles.price}>
            <span className={styles.currency}>$</span>
            <span className={styles.amount}>{product.price}</span>
          </div>

          {product.includes && (
            <div className={styles.includes}>
              <div className={styles.includesLabel}>
                <Package size={14} /> What's included
              </div>
              <ul className={styles.includesList}>
                {product.includes.map(item => (
                  <li key={item} className={styles.includesItem}>
                    <CheckCircle size={14} style={{ color: 'var(--green)', flexShrink: 0 }} />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <button className="btn btn-primary w-full" style={{ justifyContent: 'center', fontSize: '1rem', padding: '14px' }}>
            <ShoppingCart size={18} />
            Add to Cart — ${product.price}
          </button>

          <p className={styles.note}>
            Secure checkout. Instant digital delivery upon payment confirmation.
          </p>
        </div>
      </div>
    </div>
  )
}
