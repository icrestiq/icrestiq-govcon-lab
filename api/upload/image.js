// api/upload/image.js
// Server-side image upload — uses service role key to bypass RLS
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-File-Name')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const chunks = []
    for await (const chunk of req) chunks.push(chunk)
    const buffer = Buffer.concat(chunks)

    const contentType = req.headers['content-type'] || 'image/jpeg'
    const ext = contentType.includes('png') ? 'png' : contentType.includes('gif') ? 'gif' : contentType.includes('webp') ? 'webp' : 'jpg'
    const fileName = `products/${Date.now()}.${ext}`

    const { error } = await supabase.storage
      .from('product-images')
      .upload(fileName, buffer, { contentType, upsert: true })

    if (error) throw error

    const { data } = supabase.storage.from('product-images').getPublicUrl(fileName)
    return res.status(200).json({ url: data.publicUrl })
  } catch (err) {
    console.error('Upload error:', err)
    return res.status(500).json({ error: err.message })
  }
}

module.exports.config = { api: { bodyParser: false } }
