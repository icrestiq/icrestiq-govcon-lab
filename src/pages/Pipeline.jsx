// src/pages/Pipeline.jsx
// Phases 0–2 of the native "Sourcing Pipeline" CRM (see the published
// scoping artifact). Companies and Contacts are a shared directory across
// every paid member (RLS gates on membership_tier, not profile_id — see
// the phase0_sourcing_pipeline_schema migration); Deal Stages are private
// per profile. As of Phase 1, generate_suggested_bid auto-creates a Deal
// (linked to whatever companies its research found) the moment a
// Suggested Bid purchase completes. As of Phase 2, the Deals tab is a
// real drag-and-drop Kanban board (dnd-kit) with a deal detail modal —
// where the notes the Phase 1 automation writes finally become visible.
// Manual deal creation, and Quotes wired into Proposal Builder, are not
// built yet (the latter deferred as its own follow-up, not part of this
// phase).

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { DndContext, useDraggable, useDroppable, useSensor, useSensors, PointerSensor } from '@dnd-kit/core'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'
import {
  Building2, Users, Columns3, Plus, Pencil, Trash2, X, ChevronUp, ChevronDown,
  MessageSquare, ChevronDown as ChevronDownIcon, ChevronRight, Briefcase,
} from 'lucide-react'
import styles from './Pipeline.module.css'

const COMPANY_TYPES = [
  { value: 'vendor', label: 'Vendor' },
  { value: 'supplier', label: 'Supplier' },
  { value: 'packer_shipper', label: 'Packer / Shipper' },
  { value: 'other', label: 'Other' },
]

const ROLE_TAGS = [
  { value: 'vendor', label: 'Vendor' },
  { value: 'supplier', label: 'Supplier' },
  { value: 'packer_shipper', label: 'Packer / Shipper' },
  { value: 'contracting_officer', label: 'Contracting Officer' },
  { value: 'other', label: 'Other' },
]

const DEFAULT_STAGES = ['Sourcing', 'Quoting', 'Quote Sent', 'Awarded', 'Lost']

// deal_stages has a unique (profile_id, name) constraint — translates that
// violation into plain English, same treatment as the stage_id foreign-key
// error already handled in deleteStage below.
function friendlyStageError(err) {
  if (/duplicate key value/i.test(err.message)) return 'You already have a stage with that name.'
  if (/violates foreign key/i.test(err.message)) return 'This stage still has deals in it — move them to another stage before deleting.'
  return err.message || 'Something went wrong with that stage.'
}

// role_tag and company_type share the same value set, so one badge-color
// map covers both — keeps a vendor's badge the same color whether it's
// read off a company row or a contact row.
function roleBadgeClass(value) {
  switch (value) {
    case 'vendor': return 'badge badge-blue'
    case 'supplier': return 'badge badge-green'
    case 'packer_shipper': return 'badge badge-amber'
    case 'contracting_officer': return 'badge badge-purple'
    default: return 'badge badge-navy'
  }
}

function labelFor(options, value) {
  return options.find((o) => o.value === value)?.label || value
}

