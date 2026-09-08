// api/admin/moderate-listing.js
// Market Intelligence Redesign, Phase 4 — approve/reject a pending public
// directory_listings row. Has to be a server route, not a direct client
// call: directory_listings' own RLS only lets a member update their own
// row and forces status back to 'pending' on any owner-driven update (see
// the migration), so setting status to 'approved'/'rejected' can only ever
// happen from here, with the service-role key. Same requireAdmin (Bearer
// token) pattern as api/admin/moderate-note.js and api/admin/delete-user.js.

import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function requireAdmin(req) {
  const authHeader = req.headers.authorization || ''
  const token = authHeader.replace('Bearer ', '').trim()
  if (!token) return null

  const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token)
  if (userError || !user) return null

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profileError || profile?.role !== 'admin') return null
  return user
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const admin = await requireAdmin(req)
  if (!admin) {
    return res.status(403).json({ error: 'Admin access required' })
  }

  const { listingId, action, reason } = req.body || {}
  if (!listingId || !['approve', 'reject'].includes(action)) {
    return res.status(400).json({ error: 'Missing listingId or invalid action' })
  }

  try {
    const { error } = await supabaseAdmin
      .from('directory_listings')
      .update({
        status: action === 'approve' ? 'approved' : 'rejected',
        rejection_reason: action === 'reject' ? (reason || null) : null,
        reviewed_at: new Date().toISOString(),
        reviewed_by_profile_id: admin.id,
      })
      .eq('id', listingId)
    if (error) throw error

    return res.status(200).json({ ok: true })
  } catch (err) {
    console.error('Moderate listing error:', err)
    return res.status(500).json({ error: err.message || 'Moderation failed' })
  }
}
