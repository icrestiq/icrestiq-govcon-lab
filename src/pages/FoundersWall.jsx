import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Crown } from 'lucide-react'
import FounderBadge from '../components/FounderBadge'
import styles from './FoundersWall.module.css'

const WALL_SIZE = 25

export default function FoundersWall() {
  const [founders, setFounders] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadFounders()
  }, [])

  async function loadFounders() {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('id, username, first_name, last_name, created_at')
        .eq('membership_tier', 'founding')
        .order('created_at', { ascending: true })
        .limit(WALL_SIZE)
      setFounders(data || [])
    } catch (err) {
      console.error('Failed to load founders:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.iconWrap}>
          <Crown size={22} />
        </div>
        <h1 className={styles.title}>Founding Members</h1>
        <p className={styles.sub}>
          The first {WALL_SIZE} to back GovCon Lab before launch — full store access,
          the private Founding Members room, and a permanent spot on this wall.
        </p>
      </div>

      {loading && <p className={styles.empty}>Loading...</p>}

      {!loading && founders.length === 0 && (
        <p className={styles.empty}>
          No Founding Members yet — be the first on the wall.
        </p>
      )}

      {!loading && founders.length > 0 && (
        <div className={styles.grid}>
          {founders.map((founder, i) => {
            const displayName = founder.first_name
              ? `${founder.first_name} ${founder.last_name || ''}`.trim()
              : founder.username || 'Member'
            const initials = founder.first_name && founder.last_name
              ? (founder.first_name[0] + founder.last_name[0]).toUpperCase()
              : (founder.username || 'M').slice(0, 2).toUpperCase()

            return (
              <div key={founder.id} className={styles.card}>
                <span className={styles.rank}>#{i + 1}</span>
                <div className="avatar" style={{ width: 48, height: 48, fontSize: '1rem' }}>
                  {initials}
                </div>
                <div className={styles.name}>{displayName}</div>
                {founder.username && <div className={styles.username}>@{founder.username}</div>}
                <FounderBadge tier="founding" />
              </div>
            )
          })}
        </div>
      )}

      {!loading && founders.length >= WALL_SIZE && (
        <p className={styles.note}>The Founding Members wall is full — thank you to everyone on it.</p>
      )}
    </div>
  )
}