export default function Pipeline() {
  const [searchParams, setSearchParams] = useSearchParams()
  // Captured once via lazy init, not read reactively — the clearing effect
  // below wipes these query params right after mount so a page refresh
  // doesn't keep re-opening the same deal, and a reactive read would just
  // see them disappear on the very next render.
  const [tab, setTab] = useState(() => (searchParams.get('tab') === 'deals' ? 'deals' : 'companies'))
  const [initialDealId] = useState(() => searchParams.get('deal'))

  useEffect(() => {
    if (searchParams.get('tab') || searchParams.get('deal')) {
      setSearchParams({}, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>Sourcing Pipeline</h1>
        <p className={styles.sub}>
          Your shared directory of vendors, suppliers, and packers/shippers — plus your own pipeline stages.
          Companies and contacts are visible to every paid member; notes stay private unless you choose to share them.
        </p>
      </div>

      <div className={styles.tabs}>
        <button className={`${styles.tab} ${tab === 'companies' ? styles.tabActive : ''}`} onClick={() => setTab('companies')}>
          <Building2 size={15} /> Companies
        </button>
        <button className={`${styles.tab} ${tab === 'contacts' ? styles.tabActive : ''}`} onClick={() => setTab('contacts')}>
          <Users size={15} /> Contacts
        </button>
        <button className={`${styles.tab} ${tab === 'stages' ? styles.tabActive : ''}`} onClick={() => setTab('stages')}>
          <Columns3 size={15} /> Pipeline Stages
        </button>
        <button className={`${styles.tab} ${tab === 'deals' ? styles.tabActive : ''}`} onClick={() => setTab('deals')}>
          <Briefcase size={15} /> Deals
        </button>
      </div>

      {tab === 'companies' && <CompaniesTab />}
      {tab === 'contacts' && <ContactsTab />}
      {tab === 'stages' && <StagesTab />}
      {tab === 'deals' && <DealsTab initialDealId={initialDealId} />}
    </div>
  )
}

// ---------------------------------------------------------------------
// Companies
// ---------------------------------------------------------------------
function CompaniesTab() {
  const { user } = useAuth()
  const [companies, setCompanies] = useState(null)
  const [error, setError] = useState('')
  const [expandedId, setExpandedId] = useState(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState({ name: '', company_type: 'vendor', website: '', address: '' })
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    const { data, error: err } = await supabase.from('companies').select('*').order('name')
    if (err) { setError(err.message); return }
    setCompanies(data || [])
  }, [])

  useEffect(() => { load() }, [load])

  function openCreate() {
    setEditingId(null)
    setForm({ name: '', company_type: 'vendor', website: '', address: '' })
    setFormOpen(true)
  }

  function openEdit(company) {
    setEditingId(company.id)
    setForm({ name: company.name, company_type: company.company_type, website: company.website || '', address: company.address || '' })
    setFormOpen(true)
  }

  async function save() {
    if (!form.name.trim()) { setError('Company name is required.'); return }
    setSaving(true)
    setError('')
    try {
      if (editingId) {
        const { error: err } = await supabase.from('companies').update({
          name: form.name.trim(), company_type: form.company_type, website: form.website.trim() || null, address: form.address.trim() || null,
        }).eq('id', editingId)
        if (err) throw err
      } else {
        const { error: err } = await supabase.from('companies').insert({
          name: form.name.trim(), company_type: form.company_type, website: form.website.trim() || null, address: form.address.trim() || null,
          created_by_profile_id: user.id,
        })
        if (err) throw err
      }
      setFormOpen(false)
      await load()
    } catch (err) {
      setError(err.message || 'Could not save this company.')
    } finally {
      setSaving(false)
    }
  }

  if (companies === null) return <div className="spinner" />

  return (
    <div className={styles.tabPanel}>
      <div className={styles.panelToolbar}>
        <p className={styles.count}>{companies.length} {companies.length === 1 ? 'company' : 'companies'} in the shared directory</p>
        <button className="btn btn-primary" onClick={openCreate}><Plus size={14} /> Add Company</button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {formOpen && (
        <div className={styles.formCard}>
          <div className={styles.formHeader}>
            <h3>{editingId ? 'Edit Company' : 'Add Company'}</h3>
            <button className={styles.iconBtn} onClick={() => setFormOpen(false)}><X size={16} /></button>
          </div>
          <div className={styles.formGrid}>
            <div>
              <label className="label">Name</label>
              <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Acme Fasteners Inc." />
            </div>
            <div>
              <label className="label">Type</label>
              <select className="input" value={form.company_type} onChange={(e) => setForm({ ...form, company_type: e.target.value })}>
                {COMPANY_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Website</label>
              <input className="input" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} placeholder="https://…" />
            </div>
            <div>
              <label className="label">Address</label>
              <input className="input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="City, State" />
            </div>
          </div>
          <button className="btn btn-primary" disabled={saving} onClick={save}>{saving ? 'Saving…' : 'Save Company'}</button>
        </div>
      )}

      {companies.length === 0 && !formOpen && (
        <p className={styles.emptyState}>No companies yet — add the first vendor, supplier, or packer/shipper you're tracking.</p>
      )}

      <div className={styles.list}>
        {companies.map((c) => (
          <div key={c.id} className={styles.listRow}>
            <button className={styles.rowMain} onClick={() => setExpandedId(expandedId === c.id ? null : c.id)}>
              {expandedId === c.id ? <ChevronDownIcon size={16} /> : <ChevronRight size={16} />}
              <span className={styles.rowTitle}>{c.name}</span>
              <span className={roleBadgeClass(c.company_type)}>{labelFor(COMPANY_TYPES, c.company_type)}</span>
              {c.website && <span className={styles.rowMeta}>{c.website}</span>}
            </button>
            <button className={styles.iconBtn} onClick={() => openEdit(c)}><Pencil size={14} /></button>
            {expandedId === c.id && (
              <div className={styles.expandedPanel}>
                {c.address && <p className={styles.detailLine}>{c.address}</p>}
                <CompanyContacts companyId={c.id} />
                <NotesPanel parentField="company_id" parentId={c.id} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function CompanyContacts({ companyId }) {
  const [contacts, setContacts] = useState(null)

  useEffect(() => {
    supabase.from('contacts').select('id, name, role_tag').eq('company_id', companyId).order('name')
      .then(({ data }) => setContacts(data || []))
  }, [companyId])

  if (contacts === null) return null
  if (contacts.length === 0) return <p className={styles.fieldHintSmall}>No contacts linked to this company yet.</p>

  return (
    <div className={styles.chipRow}>
      {contacts.map((ct) => (
        <span key={ct.id} className={roleBadgeClass(ct.role_tag)}>{ct.name}</span>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------
// Contacts
// ---------------------------------------------------------------------
function ContactsTab() {
  const { user } = useAuth()
  const [contacts, setContacts] = useState(null)
  const [companies, setCompanies] = useState([])
  const [error, setError] = useState('')
  const [expandedId, setExpandedId] = useState(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState({ name: '', role_tag: 'vendor', company_id: '', email: '', phone: '' })
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    const [{ data: contactRows, error: cErr }, { data: companyRows }] = await Promise.all([
      supabase.from('contacts').select('*, companies(name)').order('name'),
      supabase.from('companies').select('id, name').order('name'),
    ])
    if (cErr) { setError(cErr.message); return }
    setContacts(contactRows || [])
    setCompanies(companyRows || [])
  }, [])

  useEffect(() => { load() }, [load])

  function openCreate() {
    setEditingId(null)
    setForm({ name: '', role_tag: 'vendor', company_id: '', email: '', phone: '' })
    setFormOpen(true)
  }

  function openEdit(contact) {
    setEditingId(contact.id)
    setForm({ name: contact.name, role_tag: contact.role_tag, company_id: contact.company_id || '', email: contact.email || '', phone: contact.phone || '' })
    setFormOpen(true)
  }

  async function save() {
    if (!form.name.trim()) { setError('Contact name is required.'); return }
    setSaving(true)
    setError('')
    try {
      const payload = {
        name: form.name.trim(), role_tag: form.role_tag, company_id: form.company_id || null,
        email: form.email.trim() || null, phone: form.phone.trim() || null,
      }
      if (editingId) {
        const { error: err } = await supabase.from('contacts').update(payload).eq('id', editingId)
        if (err) throw err
      } else {
        const { error: err } = await supabase.from('contacts').insert({ ...payload, created_by_profile_id: user.id })
        if (err) throw err
      }
      setFormOpen(false)
      await load()
    } catch (err) {
      setError(err.message || 'Could not save this contact.')
    } finally {
      setSaving(false)
    }
  }

  if (contacts === null) return <div className="spinner" />

  return (
    <div className={styles.tabPanel}>
      <div className={styles.panelToolbar}>
        <p className={styles.count}>{contacts.length} {contacts.length === 1 ? 'contact' : 'contacts'} in the shared directory</p>
        <button className="btn btn-primary" onClick={openCreate}><Plus size={14} /> Add Contact</button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {formOpen && (
        <div className={styles.formCard}>
          <div className={styles.formHeader}>
            <h3>{editingId ? 'Edit Contact' : 'Add Contact'}</h3>
            <button className={styles.iconBtn} onClick={() => setFormOpen(false)}><X size={16} /></button>
          </div>
          <div className={styles.formGrid}>
            <div>
              <label className="label">Name</label>
              <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Jane Smith" />
            </div>
            <div>
              <label className="label">Role</label>
              <select className="input" value={form.role_tag} onChange={(e) => setForm({ ...form, role_tag: e.target.value })}>
                {ROLE_TAGS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Company</label>
              <select className="input" value={form.company_id} onChange={(e) => setForm({ ...form, company_id: e.target.value })}>
                <option value="">No company</option>
                {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Email</label>
              <input className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="jane@example.com" />
            </div>
            <div>
              <label className="label">Phone</label>
              <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="(555) 555-0100" />
            </div>
          </div>
          <button className="btn btn-primary" disabled={saving} onClick={save}>{saving ? 'Saving…' : 'Save Contact'}</button>
        </div>
      )}

      {contacts.length === 0 && !formOpen && (
        <p className={styles.emptyState}>No contacts yet — add the first person you'd reach out to for a quote.</p>
      )}

      <div className={styles.list}>
        {contacts.map((ct) => (
          <div key={ct.id} className={styles.listRow}>
            <button className={styles.rowMain} onClick={() => setExpandedId(expandedId === ct.id ? null : ct.id)}>
              {expandedId === ct.id ? <ChevronDownIcon size={16} /> : <ChevronRight size={16} />}
              <span className={styles.rowTitle}>{ct.name}</span>
              <span className={roleBadgeClass(ct.role_tag)}>{labelFor(ROLE_TAGS, ct.role_tag)}</span>
              {ct.companies?.name && <span className={styles.rowMeta}>{ct.companies.name}</span>}
            </button>
            <button className={styles.iconBtn} onClick={() => openEdit(ct)}><Pencil size={14} /></button>
            {expandedId === ct.id && (
              <div className={styles.expandedPanel}>
                {(ct.email || ct.phone) && (
                  <p className={styles.detailLine}>{[ct.email, ct.phone].filter(Boolean).join(' · ')}</p>
                )}
                <NotesPanel parentField="contact_id" parentId={ct.id} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------
// Notes — read-only-shared for now (shared always false at insert time;
// the share toggle, flagging, and admin removal UI are Phase 3). Still
// worth showing the private-by-default framing now so it isn't a surprise
// later.
// ---------------------------------------------------------------------
function NotesPanel({ parentField, parentId }) {
  const { user } = useAuth()
  const [notes, setNotes] = useState(null)
  const [body, setBody] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const { data, error: err } = await supabase.from('notes').select('*').eq(parentField, parentId).order('created_at', { ascending: false })
    if (err) { setError(err.message); return }
    setNotes(data || [])
  }, [parentField, parentId])

  useEffect(() => { load() }, [load])

  async function addNote() {
    if (!body.trim()) return
    setSaving(true)
    setError('')
    try {
      const { error: err } = await supabase.from('notes').insert({
        [parentField]: parentId, body: body.trim(), author_id: user.id,
      })
      if (err) throw err
      setBody('')
      await load()
    } catch (err) {
      setError(err.message || 'Could not save this note.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={styles.notesPanel}>
      <div className={styles.notesHeader}><MessageSquare size={13} /> Notes</div>
      {error && <div className="alert alert-error" style={{ marginBottom: 'var(--sp-2)' }}>{error}</div>}
      {notes === null ? (
        <p className={styles.fieldHintSmall}>Loading…</p>
      ) : notes.length === 0 ? (
        <p className={styles.fieldHintSmall}>No notes yet — private to you unless you choose to share one later.</p>
      ) : (
        <ul className={styles.notesList}>
          {notes.map((n) => (
            <li key={n.id} className={styles.noteItem}>
              <p>{n.body}</p>
              <span className={styles.noteMeta}>{new Date(n.created_at).toLocaleDateString()} · Private</span>
            </li>
          ))}
        </ul>
      )}
      <div className={styles.noteComposer}>
        <textarea
          className="input"
          rows={2}
          placeholder="Add a note — visible only to you for now."
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        <button className="btn btn-ghost" disabled={saving || !body.trim()} onClick={addNote}>
          {saving ? 'Saving…' : 'Add Note'}
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------
// Pipeline Stages — private per profile, customizable from day one
// (Decision 04). Reorder via up/down rather than drag-and-drop; the
// drag-drop Kanban board itself is Phase 2.
// ---------------------------------------------------------------------
function StagesTab() {
  const { user } = useAuth()
  const [stages, setStages] = useState(null)
  const [error, setError] = useState('')
  const [newName, setNewName] = useState('')
  const [renamingId, setRenamingId] = useState(null)
  const [renameValue, setRenameValue] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const { data, error: err } = await supabase.from('deal_stages').select('*').eq('profile_id', user.id).order('sort_order')
    if (err) { setError(err.message); return }

    if ((data || []).length === 0) {
      // First visit — seed a starter pipeline rather than showing an empty
      // screen with no obvious next step. Still fully editable afterward.
      const seedRows = DEFAULT_STAGES.map((name, i) => ({ profile_id: user.id, name, sort_order: i }))
      const { data: seeded, error: seedErr } = await supabase.from('deal_stages').insert(seedRows).select('*')
      if (seedErr) { setError(seedErr.message); return }
      setStages((seeded || []).sort((a, b) => a.sort_order - b.sort_order))
      return
    }
    setStages(data)
  }, [user.id])

  useEffect(() => { load() }, [load])

  async function addStage() {
    if (!newName.trim()) return
    setBusy(true)
    setError('')
    try {
      const nextOrder = stages.length > 0 ? Math.max(...stages.map((s) => s.sort_order)) + 1 : 0
      const { error: err } = await supabase.from('deal_stages').insert({ profile_id: user.id, name: newName.trim(), sort_order: nextOrder })
      if (err) throw err
      setNewName('')
      await load()
    } catch (err) {
      setError(friendlyStageError(err))
    } finally {
      setBusy(false)
    }
  }

  async function renameStage(id) {
    if (!renameValue.trim()) { setRenamingId(null); return }
    setBusy(true)
    setError('')
    try {
      const { error: err } = await supabase.from('deal_stages').update({ name: renameValue.trim() }).eq('id', id)
      if (err) throw err
      setRenamingId(null)
      await load()
    } catch (err) {
      setError(friendlyStageError(err))
    } finally {
      setBusy(false)
    }
  }

  async function moveStage(index, direction) {
    const target = index + direction
    if (target < 0 || target >= stages.length) return
    setBusy(true)
    setError('')
    try {
      const a = stages[index]
      const b = stages[target]
      await Promise.all([
        supabase.from('deal_stages').update({ sort_order: b.sort_order }).eq('id', a.id),
        supabase.from('deal_stages').update({ sort_order: a.sort_order }).eq('id', b.id),
      ])
      await load()
    } catch (err) {
      setError(err.message || 'Could not reorder stages.')
    } finally {
      setBusy(false)
    }
  }

  async function deleteStage(id) {
    if (!window.confirm('Delete this stage? Any deal in it would block the delete — move those first.')) return
    setBusy(true)
    setError('')
    try {
      const { error: err } = await supabase.from('deal_stages').delete().eq('id', id)
      if (err) throw err
      await load()
    } catch (err) {
      setError(friendlyStageError(err))
    } finally {
      setBusy(false)
    }
  }

  if (stages === null) return <div className="spinner" />

  return (
    <div className={styles.tabPanel}>
      <p className={styles.count}>Your pipeline columns — reorder, rename, add, or remove any of them. Private to you.</p>
      {error && <div className="alert alert-error">{error}</div>}

      <div className={styles.stageList}>
        {stages.map((s, i) => (
          <div key={s.id} className={styles.stageRow}>
            <div className={styles.stageOrderBtns}>
              <button className={styles.iconBtn} disabled={busy || i === 0} onClick={() => moveStage(i, -1)}><ChevronUp size={14} /></button>
              <button className={styles.iconBtn} disabled={busy || i === stages.length - 1} onClick={() => moveStage(i, 1)}><ChevronDown size={14} /></button>
            </div>
            {renamingId === s.id ? (
              <input
                className="input"
                autoFocus
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onBlur={() => renameStage(s.id)}
                onKeyDown={(e) => e.key === 'Enter' && renameStage(s.id)}
              />
            ) : (
              <span className={styles.stageName}>{s.name}</span>
            )}
            <button className={styles.iconBtn} disabled={busy} onClick={() => { setRenamingId(s.id); setRenameValue(s.name) }}><Pencil size={14} /></button>
            <button className={styles.iconBtn} disabled={busy} onClick={() => deleteStage(s.id)}><Trash2 size={14} /></button>
          </div>
        ))}
      </div>

      <div className={styles.addStageRow}>
        <input
          className="input"
          placeholder="New stage name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addStage()}
        />
        <button className="btn btn-ghost" disabled={busy || !newName.trim()} onClick={addStage}><Plus size={14} /> Add Stage</button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------
// Deals — a real Kanban board (Phase 2). Deals are still only created by
// the Suggested Bid purchase automation (generate_suggested_bid), not by
// hand — that's a later phase — but from here they can be dragged between
// stages, and clicking a card opens the detail modal where its notes
// (written by the automation since Phase 1, invisible until now) finally
// become visible.
// ---------------------------------------------------------------------
function DealsTab({ initialDealId }) {
  const { user } = useAuth()
  const [deals, setDeals] = useState(null)
  const [stages, setStages] = useState([])
  const [error, setError] = useState('')
  const [selectedDealId, setSelectedDealId] = useState(initialDealId || null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const load = useCallback(async () => {
    const [{ data: stageRows, error: stageErr }, { data: dealRows, error: dealErr }] = await Promise.all([
      supabase.from('deal_stages').select('id, name, sort_order').eq('profile_id', user.id).order('sort_order'),
      supabase
        .from('deals')
        .select('id, title, value_estimate, stage_id, created_at, deal_companies(role_on_deal, companies(name, company_type))')
        .eq('profile_id', user.id)
        .order('created_at', { ascending: false }),
    ])
    if (stageErr) { setError(stageErr.message); return }
    if (dealErr) { setError(dealErr.message); return }
    setStages(stageRows || [])
    setDeals(dealRows || [])
  }, [user.id])

  useEffect(() => { load() }, [load])

  async function handleDragEnd(event) {
    const { active, over } = event
    if (!over) return
    const dealId = active.id
    const newStageId = over.id
    const deal = deals.find((d) => d.id === dealId)
    if (!deal || deal.stage_id === newStageId) return

    const prevStageId = deal.stage_id
    setDeals((prev) => prev.map((d) => (d.id === dealId ? { ...d, stage_id: newStageId } : d)))
    const { error: err } = await supabase.from('deals').update({ stage_id: newStageId }).eq('id', dealId)
    if (err) {
      setError(err.message)
      setDeals((prev) => prev.map((d) => (d.id === dealId ? { ...d, stage_id: prevStageId } : d)))
    }
  }

  if (deals === null) return <div className="spinner" />

  const dealsByStage = {}
  for (const d of deals) {
    if (!dealsByStage[d.stage_id]) dealsByStage[d.stage_id] = []
    dealsByStage[d.stage_id].push(d)
  }

  return (
    <div className={styles.tabPanel}>
      <p className={styles.count}>
        {deals.length} {deals.length === 1 ? 'deal' : 'deals'} — drag a card to change its stage, or click one for details.
      </p>
      {error && <div className="alert alert-error">{error}</div>}

      {stages.length === 0 ? (
        <p className={styles.emptyState}>No pipeline stages yet — visit the Pipeline Stages tab to set one up.</p>
      ) : deals.length === 0 ? (
        <p className={styles.emptyState}>No deals yet — buy a Suggested Bid on a matched opportunity and it'll show up here automatically.</p>
      ) : (
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <div className={styles.board}>
            {stages.map((stage) => (
              <div key={stage.id} className={styles.column}>
                <div className={styles.columnHeader}>
                  <span>{stage.name}</span>
                  <span className={styles.columnCount}>{dealsByStage[stage.id]?.length || 0}</span>
                </div>
                <StageDropZone stageId={stage.id}>
                  {(dealsByStage[stage.id] || []).map((deal) => (
                    <DealCard key={deal.id} deal={deal} onClick={() => setSelectedDealId(deal.id)} />
                  ))}
                  {(!dealsByStage[stage.id] || dealsByStage[stage.id].length === 0) && (
                    <p className={styles.emptyColumn}>No deals</p>
                  )}
                </StageDropZone>
              </div>
            ))}
          </div>
        </DndContext>
      )}

      {selectedDealId && (
        <DealDetailModal
          dealId={selectedDealId}
          stages={stages}
          onClose={() => setSelectedDealId(null)}
          onStageChange={(dealId, newStageId) => {
            setDeals((prev) => prev.map((d) => (d.id === dealId ? { ...d, stage_id: newStageId } : d)))
          }}
        />
      )}
    </div>
  )
}

function StageDropZone({ stageId, children }) {
  const { setNodeRef, isOver } = useDroppable({ id: stageId })
  return (
    <div ref={setNodeRef} className={`${styles.columnDropZone} ${isOver ? styles.columnDropZoneOver : ''}`}>
      {children}
    </div>
  )
}

function DealCard({ deal, onClick }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: deal.id })
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined
  const companyCount = deal.deal_companies?.length || 0

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`${styles.dealCard} ${isDragging ? styles.dealCardDragging : ''}`}
      onClick={onClick}
    >
      <span className={styles.dealCardTitle}>{deal.title}</span>
      {typeof deal.value_estimate === 'number' && (
        <span className={styles.dealCardMeta}>${Math.round(deal.value_estimate).toLocaleString()} est.</span>
      )}
      {companyCount > 0 && (
        <span className={styles.dealCardMeta}>{companyCount} linked {companyCount === 1 ? 'company' : 'companies'}</span>
      )}
    </div>
  )
}

// Notes here are what generate_suggested_bid's createCrmDeal has been
// writing since Phase 1 (AI summary, RFQ drafts) — this modal is the
// first place any of that becomes visible to a member.
function DealDetailModal({ dealId, stages, onClose, onStageChange }) {
  const [deal, setDeal] = useState(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const { data, error: err } = await supabase
      .from('deals')
      .select('id, title, value_estimate, stage_id, opportunity_id, deal_companies(role_on_deal, companies(id, name, company_type))')
      .eq('id', dealId)
      .single()
    if (err) { setError(err.message); return }
    setDeal(data)
  }, [dealId])

  useEffect(() => { load() }, [load])

  async function changeStage(newStageId) {
    const prevStageId = deal.stage_id
    setDeal((d) => ({ ...d, stage_id: newStageId }))
    const { error: err } = await supabase.from('deals').update({ stage_id: newStageId }).eq('id', dealId)
    if (err) {
      setError(err.message)
      setDeal((d) => ({ ...d, stage_id: prevStageId }))
      return
    }
    onStageChange?.(dealId, newStageId)
  }

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>{deal?.title || 'Loading…'}</h2>
          <button className={styles.iconBtn} onClick={onClose}><X size={18} /></button>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        {!deal ? (
          <div className="spinner" />
        ) : (
          <>
            <div className={styles.modalMetaRow}>
              <select className="input" style={{ maxWidth: 220 }} value={deal.stage_id} onChange={(e) => changeStage(e.target.value)}>
                {stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              {typeof deal.value_estimate === 'number' && (
                <span className="badge badge-navy">${Math.round(deal.value_estimate).toLocaleString()} est.</span>
              )}
            </div>

            {deal.deal_companies?.length > 0 && (
              <div>
                <label className="label">Linked companies</label>
                <div className={styles.chipRow} style={{ marginTop: 'var(--sp-2)' }}>
                  {deal.deal_companies.map((dc, i) => (
                    <span key={i} className={roleBadgeClass(dc.role_on_deal)}>{dc.companies?.name}</span>
                  ))}
                </div>
              </div>
            )}

            <NotesPanel parentField="deal_id" parentId={dealId} />
          </>
        )}
      </div>
    </div>
  )
}
