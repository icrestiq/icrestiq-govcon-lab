import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'
import { User, Activity, FileText, MessageCircle, Heart, Pencil, X, Camera } from 'lucide-react'
import ActivityHeatmap from '../components/ActivityHeatmap'
import FounderBadge from '../components/FounderBadge'
import Avatar from '../components/Avatar'
import { isFoundingMember } from '../lib/tier'
import styles from './Profile.module.css'

const MAX_AVATAR_MB = 2
const MAX_AVATAR_BYTES = MAX_AVATAR_MB * 1024 * 1024
const ACCEPTED_AVATAR_TYPES = ['image/png', 'image/jpeg', 'image/webp']

const USERNAME_PATTERN = /^[a-zA-Z0-9_-]+$/
const USERNAME_HELP = 'Letters, numbers, underscores, and dashes only — no spaces (e.g. john_atkinson or john-atkinson).'
const BIO_MAX_LEN = 600

export default function Profile() {
  const { user, profile, updateProfile } = useAuth()
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
    </div>
  )
}
