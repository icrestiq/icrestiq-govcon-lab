import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { ShoppingCart, Package, Search,Shirt, ArrowRight } from 'lucide-react'
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

export default function Store() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState('All')
  const [search, setSearch] = useState('')
  const [cartOpen, setCartOpen] = useState(false)
  const { cart, addToCart, removeFromCart, cartCount } = useCart()

  useEffect(() => {
    loadProducts()
  }, [])

  async function loadProducts() {
    try {
      const { data } = await supabase
        .from('products')
        .select('*')
        .eq('active', true)
        .order('created_at', { ascending: false })
      if (data) setProducts(data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
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

      {/* Merch store banner */}
      
        <a href="https://govconlab.printify.me/"
        target="_blank"
        rel="noopener noreferrer"
        className="card card-hover"
        style={{
          display: 'flex', alignItems: 'center', gap: 'var(--sp-3)',
          padding: 'var(--sp-4)', marginBottom: 'var(--sp-5)',
          textDecoration: 'none', color: 'inherit',
        }}
      >
        <div style={{
          width: 40, height: 40, borderRadius: 10, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: '#C9A84C15', border: '1px solid #C9A84C30', color: '#93762c',
        }}>
          <Shirt size={20} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: '0.9375rem' }}>Merch Store</div>
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
            Shirts, hats & branded gear — shop the GovCon Lab collection
          </div>
        </div>
        <ArrowRight size={18} style={{ opacity: 0.6, flexShrink: 0 }} />
      </a>

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
        {loading && (
          <div className={styles.empty}>
            <p>Loading products...</p>
          </div>
        )}
        {!loading && filtered.length === 0 && (
          <div className={styles.empty}>
            <Package size={32} style={{ color: 'var(--text-muted)', marginBottom: 'var(--sp-3)' }} />
            <p>No products available yet.</p>
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
      {/* Badges */}
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
          const bc = BADGE_COLORS[product.badge_type || 'green']
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
