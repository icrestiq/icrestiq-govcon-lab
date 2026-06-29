import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { ShoppingCart, Package, Filter, Search } from 'lucide-react'
import styles from './Store.module.css'
import CartDrawer from '../components/store/CartDrawer'
import { useCart } from '../hooks/useCart'


const CATEGORY_COLORS = {
  'Playbooks': { bg: '#EBF4FF', color: '#2B6CB0', border: '#BEE3F8' },
  'Templates': { bg: '#F0FFF4', color: '#276749', border: '#9AE6B4' },
  'Tools':     { bg: '#FAF5FF', color: '#6B46C1', border: '#D6BCFA' },
  'Courses':   { bg: '#FFFAF0', color: '#C05621', border: '#FBD38D' },
  'Bundles':   { bg: '#FFF5F5', color: '#C53030', border: '#FEB2B2' },
}

const CATEGORIES = ['All', 'Playbooks', 'Templates', 'Tools', 'Courses', 'Bundles']

// Fallback demo products if no DB products yet
const DEMO_PRODUCTS = [
  {
    id: 'hw-fasteners',
    title: 'Hardware & Fasteners Niche Playbook',
    price: 97,
    category: 'Playbooks',
    badge: 'Bestseller',
    badgeType: 'green',
    description: 'Complete sourcing guide for DIBBS hardware and fastener categories. NSN lookup strategies, vendor qualification, and pricing frameworks.',
    tag_line: '70+ pages · Full appendix suite',
  },
  {
    id: 'jan-san',
    title: 'Janitorial & Sanitation Playbook',
    price: 97,
    category: 'Playbooks',
    badge: 'New',
    badgeType: 'blue',
    description: 'End-to-end playbook for janitorial supply contracting. Category breakdowns, approved vendor types, and margin targets by NSN class.',
    tag_line: '65+ pages · Supplier appendix',
  },
  {
    id: 'safety-ppe',
    title: 'Safety & PPE Niche Playbook',
    price: 97,
    category: 'Playbooks',
    badge: null,
    description: 'OSHA-aligned PPE sourcing for government buyers. MIL-SPEC compliance checkpoints and approved product equivalents.',
    tag_line: '60+ pages · Compliance checklist',
  },
  {
    id: 'mro-industrial',
    title: 'MRO & Industrial Parts Playbook',
    price: 97,
    category: 'Playbooks',
    badge: null,
    description: 'Industrial parts and MRO sourcing strategy with NSN deep dives, OEM cross-reference techniques, and pricing band analysis.',
    tag_line: '75+ pages · NSN reference guide',
  },
  {
    id: 'mil-spec-bible',
    title: 'MIL-SPEC Packaging Bible™',
    price: 147,
    category: 'Tools',
    badge: 'Popular',
    badgeType: 'amber',
    description: 'The definitive guide to military packaging compliance. MIL-STD-2073, marking requirements, and the complete Bid & Quote Tool™ workbook.',
    tag_line: 'Guide + Excel Bid & Quote Tool™',
  },
  {
    id: 'govcon-mastery',
    title: 'GovCon Mastery Foundation Course',
    price: 0,
    category: 'Courses',
    badge: 'Free',
    badgeType: 'green',
    description: '23-lesson free foundation course covering LLC setup, SAM registration, DIBBS navigation, and basic sourcing workflows.',
    tag_line: '23 lessons · 5 phases · Lifetime access',
  },
]

