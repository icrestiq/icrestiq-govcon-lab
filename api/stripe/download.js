import { createClient } from '@supabase/supabase-js'
import { requireAuthenticatedUser } from '../_lib/auth.js'
import { hasDownloadEntitlement } from '../_lib/download-entitlement.js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const user = await requireAuthenticatedUser(req, supabase)
    if (!user) {
      return res.status(401).json({ error: 'Authentication required' })
    }

    const { productId } = req.body || {}

    if (!productId) {
      return res.status(400).json({ error: 'Missing productId' })
    }

    // Get the file path from the products table
    const { data: product, error } = await supabase
      .from('products')
      .select('file_url, title')
      .eq('id', productId)
      .single()

    if (error || !product) {
      return res.status(404).json({ error: 'Product not found' })
    }

    if (!product.file_url) {
      return res.status(400).json({ error: 'No file available for this product' })
    }

    const entitled = await hasDownloadEntitlement(supabase, user.id, productId)
    if (!entitled) {
      return res.status(403).json({ error: 'Purchase required' })
    }

    // Generate a secure signed URL that expires in 24 hours
    const { data: signedUrl, error: urlError } = await supabase
      .storage
      .from('products')
      .createSignedUrl(product.file_url, 86400)

    if (urlError) {
      return res.status(500).json({ error: 'Could not generate download link' })
    }

    return res.status(200).json({ 
      url: signedUrl.signedUrl,
      filename: product.title 
    })

  } catch (err) {
    console.error('Download error:', err)
    return res.status(500).json({ error: err.message })
  }
}
