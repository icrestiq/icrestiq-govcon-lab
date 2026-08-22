import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'
import { User, Activity, FileText, MessageCircle, Heart, Pencil, X, Camera, Target, Plug } from 'lucide-react'
import ActivityHeatmap from '../components/ActivityHeatmap'
import FounderBadge from '../components/FounderBadge'
import Avatar from '../components/Avatar'
import TagInput from '../components/TagInput'
import { isFoundingMember, isMemberOrFounding } from '../lib/tier'
import { searchNaics, getNaicsTitle } from '../lib/naics'
import styles from './Profile.module.css'

// Matching preferences allow more codes than the Proposal Builder's NAICS
// selector (which caps at 5 for a single proposal) — a member's actual
// business can reasonably span more industries than any one proposal does.
const MAX_MATCHING_NAICS = 15
const MAX_PSC_CODES = 15
const MAX_AGENCY_TAGS = 10
const CAPABILITIES_MAX_LEN = 1000

const SET_ASIDE_OPTIONS = ['8(a)', 'HUBZone', 'WOSB', 'EDWOSB', 'VOSB', 'SDVOSB', 'SDB']

const MAX_AVATAR_MB = 2
const MAX_AVATAR_BYTES = MAX_AVATAR_MB * 1024 * 1024
const ACCEPTED_AVATAR_TYPES = ['image/png', 'image/jpeg', 'image/webp']

const USERNAME_PATTERN = /^[a-zA-Z0-9_-]+$/
const USERNAME_HELP = 'Letters, numbers, underscores, and dashes only — no spaces (e.g. john_atkinson or john-atkinson).'
const BIO_MAX_LEN = 600

