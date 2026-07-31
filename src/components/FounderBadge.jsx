// src/components/FounderBadge.jsx
// Small gold tag marking a Founding Member. Used next to usernames in chat,
// on Profile, and on the Founders Wall — one component so all three stay
// visually consistent.

import { Crown } from 'lucide-react'
import styles from './FounderBadge.module.css'

// `tier` accepts either a membership_tier string ('founding') or a boolean,
// so callers that already computed isFoundingMember(profile) can pass that
// straight through instead of the raw tier string.
export default function FounderBadge({ tier, size = 'sm' }) {
  const isFounding = tier === 'founding' || tier === true
  if (!isFounding) return null

  return (
    <span className={`${styles.badge} ${size === 'lg' ? styles.lg : ''}`} title="Founding Member">
      <Crown size={size === 'lg' ? 13 : 11} />
      Founding
    </span>
  )
}
