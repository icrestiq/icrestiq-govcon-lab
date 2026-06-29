// api/upload/image.js
// Server-side image upload handler for GovCon Lab (v7)
// Uses Supabase service role key to bypass RLS for storage
// Handles multipart/form-data from <input type="file"> / FormData

const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Minimal multipart parser — extracts the first file part from a multipart/form-data body
function parseMultipart(buffer, boundary) {
  const boundaryBuf = Buffer.from('--' + boundary)
  const parts = []
  let start = 0

  while (start < buffer.length) {
    const boundaryIdx = buffer.indexOf(boundaryBuf, start)
    if (boundaryIdx === -1) break

    const headerStart = boundaryIdx + boundaryBuf.length + 2
    const headerEnd = buffer.indexOf(Buffer.from('\r\n\r\n'), headerStart)
    if (headerEnd === -1) break

    const headers = buffer.slice(headerStart, headerEnd).toString()
    const dataStart = headerEnd + 4
    const nextBoundary = buffer.indexOf(boundaryBuf, dataStart)
    const dataEnd = nextBoundary === -1 ? buffer.length : nextBoundary - 2

    const contentTypeMatch = headers.match(/Content-Type:\s*([^\r\n]+)/i)
    const filenameMatch = headers.match(/filename="([^"]+)"/i)

    if (contentTypeMatch) {
      parts.push({
        contentType: contentTypeMatch[1].trim(),
        filename: filenameMatch ? filenameMatch[1] : 'upload',
        data: buffer.slice(dataStart, dataEnd),
      })
    }

    start = nextBoundary === -1 ? buffer.length : nextBoundary
  }

  return parts
}

function getExt(contentType) {
  if (contentType.includes('png')) return 'png'
  if (contentType.includes('gif')) return 'gif'
  if (contentType.includes('webp')) return 'webp'
  return 'jpg'
}

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

    const rawContentType = req.headers['content-type'] || ''

    let fileBuffer, fileContentType

    if (rawContentType.startsWith('multipart/form-data')) {
      const boundaryMatch = rawContentType.match(/boundary=([^\s;]+)/)
      if (!boundaryMatch) {
        return res.status(400).json({ error: 'Missing multipart boundary' })
      }
      const parts = parseMultipart(buffer, boundaryMatch[1])
      if (!parts.length) {
        return res.status(400).json({ error: 'No file found in upload' })
      }
      fileBuffer = parts[0].data
      fileContentType = parts[0].contentType
    } else {
      fileBuffer = buffer
      fileContentType = rawContentType || 'image/jpeg'
    }

    const ext = getExt(fileContentType)
    const fileName = `products/${Date.now()}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('product-images')
      .upload(fileName, fileBuffer, {
        contentType: fileContentType,
        upsert: true,
      })

    if (uploadError) throw uploadError

    const { data: urlData } = supabase.storage
      .from('product-images')
      .getPublicUrl(fileName)

    return res.status(200).json({ url: urlData.publicUrl })
  } catch (err) {
    console.error('Upload error:', err)
    return res.status(500).json({ error: err.message || 'Upload failed' })
  }
}