// api/admin/moderate-note.js
// Removes a flagged shared note — Sourcing Pipeline Phase 3 moderation.
// Has to be a server route, not a direct client call: the
// protect_note_removal_fields trigger (added in the Phase 0 migration)
// only trusts Postgres's service_role, regardless of what a signed-in
// admin's own profiles.role says, so removed_at/removed_by_profile_id/
// removal_reason can only ever be set from here. Same requireAdmin
// (Bearer token) pattern as api/admin/delete-user.js.

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

  const { noteId, reason } = req.body || {}
  if (!noteId) {
    return res.status(400).json({ error: 'Missing noteId' })
  }

  try {
    // Forces shared back to false as well as recording the removal —
    // pulling a note off the shared directory is the actual visible
    // effect for other members; the removed_at/removed_by/reason trio is
    // the audit trail behind it.
    const { error } = await supabaseAdmin
      .from('notes')
      .update({
        shared: false,
        removed_at: new Date().toISOString(),
        removed_by_profile_id: admin.id,
        removal_reason: reason || null,
      })
      .eq('id', noteId)
    if (error) throw error

    return res.status(200).json({ ok: true })
  } catch (err) {
    console.error('Moderate note error:', err)
    return res.status(500).json({ error: err.message || 'Removal failed' })
  }
}
