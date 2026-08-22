// api/notion/authorize.js
// Starts the Notion OAuth connect flow: mints a signed state tying the
// callback back to this profile, then redirects to Notion's own consent
// screen. The frontend never needs the client secret — it just links here.
//
// Notion Sync is a paid-tier feature — the Profile.jsx tab is already
// hidden for Free members, but that's UI convenience only. This is the
// real gate: a direct request here with someone else's userId still gets
// rejected server-side, same principle as suggested-bid-checkout.js
// re-verifying tier itself rather than trusting the caller.

import { createClient } from '@supabase/supabase-js'
import { createState } from '../_lib/notion-state.js'

// Mirrors isMemberOrFounding() in src/lib/tier.js — kept in sync manually
// since this file runs server-side and can't import frontend source.
const ELIGIBLE_TIERS = ['member', 'pro', 'founding']

// Must exactly match a Redirect URI registered on the Notion connection —
// Notion rejects any mismatch, including a www vs. apex-domain difference.
// Deliberately not derived from SITE_URL (which defaults to the www host)
// for that reason.
const NOTION_REDIRECT_URI = 'https://govconlab.com/api/notion/oauth-callback'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const { userId } = req.query
  if (!userId) return res.status(400).json({ error: 'Missing userId' })

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('membership_tier, role')
    .eq('id', userId)
    .single()
  if (profileError || !profile) return res.status(404).json({ error: 'Profile not found' })

  const eligible = profile.role === 'admin' || ELIGIBLE_TIERS.includes(profile.membership_tier)
  if (!eligible) {
    return res.status(403).json({ error: 'Notion Sync is available to Lab Member and Founding members only' })
  }

  const state = createState(userId)
  const authorizeUrl = new URL('https://api.notion.com/v1/oauth/authorize')
  authorizeUrl.searchParams.set('client_id', process.env.NOTION_OAUTH_CLIENT_ID)
  authorizeUrl.searchParams.set('response_type', 'code')
  authorizeUrl.searchParams.set('owner', 'user')
  authorizeUrl.searchParams.set('redirect_uri', NOTION_REDIRECT_URI)
  authorizeUrl.searchParams.set('state', state)

  return res.redirect(302, authorizeUrl.toString())
}
