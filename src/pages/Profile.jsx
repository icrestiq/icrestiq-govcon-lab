import { useState, useEffect } from 'react'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'
import { User, Activity, FileText, MessageCircle, Heart } from 'lucide-react'
import ActivityHeatmap from '../components/ActivityHeatmap'
import styles from './Profile.module.css'

export default function Profile() {
  const { user, profile } = useAuth()
  const [tab, setTab] = useState('overview')
  const [activityData, setActivityData] = useState({})
  const [stats, setStats] = useState({ posts: 0, comments: 0, likesReceived: 0 })
  const [loading, setLoading] = useState(true)

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

  const initials = profile?.first_name && profile?.last_name
    ? (profile.first_name[0] + profile.last_name[0]).toUpperCase()
    : (profile?.username || 'M').slice(0, 2).toUpperCase()

  const joinedDate = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : null

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className="avatar" style={{ width: 64, height: 64, fontSize: '1.25rem' }}>{initials}</div>
        <div>
          <h1 className={styles.name}>{displayName}</h1>
          <p className={styles.username}>@{profile?.username || 'member'}</p>
          <div className={styles.badges}>
            <span className="badge badge-navy">{profile?.membership_tier || 'free'}</span>
            {joinedDate && <span className={styles.joined}>Member since {joinedDate}</span>}
          </div>
        </div>
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
          <h3 className={styles.cardTitle}>About</h3>
          <p className={styles.bio}>{profile?.bio || 'No bio added yet.'}</p>
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
