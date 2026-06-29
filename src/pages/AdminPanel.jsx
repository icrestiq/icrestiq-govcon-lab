import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { Users, Package, MessageSquare, Plus, Trash2, Edit, Tag, Upload, X } from 'lucide-react'
import styles from './AdminPanel.module.css'

const TABS = [
  { id: 'products',  label: 'Products',       icon: Package },
  { id: 'discounts', label: 'Discount Codes',  icon: Tag },
  { id: 'users',     label: 'Members',         icon: Users },
  { id: 'messages',  label: 'Messages',        icon: MessageSquare },
]

// Built-in discount codes — add more here or manage via Stripe dashboard
const DEFAULT_CODES = [
  { code: 'GOVCON10',   discount: 10, type: '%',  active: true,  uses: 0 },
  { code: 'LAUNCH10',   discount: 10, type: '%',  active: true,  uses: 0 },
  { code: 'ICRESTIQ10', discount: 10, type: '%',  active: true,  uses: 0 },
]

export default function AdminPanel() {
  const { profile } = useAuth()
  const [tab, setTab] = useState('products')
  const [products, setProducts] = useState([])
  const [users, setUsers] = useState([])
  const [showProductForm, setShowProductForm] = useState(false)
  const [editProduct, setEditProduct] = useState(null)

  useEffect(() => {
    if (tab === 'products') loadProducts()
    if (tab === 'users') loadUsers()
  }, [tab])

  async function loadProducts() {
    const { data } = await supabase.from('products').select('*').order('created_at', { ascending: false })
    if (data) setProducts(data)
  }

  async function loadUsers() {
    const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false })
    if (data) setUsers(data)
  }

  async function deleteProduct(id) {
    if (!confirm('Delete this product?')) return
    await supabase.from('products').delete().eq('id', id)
    loadProducts()
  }

  async function toggleProductActive(product) {
    await supabase.from('products').update({ active: !product.active }).eq('id', product.id)
    loadProducts()
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Admin Panel</h1>
          <p className={styles.sub}>Logged in as <span style={{ color: 'var(--gold)' }}>{profile?.username}</span></p>
        </div>
        <span className="badge badge-red">Admin Access</span>
      </div>

      {/* Tabs */}
      <div className={styles.tabs}>
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            className={`${styles.tab} ${tab === id ? styles.tabActive : ''}`}
            onClick={() => setTab(id)}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {/* ── Products ── */}
      {tab === 'products' && (
        <div>
          <div className={styles.tabActions}>
            <h2 className={styles.tabTitle}>Products ({products.length})</h2>
            <button className="btn btn-primary" onClick={() => { setEditProduct(null); setShowProductForm(true) }}>
              <Plus size={16} /> Add Product
            </button>
          </div>

          {showProductForm && (
            <ProductForm
              product={editProduct}
              onSave={() => { setShowProductForm(false); loadProducts() }}
              onCancel={() => setShowProductForm(false)}
            />
          )}

          <div className={styles.table}>
            <div className={`${styles.tableRow} ${styles.tableHead}`}>
              <span>Title</span>
              <span>Category</span>
              <span>Price</span>
              <span>Status</span>
              <span>Actions</span>
            </div>
            {products.length === 0 && (
              <div className={styles.tableEmpty}>No products yet. Add your first product above.</div>
            )}
            {products.map(p => (
              <div key={p.id} className={styles.tableRow}>
                <span className={styles.cellTitle}>
                  {p.thumbnail_url && (
                    <img src={p.thumbnail_url} alt="" style={{ width: 32, height: 32, borderRadius: 4, objectFit: 'cover', flexShrink: 0 }} />
                  )}
                  {p.title}
                </span>
                <span><span className="badge badge-blue">{p.category}</span></span>
                <span className={styles.cellPrice}>${p.price}</span>
                <span>
                  <button
                    className={`badge ${p.active ? 'badge-green' : 'badge-amber'}`}
                    onClick={() => toggleProductActive(p)}
                    style={{ cursor: 'pointer', border: 'none' }}
                  >
                    {p.active ? 'Active' : 'Hidden'}
                  </button>
                </span>
                <span className={styles.cellActions}>
                  <button className="btn btn-ghost" style={{ padding: '4px 10px' }}
                    onClick={() => { setEditProduct(p); setShowProductForm(true) }}>
                    <Edit size={14} />
                  </button>
                  <button className="btn btn-danger" style={{ padding: '4px 10px' }}
                    onClick={() => deleteProduct(p.id)}>
                    <Trash2 size={14} />
                  </button>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Discount Codes ── */}
      {tab === 'discounts' && (
        <div>
          <div className={styles.tabActions}>
            <h2 className={styles.tabTitle}>Discount Codes</h2>
          </div>

          <div className="alert alert-info" style={{ marginBottom: 'var(--sp-5)' }}>
            These codes are active on your membership page. To apply discounts to Stripe checkout automatically,
            create matching coupon codes in your Stripe Dashboard → Coupons with the same code names.
          </div>

          <div className={styles.table}>
            <div className={`${styles.tableRow} ${styles.tableHead}`} style={{ gridTemplateColumns: '1fr 1fr 100px 100px 120px' }}>
              <span>Code</span>
              <span>Discount</span>
              <span>Type</span>
              <span>Uses</span>
              <span>Status</span>
            </div>
            {DEFAULT_CODES.map(code => (
              <div key={code.code} className={styles.tableRow} style={{ gridTemplateColumns: '1fr 1fr 100px 100px 120px' }}>
                <span className={styles.cellCode}>{code.code}</span>
                <span className={styles.cellPrice}>{code.discount}{code.type}</span>
                <span><span className="badge badge-blue">Percent</span></span>
                <span className="mono">{code.uses}</span>
                <span><span className={`badge ${code.active ? 'badge-green' : 'badge-red'}`}>{code.active ? 'Active' : 'Inactive'}</span></span>
              </div>
            ))}
          </div>

          <div className="card" style={{ marginTop: 'var(--sp-6)' }}>
            <h3 style={{ marginBottom: 'var(--sp-3)', fontSize: '1rem', color: 'var(--navy)' }}>How to add a new discount code</h3>
            <ol style={{ paddingLeft: 'var(--sp-5)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              <li>Go to <strong>Stripe Dashboard → Coupons → Create coupon</strong></li>
              <li>Set the code name (e.g. <code style={{ background: '#F4F5F7', padding: '2px 6px', borderRadius: 4 }}>SUMMER20</code>)</li>
              <li>Set the discount percent or fixed amount</li>
              <li>Add the same code name to the <code style={{ background: '#F4F5F7', padding: '2px 6px', borderRadius: 4 }}>DISCOUNT_CODES</code> object in <code style={{ background: '#F4F5F7', padding: '2px 6px', borderRadius: 4 }}>src/pages/Membership.jsx</code></li>
              <li>Post it on LinkedIn: <em>"Use code SUMMER20 for 20% off — this week only"</em></li>
            </ol>
          </div>
        </div>
      )}

      {/* ── Users ── */}
      {tab === 'users' && (
        <div>
          <div className={styles.tabActions}>
            <h2 className={styles.tabTitle}>Members ({users.length})</h2>
          </div>
          <div className={styles.table}>
            <div className={`${styles.tableRow} ${styles.tableHead}`}>
              <span>Name</span>
              <span>Email</span>
              <span>Role</span>
              <span>Joined</span>
            </div>
            {users.map(u => (
              <div key={u.id} className={styles.tableRow}>
                <span className={styles.cellTitle}>
                  <div className="avatar" style={{ width: 28, height: 28, fontSize: '0.6875rem' }}>
                    {(u.first_name || u.username || 'M').slice(0, 1).toUpperCase()}
                    {(u.last_name || '').slice(0, 1).toUpperCase()}
                  </div>
                  {u.first_name ? `${u.first_name} ${u.last_name || ''}`.trim() : u.username}
                </span>
                <span className="mono" style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>{u.email}</span>
                <span><span className={`badge ${u.role === 'admin' ? 'badge-red' : 'badge-blue'}`}>{u.role || 'member'}</span></span>
                <span className="mono" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Messages ── */}
      {tab === 'messages' && (
        <div className={styles.comingSoon}>
          <MessageSquare size={32} style={{ color: 'var(--text-muted)', marginBottom: 'var(--sp-3)' }} />
          <p>Message moderation panel coming in the next update.</p>
          <p className="mono" style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: 'var(--sp-2)' }}>
            Use Supabase dashboard → Table Editor → messages for now.
          </p>
        </div>
      )}
    </div>
  )
}

// ── Product Form with image upload ────────────────────────
function ProductForm({ product, onSave, onCancel }) {
  const [form, setForm] = useState({
    title: product?.title || '',
    description: product?.description || '',
    long_description: product?.long_description || '',
    price: product?.price || '',
    category: product?.category || 'Playbooks',
    active: product?.active !== false,
    badge: product?.badge || '',
    tag_line: product?.tag_line || '',
    thumbnail_url: product?.thumbnail_url || '',
  })
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')

  async function handleImageUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadError('')
    setUploading(true)
    try {
      // Validate file size (max 2MB)
      if (file.size > 2 * 1024 * 1024) {
        throw new Error('File too large. Max size is 2MB.')
      }
      // Use server-side API to upload (bypasses storage RLS issues)
      const res = await fetch('/api/upload/image', {
        method: 'POST',
        headers: { 'Content-Type': file.type },
        body: file,
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Upload failed')
      }
      const { url } = await res.json()
      setForm(f => ({ ...f, thumbnail_url: url }))
    } catch (err) {
      setUploadError('Upload failed: ' + err.message)
    } finally {
      setUploading(false)
    }
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = {
        title: form.title,
        description: form.description,
        long_description: form.long_description,
        tag_line: form.tag_line,
        price: Number(form.price),
        category: form.category,
        active: form.active,
        badge: form.badge,
        thumbnail_url: form.thumbnail_url,
      }
      if (product?.id) {
        const { error } = await supabase.from('products').update(payload).eq('id', product.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('products').insert({ ...payload, created_at: new Date().toISOString() })
        if (error) throw error
      }
      onSave()
    } catch (err) {
      console.error('Save error:', err)
      alert('Save failed: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="card" style={{ marginBottom: 'var(--sp-6)' }}>
      <h3 style={{ marginBottom: 'var(--sp-5)', fontSize: '1rem', color: 'var(--navy)' }}>
        {product ? 'Edit Product' : 'New Product'}
      </h3>
      <form onSubmit={handleSave}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-4)' }}>

          {/* Title */}
          <div className="field" style={{ gridColumn: '1 / -1' }}>
            <label className="label">Product Title</label>
            <input className="input" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required />
          </div>

          {/* Short Description */}
          <div className="field" style={{ gridColumn: '1 / -1' }}>
            <label className="label">Short Description (shown on card)</label>
            <textarea className="input" value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} required />
          </div>

          {/* Rich Long Description */}
          <div className="field" style={{ gridColumn: '1 / -1' }}>
            <label className="label">Full Description (shown on product page)</label>
            <textarea className="input" value={form.long_description}
              onChange={e => setForm(f => ({ ...f, long_description: e.target.value }))}
              rows={6}
              placeholder="Supports basic formatting:&#10;- Use hyphens for bullet points&#10;- Separate paragraphs with blank lines&#10;- Use ALL CAPS for section headers" />
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 'var(--sp-2)', fontFamily: 'var(--font-mono)' }}>
              Tip: Start lines with "- " for bullets. Separate paragraphs with a blank line.
            </p>
          </div>

          {/* Tag line */}
          <div className="field" style={{ gridColumn: '1 / -1' }}>
            <label className="label">Tag Line (e.g. "70+ pages · Full appendix suite")</label>
            <input className="input" value={form.tag_line}
              onChange={e => setForm(f => ({ ...f, tag_line: e.target.value }))}
              placeholder="e.g. 70+ pages · Full appendix suite" />
          </div>

          {/* Price */}
          <div className="field">
            <label className="label">Price ($)</label>
            <input className="input" type="number" min="0" value={form.price}
              onChange={e => setForm(f => ({ ...f, price: e.target.value }))} required />
          </div>

          {/* Category */}
          <div className="field">
            <label className="label">Category</label>
            <select className="input" value={form.category}
              onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
              {['Playbooks', 'Templates', 'Tools', 'Courses', 'Bundles'].map(c => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Badge */}
          <div className="field">
            <label className="label">Badge (optional)</label>
            <input className="input" placeholder="e.g. New, Bestseller, Popular"
              value={form.badge} onChange={e => setForm(f => ({ ...f, badge: e.target.value }))} />
          </div>

          {/* Active toggle */}
          <div className="field" style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', paddingTop: 'var(--sp-5)' }}>
            <input type="checkbox" id="active" checked={form.active}
              onChange={e => setForm(f => ({ ...f, active: e.target.checked }))} />
            <label htmlFor="active" className="label" style={{ marginBottom: 0 }}>
              Active — visible in store
            </label>
          </div>

          {/* Thumbnail Upload */}
          <div className="field" style={{ gridColumn: '1 / -1' }}>
            <label className="label">Product Thumbnail</label>

            {form.thumbnail_url && (
              <div style={{ marginBottom: 'var(--sp-3)', position: 'relative', display: 'inline-block' }}>
                <img src={form.thumbnail_url} alt="Thumbnail"
                  style={{ width: 120, height: 90, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)' }} />
                <button type="button"
                  style={{ position: 'absolute', top: -8, right: -8, background: 'var(--red)', border: 'none', borderRadius: '50%', width: 20, height: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}
                  onClick={() => setForm(f => ({ ...f, thumbnail_url: '' }))}>
                  <X size={12} />
                </button>
              </div>
            )}

            <label className={styles.uploadBtn}>
              <Upload size={16} />
              {uploading ? 'Uploading...' : 'Upload Thumbnail'}
              <input type="file" accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} disabled={uploading} />
            </label>

            {uploadError && <p style={{ color: 'var(--red)', fontSize: '0.8125rem', marginTop: 'var(--sp-2)' }}>{uploadError}</p>}

            <div className={styles.uploadGuide}>
              <strong>Recommended specs:</strong>
              <ul>
                <li>📐 <strong>Size:</strong> 800 × 600px (4:3 ratio) — landscape orientation</li>
                <li>📁 <strong>File type:</strong> JPG or PNG</li>
                <li>💾 <strong>Max file size:</strong> 2MB</li>
                <li>🖼 <strong>Orientation:</strong> Landscape (wider than tall)</li>
                <li>🎨 <strong>Style tip:</strong> Use navy/gold iCrestiQ branding for consistency</li>
              </ul>
            </div>
          </div>

        </div>

        <div style={{ display: 'flex', gap: 'var(--sp-3)', marginTop: 'var(--sp-5)' }}>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? <div className="spinner" /> : 'Save Product'}
          </button>
          <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancel</button>
        </div>
      </form>
    </div>
  )
}
