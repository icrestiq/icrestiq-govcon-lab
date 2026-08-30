export function getBearerToken(req) {
  const authHeader = req.headers.authorization || ''
  const [scheme, token] = authHeader.trim().split(/\s+/, 2)
  if (scheme?.toLowerCase() !== 'bearer' || !token) return null
  return token
}

export async function requireAuthenticatedUser(req, supabaseAdmin) {
  const token = getBearerToken(req)
  if (!token) return null

  const { data: { user } = {}, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !user) return null
  return user
}
