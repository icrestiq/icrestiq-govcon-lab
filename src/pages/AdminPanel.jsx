import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { Users, Package, MessageSquare, Plus, Trash2, Edit } from 'lucide-react'
import styles from './AdminPanel.module.css'

const TABS = [
  { id: 'products', label: 'Products', icon: Package },
  { id: 'users', label: 'Members', icon: Users },
  { id: 'messages', label: 'Messages', icon: MessageSquare },
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
          <p className={styles.sub}>Logged in as <span style={{ color: 'var(--green)' }}>{profile?.username}</span></p>
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

      {/* Products tab */}
      {tab === 'products' && (
        <div>
          <div className={styles.tabActions}>
            <h2 className={styles.tabTitle}>Products</h2>
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
                <span className={styles.cellTitle}>{p.title}</span>
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

      {/* Users tab */}
      {tab === 'users' && (
        <div>
          <div className={styles.tabActions}>
            <h2 className={styles.tabTitle}>Members ({users.length})</h2>
          </div>
          <div className={styles.table}>
            <div className={`${styles.tableRow} ${styles.tableHead}`}>
              <span>Username</span>
              <span>Email</span>
              <span>Role</span>
              <span>Joined</span>
            </div>
            {users.map(u => (
              <div key={u.id} className={styles.tableRow}>
                <span className={styles.cellTitle}>
                  <div className="avatar" style={{ width: 28, height: 28, fontSize: '0.6875rem' }}>
                    {(u.username || 'M').slice(0, 2).toUpperCase()}
                  </div>
                  {u.username}
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

      {/* Messages tab */}
      {tab === 'messages' && (
        <div className={styles.comingSoon}>
          <MessageSquare size={32} style={{ color: 'var(--text-muted)', marginBottom: 'var(--sp-3)' }} />
          <p>Message moderation panel coming in the next update.</p>
          <p className="mono" style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: 'var(--sp-2)' }}>
            Use Supabase dashboard for now.
          </p>
        </div>
      )}
    </div>
  )
}

function ProductForm({ product, onSave, onCancel }) {
  const [form, setForm] = useState({
    title: product?.title || '',
    description: product?.description || '',
    price: product?.price || '',
    category: product?.category || 'Playbooks',
    active: product?.active !== false,
    badge: product?.badge || '',
  })
  const [saving, setSaving] = useState(false)

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = { ...form, price: Number(form.price) }
      if (product?.id) {
        await supabase.from('products').update(payload).eq('id', product.id)
      } else {
        await supabase.from('products').insert({ ...payload, created_at: new Date().toISOString() })
      }
      onSave()
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="card" style={{ marginBottom: 'var(--sp-6)' }}>
      <h3 style={{ marginBottom: 'var(--sp-5)', fontSize: '1rem' }}>
        {product ? 'Edit Product' : 'New Product'}
      </h3>
      <form onSubmit={handleSave}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-4)' }}>
          <div className="field" style={{ gridColumn: '1 / -1' }}>
            <label className="label">Title</label>
            <input className="input" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required />
          </div>
          <div className="field" style={{ gridColumn: '1 / -1' }}>
            <label className="label">Description</label>
            <textarea className="input" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} required />
          </div>
          <div className="field">
            <label className="label">Price ($)</label>
            <input className="input" type="number" min="0" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} required />
          </div>
          <div className="field">
            <label className="label">Category</label>
            <select className="input" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
              {['Playbooks', 'Templates', 'Tools', 'Courses', 'Bundles'].map(c => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label className="label">Badge (optional)</label>
            <input className="input" placeholder="e.g. New, Bestseller" value={form.badge} onChange={e => setForm(f => ({ ...f, badge: e.target.value }))} />
          </div>
          <div className="field" style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', paddingTop: 'var(--sp-5)' }}>
            <input type="checkbox" id="active" checked={form.active} onChange={e => setForm(f => ({ ...f, active: e.target.checked }))} />
            <label htmlFor="active" className="label" style={{ marginBottom: 0 }}>Active (visible in store)</label>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 'var(--sp-3)', marginTop: 'var(--sp-4)' }}>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? <div className="spinner" /> : 'Save Product'}
          </button>
          <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancel</button>
        </div>
      </form>
    </div>
  )
}
