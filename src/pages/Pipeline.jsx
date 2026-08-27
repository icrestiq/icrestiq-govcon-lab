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

import { useState, useEffect, useCallback, useRef } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { DndContext, useDraggable, useDroppable, useSensor, useSensors, PointerSensor } from '@dnd-kit/core'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'
import {
  Building2, Users, Columns3, Plus, Pencil, Trash2, X, ChevronUp, ChevronDown,
  MessageSquare, ChevronDown as ChevronDownIcon, ChevronRight, Briefcase,
  ListTodo, Square, CheckSquare, Calendar, Search, BarChart3, FileText,
} from 'lucide-react'
import useDialogA11y from '../hooks/useDialogA11y'
import useDocumentTitle from '../hooks/useDocumentTitle'
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

const DEFAULT_STAGES = [
  { name: 'Sourcing', stage_type: 'active' },
  { name: 'Quoting', stage_type: 'active' },
  { name: 'Quote Sent', stage_type: 'active' },
  { name: 'Awarded', stage_type: 'won' },
  { name: 'Lost', stage_type: 'lost' },
  { name: 'Declined', stage_type: 'declined' },
]

const STAGE_TYPES = [
  { value: 'active', label: 'Active' },
  { value: 'won', label: 'Won' },
  { value: 'lost', label: 'Lost' },
  { value: 'declined', label: 'Declined' },
]

