// src/lib/tier.js
// Single source of truth for membership-tier checks. Import this instead of
// re-writing `profile?.membership_tier === 'founding'` in every file —
// keeps Chat, Store, Profile, and the Founders Wall all in sync if the tier
// model ever changes.

export const TIERS = {
  FREE: 'free',
  MEMBER: 'member',
  PRO: 'pro',
  FOUNDING: 'founding',
}

// Admins get founder-equivalent access everywhere founder access is checked,
// matching the existing pattern already used in Chat.jsx.
export function isFoundingMember(profile, isAdmin = false) {
  return isAdmin || profile?.membership_tier === TIERS.FOUNDING
}

export function isPaidMember(profile) {
  return [TIERS.MEMBER, TIERS.PRO, TIERS.FOUNDING].includes(profile?.membership_tier)
}

export const TIER_LABELS = {
  [TIERS.FREE]: 'Free',
  [TIERS.MEMBER]: 'Lab Member',
  [TIERS.PRO]: 'Lab Pro',
  [TIERS.FOUNDING]: 'Founding Member',
}
