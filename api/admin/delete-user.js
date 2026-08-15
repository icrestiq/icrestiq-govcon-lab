// api/admin/delete-user.js
// Permanently deletes a member's account — for purging fake/spam signups.
// Uses the Supabase Auth Admin API (auth.admin.deleteUser), which only
// works with the service-role key, so this can't be a direct browser call —
// same requireAdmin(Bearer token) pattern as api/stripe/discounts.js.
//
// Deleting the auth.users row cascades cleanly through most of the schema
// (profiles, messages.user_id → null, orders.user_id → null,
// user_purchases, message_likes, activity_log, message_reports.reporter_id)
// — verified via pg_constraint. Two tables are NOT covered by that cascade
// though: proposal_drafts.user_id and monthly_rewards.user_id are both
// "NO ACTION", so deleteUser() would fail outright for any member who ever
// used the Proposal Builder or won a monthly reward unless those rows are
// removed first.

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
  res.setHeader('Access-Control-Allow-Methods', 'DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'DELETE') return res.status(405).json({ error: 'Method not allowed' })

  const admin = await requireAdmin(req)
  if (!admin) {
    return res.status(403).json({ error: 'Admin access required' })
  }

  const { userId } = req.body || {}
  if (!userId) {
    return res.status(400).json({ error: 'Missing userId' })
  }
  if (userId === admin.id) {
    return res.status(400).json({ error: 'You cannot delete your own account from here.' })
  }

  try {
    await supabaseAdmin.from('proposal_drafts').delete().eq('user_id', userId)
    await supabaseAdmin.from('monthly_rewards').delete().eq('user_id', userId)

    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId)
    if (error) throw error

    return res.status(200).json({ ok: true })
  } catch (err) {
    console.error('Delete user error:', err)
    return res.status(500).json({ error: err.message || 'Delete failed' })
  }
}
