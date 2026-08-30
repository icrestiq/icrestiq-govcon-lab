import { requireAuthenticatedUser } from './auth.js'

export async function requireAdminUser(req, supabaseAdmin) {
  const user = await requireAuthenticatedUser(req, supabaseAdmin)
  if (!user) return null

  const { data: profile, error } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (error || profile?.role !== 'admin') return null
  return user
}
