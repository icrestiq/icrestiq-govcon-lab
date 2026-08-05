import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { Users, Package, MessageSquare, Plus, Trash2, Edit, Tag, Upload, X, Image as ImageIcon, Copy, Check, Mail, Download } from 'lucide-react'
import styles from './AdminPanel.module.css'

const TABS = [
  { id: 'products',    label: 'Products',       icon: Package },
  { id: 'discounts',   label: 'Discount Codes',  icon: Tag },
  { id: 'users',       label: 'Members',         icon: Users },
  { id: 'messages',    label: 'Messages',        icon: MessageSquare },
  { id: 'images',      label: 'Image Uploader',  icon: ImageIcon },
  { id: 'subscribers', label: 'Subscribers',     icon: Mail },
]

export default function AdminPanel() {
  const { profile } = useAuth()
  const [tab, setTab] = useState('products')
  const [products, setProducts] = useState([])
  const [users, setUsers] = useState([])
  const [showProductForm, setShowProductForm] = useState(false)
  const [editProduct, setEditProduct] = useState(null)
  const [pendingReportCount, setPendingReportCount] = useState(0)

  useEffect(() => {
    if (tab === 'products') loadProducts()
    if (tab === 'users') loadUsers()
  }, [tab])

  useEffect(() => { loadPendingReportCount() }, [])

  async function loadPendingReportCount() {
    const { count } = await supabase
      .from('message_reports')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending')
    setPendingReportCount(count || 0)
  }
async function testMonthlyRewards() {
    const { data: { session } } = await supabase.auth.getSession()
    try {
      const res = await fetch('https://zohrpargudmogfywciik.supabase.co/functions/v1/monthly_rewards', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      })
      const data = await res.json()
      console.log('Rewards result:', data)
      alert(JSON.stringify(data, null, 2))
    } catch (err) {
      console.error('Test error:', err)
      alert('Error: ' + err.message)
    }
  }
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
        <button className="btn btn-primary" onClick={testMonthlyRewards} style={{ marginLeft: 'auto' }}>
          Test Monthly Rewards
        </button>
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
            {id === 'messages' && pendingReportCount > 0 && (
              <span className="badge badge-red" style={{ marginLeft: 6, padding: '1px 7px', fontSize: '0.6875rem' }}>
                {pendingReportCount}
              </span>
            )}
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
                  {!p.stripe_price_id && (
                    <span className="badge badge-red" style={{ marginLeft: 'var(--sp-2)' }} title="Checkout will fail until a Stripe Price ID is added">
                      No Price ID
                    </span>
                  )}
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
      {tab === 'discounts' && <DiscountsTab />}

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
      {tab === 'messages' && <ReportsTab />}

      {/* ── Image Uploader ── */}
      {tab === 'images' && <ImageUploaderTab />}

      {/* ── Subscribers ── */}
      {tab === 'subscribers' && <SubscribersTab />}
    </div>
  )
}

