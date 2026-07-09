// api/upload/product-file-url.mjs
// Admin-only. Generates a Supabase Storage signed upload URL so the
// browser can upload large product files (PDFs, xlsx, zip bundles)
// DIRECTLY to Supabase, bypassing Vercel's ~4.5MB request body limit.
// Files land in the private "products" bucket — the same one
// api/stripe/download.js reads from to deliver purchases.

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
  if (!admin) return res.status(403).json({ error: 'Admin access required' })

  try {
    const { fileName } = req.body
    if (!fileName) return res.status(400).json({ error: 'Missing fileName' })

    // Strip anything that isn't safe in a storage path
    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
    const path = `products/${Date.now()}-${safeName}`

    const { data, error } = await supabaseAdmin.storage
      .from('products')
      .createSignedUploadUrl(path)

    if (error) {
      console.error('Signed upload URL error:', error.message)
      throw error
    }

    return res.status(200).json({
      path: data.path,
      token: data.token,
    })
  } catch (err) {
    console.error('Upload URL generation failed:', err)
    return res.status(500).json({ error: err.message || 'Could not prepare upload' })
  }
}
