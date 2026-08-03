import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import styles from './FoundingSpotsCounter.module.css'

const TOTAL_SPOTS = 25

// Returns { claimed, loading } — claimed is null while loading, and stays
// null (never a guessed number) if the query fails.
function useFoundingSpotsClaimed() {
  const [claimed, setClaimed] = useState(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { count, error } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('membership_tier', 'founding')
      if (!cancelled && !error && typeof count === 'number') {
        setClaimed(count)
      }
    })()
    return () => { cancelled = true }
  }, [])

  return claimed
}

export function useFoundingSpotsRemaining() {
  const claimed = useFoundingSpotsClaimed()
  if (claimed === null) return null
  return Math.max(0, TOTAL_SPOTS - claimed)
}

export default function FoundingSpotsCounter() {
  const claimed = useFoundingSpotsClaimed()

  if (claimed === null) return null

  const pct = Math.min(100, (claimed / TOTAL_SPOTS) * 100)

  return (
    <div className={styles.wrap}>
      <div className={styles.track}>
        <div className={styles.fill} style={{ width: `${pct}%` }} />
      </div>
      <div className={styles.label}>
        {claimed === 0
          ? `${TOTAL_SPOTS} founding spots available`
          : `${claimed} of ${TOTAL_SPOTS} founding spots claimed`}
      </div>
    </div>
  )
}