function stageTypeBadgeClass(stageType) {
  switch (stageType) {
    case 'won': return 'badge badge-green'
    case 'lost': return 'badge badge-red'
    case 'declined': return 'badge badge-amber'
    default: return null
  }
}

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
  useDocumentTitle('Sourcing Pipeline — GovCon Lab')
  const [searchParams, setSearchParams] = useSearchParams()
  // Captured once via lazy init, not read reactively — the clearing effect
  // below wipes these query params right after mount so a page refresh
  // doesn't keep re-opening the same deal, and a reactive read would just
  // see them disappear on the very next render.
  const [tab, setTab] = useState(() => (searchParams.get('tab') === 'deals' ? 'deals' : 'companies'))
  const [initialDealId] = useState(() => searchParams.get('deal'))
  // Set by the Tasks tab's "jump to this task's record" links. Kept as
  // plain state (not the URL) since this is in-page tab switching, not
  // real navigation — DealsTab/CompaniesTab/ContactsTab each pick these up
  // in an effect and open the matching record the moment they're mounted.
  const [jumpDealId, setJumpDealId] = useState(null)
  const [jumpCompanyId, setJumpCompanyId] = useState(null)
  const [jumpContactId, setJumpContactId] = useState(null)

  useEffect(() => {
    if (searchParams.get('tab') || searchParams.get('deal')) {
      setSearchParams({}, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function jumpToEntity(entityType, id) {
    if (entityType === 'Deal') { setJumpDealId(id); setTab('deals') }
    else if (entityType === 'Company') { setJumpCompanyId(id); setTab('companies') }
    else if (entityType === 'Contact') { setJumpContactId(id); setTab('contacts') }
  }

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
        <button className={`${styles.tab} ${tab === 'tasks' ? styles.tabActive : ''}`} onClick={() => setTab('tasks')}>
          <ListTodo size={15} /> Tasks
        </button>
        <button className={`${styles.tab} ${tab === 'reports' ? styles.tabActive : ''}`} onClick={() => setTab('reports')}>
          <BarChart3 size={15} /> Reports
        </button>
      </div>

      {tab === 'companies' && <CompaniesTab openCompanyId={jumpCompanyId} />}
      {tab === 'contacts' && <ContactsTab openContactId={jumpContactId} />}
      {tab === 'stages' && <StagesTab />}
      {tab === 'deals' && <DealsTab initialDealId={initialDealId} openDealId={jumpDealId} />}
      {tab === 'tasks' && <TasksTab onJump={jumpToEntity} />}
      {tab === 'reports' && <ReportsTab />}
    </div>
  )
}

// ---------------------------------------------------------------------
// Companies
// ---------------------------------------------------------------------
// Loosens an NSN/CAGE search term to just its alphanumerics so "5340-01-
// 592-1509" matches a search for "534001592" and vice versa — members
// shouldn't have to match punctuation exactly to find a part.
function normalizeSearchTerm(value) {
  return (value || '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

function CompaniesTab({ openCompanyId }) {
  const { user } = useAuth()
  const [companies, setCompanies] = useState(null)
  const [nsnsByCompany, setNsnsByCompany] = useState({})
  const [error, setError] = useState('')
  const [expandedId, setExpandedId] = useState(null)
  const [search, setSearch] = useState('')

  useEffect(() => { if (openCompanyId) setExpandedId(openCompanyId) }, [openCompanyId])
  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState({ name: '', company_type: 'vendor', website: '', address: '', cage_code: '' })
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    const [{ data: companyRows, error: err }, { data: nsnRows }] = await Promise.all([
      supabase.from('companies').select('*').order('name'),
      supabase.from('company_nsns').select('id, company_id, nsn'),
    ])
    if (err) { setError(err.message); return }
    setCompanies(companyRows || [])
    const byCompany = {}
    for (const row of nsnRows || []) {
      if (!byCompany[row.company_id]) byCompany[row.company_id] = []
      byCompany[row.company_id].push(row)
    }
    setNsnsByCompany(byCompany)
  }, [])

  useEffect(() => { load() }, [load])

  function openCreate() {
    setEditingId(null)
    setForm({ name: '', company_type: 'vendor', website: '', address: '', cage_code: '' })
    setFormOpen(true)
  }

  function openEdit(company) {
    setEditingId(company.id)
    setForm({
      name: company.name, company_type: company.company_type, website: company.website || '',
      address: company.address || '', cage_code: company.cage_code || '',
    })
    setFormOpen(true)
  }

  async function save() {
    if (!form.name.trim()) { setError('Company name is required.'); return }
    setSaving(true)
    setError('')
    try {
      const payload = {
        name: form.name.trim(), company_type: form.company_type, website: form.website.trim() || null,
        address: form.address.trim() || null, cage_code: form.cage_code.trim() || null,
      }
      if (editingId) {
        const { error: err } = await supabase.from('companies').update(payload).eq('id', editingId)
        if (err) throw err
      } else {
        const { error: err } = await supabase.from('companies').insert({ ...payload, created_by_profile_id: user.id })
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

  async function unlinkNsn(nsnRowId, companyId) {
    if (!window.confirm('Unlink this NSN from this company? This only removes the tag — it doesn\'t touch any deal history.')) return
    const prev = nsnsByCompany[companyId] || []
    setNsnsByCompany((m) => ({ ...m, [companyId]: prev.filter((n) => n.id !== nsnRowId) }))
    const { error: err } = await supabase.from('company_nsns').delete().eq('id', nsnRowId)
    if (err) {
      setError(err.message)
      setNsnsByCompany((m) => ({ ...m, [companyId]: prev }))
    }
  }

  if (companies === null) return <div className="spinner" />

  const searchTerm = normalizeSearchTerm(search)
  const filtered = !searchTerm ? companies : companies.filter((c) => {
    if (normalizeSearchTerm(c.name).includes(searchTerm)) return true
    if (c.cage_code && normalizeSearchTerm(c.cage_code).includes(searchTerm)) return true
    return (nsnsByCompany[c.id] || []).some((n) => normalizeSearchTerm(n.nsn).includes(searchTerm))
  })

  return (
    <div className={styles.tabPanel}>
      <div className={styles.panelToolbar}>
        <p className={styles.count}>{filtered.length} of {companies.length} {companies.length === 1 ? 'company' : 'companies'} in the shared directory</p>
        <button className="btn btn-primary" onClick={openCreate}><Plus size={14} /> Add Company</button>
      </div>

      <div className={styles.searchRow}>
        <Search size={14} />
        <input
          value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, CAGE code, or NSN…"
        />
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {formOpen && (
        <div className={styles.formCard}>
          <div className={styles.formHeader}>
            <h3>{editingId ? 'Edit Company' : 'Add Company'}</h3>
            <button className={styles.iconBtn} onClick={() => setFormOpen(false)} aria-label="Cancel"><X size={16} aria-hidden="true" /></button>
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
            <div>
              <label className="label">CAGE Code</label>
              <input className="input" value={form.cage_code} onChange={(e) => setForm({ ...form, cage_code: e.target.value })} placeholder="1A2B3" />
            </div>
          </div>
          <button className="btn btn-primary" disabled={saving} onClick={save}>{saving ? 'Saving…' : 'Save Company'}</button>
        </div>
      )}

      {companies.length === 0 && !formOpen && (
        <p className={styles.emptyState}>No companies yet — add the first vendor, supplier, or packer/shipper you're tracking.</p>
      )}
      {companies.length > 0 && filtered.length === 0 && (
        <p className={styles.emptyState}>No companies match "{search}".</p>
      )}

      <div className={styles.list}>
        {filtered.map((c) => {
          const nsns = nsnsByCompany[c.id] || []
          return (
          <div key={c.id} className={styles.listRow}>
            <button className={styles.rowMain} onClick={() => setExpandedId(expandedId === c.id ? null : c.id)}>
              {expandedId === c.id ? <ChevronDownIcon size={16} /> : <ChevronRight size={16} />}
              <span className={styles.rowTitle}>{c.name}</span>
              <span className={roleBadgeClass(c.company_type)}>{labelFor(COMPANY_TYPES, c.company_type)}</span>
              {c.cage_code && <span className={styles.rowMeta}>CAGE {c.cage_code}</span>}
              {c.website && <span className={styles.rowMeta}>{c.website}</span>}
            </button>
            <button className={styles.iconBtn} onClick={() => openEdit(c)} aria-label="Edit company"><Pencil size={14} aria-hidden="true" /></button>
            {expandedId === c.id && (
              <div className={styles.expandedPanel}>
                {c.address && <p className={styles.detailLine}>{c.address}</p>}
                {nsns.length > 0 && (
                  <div className={styles.chipRow}>
                    {nsns.map((n) => (
                      <span key={n.id} className="badge badge-navy" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, paddingRight: 4 }}>
                        {n.nsn}
                        <button type="button" className={styles.chipRemoveBtn} onClick={() => unlinkNsn(n.id, c.id)} aria-label={`Unlink NSN ${n.nsn}`}>
                          <X size={11} aria-hidden="true" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <CompanyContacts companyId={c.id} />
                <TasksPanel parentField="company_id" parentId={c.id} />
                <NotesPanel parentField="company_id" parentId={c.id} allowSharing />
              </div>
            )}
          </div>
          )
        })}
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
function ContactsTab({ openContactId }) {
  const { user } = useAuth()
  const [contacts, setContacts] = useState(null)
  const [companies, setCompanies] = useState([])
  const [error, setError] = useState('')
  const [expandedId, setExpandedId] = useState(null)

  useEffect(() => { if (openContactId) setExpandedId(openContactId) }, [openContactId])
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
            <button className={styles.iconBtn} onClick={() => setFormOpen(false)} aria-label="Cancel"><X size={16} aria-hidden="true" /></button>
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
            <button className={styles.iconBtn} onClick={() => openEdit(ct)} aria-label="Edit contact"><Pencil size={14} aria-hidden="true" /></button>
            {expandedId === ct.id && (
              <div className={styles.expandedPanel}>
                {(ct.email || ct.phone) && (
                  <p className={styles.detailLine}>{[ct.email, ct.phone].filter(Boolean).join(' · ')}</p>
                )}
                <TasksPanel parentField="contact_id" parentId={ct.id} />
                <NotesPanel parentField="contact_id" parentId={ct.id} allowSharing />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------
// Tasks (Phase 3b: private per-owner to-dos, attached to a company,
// contact, or deal). No sharing — unlike notes, a task is a personal
// reminder, not directory content. The Tasks tab (below) is the "all my
// open tasks across everything, soonest due date first" reminders view;
// this panel is the "tasks scoped to just this one record" view.
// ---------------------------------------------------------------------
function TasksPanel({ parentField, parentId }) {
  const { user } = useAuth()
  const [tasks, setTasks] = useState(null)
  const [title, setTitle] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const { data, error: err } = await supabase.from('tasks').select('*').eq(parentField, parentId).order('due_date', { ascending: true, nullsFirst: false })
    if (err) { setError(err.message); return }
    setTasks(data || [])
  }, [parentField, parentId])

  useEffect(() => { load() }, [load])

  async function addTask() {
    if (!title.trim()) return
    setSaving(true)
    setError('')
    try {
      const { error: err } = await supabase.from('tasks').insert({
        [parentField]: parentId, title: title.trim(), due_date: dueDate || null, profile_id: user.id,
      })
      if (err) throw err
      setTitle('')
      setDueDate('')
      await load()
    } catch (err) {
      setError(err.message || 'Could not save this task.')
    } finally {
      setSaving(false)
    }
  }

  async function toggleComplete(task) {
    setError('')
    const nextCompletedAt = task.completed_at ? null : new Date().toISOString()
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, completed_at: nextCompletedAt } : t)))
    const { error: err } = await supabase.from('tasks').update({ completed_at: nextCompletedAt }).eq('id', task.id)
    if (err) {
      setError(err.message)
      setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, completed_at: task.completed_at } : t)))
    }
  }

  const openTasks = (tasks || []).filter((t) => !t.completed_at)
  const doneTasks = (tasks || []).filter((t) => t.completed_at)

  return (
    <div className={styles.notesPanel}>
      <div className={styles.notesHeader}><ListTodo size={13} /> Tasks</div>
      {error && <div className="alert alert-error" style={{ marginBottom: 'var(--sp-2)' }}>{error}</div>}
      {tasks === null ? ( <p className={styles.fieldHintSmall}>Loading…</p> )
      : tasks.length === 0 ? ( <p className={styles.fieldHintSmall}>No tasks yet.</p> )
      : (
        <ul className={styles.notesList}>
          {[...openTasks, ...doneTasks].map((t) => {
            const overdue = !t.completed_at && t.due_date && t.due_date < new Date().toISOString().slice(0, 10)
            return (
              <li key={t.id} className={styles.taskItem}>
                <button type="button" className={styles.taskCheckBtn} onClick={() => toggleComplete(t)} aria-label={t.completed_at ? `Mark "${t.title}" not done` : `Mark "${t.title}" done`}>
                  {t.completed_at ? <CheckSquare size={15} aria-hidden="true" /> : <Square size={15} aria-hidden="true" />}
                </button>
                <div className={styles.taskBody}>
                  <span className={t.completed_at ? styles.taskTitleDone : styles.taskTitle}>{t.title}</span>
                  {t.due_date && (
                    <span className={overdue ? styles.taskDueOverdue : styles.taskDue}>
                      <Calendar size={11} aria-hidden="true" /> {new Date(`${t.due_date}T00:00:00`).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
      <div className={styles.noteComposer}>
        <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Add a task…" style={{ width: '100%' }} />
        <div style={{ display: 'flex', gap: 'var(--sp-2)', alignItems: 'center', width: '100%' }}>
          <input className="input" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} style={{ maxWidth: 160 }} />
          <button className="btn btn-ghost" disabled={saving || !title.trim()} onClick={addTask}>
            {saving ? 'Saving…' : 'Add Task'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------
// Notes (Phase 3: sharing + flagging). `allowSharing` gates both the
// share toggle and the flag button — pass it only where notes attach to
// a shared-directory entity (company/contact). Deal notes stay
// unshareable: even though the schema's `shared` column doesn't
// distinguish, sharing a note tied to a private deal wouldn't be visible
// to anyone anyway (deals stay profile_id-scoped), so the control is
// simply never offered there. Admin removal isn't done here — see
// AdminPanel's Flagged Notes tab, which goes through a service-role API
// route rather than a direct client call, since the protect_note_removal_
// fields trigger only trusts service_role regardless of profiles.role.
// ---------------------------------------------------------------------
function NotesPanel({ parentField, parentId, allowSharing = false }) {
  const { user } = useAuth()
  const [notes, setNotes] = useState(null)
  const [body, setBody] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [flaggingId, setFlaggingId] = useState(null)

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

  async function toggleShared(note) {
    setError('')
    const nextShared = !note.shared
    setNotes((prev) => prev.map((n) => (n.id === note.id ? { ...n, shared: nextShared } : n)))
    const { error: err } = await supabase.from('notes').update({ shared: nextShared }).eq('id', note.id)
    if (err) {
      setError(err.message)
      setNotes((prev) => prev.map((n) => (n.id === note.id ? { ...n, shared: !nextShared } : n)))
    }
  }

  async function flagNote(noteId) {
    setFlaggingId(noteId)
    setError('')
    try {
      const { error: err } = await supabase.from('note_flags').insert({ note_id: noteId, flagged_by_profile_id: user.id })
      if (err) throw err
    } catch (err) {
      // note_flags has no SELECT access for regular members (admin-only —
      // see the RLS policy), so there's no way to pre-check "did I already
      // flag this" — catching the unique-constraint violation is the only
      // way to give a friendly answer instead of a raw Postgres error.
      setError(/duplicate key value/i.test(err.message) ? 'You already flagged this note.' : (err.message || 'Could not flag this note.'))
    } finally {
      setFlaggingId(null)
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
          {notes.map((n) => {
            const isAuthor = n.author_id === user.id
            return (
              <li key={n.id} className={styles.noteItem}>
                <p>{n.body}</p>
                <div className={styles.noteFooter}>
                  <span className={styles.noteMeta}>
                    {new Date(n.created_at).toLocaleDateString()} · {n.shared ? 'Shared' : 'Private'}
                  </span>
                  {allowSharing && isAuthor && (
                    <button type="button" className={styles.noteActionBtn} onClick={() => toggleShared(n)}>
                      {n.shared ? 'Unshare' : 'Share'}
                    </button>
                  )}
                  {allowSharing && !isAuthor && n.shared && (
                    <button
                      type="button"
                      className={styles.noteActionBtn}
                      disabled={flaggingId === n.id}
                      onClick={() => flagNote(n.id)}
                    >
                      {flaggingId === n.id ? 'Flagging…' : 'Flag'}
                    </button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
      <div className={styles.noteComposer}>
        <textarea
          className="input"
          rows={2}
          placeholder={allowSharing ? 'Add a note — private by default, share it any time.' : 'Add a note — visible only to you.'}
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
  const [newStageType, setNewStageType] = useState('active')
  const [renamingId, setRenamingId] = useState(null)
  const [renameValue, setRenameValue] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const { data, error: err } = await supabase.from('deal_stages').select('*').eq('profile_id', user.id).order('sort_order')
    if (err) { setError(err.message); return }

    if ((data || []).length === 0) {
      // First visit — seed a starter pipeline rather than showing an empty
      // screen with no obvious next step. Still fully editable afterward.
      const seedRows = DEFAULT_STAGES.map((s, i) => ({ profile_id: user.id, name: s.name, stage_type: s.stage_type, sort_order: i }))
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
      const { error: err } = await supabase.from('deal_stages').insert({ profile_id: user.id, name: newName.trim(), stage_type: newStageType, sort_order: nextOrder })
      if (err) throw err
      setNewName('')
      setNewStageType('active')
      await load()
    } catch (err) {
      setError(friendlyStageError(err))
    } finally {
      setBusy(false)
    }
  }

  async function changeStageType(id, stageType) {
    setStages((prev) => prev.map((s) => (s.id === id ? { ...s, stage_type: stageType } : s)))
    const { error: err } = await supabase.from('deal_stages').update({ stage_type: stageType }).eq('id', id)
    if (err) { setError(err.message); await load() }
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
              <button className={styles.iconBtn} disabled={busy || i === 0} onClick={() => moveStage(i, -1)} aria-label={`Move "${s.name}" up`}><ChevronUp size={14} aria-hidden="true" /></button>
              <button className={styles.iconBtn} disabled={busy || i === stages.length - 1} onClick={() => moveStage(i, 1)} aria-label={`Move "${s.name}" down`}><ChevronDown size={14} aria-hidden="true" /></button>
            </div>
            {renamingId === s.id ? (
              <input
                className="input"
                autoFocus
                aria-label={`Rename stage "${s.name}"`}
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onBlur={() => renameStage(s.id)}
                onKeyDown={(e) => e.key === 'Enter' && renameStage(s.id)}
              />
            ) : (
              <span className={styles.stageName}>{s.name}</span>
            )}
            <select
              className="input" style={{ maxWidth: 130 }} value={s.stage_type || 'active'}
              onChange={(e) => changeStageType(s.id, e.target.value)}
              aria-label={`What "${s.name}" counts as in Reports`}
            >
              {STAGE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <button className={styles.iconBtn} disabled={busy} onClick={() => { setRenamingId(s.id); setRenameValue(s.name) }} aria-label={`Rename "${s.name}"`}><Pencil size={14} aria-hidden="true" /></button>
            <button className={styles.iconBtn} disabled={busy} onClick={() => deleteStage(s.id)} aria-label={`Delete "${s.name}"`}><Trash2 size={14} aria-hidden="true" /></button>
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
        <select className="input" style={{ maxWidth: 130 }} value={newStageType} onChange={(e) => setNewStageType(e.target.value)}>
          {STAGE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <button className="btn btn-ghost" disabled={busy || !newName.trim()} onClick={addStage}><Plus size={14} /> Add Stage</button>
      </div>
      <p className={styles.fieldHintSmall}>Stage type controls what shows up in Reports — mark the stages that mean a deal was won, lost, or declined (by you, before an outcome).</p>
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
function DealsTab({ initialDealId, openDealId }) {
  const { user } = useAuth()
  const [deals, setDeals] = useState(null)
  const [stages, setStages] = useState([])
  const [error, setError] = useState('')
  const [selectedDealId, setSelectedDealId] = useState(initialDealId || null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  useEffect(() => { if (openDealId) setSelectedDealId(openDealId) }, [openDealId])

  const load = useCallback(async () => {
    const [{ data: stageRows, error: stageErr }, { data: dealRows, error: dealErr }] = await Promise.all([
      supabase.from('deal_stages').select('id, name, sort_order').eq('profile_id', user.id).order('sort_order'),
      supabase
        .from('deals')
        .select(`
          id, title, value_estimate, stage_id, created_at,
          deal_companies(role_on_deal, companies(name, company_type)),
          opportunities(solicitation_number),
          bid_requests(suggested_bid)
        `)
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

// Solicitation # comes from the linked opportunities row; NSN/P-N
// identifiers come from bid_requests.suggested_bid.identifiers — already
// pre-labeled strings (e.g. "NSN 5340-01-592-1509") extracted by
// generate_suggested_bid, not re-parsed here. Either can be missing
// (a manually created deal down the line would have neither), so this
// returns null rather than an empty string when there's nothing to show.
function dealIdentifierLine(deal) {
  const parts = []
  if (deal.opportunities?.solicitation_number) parts.push(`Sol# ${deal.opportunities.solicitation_number}`)
  const identifiers = deal.bid_requests?.suggested_bid?.identifiers
  if (Array.isArray(identifiers) && identifiers.length > 0) parts.push(identifiers.join(', '))
  return parts.length > 0 ? parts.join(' · ') : null
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
  const identifierLine = dealIdentifierLine(deal)

  // useDraggable's own `attributes` already supplies role="button" and
  // tabIndex={0} (dnd-kit does this regardless of which sensors are
  // configured), but keyboard *activation* of a div with an ARIA button
  // role isn't automatic the way it is for a real <button> — only
  // dragging was wired up (PointerSensor only, no KeyboardSensor), so
  // without this a keyboard user could tab to the card but never open it.
  function handleKeyDown(e) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onClick?.(e)
    }
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`${styles.dealCard} ${isDragging ? styles.dealCardDragging : ''}`}
      onClick={onClick}
      onKeyDown={handleKeyDown}
    >
      <span className={styles.dealCardTitle}>{deal.title}</span>
      {identifierLine && <span className={styles.dealCardIdentifiers}>{identifierLine}</span>}
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
  const navigate = useNavigate()
  const [deal, setDeal] = useState(null)
  const [error, setError] = useState('')
  const dialogRef = useRef(null)
  useDialogA11y({ isOpen: true, onClose, containerRef: dialogRef })

  const load = useCallback(async () => {
    const { data, error: err } = await supabase
      .from('deals')
      .select(`
        id, title, value_estimate, stage_id, opportunity_id,
        deal_companies(id, role_on_deal, companies(id, name, company_type)),
        opportunities(solicitation_number),
        bid_requests(suggested_bid)
      `)
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

  // Unlinks a company from just this deal — doesn't touch the company
  // record itself, which stays in the shared directory (still relevant to
  // other deals/members even if it doesn't carry the NSN this deal needs).
  // deal_companies already grants delete via RLS scoped through the
  // parent deal, so nothing new needed on the database side.
  async function removeCompany(dealCompanyId) {
    const prevCompanies = deal.deal_companies
    setDeal((d) => ({ ...d, deal_companies: d.deal_companies.filter((dc) => dc.id !== dealCompanyId) }))
    const { error: err } = await supabase.from('deal_companies').delete().eq('id', dealCompanyId)
    if (err) {
      setError(err.message)
      setDeal((d) => ({ ...d, deal_companies: prevCompanies }))
    }
  }

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div
        ref={dialogRef}
        className={styles.modalCard}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="deal-modal-title"
      >
        <div className={styles.modalHeader}>
          <div>
            <h2 id="deal-modal-title" className={styles.modalTitle}>{deal?.title || 'Loading…'}</h2>
            {deal && dealIdentifierLine(deal) && (
              <p className={styles.modalIdentifiers}>{dealIdentifierLine(deal)}</p>
            )}
          </div>
          <button className={styles.iconBtn} onClick={onClose} aria-label="Close"><X size={18} aria-hidden="true" /></button>
        </div>

        {error && <div className="alert alert-error" role="alert">{error}</div>}

        {!deal ? (
          <div className="spinner" />
        ) : (
          <>
            <div className={styles.modalMetaRow}>
              <select className="input" style={{ maxWidth: 220 }} value={deal.stage_id} onChange={(e) => changeStage(e.target.value)} aria-label="Deal stage">
                {stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              {typeof deal.value_estimate === 'number' && (
                <span className="badge badge-navy">${Math.round(deal.value_estimate).toLocaleString()} est.</span>
              )}
              <button
                type="button" className="btn btn-ghost"
                onClick={() => navigate(`/tools/proposal-builder?deal=${dealId}`)}
                title="Opens Proposal Builder pre-filled with this deal's solicitation, technical approach, and risk notes"
              >
                <FileText size={14} aria-hidden="true" /> Generate Proposal
              </button>
            </div>

            {deal.deal_companies?.length > 0 && (
              <div>
                <label className="label">Linked companies</label>
                <p className={styles.fieldHintSmall}>Remove one if research shows it doesn't actually carry what this deal needs — the company itself stays in the shared directory.</p>
                <div className={styles.chipRow} style={{ marginTop: 'var(--sp-2)' }}>
                  {deal.deal_companies.map((dc) => (
                    <span key={dc.id} className={`${roleBadgeClass(dc.role_on_deal)} ${styles.removableChip}`}>
                      {dc.companies?.name}
                      <button
                        type="button"
                        className={styles.chipRemoveBtn}
                        onClick={() => removeCompany(dc.id)}
                        aria-label={`Remove ${dc.companies?.name} from this deal`}
                      >
                        <X size={11} aria-hidden="true" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}

            <TasksPanel parentField="deal_id" parentId={dealId} />
            <NotesPanel parentField="deal_id" parentId={dealId} />
          </>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------
// Tasks tab — every open task across companies, contacts, and deals in
// one reminders view, soonest due date first. TasksPanel above is
// per-record; this is the "what do I need to do" surface the sharing
// decisions this phase settled on (in-app visual only, no email/cron).
// ---------------------------------------------------------------------
function TasksTab({ onJump }) {
  const { user } = useAuth()
  const [tasks, setTasks] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    setError('')
    try {
      const { data: rows, error: err } = await supabase
        .from('tasks')
        .select('*')
        .eq('profile_id', user.id)
        .is('completed_at', null)
        .order('due_date', { ascending: true, nullsFirst: false })
      if (err) throw err

      const companyIds = [...new Set((rows || []).map((t) => t.company_id).filter(Boolean))]
      const contactIds = [...new Set((rows || []).map((t) => t.contact_id).filter(Boolean))]
      const dealIds = [...new Set((rows || []).map((t) => t.deal_id).filter(Boolean))]
      const [{ data: companies }, { data: contacts }, { data: deals }] = await Promise.all([
        companyIds.length ? supabase.from('companies').select('id, name').in('id', companyIds) : Promise.resolve({ data: [] }),
        contactIds.length ? supabase.from('contacts').select('id, name').in('id', contactIds) : Promise.resolve({ data: [] }),
        dealIds.length ? supabase.from('deals').select('id, title').in('id', dealIds) : Promise.resolve({ data: [] }),
      ])
      const companyById = Object.fromEntries((companies || []).map((c) => [c.id, c.name]))
      const contactById = Object.fromEntries((contacts || []).map((c) => [c.id, c.name]))
      const dealById = Object.fromEntries((deals || []).map((d) => [d.id, d.title]))

      setTasks((rows || []).map((t) => ({
        ...t,
        entityType: t.company_id ? 'Company' : t.contact_id ? 'Contact' : 'Deal',
        entityId: t.company_id || t.contact_id || t.deal_id,
        entityName: t.company_id ? companyById[t.company_id] : t.contact_id ? contactById[t.contact_id] : dealById[t.deal_id],
      })))
    } catch (err) {
      setError(err.message)
    }
  }

  async function complete(task) {
    setTasks((prev) => prev.filter((t) => t.id !== task.id))
    const { error: err } = await supabase.from('tasks').update({ completed_at: new Date().toISOString() }).eq('id', task.id)
    if (err) {
      setError(err.message)
      load()
    }
  }

  const todayStr = new Date().toISOString().slice(0, 10)

  return (
    <div className={styles.tabPanel}>
      <div className={styles.panelToolbar}>
        <span className={styles.count}>{tasks === null ? '…' : `${tasks.length} open`}</span>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {tasks === null ? (
        <p className={styles.fieldHintSmall}>Loading…</p>
      ) : tasks.length === 0 ? (
        <div className={styles.emptyState}>No open tasks. Add one from a company, contact, or deal.</div>
      ) : (
        <ul className={styles.list} style={{ gap: 'var(--sp-2)' }}>
          {tasks.map((t) => {
            const overdue = t.due_date && t.due_date < todayStr
            return (
              <li key={t.id} className={styles.listRow}>
                <button type="button" className={styles.taskCheckBtn} onClick={() => complete(t)} aria-label={`Mark "${t.title}" done`}>
                  <Square size={16} aria-hidden="true" />
                </button>
                <div className={styles.taskBody}>
                  <span className={styles.taskTitle}>{t.title}</span>
                  <span className={styles.rowMeta}>
                    {t.entityType}:{' '}
                    {t.entityId ? (
                      <button type="button" className={styles.entityLinkBtn} onClick={() => onJump(t.entityType, t.entityId)}>
                        {t.entityName || 'unknown'}
                      </button>
                    ) : (
                      t.entityName || 'unknown'
                    )}
                    {t.due_date && (
                      <>
                        {' · '}
                        <span className={overdue ? styles.taskDueOverdue : styles.taskDue} style={{ display: 'inline-flex' }}>
                          <Calendar size={11} /> {new Date(`${t.due_date}T00:00:00`).toLocaleDateString()}
                        </span>
                      </>
                    )}
                  </span>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------
// Reports tab (Phase 4) — active pipeline value/counts by stage, plus
// won/lost/declined outcome rates. Outcome semantics come entirely from
// deal_stages.stage_type, tagged per-stage in the Stages tab — a stage
// literally named "Awarded" only counts as a win if it's tagged that way,
// since stage names are freely renameable per member.
// ---------------------------------------------------------------------
function ReportsTab() {
  const [deals, setDeals] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase
      .from('deals')
      .select('id, value_estimate, deal_stages(name, stage_type)')
      .then(({ data, error: err }) => {
        if (err) { setError(err.message); return }
        setDeals(data || [])
      })
  }, [])

  if (deals === null) return <div className="spinner" />
  if (error) return <div className="alert alert-error">{error}</div>

  const activeByStage = {}
  let wonCount = 0, lostCount = 0, declinedCount = 0
  for (const d of deals) {
    const stageType = d.deal_stages?.stage_type || 'active'
    const stageName = d.deal_stages?.name || 'No stage'
    if (stageType === 'won') wonCount += 1
    else if (stageType === 'lost') lostCount += 1
    else if (stageType === 'declined') declinedCount += 1
    else {
      if (!activeByStage[stageName]) activeByStage[stageName] = { count: 0, value: 0 }
      activeByStage[stageName].count += 1
      activeByStage[stageName].value += Number(d.value_estimate) || 0
    }
  }
  const activeRows = Object.entries(activeByStage).map(([name, v]) => ({ name, ...v }))
  const activeTotal = activeRows.reduce((sum, r) => sum + r.value, 0)
  const activeCount = activeRows.reduce((sum, r) => sum + r.count, 0)
  const closedTotal = wonCount + lostCount + declinedCount
  const pct = (n) => (closedTotal > 0 ? Math.round((n / closedTotal) * 100) : 0)

  return (
    <div className={styles.tabPanel}>
      <div className={styles.panelToolbar}>
        <p className={styles.count}>{deals.length} total {deals.length === 1 ? 'deal' : 'deals'}</p>
      </div>

      <div className={styles.formCard}>
        <h3 style={{ marginBottom: 'var(--sp-2)' }}>Active pipeline</h3>
        <p className={styles.fieldHintSmall}>{activeCount} open {activeCount === 1 ? 'deal' : 'deals'}, ${Math.round(activeTotal).toLocaleString()} total value estimate.</p>
        {activeRows.length === 0 ? (
          <p className={styles.emptyState}>No open deals right now.</p>
        ) : (
          <div className={styles.list} style={{ marginTop: 'var(--sp-3)' }}>
            {activeRows.map((r) => (
              <div key={r.name} className={styles.listRow} style={{ justifyContent: 'space-between' }}>
                <span className={styles.stageName}>{r.name}</span>
                <span className={styles.rowMeta}>{r.count} {r.count === 1 ? 'deal' : 'deals'} · ${Math.round(r.value).toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className={styles.formCard}>
        <h3 style={{ marginBottom: 'var(--sp-2)' }}>Outcomes</h3>
        {closedTotal === 0 ? (
          <p className={styles.emptyState}>No deals have reached a Won/Lost/Declined stage yet.</p>
        ) : (
          <div className={styles.list}>
            <div className={styles.listRow} style={{ justifyContent: 'space-between' }}>
              <span className="badge badge-green">Won</span>
              <span className={styles.rowMeta}>{wonCount} ({pct(wonCount)}%)</span>
            </div>
            <div className={styles.listRow} style={{ justifyContent: 'space-between' }}>
              <span className="badge badge-red">Lost</span>
              <span className={styles.rowMeta}>{lostCount} ({pct(lostCount)}%)</span>
            </div>
            <div className={styles.listRow} style={{ justifyContent: 'space-between' }}>
              <span className="badge badge-amber">Declined</span>
              <span className={styles.rowMeta}>{declinedCount} ({pct(declinedCount)}%)</span>
            </div>
          </div>
        )}
        <p className={styles.fieldHintSmall} style={{ marginTop: 'var(--sp-3)' }}>
          A stage only counts here once it's tagged Won, Lost, or Declined in Pipeline Stages — retag a stage there if this doesn't match what you expect.
        </p>
      </div>
    </div>
  )
}