export default function Profile() {
  const { user, profile, updateProfile, isAdmin } = useAuth()
  const notionEligible = isMemberOrFounding(profile, isAdmin)
  const [tab, setTab] = useState('overview')
  const [activityData, setActivityData] = useState({})
  const [stats, setStats] = useState({ posts: 0, comments: 0, likesReceived: 0 })
  const [loading, setLoading] = useState(true)

  // ── Edit profile ──
  const [isEditing, setIsEditing] = useState(false)
  const [form, setForm] = useState({ first_name: '', last_name: '', username: '', bio: '' })
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  // ── Avatar upload ──
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [avatarError, setAvatarError] = useState('')
  const avatarInputRef = useRef(null)

  // ── Matching preferences ──
  const [matchForm, setMatchForm] = useState({
    naics_codes: [],
    psc_codes: [],
    set_aside_certifications: [],
    matching_enabled: false,
    bid_criteria: {},
    capabilities_summary: '',
  })
  const [matchSaving, setMatchSaving] = useState(false)
  const [matchError, setMatchError] = useState('')
  const [matchSaved, setMatchSaved] = useState(false)
  // '' | 'pulling' | 'done' | 'error' — tracks the background SAM.gov pull
  // for newly-added codes, separate from the save itself so the save
  // button re-enables immediately rather than waiting on SAM.gov calls.
  const [pullStatus, setPullStatus] = useState('')

  // ── Notion connection ──
  const [notionStatus, setNotionStatus] = useState(null) // null while loading, then the /api/notion/status shape
  const [notionRedirectMsg, setNotionRedirectMsg] = useState('') // from ?notion= on landing back from the OAuth callback

  // ── Notion database picker (shown once connected but no database chosen yet) ──
  const [notionDatabases, setNotionDatabases] = useState(null) // null = not loaded yet, [] = loaded, empty
  const [notionTotalShared, setNotionTotalShared] = useState(0) // how many databases were shared during consent, before the template-schema filter
  const [notionDbError, setNotionDbError] = useState('')
  const [notionDbSelected, setNotionDbSelected] = useState('')
  const [notionDbSaving, setNotionDbSaving] = useState(false)

  // Picks up ?notion=connected|denied|invalid_state|error left by
  // api/notion/oauth-callback.js, shows it once, then strips the query
  // param so a page refresh doesn't re-show a stale result.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const notionParam = params.get('notion')
    if (!notionParam) return

    setNotionRedirectMsg(notionParam)
    setTab('notion')
    params.delete('notion')
    const rest = params.toString()
    window.history.replaceState({}, '', rest ? `/profile?${rest}` : '/profile')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (tab === 'notion' && user) loadNotionStatus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, user])

  // Only worth listing databases once we know the connection is active and
  // no database has been picked yet — avoids an extra Notion API call on
  // every tab visit once a customer has already finished this step.
  useEffect(() => {
    if (notionStatus?.connected && !notionStatus?.hasOpportunitiesDatabase) loadNotionDatabases()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notionStatus?.connected, notionStatus?.hasOpportunitiesDatabase])

  async function loadNotionStatus() {
    try {
      const res = await fetch(`/api/notion/status?userId=${user.id}`)
      const data = await res.json()
      setNotionStatus(data)
    } catch (err) {
      console.error('Notion status fetch error:', err)
      setNotionStatus({ connected: false })
    }
  }

  async function loadNotionDatabases() {
    setNotionDbError('')
    try {
      const res = await fetch(`/api/notion/databases?userId=${user.id}`)
      const data = await res.json()
      if (!res.ok) {
        if (data.revoked) { setNotionStatus({ connected: false, status: 'revoked' }); return }
        throw new Error(data.error || 'Could not load your Notion databases.')
      }
      setNotionDatabases(data.databases)
      setNotionTotalShared(data.totalShared || 0)
    } catch (err) {
      console.error('Notion databases fetch error:', err)
      setNotionDbError(err.message || 'Could not load your Notion databases.')
      setNotionDatabases([])
    }
  }

  async function saveNotionDatabase() {
    if (!notionDbSelected) return
    setNotionDbSaving(true)
    setNotionDbError('')
    try {
      const res = await fetch('/api/notion/select-database', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, databaseId: notionDbSelected }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.revoked) { setNotionStatus({ connected: false, status: 'revoked' }); return }
        throw new Error(data.error || 'Could not save your database selection.')
      }
      await loadNotionStatus()
    } catch (err) {
      console.error('Notion select-database error:', err)
      setNotionDbError(err.message || 'Could not save your database selection.')
    } finally {
      setNotionDbSaving(false)
    }
  }

  // Seeds the form once the profile first loads. Keyed on id (not the
  // whole profile object) so a later profile update from saving here
  // doesn't clobber further in-progress edits with what was just written.
  useEffect(() => {
    if (!profile) return
    setMatchForm({
      naics_codes: profile.naics_codes || [],
      psc_codes: profile.psc_codes || [],
      set_aside_certifications: profile.set_aside_certifications || [],
      matching_enabled: profile.matching_enabled || false,
      bid_criteria: profile.bid_criteria || {},
      capabilities_summary: profile.capabilities_summary || '',
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id])

  function setCriteria(patch) {
    setMatchForm((f) => ({ ...f, bid_criteria: { ...f.bid_criteria, ...patch } }))
  }

  // Pulls fresh SAM.gov results for just the codes that are new this save
  // (not the member's whole list — they can register up to 15+15 codes,
  // and each SAM.gov call needs ~2s spacing, so a full re-pull on every
  // save would be too slow to run inline here). Runs in the background,
  // separate from the save's own loading state, and refreshes this
  // member's matches once the pull completes. The daily cron still covers
  // every registered code regardless, so a failure here is non-critical —
  // it just means waiting for tomorrow's automatic pull instead of seeing
  // fresh matches immediately.
  async function pullNewCodesInBackground(newNaicsCodes, newPscCodes) {
    setPullStatus('pulling')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const authHeaders = {
        'Content-Type': 'application/json',
        ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
      }

      const pullRes = await fetch('https://zohrpargudmogfywciik.supabase.co/functions/v1/sam_gov_pull_codes', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ profileId: profile.id, naicsCodes: newNaicsCodes, pscCodes: newPscCodes }),
      })
      if (!pullRes.ok) throw new Error(`Pull failed with status ${pullRes.status}`)

      await fetch('https://zohrpargudmogfywciik.supabase.co/functions/v1/match_opportunities', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ profileId: profile.id }),
      })

      setPullStatus('done')
    } catch (err) {
      console.error('Background opportunity pull error:', err)
      setPullStatus('error')
    }
  }

  async function saveMatchingPreferences() {
    setMatchError('')
    setMatchSaved(false)
    setPullStatus('')
    setMatchSaving(true)

    const priorNaics = profile?.naics_codes || []
    const priorPsc = profile?.psc_codes || []
    const newNaicsCodes = matchForm.naics_codes.filter((c) => !priorNaics.includes(c))
    const newPscCodes = matchForm.psc_codes.filter((c) => !priorPsc.includes(c))

    try {
      await updateProfile({
        naics_codes: matchForm.naics_codes,
        psc_codes: matchForm.psc_codes,
        set_aside_certifications: matchForm.set_aside_certifications,
        matching_enabled: matchForm.matching_enabled,
        bid_criteria: matchForm.bid_criteria,
        capabilities_summary: matchForm.capabilities_summary.trim().slice(0, CAPABILITIES_MAX_LEN),
      })
      setMatchSaved(true)

      if (matchForm.matching_enabled && (newNaicsCodes.length > 0 || newPscCodes.length > 0)) {
        pullNewCodesInBackground(newNaicsCodes, newPscCodes)
      }
    } catch (err) {
      console.error('Matching preferences save error:', err)
      setMatchError('Could not save your matching preferences. Please try again.')
    } finally {
      setMatchSaving(false)
    }
  }

  function startEditing() {
    setForm({
      first_name: profile?.first_name || '',
      last_name: profile?.last_name || '',
      username: profile?.username || '',
      bio: profile?.bio || '',
    })
    setSaveError('')
    setIsEditing(true)
  }

  function cancelEditing() {
    setIsEditing(false)
    setSaveError('')
  }

  async function saveProfile(e) {
    e.preventDefault()
    setSaveError('')

    const username = form.username.trim()
    if (!username) {
      setSaveError('Username is required.')
      return
    }
    if (!USERNAME_PATTERN.test(username)) {
      setSaveError(`Username can only contain letters, numbers, underscores, and dashes. ${USERNAME_HELP}`)
      return
    }

    const bio = form.bio.trim().slice(0, BIO_MAX_LEN)

    setSaving(true)
    try {
      await updateProfile({
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        username,
        bio,
      })
      setIsEditing(false)
    } catch (err) {
      console.error('Profile update error:', err)
      if (err?.code === '23505' || /duplicate key|unique/i.test(err?.message || '')) {
        setSaveError('That username is already taken. Please choose another.')
      } else if (err?.code === '23514' || /check constraint|violates/i.test(err?.message || '')) {
        if (/bio_length/i.test(err?.message || '')) {
          setSaveError(`Your bio is too long. Please keep it under ${BIO_MAX_LEN} characters.`)
        } else if (/username_format/i.test(err?.message || '')) {
          setSaveError(`Username can only contain letters, numbers, underscores, and dashes. ${USERNAME_HELP}`)
        } else {
          setSaveError('One of your changes doesn\'t meet the site\'s requirements. Please check your entries and try again.')
        }
      } else {
        setSaveError('Could not save your changes. Please try again.')
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleAvatarFile(file) {
    setAvatarError('')
    if (!file || !user) return

    if (!ACCEPTED_AVATAR_TYPES.includes(file.type)) {
      setAvatarError('Please upload a PNG, JPG, or WEBP file.')
      return
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setAvatarError(`File is too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum size is ${MAX_AVATAR_MB}MB.`)
      return
    }

    setAvatarUploading(true)
    try {
      const ext = file.name.split('.').pop()
      const path = `${user.id}/avatar.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true, cacheControl: '3600' })
      if (uploadError) throw uploadError

      const { data } = supabase.storage.from('avatars').getPublicUrl(path)
      // cache-bust so a re-upload with the same filename shows immediately
      const avatarUrl = `${data.publicUrl}?t=${Date.now()}`
      await updateProfile({ avatar_url: avatarUrl })
    } catch (err) {
      console.error('Avatar upload error:', err)
      setAvatarError('Upload failed. Please try again.')
    } finally {
      setAvatarUploading(false)
    }
  }

  useEffect(() => {
    if (tab === 'activity' && user) loadActivity()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, user])

  async function loadActivity() {
    setLoading(true)
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setDate(sixMonthsAgo.getDate() - 182)

    const { data } = await supabase
      .from('activity_log')
      .select('activity_type, created_at')
      .eq('user_id', user.id)
      .gte('created_at', sixMonthsAgo.toISOString())

    if (data) {
      const grouped = {}
      let posts = 0, comments = 0, likesReceived = 0
      data.forEach(row => {
        const day = row.created_at.slice(0, 10)
        grouped[day] = (grouped[day] || 0) + 1
        if (row.activity_type === 'post') posts++
        if (row.activity_type === 'comment') comments++
        if (row.activity_type === 'like_received') likesReceived++
      })
      setActivityData(grouped)
      setStats({ posts, comments, likesReceived })
    }
    setLoading(false)
  }

  const displayName = profile?.first_name
    ? `${profile.first_name} ${profile.last_name || ''}`.trim()
    : profile?.username || 'Member'

  const joinedDate = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : null

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.avatarWrap}>
          <Avatar
            avatarUrl={profile?.avatar_url}
            firstName={profile?.first_name}
            lastName={profile?.last_name}
            username={profile?.username}
            size={64}
            fontSize="1.25rem"
          />
          <button
            type="button"
            className={styles.avatarEditBtn}
            onClick={() => avatarInputRef.current?.click()}
            disabled={avatarUploading}
            title="Change photo"
          >
            <Camera size={13} />
          </button>
          <input
            ref={avatarInputRef}
            type="file"
            accept={ACCEPTED_AVATAR_TYPES.join(',')}
            style={{ display: 'none' }}
            onChange={(e) => handleAvatarFile(e.target.files?.[0])}
          />
        </div>
        <div className={styles.headerInfo}>
          <h1 className={styles.name}>{displayName}</h1>
          <p className={styles.username}>@{profile?.username || 'member'}</p>
          <div className={styles.badges}>
            {isFoundingMember(profile) ? (
              <FounderBadge tier="founding" size="lg" />
            ) : (
              <span className="badge badge-navy">{profile?.membership_tier || 'free'}</span>
            )}
            {joinedDate && <span className={styles.joined}>Member since {joinedDate}</span>}
          </div>
          {avatarUploading && <p className={styles.avatarStatus}>Uploading photo…</p>}
          {!avatarUploading && avatarError && (
            <p className={styles.avatarStatus} style={{ color: 'var(--red)' }}>{avatarError}</p>
          )}
          {!avatarUploading && !avatarError && (
            <p className={styles.avatarStatus}>Photo: PNG, JPG, or WEBP · max 2MB</p>
          )}
        </div>
        {!isEditing && (
          <button type="button" className="btn btn-ghost" onClick={startEditing} style={{ marginLeft: 'auto' }}>
            <Pencil size={14} /> Edit Profile
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${tab === 'overview' ? styles.tabActive : ''}`}
          onClick={() => setTab('overview')}
        >
          <User size={15} /> Overview
        </button>
        <button
          className={`${styles.tab} ${tab === 'activity' ? styles.tabActive : ''}`}
          onClick={() => setTab('activity')}
        >
          <Activity size={15} /> Activity
        </button>
        <button
          className={`${styles.tab} ${tab === 'matching' ? styles.tabActive : ''}`}
          onClick={() => setTab('matching')}
        >
          <Target size={15} /> Matching Preferences
        </button>
        {notionEligible && (
          <button
            className={`${styles.tab} ${tab === 'notion' ? styles.tabActive : ''}`}
            onClick={() => setTab('notion')}
          >
            <Plug size={15} /> Notion Sync
          </button>
        )}
      </div>

      {tab === 'overview' && (
        <div className={styles.card}>
          {isEditing ? (
            <form onSubmit={saveProfile}>
              <div className={styles.editHeader}>
                <h3 className={styles.cardTitle}>Edit Profile</h3>
                <button type="button" className="btn btn-ghost" onClick={cancelEditing} disabled={saving}>
                  <X size={14} /> Cancel
                </button>
              </div>

              {saveError && <div className="alert alert-error" style={{ marginBottom: 'var(--sp-4)' }}>{saveError}</div>}

              <div className={styles.editRow}>
                <div>
                  <label className="label" htmlFor="first_name">First Name</label>
                  <input
                    id="first_name"
                    className="input"
                    value={form.first_name}
                    onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="label" htmlFor="last_name">Last Name</label>
                  <input
                    id="last_name"
                    className="input"
                    value={form.last_name}
                    onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))}
                  />
                </div>
              </div>

              <div style={{ marginTop: 'var(--sp-4)' }}>
                <label className="label" htmlFor="username">Username</label>
                <input
                  id="username"
                  className="input"
                  value={form.username}
                  onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                  pattern="[a-zA-Z0-9_-]+"
                  title="Letters, numbers, underscores, and dashes only — no spaces."
                  required
                />
                <p className={styles.fieldHint}>{USERNAME_HELP}</p>
              </div>

              <div style={{ marginTop: 'var(--sp-4)' }}>
                <label className="label" htmlFor="bio">Bio</label>
                <textarea
                  id="bio"
                  className="input"
                  rows={4}
                  maxLength={BIO_MAX_LEN}
                  placeholder="Tell the community a bit about yourself and your company."
                  value={form.bio}
                  onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value.slice(0, BIO_MAX_LEN) }))}
                />
                <p className={styles.fieldHint}>
                  {form.bio.length}/{BIO_MAX_LEN} characters
                </p>
              </div>

              <div style={{ marginTop: 'var(--sp-5)', display: 'flex', gap: 'var(--sp-3)' }}>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
                <button type="button" className="btn btn-ghost" onClick={cancelEditing} disabled={saving}>
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <>
              <h3 className={styles.cardTitle}>About</h3>
              <p className={styles.bio}>{profile?.bio || 'No bio added yet.'}</p>
            </>
          )}
        </div>
      )}

      {tab === 'activity' && (
        <div>
          <div className={styles.statsRow}>
            <div className={styles.statCard}>
              <FileText size={18} style={{ color: 'var(--navy)' }} />
              <div>
                <div className={styles.statValue}>{stats.posts}</div>
                <div className={styles.statLabel}>Posts</div>
              </div>
            </div>
            <div className={styles.statCard}>
              <MessageCircle size={18} style={{ color: '#4F6BED' }} />
              <div>
                <div className={styles.statValue}>{stats.comments}</div>
                <div className={styles.statLabel}>Comments</div>
              </div>
            </div>
            <div className={styles.statCard}>
              <Heart size={18} style={{ color: '#E0245E' }} />
              <div>
                <div className={styles.statValue}>{stats.likesReceived}</div>
                <div className={styles.statLabel}>Likes Received</div>
              </div>
            </div>
          </div>

          <div className={styles.card}>
            <h3 className={styles.cardTitle}>Activity, last 6 months</h3>
            {loading ? (
              <div className="spinner" />
            ) : (
              <ActivityHeatmap data={activityData} weeks={26} />
            )}
          </div>
        </div>
      )}

      {tab === 'matching' && (
        <div className={styles.card}>
          <h3 className={styles.cardTitle}>Opportunity Matching</h3>
          <p className={styles.bio} style={{ marginBottom: 'var(--sp-5)' }}>
            Set your NAICS/PSC codes and certifications so we can match you against new SAM.gov
            opportunities. Pro and Founding members see matches under "Matched Opportunities" in the nav.
          </p>

          {matchError && <div className="alert alert-error" style={{ marginBottom: 'var(--sp-4)' }}>{matchError}</div>}
          {matchSaved && <div className="alert" style={{ marginBottom: 'var(--sp-4)', background: 'rgba(72,187,120,0.08)', borderColor: '#48BB78', color: '#276749' }}>Matching preferences saved.</div>}
          {pullStatus === 'pulling' && <p className={styles.fieldHint} style={{ marginBottom: 'var(--sp-4)' }}>Fetching current opportunities for your new codes — check "Matched Opportunities" in a minute.</p>}
          {pullStatus === 'done' && <p className={styles.fieldHint} style={{ marginBottom: 'var(--sp-4)' }}>New opportunities fetched — check "Matched Opportunities" for fresh matches.</p>}
          {pullStatus === 'error' && <p className={styles.fieldHint} style={{ marginBottom: 'var(--sp-4)' }}>Couldn't fetch new opportunities right now — they'll still show up after tomorrow's automatic pull.</p>}

          <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', marginBottom: 'var(--sp-5)', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={matchForm.matching_enabled}
              onChange={(e) => setMatchForm((f) => ({ ...f, matching_enabled: e.target.checked }))}
            />
            <span style={{ fontWeight: 600, color: 'var(--navy)' }}>Enable opportunity matching</span>
          </label>

          <div style={{ marginBottom: 'var(--sp-5)' }}>
            <label className="label">NAICS Codes (up to {MAX_MATCHING_NAICS}, searched and selected)</label>
            <NaicsMultiSelect
              selected={matchForm.naics_codes}
              onChange={(codes) => setMatchForm((f) => ({ ...f, naics_codes: codes }))}
            />
          </div>

          <div style={{ marginBottom: 'var(--sp-5)' }}>
            <label className="label">PSC Codes</label>
            <TagInput
              value={matchForm.psc_codes}
              onChange={(codes) => setMatchForm((f) => ({ ...f, psc_codes: codes }))}
              placeholder="Type a PSC code and press Enter (e.g. R425)"
              transform={(s) => s.trim().toUpperCase()}
              maxItems={MAX_PSC_CODES}
            />
          </div>

          <div style={{ marginBottom: 'var(--sp-6)' }}>
            <label className="label">Set-Aside Certifications</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-3)', marginTop: 'var(--sp-2)' }}>
              {SET_ASIDE_OPTIONS.map((cert) => (
                <label key={cert} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.875rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={matchForm.set_aside_certifications.includes(cert)}
                    onChange={(e) => {
                      setMatchForm((f) => ({
                        ...f,
                        set_aside_certifications: e.target.checked
                          ? [...f.set_aside_certifications, cert]
                          : f.set_aside_certifications.filter((c) => c !== cert),
                      }))
                    }}
                  />
                  {cert}
                </label>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 'var(--sp-6)' }}>
            <label className="label" htmlFor="capabilities_summary">Capabilities / Past Performance Summary</label>
            <textarea
              id="capabilities_summary"
              className="input"
              rows={4}
              maxLength={CAPABILITIES_MAX_LEN}
              placeholder="Briefly describe your company's core capabilities and relevant past performance. Used by AI matching to judge fit when you haven't set explicit bid criteria."
              value={matchForm.capabilities_summary}
              onChange={(e) => setMatchForm((f) => ({ ...f, capabilities_summary: e.target.value.slice(0, CAPABILITIES_MAX_LEN) }))}
            />
            <p className={styles.fieldHint}>{matchForm.capabilities_summary.length}/{CAPABILITIES_MAX_LEN} characters</p>
          </div>

          <h3 className={styles.cardTitle}>Bid Criteria (optional)</h3>
          <p className={styles.fieldHint} style={{ marginBottom: 'var(--sp-4)' }}>
            Set your own go/no-go rules below and matches will be scored against them automatically.
            Leave this section blank and we'll use AI judgment instead once that's live.
          </p>

          <div className={styles.editRow} style={{ marginBottom: 'var(--sp-4)' }}>
            <div>
              <label className="label" htmlFor="min_value">Minimum Contract Value ($)</label>
              <input
                id="min_value"
                type="number"
                min="0"
                className="input"
                value={matchForm.bid_criteria.min_value ?? ''}
                onChange={(e) => setCriteria({ min_value: e.target.value === '' ? null : Number(e.target.value) })}
              />
            </div>
            <div>
              <label className="label" htmlFor="max_value">Maximum Contract Value ($)</label>
              <input
                id="max_value"
                type="number"
                min="0"
                className="input"
                value={matchForm.bid_criteria.max_value ?? ''}
                onChange={(e) => setCriteria({ max_value: e.target.value === '' ? null : Number(e.target.value) })}
              />
            </div>
          </div>

          <div style={{ marginBottom: 'var(--sp-4)' }}>
            <label className="label" htmlFor="min_deadline_days">Minimum Days Left to Respond</label>
            <input
              id="min_deadline_days"
              type="number"
              min="0"
              className="input"
              style={{ maxWidth: 200 }}
              value={matchForm.bid_criteria.min_deadline_days ?? ''}
              onChange={(e) => setCriteria({ min_deadline_days: e.target.value === '' ? null : Number(e.target.value) })}
            />
            <p className={styles.fieldHint}>Opportunities closing sooner than this will be flagged no-go.</p>
          </div>

          <div className={styles.editRow} style={{ marginBottom: 'var(--sp-4)' }}>
            <div>
              <label className="label">Preferred Agencies</label>
              <TagInput
                value={matchForm.bid_criteria.agency_allow || []}
                onChange={(list) => setCriteria({ agency_allow: list })}
                placeholder="Type an agency name and press Enter"
                maxItems={MAX_AGENCY_TAGS}
              />
              <p className={styles.fieldHint}>If set, only these agencies will pass.</p>
            </div>
            <div>
              <label className="label">Excluded Agencies</label>
              <TagInput
                value={matchForm.bid_criteria.agency_deny || []}
                onChange={(list) => setCriteria({ agency_deny: list })}
                placeholder="Type an agency name and press Enter"
                maxItems={MAX_AGENCY_TAGS}
              />
            </div>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', marginBottom: 'var(--sp-5)', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={!!matchForm.bid_criteria.require_set_aside_match}
              onChange={(e) => setCriteria({ require_set_aside_match: e.target.checked })}
            />
            Only go on opportunities matching one of my set-aside certifications
          </label>

          <button type="button" className="btn btn-primary" onClick={saveMatchingPreferences} disabled={matchSaving}>
            {matchSaving ? 'Saving…' : 'Save Matching Preferences'}
          </button>
        </div>
      )}

      {tab === 'notion' && notionEligible && (
        <div className={styles.card}>
          <h3 className={styles.cardTitle}>Notion Sync</h3>
          <p className={styles.bio} style={{ marginBottom: 'var(--sp-5)' }}>
            Connect your GovCon Command Center Notion workspace to have Sourcing Research results
            and matched opportunities synced straight into it.
          </p>

          {notionRedirectMsg === 'connected' && (
            <div className="alert" style={{ marginBottom: 'var(--sp-4)', background: 'rgba(72,187,120,0.08)', borderColor: '#48BB78', color: '#276749' }}>
              Notion connected.
            </div>
          )}
          {notionRedirectMsg === 'denied' && (
            <div className="alert alert-error" style={{ marginBottom: 'var(--sp-4)' }}>
              Notion connection was cancelled. No changes were made.
            </div>
          )}
          {(notionRedirectMsg === 'invalid_state' || notionRedirectMsg === 'error') && (
            <div className="alert alert-error" style={{ marginBottom: 'var(--sp-4)' }}>
              Something went wrong connecting Notion. Please try again.
            </div>
          )}

          {notionStatus === null ? (
            <div className="spinner" />
          ) : notionStatus.connected ? (
            <>
              <p className={styles.bio} style={{ marginBottom: 'var(--sp-4)' }}>
                Connected to <strong>{notionStatus.workspaceName || 'your Notion workspace'}</strong>.
              </p>
              {!notionStatus.hasOpportunitiesDatabase && (
                <div style={{ marginBottom: 'var(--sp-5)' }}>
                  <label className="label">Which database is your Opportunities database?</label>
                  {notionDbError && <div className="alert alert-error" style={{ margin: 'var(--sp-2) 0' }}>{notionDbError}</div>}
                  {notionDatabases === null ? (
                    <p className={styles.fieldHint}>Loading your Notion databases…</p>
                  ) : notionDbError ? null : notionDatabases.length === 0 ? (
                    <p className={styles.fieldHint}>
                      {notionTotalShared === 0 ? (
                        'No databases shared. Make sure you select your Opportunities database when approving access in Notion, then reconnect.'
                      ) : (
                        "None of your shared databases match the GovCon Command Center template. Make sure you've duplicated the template into your workspace (not a different database), share that one during reconnect, and pick it here."
                      )}
                    </p>
                  ) : (
                    <div style={{ display: 'flex', gap: 'var(--sp-3)', alignItems: 'center', flexWrap: 'wrap', marginTop: 'var(--sp-2)' }}>
                      <select
                        className="input"
                        style={{ maxWidth: 320 }}
                        value={notionDbSelected}
                        onChange={(e) => setNotionDbSelected(e.target.value)}
                      >
                        <option value="">Select a database…</option>
                        {notionDatabases.map((db) => (
                          <option key={db.id} value={db.id}>{db.title}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="btn btn-primary"
                        disabled={!notionDbSelected || notionDbSaving}
                        onClick={saveNotionDatabase}
                      >
                        {notionDbSaving ? 'Saving…' : 'Save'}
                      </button>
                    </div>
                  )}
                </div>
              )}
              <a className="btn btn-ghost" href={`/api/notion/authorize?userId=${user.id}`}>
                Reconnect Notion
              </a>
            </>
          ) : (
            <>
              {notionStatus.status === 'revoked' && (
                <p className={styles.fieldHint} style={{ marginBottom: 'var(--sp-4)' }}>
                  Your previous connection was disconnected or revoked. Reconnect to resume syncing.
                </p>
              )}
              <a className="btn btn-primary" href={`/api/notion/authorize?userId=${user.id}`}>
                Connect Notion
              </a>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------
// NAICS multi-select for matching preferences — same searchable-chip
// pattern as the Proposal Builder's selector (src/pages/ProposalBuilder.jsx)
// but with its own selection cap, since a member's real NAICS footprint
// can span more industries than any single proposal declares.
// ---------------------------------------------------------------------
function NaicsMultiSelect({ selected, onChange }) {
  const [query, setQuery] = useState('')
  const results = query.trim() ? searchNaics(query) : []
  const atLimit = selected.length >= MAX_MATCHING_NAICS

  function addCode(code) {
    if (atLimit || selected.includes(code)) return
    onChange([...selected, code])
    setQuery('')
  }

  function removeCode(code) {
    onChange(selected.filter((c) => c !== code))
  }

  return (
    <div>
      {selected.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
          {selected.map((code) => (
            <span key={code} className="badge badge-navy" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <strong>{code}</strong> — {getNaicsTitle(code)}
              <button
                type="button"
                onClick={() => removeCode(code)}
                aria-label={`Remove ${code}`}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontSize: 13, lineHeight: 1, padding: 0 }}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      {atLimit ? (
        <p className="fieldHint" style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
          Maximum of {MAX_MATCHING_NAICS} codes selected. Remove one to add another.
        </p>
      ) : (
        <>
          <input
            className="input"
            placeholder="Search by code (e.g. 541511) or keyword (e.g. software)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {results.length > 0 && (
            <div style={{ border: '1px solid var(--border)', borderRadius: 4, marginTop: 4, maxHeight: 220, overflowY: 'auto' }}>
              {results.map((r) => (
                <div
                  key={r.code}
                  onClick={() => addCode(r.code)}
                  style={{ padding: '8px 10px', cursor: 'pointer', borderBottom: '1px solid var(--border)', fontSize: 13 }}
                >
                  <strong>{r.code}</strong> — {r.title}
                </div>
              ))}
            </div>
          )}
          {query.trim() && results.length === 0 && (
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>No matching NAICS code found.</p>
          )}
        </>
      )}
    </div>
  )
}