export default function Store() {
  const [products, setProducts] = useState(DEMO_PRODUCTS)
  const [category, setCategory] = useState('All')
  const [search, setSearch] = useState('')
  const [cartOpen, setCartOpen] = useState(false)
  const { cart, addToCart, removeFromCart, cartCount } = useCart()

  useEffect(() => {
    loadProducts()
  }, [])

  async function loadProducts() {
    try {
      const { data } = await supabase.from('products').select('*').eq('active', true).order('created_at', { ascending: false })
      if (data && data.length > 0) setProducts(data)
    } catch {
      // Use demo products as fallback
    }
  }

  const filtered = products.filter(p => {
    const matchCat = category === 'All' || p.category === category
    const matchSearch = !search || p.title.toLowerCase().includes(search.toLowerCase())
    return matchCat && matchSearch
  })

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>GovCon Store</h1>
          <p className={styles.sub}>Playbooks, tools, and templates built from real contracting experience.</p>
        </div>
        <button className={`btn btn-ghost ${styles.cartBtn}`} onClick={() => setCartOpen(true)}>
          <ShoppingCart size={18} />
          Cart
          {cartCount > 0 && <span className={styles.cartBadge}>{cartCount}</span>}
        </button>
      </div>

      {/* Filters */}
      <div className={styles.filters}>
        <div className={styles.searchWrap}>
          <Search size={15} className={styles.searchIcon} />
          <input
            className={`input ${styles.searchInput}`}
            placeholder="Search products..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className={styles.categories}>
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              className={`${styles.catBtn} ${category === cat ? styles.catActive : ''}`}
              onClick={() => setCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Products grid */}
      <div className={styles.grid}>
        {filtered.length === 0 && (
          <div className={styles.empty}>
            <Package size={32} style={{ color: 'var(--text-muted)', marginBottom: 'var(--sp-3)' }} />
            <p>No products match your search.</p>
          </div>
        )}
        {filtered.map(product => (
          <ProductCard
            key={product.id}
            product={product}
            inCart={cart.some(c => c.id === product.id)}
            onAddToCart={() => addToCart(product)}
            onRemove={() => removeFromCart(product.id)}
          />
        ))}
      </div>

      {/* Cart drawer */}
      <CartDrawer
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        cart={cart}
        onRemove={removeFromCart}
      />
    </div>
  )
}

function ProductCard({ product, inCart, onAddToCart, onRemove }) {
  const isFree = product.price === 0
  const catColor = CATEGORY_COLORS[product.category] || CATEGORY_COLORS['Playbooks']

  const BADGE_COLORS = {
    'green':  { bg: '#F0FFF4', color: '#276749', border: '#9AE6B4' },
    'blue':   { bg: '#EBF4FF', color: '#2B6CB0', border: '#BEE3F8' },
    'amber':  { bg: '#FFFAF0', color: '#C05621', border: '#FBD38D' },
    'red':    { bg: '#FFF5F5', color: '#C53030', border: '#FEB2B2' },
  }

  return (
    <div className={`card card-hover ${styles.productCard}`}>
      {/* Top */}
      <div className={styles.productTop}>
        <span style={{
          display: 'inline-flex', alignItems: 'center',
          padding: '3px 10px', borderRadius: '100px',
          fontSize: '0.6875rem', fontWeight: 700,
          fontFamily: 'var(--font-display)', textTransform: 'uppercase',
          letterSpacing: '0.05em',
          background: catColor.bg, color: catColor.color, border: `1px solid ${catColor.border}`
        }}>{product.category}</span>
        {product.badge && (() => {
          const bc = BADGE_COLORS[product.badgeType || 'green']
          return (
            <span style={{
              display: 'inline-flex', alignItems: 'center',
              padding: '3px 10px', borderRadius: '100px',
              fontSize: '0.6875rem', fontWeight: 700,
              fontFamily: 'var(--font-display)', textTransform: 'uppercase',
              letterSpacing: '0.05em',
              background: bc.bg, color: bc.color, border: `1px solid ${bc.border}`
            }}>{product.badge}</span>
          )
        })()}
      </div>

     {/* Thumbnail */}
      {product.thumbnail_url && (
        <div style={{ margin: '12px 0', borderRadius: 8, overflow: 'hidden', aspectRatio: '4/3' }}>
          <img
            src={product.thumbnail_url}
            alt={product.title}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        </div>
      )}

      {/* Content */}
         <h3 className={styles.productTitle}>{product.title}</h3>
      <p className={styles.productDesc}>{product.description}</p>

      {product.tag_line && (
        <div className={styles.tagLine}>
          <Package size={12} />
          {product.tag_line}
        </div>
      )}

      {/* Footer */}
      <div className={styles.productFooter}>
        <div className={styles.price}>
          {isFree ? (
            <span className={styles.priceAccent}>FREE</span>
          ) : (
            <>
              <span className={styles.priceCurrency}>$</span>
              <span className={styles.priceAmount}>{product.price}</span>
            </>
          )}
        </div>
        <div className={styles.productActions}>
          <Link to={`/store/${product.id}`} className="btn btn-ghost" style={{ padding: '8px 14px' }}>
            Details
          </Link>
          {!isFree && (
            inCart ? (
              <button className="btn btn-danger" style={{ padding: '8px 14px' }} onClick={onRemove}>
                Remove
              </button>
            ) : (
              <button className="btn btn-primary" style={{ padding: '8px 14px' }} onClick={onAddToCart}>
                Add to Cart
              </button>
            )
          )}
          {isFree && (
            <button className="btn btn-primary" style={{ padding: '8px 14px' }}>
              Access Free →
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
