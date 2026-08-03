import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import styles from './MemberCount.module.css'

// A small real number reads worse than no number. Nothing renders below this,
// regardless of the true count. Raise or lower as the real membership grows.
const DISPLAY_THRESHOLD = 50

export default function MemberCount() {
  const [count, setCount] = useState(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { count: total, error } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
      if (!cancelled && !error && typeof total === 'number') {
        setCount(total)
      }
    })()
    return () => { cancelled = true }
  }, [])

  if (count === null || count < DISPLAY_THRESHOLD) return null

  return (
    <div className={styles.memberCount}>
      <span className="online-dot" />
      <span>{count.toLocaleString()} members and counting</span>
    </div>
  )
}