// ── Reports Tab — review flagged posts, delete or dismiss ──
function ReportsTab() {
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => { loadReports() }, [])

  async function loadReports() {
    setLoading(true)
    setError('')
    try {
      const { data, error } = await supabase
        .from('message_reports')
        .select(`
          id, reason, status, created_at, reporter_id,
          messages ( id, content, username, room_id, user_id )
        `)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
      if (error) throw error
      setReports(data || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function dismissReport(report) {
    try {
      await supabase.from('message_reports').update({ status: 'dismissed' }).eq('id', report.id)
      setReports(prev => prev.filter(r => r.id !== report.id))
    } catch (err) {
      alert('Could not dismiss: ' + err.message)
    }
  }

  async function deleteReportedPost(report) {
    if (!confirm('Delete this post? This also removes any replies to it. This cannot be undone.')) return
    try {
      if (report.messages?.id) {
        await supabase.from('messages').delete().eq('id', report.messages.id)
      }
      await supabase.from('message_reports').update({ status: 'resolved' }).eq('id', report.id)
      setReports(prev => prev.filter(r => r.id !== report.id))
    } catch (err) {
      alert('Could not delete: ' + err.message)
    }
  }

  return (
    <div>
      <div className={styles.tabActions}>
        <h2 className={styles.tabTitle}>Reported Posts ({reports.length})</h2>
      </div>

      {error && (
        <div className="alert alert-info" style={{ marginBottom: 'var(--sp-5)', borderColor: 'var(--red)', color: 'var(--red)' }}>
          {error}
        </div>
      )}

      {loading && <div className={styles.tableEmpty}>Loading reports…</div>}
      {!loading && reports.length === 0 && (
        <div className={styles.tableEmpty}>No pending reports. All clear.</div>
      )}

      {!loading && reports.map(report => (
        <div key={report.id} className="card" style={{ marginBottom: 'var(--sp-4)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--sp-3)' }}>
            <div>
              <span className="badge badge-red" style={{ marginRight: 'var(--sp-2)', textTransform: 'capitalize' }}>{report.reason}</span>
              <span className="mono" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                room: {report.messages?.room_id || 'unknown'} · {new Date(report.created_at).toLocaleString()}
              </span>
            </div>
          </div>

          <div style={{ background: 'var(--surface-2)', borderRadius: 'var(--r-md)', padding: 'var(--sp-3) var(--sp-4)', marginBottom: 'var(--sp-4)' }}>
            <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--navy)', marginBottom: 'var(--sp-1)' }}>
              {report.messages?.username || 'Unknown user'} posted:
            </p>
            <p style={{ fontSize: '0.9375rem', color: 'var(--text-primary)' }}>
              {report.messages?.content || '(message no longer exists)'}
            </p>
          </div>

          <div style={{ display: 'flex', gap: 'var(--sp-3)' }}>
            <button className="btn btn-danger" onClick={() => deleteReportedPost(report)}>
              <Trash2 size={14} /> Delete Post
            </button>
            <button className="btn btn-ghost" onClick={() => dismissReport(report)}>
              Dismiss
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Discounts Tab — create & manage real Stripe promo codes ──
function DiscountsTab() {
  const [codes, setCodes] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    code: '',
    discountType: 'percent',
    amount: '',
    duration: 'once',
    durationInMonths: 3,
    maxRedemptions: '',
    expiresAt: '',
  })

  useEffect(() => { loadCodes() }, [])

  async function authHeader() {
    const { data: { session } } = await supabase.auth.getSession()
    return { Authorization: `Bearer ${session?.access_token}` }
  }

  async function loadCodes() {
    setLoading(true)
    setError('')
    try {
      const headers = await authHeader()
      const res = await fetch('/api/stripe/discounts', { headers })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load discount codes')
      setCodes(data.codes || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleCreate(e) {
    e.preventDefault()
    setCreating(true)
    setError('')
    try {
      const headers = await authHeader()
      const payload = {
        code: form.code,
        duration: form.duration,
        durationInMonths: form.durationInMonths,
        maxRedemptions: form.maxRedemptions || undefined,
        expiresAt: form.expiresAt || undefined,
      }
      if (form.discountType === 'percent') payload.percentOff = form.amount
      else payload.amountOff = form.amount

      const res = await fetch('/api/stripe/discounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create discount code')

      setForm({
        code: '', discountType: 'percent', amount: '', duration: 'once',
        durationInMonths: 3, maxRedemptions: '', expiresAt: '',
      })
      setShowForm(false)
      loadCodes()
    } catch (err) {
      setError(err.message)
    } finally {
      setCreating(false)
    }
  }

  async function toggleActive(codeRow) {
    try {
      const headers = await authHeader()
      const res = await fetch('/api/stripe/discounts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ id: codeRow.id, active: !codeRow.active }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to update code')
      loadCodes()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div>
      <div className={styles.tabActions}>
        <h2 className={styles.tabTitle}>Discount Codes ({codes.length})</h2>
        <button className="btn btn-primary" onClick={() => setShowForm(f => !f)}>
          <Plus size={16} /> New Discount
        </button>
      </div>

      {error && (
        <div className="alert alert-info" style={{ marginBottom: 'var(--sp-5)', borderColor: 'var(--red)', color: 'var(--red)' }}>
          {error}
        </div>
      )}

      {showForm && (
        <div className="card" style={{ marginBottom: 'var(--sp-6)' }}>
          <h3 style={{ marginBottom: 'var(--sp-5)', fontSize: '1rem', color: 'var(--navy)' }}>New Discount Code</h3>
          <form onSubmit={handleCreate}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-4)' }}>

              <div className="field" style={{ gridColumn: '1 / -1' }}>
                <label className="label">Code (e.g. SUMMER20)</label>
                <input className="input mono" value={form.code}
                  onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                  placeholder="SUMMER20" required />
              </div>

              <div className="field">
                <label className="label">Discount Type</label>
                <select className="input" value={form.discountType}
                  onChange={e => setForm(f => ({ ...f, discountType: e.target.value }))}>
                  <option value="percent">Percent off (%)</option>
                  <option value="amount">Dollar amount off ($)</option>
                </select>
              </div>

              <div className="field">
                <label className="label">{form.discountType === 'percent' ? 'Percent Off' : 'Dollars Off'}</label>
                <input className="input" type="number" min="0"
                  max={form.discountType === 'percent' ? 100 : undefined}
                  value={form.amount}
                  onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                  placeholder={form.discountType === 'percent' ? '20' : '10'} required />
              </div>

              <div className="field">
                <label className="label">Applies</label>
                <select className="input" value={form.duration}
                  onChange={e => setForm(f => ({ ...f, duration: e.target.value }))}>
                  <option value="once">Once (first payment only)</option>
                  <option value="repeating">For a number of months</option>
                  <option value="forever">Forever (every payment)</option>
                </select>
              </div>

              {form.duration === 'repeating' && (
                <div className="field">
                  <label className="label">Number of Months</label>
                  <input className="input" type="number" min="1" value={form.durationInMonths}
                    onChange={e => setForm(f => ({ ...f, durationInMonths: e.target.value }))} />
                </div>
              )}

              <div className="field">
                <label className="label">Max Redemptions (optional)</label>
                <input className="input" type="number" min="1" value={form.maxRedemptions}
                  onChange={e => setForm(f => ({ ...f, maxRedemptions: e.target.value }))}
                  placeholder="Unlimited" />
              </div>

              <div className="field">
                <label className="label">Expires On (optional)</label>
                <input className="input" type="date" value={form.expiresAt}
                  onChange={e => setForm(f => ({ ...f, expiresAt: e.target.value }))} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 'var(--sp-3)', marginTop: 'var(--sp-5)' }}>
              <button type="submit" className="btn btn-primary" disabled={creating}>
                {creating ? <div className="spinner" /> : 'Create Code'}
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className={styles.table}>
        <div className={`${styles.tableRow} ${styles.tableHead}`} style={{ gridTemplateColumns: '1.5fr 1fr 1fr 100px 120px' }}>
          <span>Code</span>
          <span>Discount</span>
          <span>Redemptions</span>
          <span>Expires</span>
          <span>Status</span>
        </div>
        {loading && <div className={styles.tableEmpty}>Loading discount codes…</div>}
        {!loading && codes.length === 0 && (
          <div className={styles.tableEmpty}>No discount codes yet. Create your first one above.</div>
        )}
        {!loading && codes.map(c => (
          <div key={c.id} className={styles.tableRow} style={{ gridTemplateColumns: '1.5fr 1fr 1fr 100px 120px' }}>
            <span className={styles.cellCode}>{c.code}</span>
            <span className={styles.cellPrice}>
              {c.percentOff ? `${c.percentOff}%` : c.amountOff ? `$${c.amountOff}` : '—'}
            </span>
            <span className="mono" style={{ fontSize: '0.8125rem' }}>
              {c.timesRedeemed}{c.maxRedemptions ? ` / ${c.maxRedemptions}` : ''}
            </span>
            <span className="mono" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {c.expiresAt ? new Date(c.expiresAt * 1000).toLocaleDateString() : 'Never'}
            </span>
            <span>
              <button
                className={`badge ${c.active ? 'badge-green' : 'badge-red'}`}
                onClick={() => toggleActive(c)}
                style={{ cursor: 'pointer', border: 'none' }}
              >
                {c.active ? 'Active' : 'Inactive'}
              </button>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Image Uploader Tab — standalone uploader for use across other sites ──
function ImageUploaderTab() {
  const [uploads, setUploads] = useState([])
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [copiedUrl, setCopiedUrl] = useState('')

  async function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setError('')
    setUploading(true)
    try {
      if (file.size > 5 * 1024 * 1024) {
        throw new Error('File too large. Max size is 5MB.')
      }
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
      setUploads(prev => [{ url, name: file.name }, ...prev])
    } catch (err) {
      setError('Upload failed: ' + err.message)
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  function copyToClipboard(url) {
    navigator.clipboard.writeText(url)
    setCopiedUrl(url)
    setTimeout(() => setCopiedUrl(''), 1500)
  }

  return (
    <div>
      <div className={styles.tabActions}>
        <h2 className={styles.tabTitle}>Image Uploader</h2>
      </div>

      <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: 'var(--sp-4)' }}>
        Upload any image to get a permanent, public direct-link URL — useful
        for cover images on other sites (like iCrestiQ Publishing), not just
        GovCon Lab products.
      </p>

      <label className={styles.uploadBtn}>
        <Upload size={16} />
        {uploading ? 'Uploading...' : 'Upload Image'}
        <input type="file" accept="image/*" onChange={handleFile} style={{ display: 'none' }} disabled={uploading} />
      </label>

      {error && <p style={{ color: 'var(--red)', fontSize: '0.8125rem', marginTop: 'var(--sp-2)' }}>{error}</p>}

      <div className={styles.uploadGuide} style={{ marginTop: 'var(--sp-4)' }}>
        <strong>Notes:</strong>
        <ul>
          <li>📐 Any size or aspect ratio works — resize before uploading if you want a specific look</li>
          <li>📁 JPG, PNG, GIF, or WebP</li>
          <li>💾 Max file size: 5MB</li>
          <li>🔗 The URL is permanent and public as soon as it uploads</li>
        </ul>
      </div>

      {uploads.length > 0 && (
        <div style={{ marginTop: 'var(--sp-6)' }}>
          <h3 style={{ fontSize: '0.9375rem', color: 'var(--navy)', marginBottom: 'var(--sp-3)' }}>
            This session&rsquo;s uploads
          </h3>
          <div className={styles.table}>
            {uploads.map((u, i) => (
              <div
                key={i}
                className={styles.tableRow}
                style={{ gridTemplateColumns: '60px 1fr auto' }}
              >
                <img
                  src={u.url}
                  alt=""
                  style={{ width: 48, height: 48, borderRadius: 4, objectFit: 'cover' }}
                />
                <span
                  className="mono"
                  style={{ fontSize: '0.75rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                >
                  {u.url}
                </span>
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{ padding: '4px 10px' }}
                  onClick={() => copyToClipboard(u.url)}
                >
                  {copiedUrl === u.url ? <Check size={14} /> : <Copy size={14} />}
                  {copiedUrl === u.url ? ' Copied' : ' Copy'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Free digest subscriber list, with CSV export ──────────
const SUBSCRIBER_PAGE_SIZE = 100

function SubscribersTab() {
  const [subscribers, setSubscribers] = useState([])
  const [totalCount, setTotalCount] = useState(0)
  const [pageIndex, setPageIndex] = useState(0)
  const [loading, setLoading] = useState(true)

  const [stats, setStats] = useState(null) // { confirmed, pending, newLast7Days, total }
  const [sourceBreakdown, setSourceBreakdown] = useState([])
  const [statsLoading, setStatsLoading] = useState(true)

  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [sourceFilter, setSourceFilter] = useState('all')
  const [statsError, setStatsError] = useState('')
  const [tableError, setTableError] = useState('')
  const [exportError, setExportError] = useState('')
  const [exporting, setExporting] = useState(false)

  useEffect(() => { loadStatsAndBreakdown() }, [])

  // Debounce the search box ~300ms so we're not re-querying the server on
  // every keystroke — only once typing pauses.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300)
    return () => clearTimeout(t)
  }, [search])

  // Reset to page 0 whenever the (debounced) search term or source filter
  // actually changes — otherwise you could be sitting on page 3 when a new
  // filter only has one page of results. The prev===0 check makes this a
  // no-op (no extra render/fetch) in the common case where you're already
  // on page 0 when you change a filter.
  useEffect(() => {
    setPageIndex(prev => (prev === 0 ? prev : 0))
  }, [debouncedSearch, sourceFilter])

  // The actual data load — server-side search/filter now, same as export
  // already did. Re-runs on page change AND whenever the filters change.
  useEffect(() => {
    loadPage(pageIndex, debouncedSearch, sourceFilter)
  }, [pageIndex, debouncedSearch, sourceFilter])

  // ── Aggregate stats: count-only queries (head: true), so these stay
  // cheap and instant no matter how large digest_subscribers grows —
  // never a payload of actual subscriber rows. ──
  async function loadStatsAndBreakdown() {
    setStatsLoading(true)
    setStatsError('')
    try {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

      const [confirmedRes, totalRes, newRes, breakdownRes] = await Promise.all([
        supabase.from('digest_subscribers').select('*', { count: 'exact', head: true }).eq('confirmed', true),
        supabase.from('digest_subscribers').select('*', { count: 'exact', head: true }),
        supabase.from('digest_subscribers').select('*', { count: 'exact', head: true }).gte('created_at', sevenDaysAgo),
        supabase.rpc('digest_subscriber_source_breakdown'),
      ])

      if (confirmedRes.error) throw confirmedRes.error
      if (totalRes.error) throw totalRes.error
      if (newRes.error) throw newRes.error
      if (breakdownRes.error) throw breakdownRes.error

      const confirmed = confirmedRes.count || 0
      const total = totalRes.count || 0
      // Pending computed as total-confirmed, not a second .eq('confirmed', false)
      // query — confirmed is nullable in the real schema, and a NULL row
      // wouldn't match .eq(..., false) under SQL's three-valued logic.
      setStats({
        confirmed,
        pending: Math.max(0, total - confirmed),
        newLast7Days: newRes.count || 0,
        total,
      })
      setSourceBreakdown(breakdownRes.data || [])
    } catch (err) {
      setStatsError(err.message)
    } finally {
      setStatsLoading(false)
    }
  }

  // ── The paginated table itself: exactly one page (100 rows) per
  // request via .range(), with { count: 'exact' } so we know the total
  // for pagination controls without a separate query. Never fetches the
  // full subscriber list. Search and source filter are now applied
  // server-side, same as the export query below — a match beyond page 1
  // is actually found instead of silently looking like a no-result. ──
  async function loadPage(index, searchTerm, source) {
    setLoading(true)
    setTableError('')
    try {
      const from = index * SUBSCRIBER_PAGE_SIZE
      const to = from + SUBSCRIBER_PAGE_SIZE - 1
      let query = supabase
        .from('digest_subscribers')
        .select('id, email, source, confirmed, created_at', { count: 'exact' })
        .order('created_at', { ascending: false })

      if (source && source !== 'all') query = query.eq('source', source)
      if (searchTerm) query = query.ilike('email', `%${searchTerm}%`)

      const { data, count, error } = await query.range(from, to)
      if (error) throw error
      setSubscribers(data || [])
      setTotalCount(count || 0)
    } catch (err) {
      setTableError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const isFiltered = Boolean(debouncedSearch) || sourceFilter !== 'all'
  const pageCount = Math.max(1, Math.ceil(totalCount / SUBSCRIBER_PAGE_SIZE))
  const rangeStart = totalCount === 0 ? 0 : pageIndex * SUBSCRIBER_PAGE_SIZE + 1
  const rangeEnd = Math.min(totalCount, (pageIndex + 1) * SUBSCRIBER_PAGE_SIZE)

  // Export is a deliberate, explicit, one-time action — unlike the page
  // view above, it does need the full list. Fetched in 1,000-row chunks
  // via repeated .range() calls rather than one unbounded request.
  // Guards every CSV cell two ways: (1) a leading single quote on any
  // value starting with =, +, -, or @ so Excel/Sheets treats it as
  // literal text instead of executing it as a formula — the standard
  // defense against CSV/formula injection, since `source` is
  // user-suppliable to the raw API (subscribe.js doesn't restrict it to
  // the UI's fixed values) and `email` only has to look like an email to
  // a regex, not be a safe string; (2) wraps every field in quotes with
  // internal quotes doubled, so a comma, newline, or stray quote in a
  // malformed value can't break the file's column/row structure.
  function csvSafeCell(value) {
    let str = value === null || value === undefined ? '' : String(value)
    if (/^[=+\-@]/.test(str)) str = "'" + str
    return `"${str.replace(/"/g, '""')}"`
  }

  async function exportCsv() {
    setExporting(true)
    setExportError('')
    try {
      const chunkSize = 1000
      let from = 0
      let allRows = []
      while (true) {
        // Same filters as the on-screen search/source dropdown, applied
        // server-side against the full table — not limited to whatever
        // page happens to be loaded in the browser right now.
        let query = supabase
          .from('digest_subscribers')
          .select('email, source, confirmed, created_at')
          .order('created_at', { ascending: false })
          .range(from, from + chunkSize - 1)

        if (sourceFilter !== 'all') query = query.eq('source', sourceFilter)
        if (search.trim()) query = query.ilike('email', `%${search.trim()}%`)

        const { data, error } = await query
        if (error) throw error
        if (!data || data.length === 0) break
        allRows = allRows.concat(data)
        if (data.length < chunkSize) break
        from += chunkSize
      }

      const header = ['email', 'source', 'status', 'created_at']
      const rows = allRows.map(s => [
        s.email,
        s.source || '',
        s.confirmed ? 'Confirmed' : 'Pending',
        s.created_at ? new Date(s.created_at).toISOString() : '',
      ])
      const csv = [header, ...rows]
        .map(row => row.map(csvSafeCell).join(','))
        .join('\n')

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `digest-subscribers-${new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      setExportError(err.message)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div>
      <div className={styles.tabActions}>
        <h2 className={styles.tabTitle}>Subscribers ({totalCount})</h2>
        <button className="btn btn-primary" onClick={exportCsv} disabled={exporting || totalCount === 0}>
          {exporting ? <div className="spinner" /> : <><Download size={16} /> Export CSV</>}
        </button>
      </div>

      {exportError && (
        <div className="alert alert-info" style={{ marginBottom: 'var(--sp-5)', borderColor: 'var(--red)', color: 'var(--red)' }}>
          Export failed: {exportError}
        </div>
      )}

      {/* ── Summary stats — no dedicated "stat card" component exists
          anywhere in this codebase (checked AdminPanel.module.css and
          Dashboard.module.css), so these reuse the existing global
          `card` class and `badge` colors rather than a new style. ── */}
      {statsError ? (
        <div className="alert alert-info" style={{ marginBottom: 'var(--sp-6)', borderColor: 'var(--red)', color: 'var(--red)' }}>
          <strong>Couldn't load subscriber stats:</strong> {statsError}
          <div style={{ fontSize: '0.8125rem', marginTop: 'var(--sp-1)', opacity: 0.85 }}>
            If this is a permissions error, check that the admin SELECT policy on digest_subscribers is actually applied.
          </div>
          <div style={{ marginTop: 'var(--sp-2)' }}>
            <button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: '0.8125rem' }} onClick={loadStatsAndBreakdown}>
              Retry
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 'var(--sp-4)', marginBottom: 'var(--sp-6)' }}>
          <div className="card">
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 'var(--sp-2)' }}>Confirmed</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--navy)' }}>
              {statsLoading || !stats ? '—' : stats.confirmed}
            </div>
            <span className="badge badge-green" style={{ marginTop: 'var(--sp-2)' }}>Ready to send</span>
          </div>
          <div className="card">
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 'var(--sp-2)' }}>Pending confirmation</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--navy)' }}>
              {statsLoading || !stats ? '—' : stats.pending}
            </div>
            <span className="badge badge-amber" style={{ marginTop: 'var(--sp-2)' }}>Never clicked the link</span>
          </div>
          <div className="card">
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 'var(--sp-2)' }}>New in last 7 days</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--navy)' }}>
              {statsLoading || !stats ? '—' : stats.newLast7Days}
            </div>
            <span className="badge badge-blue" style={{ marginTop: 'var(--sp-2)' }}>Signups</span>
          </div>
        </div>
      )}
      {/* No "Unsubscribed" stat: digest_subscribers has no column that
          tracks it (confirmed columns are: id, email, created_at, source,
          confirmed, confirm_token, confirmed_at — verified against the
          live schema). Per "only if the table tracks it," it's omitted
          rather than shown as a fake always-zero number. */}

      {/* ── Source breakdown — grouped by whatever `source` values
          actually exist (via the RPC), not a hardcoded list. ── */}
      <h3 style={{ fontSize: '0.9375rem', color: 'var(--navy)', marginBottom: 'var(--sp-3)' }}>By source</h3>
      <div className={styles.table} style={{ marginBottom: 'var(--sp-6)' }}>
        <div className={`${styles.tableRow} ${styles.tableHead}`} style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr' }}>
          <span>Source</span>
          <span>Confirmed</span>
          <span>Pending</span>
          <span>Total</span>
        </div>
        {statsLoading && <div className={styles.tableEmpty}>Loading...</div>}
        {!statsLoading && statsError && (
          <div className={styles.tableEmpty} style={{ color: 'var(--red)' }}>
            Couldn't load: {statsError}
          </div>
        )}
        {!statsLoading && !statsError && sourceBreakdown.length === 0 && (
          <div className={styles.tableEmpty}>No subscribers yet.</div>
        )}
        {!statsLoading && !statsError && sourceBreakdown.map(row => (
          <div key={row.source} className={styles.tableRow} style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr' }}>
            <span><span className="badge badge-blue">{row.source}</span></span>
            <span className="mono">{row.confirmed_count}</span>
            <span className="mono">{row.pending_count}</span>
            <span className="mono" style={{ fontWeight: 600 }}>{row.total_count}</span>
          </div>
        ))}
      </div>

      {/* ── Filters — client-side, apply to the currently loaded page only ── */}
      <div style={{ display: 'flex', gap: 'var(--sp-3)', marginBottom: 'var(--sp-4)', flexWrap: 'wrap' }}>
        <input
          className="input"
          placeholder="Search email…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ maxWidth: 280 }}
        />
        <select className="input" value={sourceFilter} onChange={e => setSourceFilter(e.target.value)} style={{ maxWidth: 200 }}>
          <option value="all">All sources</option>
          {sourceBreakdown.map(row => (
            <option key={row.source} value={row.source}>{row.source}</option>
          ))}
        </select>
      </div>

      {/* ── The subscriber list itself — one page (100 rows) at a time ── */}
      <div className={styles.table}>
        <div className={`${styles.tableRow} ${styles.tableHead}`}>
          <span>Email</span>
          <span>Source</span>
          <span>Status</span>
          <span>Signed Up</span>
        </div>
        {loading && <div className={styles.tableEmpty}>Loading...</div>}
        {!loading && tableError && (
          <div className={styles.tableEmpty} style={{ color: 'var(--red)' }}>
            <div><strong>Couldn't load subscribers:</strong> {tableError}</div>
            <div style={{ fontSize: '0.8125rem', marginTop: 'var(--sp-1)', opacity: 0.85 }}>
              If this is a permissions error, check that the admin SELECT policy on digest_subscribers is actually applied.
            </div>
            <button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: '0.8125rem', marginTop: 'var(--sp-2)' }} onClick={() => loadPage(pageIndex, debouncedSearch, sourceFilter)}>
              Retry
            </button>
          </div>
        )}
        {!loading && !tableError && subscribers.length === 0 && !isFiltered && (
          <div className={styles.tableEmpty}>
            No subscribers yet. The signup forms on the homepage and /go both feed this list.
          </div>
        )}
        {!loading && !tableError && subscribers.length === 0 && isFiltered && (
          <div className={styles.tableEmpty}>No subscribers match your search or filter.</div>
        )}
        {!loading && !tableError && subscribers.map(s => (
          <div key={s.id} className={styles.tableRow}>
            <span className="mono" style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>{s.email}</span>
            <span><span className="badge badge-blue">{s.source || 'unknown'}</span></span>
            <span>
              <span className={`badge ${s.confirmed ? 'badge-green' : 'badge-amber'}`}>
                {s.confirmed ? 'Confirmed' : 'Pending'}
              </span>
            </span>
            <span className="mono" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {s.created_at ? new Date(s.created_at).toLocaleDateString() : '—'}
            </span>
          </div>
        ))}
      </div>

      {/* ── Pagination ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'var(--sp-4)' }}>
        <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
          {totalCount === 0 ? 'No subscribers' : `Showing ${rangeStart}–${rangeEnd} of ${totalCount}`}
        </span>
        <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
          <button
            className="btn btn-ghost"
            disabled={pageIndex === 0 || loading}
            onClick={() => setPageIndex(p => Math.max(0, p - 1))}
          >
            ← Previous
          </button>
          <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', alignSelf: 'center' }}>
            Page {pageIndex + 1} of {pageCount}
          </span>
          <button
            className="btn btn-ghost"
            disabled={pageIndex + 1 >= pageCount || loading}
            onClick={() => setPageIndex(p => p + 1)}
          >
            Next →
          </button>
        </div>
      </div>
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
    stripe_price_id: product?.stripe_price_id || '',
    is_subscription: product?.is_subscription || false,
    file_url: product?.file_url || '',
  })
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [uploadingFile, setUploadingFile] = useState(false)
  const [fileUploadError, setFileUploadError] = useState('')
  const [fileUploadProgress, setFileUploadProgress] = useState(0)

  async function handleProductFileUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileUploadError('')
    setUploadingFile(true)
    setFileUploadProgress(0)
    try {
      const { data: { session } } = await supabase.auth.getSession()

      const res = await fetch('/api/upload/product-file-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ fileName: file.name }),
      })
      const { path, token, error } = await res.json()
      if (!res.ok) throw new Error(error || 'Could not prepare upload')

      const { error: uploadErr } = await supabase.storage
        .from('products')
        .uploadToSignedUrl(path, token, file)
      if (uploadErr) throw uploadErr

      setForm(f => ({ ...f, file_url: path }))
      setFileUploadProgress(100)
    } catch (err) {
      setFileUploadError('Upload failed: ' + err.message)
    } finally {
      setUploadingFile(false)
    }
  }

  async function handleImageUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadError('')
    setUploading(true)
    try {
      if (file.size > 2 * 1024 * 1024) {
        throw new Error('File too large. Max size is 2MB.')
      }
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
        stripe_price_id: form.stripe_price_id.trim() || null,
        is_subscription: form.is_subscription,
        file_url: form.file_url || null,
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

          <div className="field" style={{ gridColumn: '1 / -1' }}>
            <label className="label">Product Title</label>
            <input className="input" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required />
          </div>

          <div className="field" style={{ gridColumn: '1 / -1' }}>
            <label className="label">Short Description (shown on card)</label>
            <textarea className="input" value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} required />
          </div>

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

          <div className="field" style={{ gridColumn: '1 / -1' }}>
            <label className="label">Tag Line (e.g. "70+ pages · Full appendix suite")</label>
            <input className="input" value={form.tag_line}
              onChange={e => setForm(f => ({ ...f, tag_line: e.target.value }))}
              placeholder="e.g. 70+ pages · Full appendix suite" />
          </div>

          <div className="field">
            <label className="label">Price ($)</label>
            <input className="input" type="number" min="0" value={form.price}
              onChange={e => setForm(f => ({ ...f, price: e.target.value }))} required />
          </div>

          <div className="field">
            <label className="label">Category</label>
            <select className="input" value={form.category}
              onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
              {['Playbooks', 'Templates', 'Tools', 'Courses', 'Bundles'].map(c => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>

          <div className="field">
            <label className="label">Stripe Price ID</label>
            <input className="input mono" value={form.stripe_price_id}
              onChange={e => setForm(f => ({ ...f, stripe_price_id: e.target.value }))}
              placeholder="price_1AbCdEfGhIjKlMnOp" />
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 'var(--sp-1)' }}>
              From Stripe → Product catalog → this product → Pricing. Checkout won't work without this.
            </p>
          </div>

          <div className="field" style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
            <input type="checkbox" id="is_subscription" checked={form.is_subscription}
              onChange={e => setForm(f => ({ ...f, is_subscription: e.target.checked }))}
              style={{ width: 18, height: 18 }} />
            <label htmlFor="is_subscription" className="label" style={{ margin: 0, cursor: 'pointer' }}>
              This is a recurring subscription (unchecked = one-time purchase)
            </label>
          </div>

          <div className="field">
            <label className="label">Badge (optional)</label>
            <input className="input" placeholder="e.g. New, Bestseller, Popular"
              value={form.badge} onChange={e => setForm(f => ({ ...f, badge: e.target.value }))} />
          </div>

          <div className="field" style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', paddingTop: 'var(--sp-5)' }}>
            <input type="checkbox" id="active" checked={form.active}
              onChange={e => setForm(f => ({ ...f, active: e.target.checked }))} />
            <label htmlFor="active" className="label" style={{ marginBottom: 0 }}>
              Active — visible in store
            </label>
          </div>

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

          <div className="field" style={{ gridColumn: '1 / -1' }}>
            <label className="label">Downloadable Product File</label>

            {form.file_url && (
              <div className="alert alert-info" style={{ marginBottom: 'var(--sp-3)', display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
                <span>✓ File attached: <span className="mono" style={{ fontSize: '0.75rem' }}>{form.file_url.split('/').pop()}</span></span>
                <button type="button" className="btn btn-ghost" style={{ padding: '2px 8px', fontSize: '0.75rem' }}
                  onClick={() => setForm(f => ({ ...f, file_url: '' }))}>
                  Remove
                </button>
              </div>
            )}

            <label className={styles.uploadBtn}>
              <Upload size={16} />
              {uploadingFile ? 'Uploading…' : form.file_url ? 'Replace File' : 'Upload Product File'}
              <input type="file" onChange={handleProductFileUpload} style={{ display: 'none' }} disabled={uploadingFile} />
            </label>

            {fileUploadError && <p style={{ color: 'var(--red)', fontSize: '0.8125rem', marginTop: 'var(--sp-2)' }}>{fileUploadError}</p>}

            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 'var(--sp-2)' }}>
              This is the actual file customers receive after purchase (PDF, Excel, ZIP bundle, etc.) — delivered via a secure 24-hour download link. Uploads go directly to storage, so large files (course PDFs, bundles) are fine.
            </p>
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