import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { Users, Package, MessageSquare, Plus, Trash2, Edit, Tag, Upload, X, Image as ImageIcon, Copy, Check, Download, Newspaper, Eye, Activity, FileText, MessageCircle, Heart, BarChart3, Flag } from 'lucide-react'
import { htmlToBodyText, plainTextToBodyText } from '../lib/blogPasteImport'
import Avatar from '../components/Avatar'
import ActivityHeatmap from '../components/ActivityHeatmap'
import styles from './AdminPanel.module.css'

const TABS = [
  { id: 'products',    label: 'Products',       icon: Package },
  { id: 'discounts',   label: 'Discount Codes',  icon: Tag },
  { id: 'people',      label: 'People',          icon: Users },
  { id: 'messages',    label: 'Messages',        icon: MessageSquare },
  { id: 'images',      label: 'Image Uploader',  icon: ImageIcon },
  { id: 'blog',        label: 'Blog Posts',      icon: Newspaper },
  { id: 'analytics',   label: 'Site Analytics',  icon: BarChart3 },
  { id: 'flagged-notes', label: 'Flagged Notes', icon: Flag },
]

export default function AdminPanel() {
  const { profile } = useAuth()
  const [tab, setTab] = useState('products')
  const [products, setProducts] = useState([])
  const [showProductForm, setShowProductForm] = useState(false)
  const [editProduct, setEditProduct] = useState(null)
  const [pendingReportCount, setPendingReportCount] = useState(0)

  useEffect(() => {
    if (tab === 'products') loadProducts()
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

      {/* ── People (Members + Subscribers, merged) ── */}
      {tab === 'people' && <PeopleTab />}

      {/* ── Messages ── */}
      {tab === 'messages' && <ReportsTab />}

      {/* ── Image Uploader ── */}
      {tab === 'images' && <ImageUploaderTab />}

      {/* ── Blog Posts ── */}
      {tab === 'blog' && <BlogTab />}

      {/* ── Site Analytics ── */}
      {tab === 'analytics' && <AnalyticsTab />}
      {tab === 'flagged-notes' && <FlaggedNotesTab />}
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

      // reporter_id references auth.users, not profiles, so it can't be
      // embedded via Supabase's FK-based select() shorthand the way
      // `messages (...)` above is — fetch the reporter usernames as a
      // separate lookup instead.
      const reporterIds = [...new Set((data || []).map(r => r.reporter_id).filter(Boolean))]
      let reporterNames = {}
      if (reporterIds.length) {
        const { data: reporters } = await supabase
          .from('profiles')
          .select('id, username, first_name, last_name')
          .in('id', reporterIds)
        reporterNames = Object.fromEntries(
          (reporters || []).map(p => [p.id, p.first_name ? `${p.first_name} ${p.last_name || ''}`.trim() : p.username])
        )
      }

      setReports((data || []).map(r => ({ ...r, reporterName: reporterNames[r.reporter_id] || 'Unknown user' })))
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
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

  // Distinct from Dismiss/Delete Post: those only change the report's
  // status (which just hides it from this pending-reports view), the
  // row stays in the table forever either way. This actually deletes
  // the report record — the underlying chat message is untouched.
  async function deleteReport(report) {
    if (!confirm('Permanently delete this report? This does not delete the post itself. This cannot be undone.')) return
    try {
      const { error } = await supabase.from('message_reports').delete().eq('id', report.id)
      if (error) throw error
      setReports(prev => prev.filter(r => r.id !== report.id))
    } catch (err) {
      alert('Could not delete report: ' + err.message)
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
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 'var(--sp-1)' }}>
                Reported by <strong style={{ color: 'var(--text-secondary)' }}>{report.reporterName}</strong>
              </div>
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
            <button className="btn btn-ghost" onClick={() => deleteReport(report)} title="Delete this report — leaves the post itself alone">
              <Trash2 size={14} /> Delete Report
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Flagged Notes Tab — Sourcing Pipeline Phase 3 moderation ──
function FlaggedNotesTab() {
  const [flags, setFlags] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actingId, setActingId] = useState(null)

  useEffect(() => { loadFlags() }, [])

  async function authHeader() {
    const { data: { session } } = await supabase.auth.getSession()
    return { Authorization: `Bearer ${session?.access_token}` }
  }

  async function loadFlags() {
    setLoading(true)
    setError('')
    try {
      const { data: flagRows, error: flagErr } = await supabase
        .from('note_flags')
        .select('*')
        .order('created_at', { ascending: false })
      if (flagErr) throw flagErr

      const noteIds = [...new Set((flagRows || []).map(f => f.note_id))]
      const { data: notes, error: notesErr } = noteIds.length
        ? await supabase.from('notes').select('*').in('id', noteIds)
        : { data: [], error: null }
      if (notesErr) throw notesErr
      const noteById = Object.fromEntries((notes || []).map(n => [n.id, n]))

      const companyIds = [...new Set((notes || []).map(n => n.company_id).filter(Boolean))]
      const contactIds = [...new Set((notes || []).map(n => n.contact_id).filter(Boolean))]
      const [{ data: companies }, { data: contacts }] = await Promise.all([
        companyIds.length ? supabase.from('companies').select('id, name').in('id', companyIds) : Promise.resolve({ data: [] }),
        contactIds.length ? supabase.from('contacts').select('id, name').in('id', contactIds) : Promise.resolve({ data: [] }),
      ])
      const companyById = Object.fromEntries((companies || []).map(c => [c.id, c.name]))
      const contactById = Object.fromEntries((contacts || []).map(c => [c.id, c.name]))

      // author_id/flagged_by_profile_id both reference profiles — fetched
      // as a flat lookup (same approach as ReportsTab's reporterNames)
      // rather than an embedded select, since notes has two profile FKs
      // (author_id, removed_by_profile_id) which makes Supabase's
      // FK-inference embed ambiguous.
      const profileIds = [...new Set([
        ...(notes || []).map(n => n.author_id),
        ...(flagRows || []).map(f => f.flagged_by_profile_id),
      ].filter(Boolean))]
      const { data: profiles } = profileIds.length
        ? await supabase.from('profiles').select('id, username, first_name, last_name').in('id', profileIds)
        : { data: [] }
      const nameById = Object.fromEntries((profiles || []).map(p => [
        p.id, p.first_name ? `${p.first_name} ${p.last_name || ''}`.trim() : p.username,
      ]))

      const rows = (flagRows || []).map(f => {
        const note = noteById[f.note_id]
        return {
          ...f,
          note,
          entityName: note ? (note.company_id ? companyById[note.company_id] : contactById[note.contact_id]) : null,
          entityType: note ? (note.company_id ? 'Company' : 'Contact') : null,
          authorName: note ? (nameById[note.author_id] || 'Unknown member') : null,
          flaggerName: nameById[f.flagged_by_profile_id] || 'Unknown member',
        }
      })
      setFlags(rows)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function removeNote(flag) {
    if (!flag.note) return
    if (!confirm('Remove this note from the shared directory? This unshares it and records the removal. This cannot be undone.')) return
    setActingId(flag.id)
    try {
      const headers = await authHeader()
      const res = await fetch('/api/admin/moderate-note', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ noteId: flag.note_id, reason: 'Removed via flagged-notes moderation' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to remove note')
      // Other pending flags on the same note (if it was flagged by more
      // than one member) are now stale too — the note is unshared either way.
      setFlags(prev => prev.filter(f => f.note_id !== flag.note_id))
    } catch (err) {
      alert('Could not remove note: ' + err.message)
    } finally {
      setActingId(null)
    }
  }

  async function dismissFlag(flag) {
    setActingId(flag.id)
    try {
      const { error: err } = await supabase.from('note_flags').delete().eq('id', flag.id)
      if (err) throw err
      setFlags(prev => prev.filter(f => f.id !== flag.id))
    } catch (err) {
      alert('Could not dismiss flag: ' + err.message)
    } finally {
      setActingId(null)
    }
  }

  return (
    <div>
      <div className={styles.tabActions}>
        <h2 className={styles.tabTitle}>Flagged Notes ({flags.length})</h2>
      </div>

      {error && (
        <div className="alert alert-info" style={{ marginBottom: 'var(--sp-5)', borderColor: 'var(--red)', color: 'var(--red)' }}>
          {error}
        </div>
      )}

      {loading && <div className={styles.tableEmpty}>Loading flagged notes…</div>}
      {!loading && flags.length === 0 && (
        <div className={styles.tableEmpty}>No flagged notes. All clear.</div>
      )}

      {!loading && flags.map(flag => (
        <div key={flag.id} className="card" style={{ marginBottom: 'var(--sp-4)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--sp-3)' }}>
            <div>
              <span className="badge badge-red" style={{ marginRight: 'var(--sp-2)' }}>Flagged</span>
              <span className="mono" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {flag.note ? `${flag.entityType}: ${flag.entityName || 'unknown'}` : 'note no longer exists'} · {new Date(flag.created_at).toLocaleString()}
              </span>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 'var(--sp-1)' }}>
                Flagged by <strong style={{ color: 'var(--text-secondary)' }}>{flag.flaggerName}</strong>
              </div>
            </div>
          </div>

          <div style={{ background: 'var(--surface-2)', borderRadius: 'var(--r-md)', padding: 'var(--sp-3) var(--sp-4)', marginBottom: 'var(--sp-4)' }}>
            <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--navy)', marginBottom: 'var(--sp-1)' }}>
              {flag.authorName || 'Unknown member'} wrote:
            </p>
            <p style={{ fontSize: '0.9375rem', color: 'var(--text-primary)' }}>
              {flag.note?.body || '(note no longer exists)'}
            </p>
          </div>

          <div style={{ display: 'flex', gap: 'var(--sp-3)' }}>
            <button className="btn btn-danger" disabled={actingId === flag.id || !flag.note} onClick={() => removeNote(flag)}>
              <Trash2 size={14} /> Remove Note
            </button>
            <button className="btn btn-ghost" disabled={actingId === flag.id} onClick={() => dismissFlag(flag)} title="Dismiss this flag — leaves the note itself alone">
              <Check size={14} /> Dismiss Flag
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

// ── Unified People list — merges profiles (real members) and
// digest_subscribers (newsletter-only leads) by email via the
// admin_unified_people()/admin_people_stats() Postgres functions, so a
// person who's both shows as one row instead of two. Replaces the
// former separate Members and Subscribers tabs; every capability
// either had (member activity/delete, subscriber stats/search/export/
// delete) is preserved here, just against the merged dataset. ──
const PEOPLE_PAGE_SIZE = 100

function PeopleTab() {
  const [people, setPeople] = useState([])
  const [totalCount, setTotalCount] = useState(0)
  const [pageIndex, setPageIndex] = useState(0)
  const [loading, setLoading] = useState(true)

  const [stats, setStats] = useState(null)
  const [sourceBreakdown, setSourceBreakdown] = useState([])
  const [statsLoading, setStatsLoading] = useState(true)

  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [sourceFilter, setSourceFilter] = useState('all')
  const [statsError, setStatsError] = useState('')
  const [tableError, setTableError] = useState('')
  const [exportError, setExportError] = useState('')
  const [exporting, setExporting] = useState(false)
  const [viewPerson, setViewPerson] = useState(null)

  useEffect(() => { loadStatsAndBreakdown() }, [])

  // Debounce the search box ~300ms so we're not re-querying the server on
  // every keystroke — only once typing pauses.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300)
    return () => clearTimeout(t)
  }, [search])

  // Reset to page 0 whenever a filter actually changes — otherwise you
  // could be sitting on page 3 when a new filter only has one page left.
  useEffect(() => {
    setPageIndex(prev => (prev === 0 ? prev : 0))
  }, [debouncedSearch, typeFilter, sourceFilter])

  useEffect(() => {
    loadPage(pageIndex, debouncedSearch, typeFilter, sourceFilter)
  }, [pageIndex, debouncedSearch, typeFilter, sourceFilter])

  async function loadStatsAndBreakdown() {
    setStatsLoading(true)
    setStatsError('')
    try {
      const [statsRes, breakdownRes] = await Promise.all([
        supabase.rpc('admin_people_stats'),
        supabase.rpc('digest_subscriber_source_breakdown'),
      ])
      if (statsRes.error) throw statsRes.error
      if (breakdownRes.error) throw breakdownRes.error
      setStats(statsRes.data)
      setSourceBreakdown(breakdownRes.data || [])
    } catch (err) {
      setStatsError(err.message)
    } finally {
      setStatsLoading(false)
    }
  }

  // One page (100 rows) at a time via admin_unified_people(), which does
  // the profiles/digest_subscribers merge and pagination server-side —
  // the browser never has to hold the full subscriber list in memory
  // just to match it against members, which is what a client-side merge
  // would require.
  async function loadPage(index, searchTerm, type, source) {
    setLoading(true)
    setTableError('')
    try {
      const { data, error } = await supabase.rpc('admin_unified_people', {
        p_search: searchTerm || null,
        p_type: type,
        p_source: source === 'all' ? null : source,
        p_limit: PEOPLE_PAGE_SIZE,
        p_offset: index * PEOPLE_PAGE_SIZE,
      })
      if (error) throw error
      setPeople(data || [])
      setTotalCount(data && data.length > 0 ? Number(data[0].total_count) : 0)
    } catch (err) {
      setTableError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // digest_subscribers has no client-writable RLS policy for anyone,
  // admin included — deletion has to go through the admin-gated
  // api/digest/delete-subscriber endpoint, same auth pattern as
  // DiscountsTab's authHeader().
  async function removeFromDigest(person) {
    if (!confirm(`Remove ${person.email} from the digest list? This cannot be undone.`)) return
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/digest/delete-subscriber', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ id: person.subscriber_id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Delete failed')
      // A "both" row loses its subscriber half and becomes member-only
      // rather than disappearing; a subscriber-only row is removed outright.
      if (person.member_id) {
        setPeople(prev => prev.map(p => p.email === person.email
          ? { ...p, subscriber_id: null, source: null, confirmed: null, subscriber_created_at: null }
          : p))
      } else {
        setPeople(prev => prev.filter(p => p.email !== person.email))
        setTotalCount(prev => Math.max(0, prev - 1))
      }
    } catch (err) {
      alert('Could not remove from digest: ' + err.message)
    }
  }

  const isFiltered = Boolean(debouncedSearch) || typeFilter !== 'all' || sourceFilter !== 'all'
  const pageCount = Math.max(1, Math.ceil(totalCount / PEOPLE_PAGE_SIZE))
  const rangeStart = totalCount === 0 ? 0 : pageIndex * PEOPLE_PAGE_SIZE + 1
  const rangeEnd = Math.min(totalCount, (pageIndex + 1) * PEOPLE_PAGE_SIZE)

  // Same CSV-injection guarding as the old Subscribers export — a
  // leading quote on any cell starting with =, +, -, or @ so Excel/
  // Sheets treats it as literal text, plus quoted/escaped cells so a
  // comma or stray quote in a value can't break the file structure.
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
      let offset = 0
      let allRows = []
      while (true) {
        const { data, error } = await supabase.rpc('admin_unified_people', {
          p_search: search.trim() || null,
          p_type: typeFilter,
          p_source: sourceFilter === 'all' ? null : sourceFilter,
          p_limit: chunkSize,
          p_offset: offset,
        })
        if (error) throw error
        if (!data || data.length === 0) break
        allRows = allRows.concat(data)
        if (data.length < chunkSize) break
        offset += chunkSize
      }

      const header = ['email', 'type', 'username', 'role', 'membership_tier', 'member_joined', 'digest_source', 'digest_status', 'digest_signed_up']
      const rows = allRows.map(p => [
        p.email,
        p.member_id && p.subscriber_id ? 'Member + Subscriber' : p.member_id ? 'Member' : 'Subscriber',
        p.username || '',
        p.role || '',
        p.membership_tier || '',
        p.member_created_at ? new Date(p.member_created_at).toISOString() : '',
        p.source || '',
        p.subscriber_id ? (p.confirmed ? 'Confirmed' : 'Pending') : '',
        p.subscriber_created_at ? new Date(p.subscriber_created_at).toISOString() : '',
      ])
      const csv = [header, ...rows]
        .map(row => row.map(csvSafeCell).join(','))
        .join('\n')

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `people-${new Date().toISOString().slice(0, 10)}.csv`
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
        <h2 className={styles.tabTitle}>People ({totalCount})</h2>
        <button className="btn btn-primary" onClick={exportCsv} disabled={exporting || totalCount === 0}>
          {exporting ? <div className="spinner" /> : <><Download size={16} /> Export CSV</>}
        </button>
      </div>

      {exportError && (
        <div className="alert alert-info" style={{ marginBottom: 'var(--sp-5)', borderColor: 'var(--red)', color: 'var(--red)' }}>
          Export failed: {exportError}
        </div>
      )}

      {statsError ? (
        <div className="alert alert-info" style={{ marginBottom: 'var(--sp-6)', borderColor: 'var(--red)', color: 'var(--red)' }}>
          <strong>Couldn't load stats:</strong> {statsError}
          <div style={{ marginTop: 'var(--sp-2)' }}>
            <button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: '0.8125rem' }} onClick={loadStatsAndBreakdown}>
              Retry
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 'var(--sp-4)', marginBottom: 'var(--sp-6)' }}>
          <div className="card">
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 'var(--sp-2)' }}>Members</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--navy)' }}>
              {statsLoading || !stats ? '—' : stats.total_members}
            </div>
            <span className="badge badge-blue" style={{ marginTop: 'var(--sp-2)' }}>Have accounts</span>
          </div>
          <div className="card">
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 'var(--sp-2)' }}>Members + Subscribers</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--navy)' }}>
              {statsLoading || !stats ? '—' : stats.members_and_subscribers}
            </div>
            <span className="badge badge-navy" style={{ marginTop: 'var(--sp-2)' }}>Both</span>
          </div>
          <div className="card">
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 'var(--sp-2)' }}>Confirmed subscribers</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--navy)' }}>
              {statsLoading || !stats ? '—' : stats.total_subscribers_confirmed}
            </div>
            <span className="badge badge-green" style={{ marginTop: 'var(--sp-2)' }}>Ready to send</span>
          </div>
          <div className="card">
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 'var(--sp-2)' }}>Pending subscribers</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--navy)' }}>
              {statsLoading || !stats ? '—' : stats.total_subscribers_pending}
            </div>
            <span className="badge badge-amber" style={{ marginTop: 'var(--sp-2)' }}>Never confirmed</span>
          </div>
        </div>
      )}

      {/* ── Source breakdown — unchanged from the old Subscribers tab,
          still reads digest_subscriber_source_breakdown() directly. ── */}
      <h3 style={{ fontSize: '0.9375rem', color: 'var(--navy)', marginBottom: 'var(--sp-3)' }}>Digest signups by source</h3>
      <div className={styles.table} style={{ marginBottom: 'var(--sp-6)' }}>
        <div className={`${styles.tableRow} ${styles.tableHead}`} style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr' }}>
          <span>Source</span>
          <span>Confirmed</span>
          <span>Pending</span>
          <span>Total</span>
        </div>
        {statsLoading && <div className={styles.tableEmpty}>Loading...</div>}
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

      {/* ── Filters ── */}
      <div style={{ display: 'flex', gap: 'var(--sp-3)', marginBottom: 'var(--sp-4)', flexWrap: 'wrap' }}>
        <input
          className="input"
          placeholder="Search email…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ maxWidth: 280 }}
        />
        <select className="input" value={typeFilter} onChange={e => setTypeFilter(e.target.value)} style={{ maxWidth: 200 }}>
          <option value="all">All people</option>
          <option value="member">Members only</option>
          <option value="subscriber">Subscribers only</option>
          <option value="both">Members + Subscribers</option>
        </select>
        <select className="input" value={sourceFilter} onChange={e => setSourceFilter(e.target.value)} style={{ maxWidth: 200 }}>
          <option value="all">All digest sources</option>
          {sourceBreakdown.map(row => (
            <option key={row.source} value={row.source}>{row.source}</option>
          ))}
        </select>
      </div>

      {/* ── The unified list — one page (100 rows) at a time ── */}
      <div className={styles.table}>
        <div className={`${styles.tableRow} ${styles.tableHead}`}>
          <span>Person</span>
          <span>Type</span>
          <span>Status</span>
          <span>Date</span>
          <span>Actions</span>
        </div>
        {loading && <div className={styles.tableEmpty}>Loading...</div>}
        {!loading && tableError && (
          <div className={styles.tableEmpty} style={{ color: 'var(--red)' }}>
            <div><strong>Couldn't load:</strong> {tableError}</div>
            <button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: '0.8125rem', marginTop: 'var(--sp-2)' }} onClick={() => loadPage(pageIndex, debouncedSearch, typeFilter, sourceFilter)}>
              Retry
            </button>
          </div>
        )}
        {!loading && !tableError && people.length === 0 && !isFiltered && (
          <div className={styles.tableEmpty}>No members or subscribers yet.</div>
        )}
        {!loading && !tableError && people.length === 0 && isFiltered && (
          <div className={styles.tableEmpty}>No one matches your search or filters.</div>
        )}
        {!loading && !tableError && people.map(p => {
          const displayName = p.first_name ? `${p.first_name} ${p.last_name || ''}`.trim() : p.username
          const date = p.member_created_at || p.subscriber_created_at
          return (
            <div key={p.email} className={styles.tableRow}>
              <span className={styles.cellTitle} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 0 }}>
                <span style={{ fontWeight: 600 }}>{displayName || p.email}</span>
                <span className="mono" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{p.email}</span>
              </span>
              <span style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
                {p.member_id && <span className={`badge ${p.role === 'admin' ? 'badge-red' : 'badge-blue'}`}>{p.role === 'admin' ? 'Admin' : 'Member'}</span>}
                {p.subscriber_id && <span className="badge badge-navy">Subscriber</span>}
              </span>
              <span style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
                {p.member_id && <span className="badge badge-blue">{p.membership_tier || 'free'}</span>}
                {p.subscriber_id && (
                  <span className={`badge ${p.confirmed ? 'badge-green' : 'badge-amber'}`}>
                    {p.confirmed ? 'Confirmed' : 'Pending'}
                  </span>
                )}
              </span>
              <span className="mono" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {date ? new Date(date).toLocaleDateString() : '—'}
              </span>
              <span style={{ display: 'flex', gap: 'var(--sp-2)' }}>
                <button className="btn btn-ghost" style={{ padding: '4px 10px' }} onClick={() => setViewPerson(p)}>
                  <Eye size={14} /> View
                </button>
                {p.subscriber_id && (
                  <button className="btn btn-danger" style={{ padding: '4px 10px' }} onClick={() => removeFromDigest(p)} title="Remove from digest list">
                    <Trash2 size={14} />
                  </button>
                )}
              </span>
            </div>
          )
        })}
      </div>

      {/* ── Pagination ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'var(--sp-4)' }}>
        <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
          {totalCount === 0 ? 'No people' : `Showing ${rangeStart}–${rangeEnd} of ${totalCount}`}
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

      {viewPerson && (
        <PersonDetailModal
          person={viewPerson}
          onClose={() => setViewPerson(null)}
          onDeleted={() => {
            setViewPerson(null)
            loadPage(pageIndex, debouncedSearch, typeFilter, sourceFilter)
            loadStatsAndBreakdown()
          }}
          onRemoveFromDigest={async person => {
            await removeFromDigest(person)
            setViewPerson(null)
          }}
        />
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

// ── Blog Tab — list posts, publish/hide, create/edit via BlogPostForm ──
function BlogTab() {
  const [posts, setPosts] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [editPost, setEditPost] = useState(null)

  useEffect(() => { loadPosts() }, [])

  async function loadPosts() {
    const { data } = await supabase.from('blog_posts').select('*').order('created_at', { ascending: false })
    if (data) setPosts(data)
  }

  async function deletePost(id) {
    if (!confirm('Delete this post?')) return
    await supabase.from('blog_posts').delete().eq('id', id)
    loadPosts()
  }

  async function togglePublished(post) {
    await supabase.from('blog_posts').update({ published: !post.published }).eq('id', post.id)
    loadPosts()
  }

  return (
    <div>
      <div className={styles.tabActions}>
        <h2 className={styles.tabTitle}>Blog Posts ({posts.length})</h2>
        <button className="btn btn-primary" onClick={() => { setEditPost(null); setShowForm(true) }}>
          <Plus size={16} /> New Post
        </button>
      </div>

      {showForm && (
        <BlogPostForm
          post={editPost}
          onSave={() => { setShowForm(false); loadPosts() }}
          onCancel={() => setShowForm(false)}
        />
      )}

      <div className={styles.table}>
        <div className={`${styles.tableRow} ${styles.tableHead}`}>
          <span>Title</span>
          <span>Category</span>
          <span>Published</span>
          <span>Actions</span>
        </div>
        {posts.length === 0 && (
          <div className={styles.tableEmpty}>No posts yet. Add your first post above.</div>
        )}
        {posts.map(p => (
          <div key={p.id} className={styles.tableRow}>
            <span className={styles.cellTitle}>
              {p.cover_image_url && (
                <img src={p.cover_image_url} alt="" style={{ width: 32, height: 32, borderRadius: 4, objectFit: 'cover', flexShrink: 0 }} />
              )}
              {p.title}
            </span>
            <span><span className="badge badge-blue">{p.category}</span></span>
            <span>
              <button
                className={`badge ${p.published ? 'badge-green' : 'badge-amber'}`}
                onClick={() => togglePublished(p)}
                style={{ cursor: 'pointer', border: 'none' }}
              >
                {p.published ? 'Published' : 'Draft'}
              </button>
            </span>
            <span className={styles.cellActions}>
              <button className="btn btn-ghost" style={{ padding: '4px 10px' }}
                onClick={() => { setEditPost(p); setShowForm(true) }}>
                <Edit size={14} />
              </button>
              <button className="btn btn-danger" style={{ padding: '4px 10px' }}
                onClick={() => deletePost(p.id)}>
                <Trash2 size={14} />
              </button>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function slugify(input) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function BlogPostForm({ post, onSave, onCancel }) {
  const [form, setForm] = useState({
    title: post?.title || '',
    slug: post?.slug || '',
    excerpt: post?.excerpt || '',
    body: post?.body || '',
    category: post?.category || 'GovCon Notes',
    author: post?.author || 'Keith Atkinson',
    cover_image_url: post?.cover_image_url || '',
    reading_minutes: post?.reading_minutes || 4,
    published: post?.published || false,
  })
  const [slugTouched, setSlugTouched] = useState(Boolean(post))
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')

  function handleTitleChange(value) {
    setForm(f => ({ ...f, title: value, slug: slugTouched ? f.slug : slugify(value) }))
  }

  function handleBodyChange(value) {
    const words = value.trim().split(/\s+/).filter(Boolean).length
    setForm(f => ({ ...f, body: value, reading_minutes: words ? Math.max(1, Math.ceil(words / 200)) : f.reading_minutes }))
  }

  // Lets admins paste directly from Word/Google Docs/Notion and have
  // bold, italic, underline, links, headings, lists, and tables come
  // through as the same lightweight format renderBody understands —
  // instead of pasting raw HTML gibberish or losing all formatting.
  function handleBodyPaste(e) {
    const html = e.clipboardData.getData('text/html')
    const plain = e.clipboardData.getData('text/plain')
    if (!html && !plain) return
    e.preventDefault()

    const converted = html ? htmlToBodyText(html) : plainTextToBodyText(plain)
    if (!converted) return

    const textarea = e.target
    const { selectionStart, selectionEnd, value } = textarea
    const nextValue = value.slice(0, selectionStart) + converted + value.slice(selectionEnd)
    handleBodyChange(nextValue)

    const cursorPos = selectionStart + converted.length
    requestAnimationFrame(() => {
      textarea.focus()
      textarea.setSelectionRange(cursorPos, cursorPos)
    })
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
      const res = await fetch('/api/upload/image?folder=blog', {
        method: 'POST',
        headers: { 'Content-Type': file.type },
        body: file,
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Upload failed')
      }
      const { url } = await res.json()
      setForm(f => ({ ...f, cover_image_url: url }))
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
        slug: slugify(form.slug || form.title),
        excerpt: form.excerpt,
        body: form.body,
        category: form.category,
        author: form.author,
        cover_image_url: form.cover_image_url || null,
        reading_minutes: Number(form.reading_minutes) || 1,
        published: form.published,
        updated_at: new Date().toISOString(),
      }
      if (post?.id) {
        const { error } = await supabase.from('blog_posts').update(payload).eq('id', post.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('blog_posts').insert(payload)
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
        {post ? 'Edit Post' : 'New Post'}
      </h3>
      <form onSubmit={handleSave}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-4)' }}>

          <div className="field" style={{ gridColumn: '1 / -1' }}>
            <label className="label">Title</label>
            <input className="input" value={form.title} onChange={e => handleTitleChange(e.target.value)} required />
          </div>

          <div className="field" style={{ gridColumn: '1 / -1' }}>
            <label className="label">URL slug</label>
            <input className="input mono" value={form.slug}
              onChange={e => { setSlugTouched(true); setForm(f => ({ ...f, slug: e.target.value })) }}
              placeholder="auto-generated-from-title" required />
          </div>

          <div className="field" style={{ gridColumn: '1 / -1' }}>
            <label className="label">Excerpt (shown on the blog index card)</label>
            <textarea className="input" value={form.excerpt}
              onChange={e => setForm(f => ({ ...f, excerpt: e.target.value }))} rows={2} />
          </div>

          <div className="field" style={{ gridColumn: '1 / -1' }}>
            <label className="label">Body</label>
            <textarea className="input" value={form.body}
              onChange={e => handleBodyChange(e.target.value)}
              onPaste={handleBodyPaste}
              rows={12}
              placeholder="Paste directly from Word, Google Docs, etc. — formatting carries over automatically. Or type: separate paragraphs with a blank line, start a line with '## ' for a subheading." required />
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 'var(--sp-2)', fontFamily: 'var(--font-mono)' }}>
              Paste formatted text (bold, links, lists, tables) and it converts automatically. Or write it directly: blank line = new paragraph &middot; "## Heading" / "### Subheading" &middot; **bold** &middot; *italic* &middot; __underline__ &middot; [link text](url) &middot; "- item" lists &middot; markdown tables (| col | col |)
            </p>
          </div>

          <div className="field">
            <label className="label">Category</label>
            <input className="input" value={form.category}
              onChange={e => setForm(f => ({ ...f, category: e.target.value }))} />
          </div>

          <div className="field">
            <label className="label">Author</label>
            <input className="input" value={form.author}
              onChange={e => setForm(f => ({ ...f, author: e.target.value }))} />
          </div>

          <div className="field">
            <label className="label">Reading time (min)</label>
            <input className="input" type="number" min="1" value={form.reading_minutes}
              onChange={e => setForm(f => ({ ...f, reading_minutes: e.target.value }))} />
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 'var(--sp-1)' }}>
              Auto-estimated from the body — edit if needed.
            </p>
          </div>

          <div className="field" style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', paddingTop: 'var(--sp-5)' }}>
            <input type="checkbox" id="published" checked={form.published}
              onChange={e => setForm(f => ({ ...f, published: e.target.checked }))} />
            <label htmlFor="published" className="label" style={{ marginBottom: 0 }}>
              Published — visible on /blog
            </label>
          </div>

          <div className="field" style={{ gridColumn: '1 / -1' }}>
            <label className="label">Cover Image</label>

            {form.cover_image_url && (
              <div style={{ marginBottom: 'var(--sp-3)', position: 'relative', display: 'inline-block' }}>
                <img src={form.cover_image_url} alt="Cover"
                  style={{ width: 160, height: 90, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)' }} />
                <button type="button"
                  style={{ position: 'absolute', top: -8, right: -8, background: 'var(--red)', border: 'none', borderRadius: '50%', width: 20, height: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}
                  onClick={() => setForm(f => ({ ...f, cover_image_url: '' }))}>
                  <X size={12} />
                </button>
              </div>
            )}

            <label className={styles.uploadBtn}>
              <Upload size={16} />
              {uploading ? 'Uploading...' : 'Upload Cover Image'}
              <input type="file" accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} disabled={uploading} />
            </label>

            {uploadError && <p style={{ color: 'var(--red)', fontSize: '0.8125rem', marginTop: 'var(--sp-2)' }}>{uploadError}</p>}
          </div>

        </div>

        <div style={{ display: 'flex', gap: 'var(--sp-3)', marginTop: 'var(--sp-5)' }}>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? <div className="spinner" /> : 'Save Post'}
          </button>
          <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancel</button>
        </div>
      </form>
    </div>
  )
}

// ── Person Detail Modal — profile + activity heatmap for one row from
// the unified People list, whether they're a full member, a digest-only
// subscriber, or both. Modal overlay pattern copied from Chat.jsx's
// ChatRulesModal (the only other modal in this codebase).
// For members: the unified list only carries a handful of profile
// fields per row (name/role/tier), not everything this modal shows
// (avatar, bio, subscription status), so it fetches the full profile
// and activity_log itself, keyed on person.member_id — same
// query/stats logic as Profile.jsx's loadActivity, parameterized by an
// arbitrary member id instead of the logged-in user.
// For subscriber-only rows (no member_id): there's no profiles row and
// no activity_log rows possible, so it renders straight from the row
// data already passed in — no fetch needed.
function PersonDetailModal({ person, onClose, onDeleted, onRemoveFromDigest }) {
  const isMember = Boolean(person.member_id)

  const [member, setMember] = useState(null)
  const [activityData, setActivityData] = useState({})
  const [stats, setStats] = useState({ posts: 0, comments: 0, likesReceived: 0 })
  const [loading, setLoading] = useState(isMember)
  const [loadError, setLoadError] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [removing, setRemoving] = useState(false)

  // Subscriber-only rows (no member_id) have no profiles row and no
  // activity_log rows — activity_log is only ever written for account
  // actions (posts/comments/likes), which someone without an account
  // can never generate — so there's nothing to fetch for them.
  useEffect(() => { if (isMember) loadMemberAndActivity() }, [person.member_id])

  async function loadMemberAndActivity() {
    setLoading(true)
    setLoadError('')
    try {
      const sixMonthsAgo = new Date()
      sixMonthsAgo.setDate(sixMonthsAgo.getDate() - 182)

      const [profileRes, activityRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', person.member_id).single(),
        supabase.from('activity_log').select('activity_type, created_at')
          .eq('user_id', person.member_id).gte('created_at', sixMonthsAgo.toISOString()),
      ])
      if (profileRes.error) throw profileRes.error
      setMember(profileRes.data)

      const grouped = {}
      let posts = 0, comments = 0, likesReceived = 0
      ;(activityRes.data || []).forEach(row => {
        const day = row.created_at.slice(0, 10)
        grouped[day] = (grouped[day] || 0) + 1
        if (row.activity_type === 'post') posts++
        if (row.activity_type === 'comment') comments++
        if (row.activity_type === 'like_received') likesReceived++
      })
      setActivityData(grouped)
      setStats({ posts, comments, likesReceived })
    } catch (err) {
      setLoadError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete() {
    if (!confirm(`Permanently delete ${member.username}'s account? This cannot be undone.`)) return
    setDeleting(true)
    setDeleteError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/admin/delete-user', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ userId: member.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Delete failed')
      onDeleted()
    } catch (err) {
      setDeleteError(err.message)
      setDeleting(false)
    }
  }

  // onRemoveFromDigest is PeopleTab's existing removeFromDigest — it
  // already handles its own confirm dialog, error alert, and updating
  // the underlying list, so this just triggers it and closes the modal.
  async function handleRemoveFromDigest() {
    setRemoving(true)
    try {
      await onRemoveFromDigest(person)
    } finally {
      setRemoving(false)
    }
  }

  const displayName = member?.first_name
    ? `${member.first_name} ${member.last_name || ''}`.trim()
    : member?.username || 'Member'

  const joinedDate = member?.created_at
    ? new Date(member.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : null

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
        padding: 20,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#fff', borderRadius: 10, maxWidth: 560, width: '100%',
          maxHeight: '85vh', display: 'flex', flexDirection: 'column',
          boxShadow: '0 12px 40px rgba(0,0,0,0.25)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '20px 28px', borderBottom: '1px solid var(--border)', flexShrink: 0,
        }}>
          <h2 style={{ margin: 0, fontSize: 18, color: 'var(--navy)' }}>{isMember ? 'Member Profile' : 'Subscriber Profile'}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888', flexShrink: 0 }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ padding: '24px 28px', overflowY: 'auto' }}>
        {!isMember && (
          <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-4)', marginBottom: 'var(--sp-5)' }}>
            <Avatar username={person.email} size={56} fontSize="1.125rem" />
            <div>
              <div style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--navy)' }}>
                {person.first_name ? `${person.first_name} ${person.last_name || ''}`.trim() : person.email}
              </div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Digest subscriber only — no account</div>
            </div>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-2)', marginBottom: 'var(--sp-5)' }}>
            <span className="badge badge-navy">Subscriber</span>
            <span className={`badge ${person.confirmed ? 'badge-green' : 'badge-amber'}`}>
              {person.confirmed ? 'Confirmed' : 'Pending confirmation'}
            </span>
            {person.source && <span className="badge badge-blue">{person.source}</span>}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-3)', marginBottom: 'var(--sp-5)', fontSize: '0.8125rem' }}>
            <div>
              <div style={{ color: 'var(--text-muted)', marginBottom: 2 }}>Email</div>
              <div className="mono" style={{ color: 'var(--text-secondary)' }}>{person.email}</div>
            </div>
            <div>
              <div style={{ color: 'var(--text-muted)', marginBottom: 2 }}>Subscribed</div>
              <div style={{ color: 'var(--text-secondary)' }}>
                {person.subscriber_created_at
                  ? new Date(person.subscriber_created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
                  : '—'}
              </div>
            </div>
          </div>

          <h3 style={{ fontSize: '0.9375rem', color: 'var(--navy)', marginBottom: 'var(--sp-3)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Activity size={15} /> Activity, last 6 months
          </h3>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: 'var(--sp-2)' }}>
            No activity to show — this person has never created a site account, so there's nothing
            for a heatmap to track (only account actions like posts, comments, and likes are logged).
          </p>
          <ActivityHeatmap data={{}} weeks={26} />

          <div style={{ borderTop: '1px solid var(--border)', marginTop: 'var(--sp-6)', paddingTop: 'var(--sp-5)' }}>
            <button className="btn btn-danger" onClick={handleRemoveFromDigest} disabled={removing}>
              {removing ? <div className="spinner" /> : <><Trash2 size={14} /> Remove from Digest</>}
            </button>
          </div>
          </>
        )}
        {isMember && loading && !member && <div className="spinner" />}
        {isMember && !loading && loadError && (
          <p style={{ color: 'var(--red)', fontSize: '0.875rem' }}>Couldn't load this member: {loadError}</p>
        )}
        {isMember && member && (
          <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-4)', marginBottom: 'var(--sp-5)' }}>
            <Avatar
              avatarUrl={member.avatar_url}
              firstName={member.first_name}
              lastName={member.last_name}
              username={member.username}
              size={56}
              fontSize="1.125rem"
            />
            <div>
              <div style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--navy)' }}>{displayName}</div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>@{member.username}</div>
            </div>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-2)', marginBottom: 'var(--sp-5)' }}>
            <span className={`badge ${member.role === 'admin' ? 'badge-red' : 'badge-blue'}`}>{member.role || 'member'}</span>
            <span className="badge badge-navy">{member.membership_tier || 'free'}</span>
            {member.subscription_status && member.subscription_status !== 'inactive' && (
              <span className="badge badge-green">{member.subscription_status}</span>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-3)', marginBottom: 'var(--sp-5)', fontSize: '0.8125rem' }}>
            <div>
              <div style={{ color: 'var(--text-muted)', marginBottom: 2 }}>Email</div>
              <div className="mono" style={{ color: 'var(--text-secondary)' }}>{member.email || '—'}</div>
            </div>
            <div>
              <div style={{ color: 'var(--text-muted)', marginBottom: 2 }}>Joined</div>
              <div style={{ color: 'var(--text-secondary)' }}>{joinedDate || '—'}</div>
            </div>
          </div>

          {member.bio && (
            <div style={{ marginBottom: 'var(--sp-5)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4 }}>Bio</div>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{member.bio}</p>
            </div>
          )}

          <h3 style={{ fontSize: '0.9375rem', color: 'var(--navy)', marginBottom: 'var(--sp-3)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Activity size={15} /> Activity, last 6 months
          </h3>
          <div style={{ display: 'flex', gap: 'var(--sp-3)', marginBottom: 'var(--sp-4)' }}>
            <div className="card" style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', padding: 'var(--sp-3)' }}>
              <FileText size={16} style={{ color: 'var(--navy)' }} />
              <div>
                <div style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--navy)' }}>{loading ? '—' : stats.posts}</div>
                <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>Posts</div>
              </div>
            </div>
            <div className="card" style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', padding: 'var(--sp-3)' }}>
              <MessageCircle size={16} style={{ color: '#4F6BED' }} />
              <div>
                <div style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--navy)' }}>{loading ? '—' : stats.comments}</div>
                <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>Comments</div>
              </div>
            </div>
            <div className="card" style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', padding: 'var(--sp-3)' }}>
              <Heart size={16} style={{ color: '#E0245E' }} />
              <div>
                <div style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--navy)' }}>{loading ? '—' : stats.likesReceived}</div>
                <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>Likes Received</div>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="spinner" />
          ) : (
            <ActivityHeatmap data={activityData} weeks={26} />
          )}

          <div style={{ borderTop: '1px solid var(--border)', marginTop: 'var(--sp-6)', paddingTop: 'var(--sp-5)' }}>
            {deleteError && <p style={{ color: 'var(--red)', fontSize: '0.8125rem', marginBottom: 'var(--sp-3)' }}>{deleteError}</p>}
            {member.role === 'admin' ? (
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Admin accounts can't be deleted from here.</p>
            ) : (
              <button className="btn btn-danger" onClick={handleDelete} disabled={deleting}>
                {deleting ? <div className="spinner" /> : <><Trash2 size={14} /> Delete Account</>}
              </button>
            )}
          </div>
          </>
        )}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------
// Site Analytics — reads Vercel Web Analytics via api/admin/site-analytics
// (which calls Vercel's own API server-side with VERCEL_API_TOKEN). Shows
// total site visits, /go landing page visits specifically, and where
// visitors to each are coming from.
// ---------------------------------------------------------------------
const DAY_OPTIONS = [7, 30, 90]

function AnalyticsTab() {
  const [days, setDays] = useState(30)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notEnabled, setNotEnabled] = useState(false)

  useEffect(() => { loadAnalytics() }, [days])

  async function loadAnalytics() {
    setLoading(true)
    setError('')
    setNotEnabled(false)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`/api/admin/site-analytics?days=${days}`, {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      })
      const json = await res.json()
      if (json.enabled === false) {
        setNotEnabled(true)
        return
      }
      if (!res.ok) throw new Error(json.error || 'Failed to load analytics')
      setData(json)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function ReferrerTable({ title, rows }) {
    return (
      <div>
        <h3 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--navy)', marginBottom: 'var(--sp-3)' }}>{title}</h3>
        {rows.length === 0 ? (
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>No referrer data for this window.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
            <thead>
              <tr style={{ textAlign: 'left', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: 'var(--sp-2) 0', fontWeight: 500 }}>Source</th>
                <th style={{ padding: 'var(--sp-2) 0', fontWeight: 500, textAlign: 'right' }}>Visits</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: 'var(--sp-2) 0', color: 'var(--navy)' }}>{r.referrerHostname || 'Direct / no referrer'}</td>
                  <td style={{ padding: 'var(--sp-2) 0', textAlign: 'right', color: 'var(--text-secondary)' }}>{r.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    )
  }

  return (
    <div>
      <div className={styles.tabActions}>
        <h2 className={styles.tabTitle}>Site Analytics</h2>
        <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
          {DAY_OPTIONS.map((d) => (
            <button
              key={d}
              className={`btn ${days === d ? 'btn-primary' : 'btn-ghost'}`}
              style={{ padding: 'var(--sp-2) var(--sp-4)', fontSize: '0.8125rem' }}
              onClick={() => setDays(d)}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {error && <p style={{ color: 'var(--red)', fontSize: '0.8125rem', marginBottom: 'var(--sp-4)' }}>{error}</p>}

      {notEnabled && (
        <div className="alert alert-info" style={{ marginBottom: 'var(--sp-4)' }}>
          Web Analytics isn't enabled for this project yet — enable it from the Vercel dashboard's Analytics tab (or <code>vercel project web-analytics</code>), and make sure VERCEL_API_TOKEN is set. Nothing has been tracked before now, so numbers start from whenever it's turned on.
        </div>
      )}

      {loading && <div className="spinner" />}

      {!loading && !notEnabled && data && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--sp-4)', marginBottom: 'var(--sp-8)' }}>
            <div className={styles.table} style={{ padding: 'var(--sp-5)' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 'var(--sp-2)' }}>
                govconlab.com visitors — last {days}d
              </div>
              <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--navy)' }}>{data.totalVisits.toLocaleString()}</div>
            </div>
            <div className={styles.table} style={{ padding: 'var(--sp-5)' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 'var(--sp-2)' }}>
                /go visitors — last {days}d
              </div>
              <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--navy)' }}>{data.goVisits.toLocaleString()}</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--sp-8)' }}>
            <ReferrerTable title="Where site-wide visitors come from" rows={data.referrers} />
            <ReferrerTable title="Where /go visitors come from" rows={data.goReferrers} />
          </div>
        </>
      )}
    </div>
  )
}