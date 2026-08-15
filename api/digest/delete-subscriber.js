// api/digest/delete-subscriber.js
// Admin-only permanent delete for a digest_subscribers row. digest_subscribers
// deliberately has no INSERT/UPDATE/DELETE RLS policy for anyone, including
// admins (see supabase-schema.sql) — every write goes through a server route
// with the service-role key instead. This follows the same
// requireAdmin(Bearer token) pattern as api/stripe/discounts.js.

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

  const { id } = req.body || {}
  if (!id) {
    return res.status(400).json({ error: 'Missing subscriber id' })
  }

  try {
    const { error } = await supabaseAdmin.from('digest_subscribers').delete().eq('id', id)
    if (error) throw error
    return res.status(200).json({ ok: true })
  } catch (err) {
    console.error('Delete subscriber error:', err)
    return res.status(500).json({ error: err.message || 'Delete failed' })
  }
}
