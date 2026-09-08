// api/upload/image.mjs
import { createClient } from '@supabase/supabase-js'
import dns from 'node:dns/promises'
import { requireAdminUser } from '../_lib/admin-auth.js'

const ALLOWED_FOLDERS = new Set(['products', 'blog'])
const MAX_URL_FETCH_BYTES = 2 * 1024 * 1024 // matches the client-side file-upload limit
const URL_FETCH_TIMEOUT_MS = 10_000

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

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

// Blocks SSRF: refuses to fetch a source image hosted on a private,
// loopback, link-local, or other non-public address (e.g. internal
// services or a cloud metadata endpoint) before we ever make the request.
function isPrivateAddress(address) {
  if (address.includes(':')) {
    const a = address.toLowerCase()
    if (a === '::1' || a === '::') return true
    if (a.startsWith('::ffff:')) return isPrivateAddress(a.slice(7))
    return a.startsWith('fe80:') || a.startsWith('fc') || a.startsWith('fd')
  }
  const parts = address.split('.').map(Number)
  if (parts.length !== 4 || parts.some(Number.isNaN)) return true
  const [a, b] = parts
  if (a === 127 || a === 0 || a === 10) return true
  if (a === 169 && b === 254) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 192 && b === 168) return true
  return false
}

async function assertPublicHttpUrl(rawUrl) {
  let parsed
  try {
    parsed = new URL(rawUrl)
  } catch {
    throw new Error('Not a valid URL')
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Only http(s) URLs are allowed')
  }
  const { address } = await dns.lookup(parsed.hostname)
  if (isPrivateAddress(address)) {
    throw new Error('That URL points to a non-public address')
  }
  return parsed
}

async function fetchImageFromUrl(rawUrl) {
  const parsed = await assertPublicHttpUrl(rawUrl)

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), URL_FETCH_TIMEOUT_MS)
  let response
  try {
    // redirect: 'error' stops a public URL from redirecting the fetch to
    // an internal address after the DNS check above already passed.
    response = await fetch(parsed, { redirect: 'error', signal: controller.signal })
  } catch (err) {
    throw new Error(err.name === 'AbortError' ? 'Timed out fetching that URL' : 'Could not fetch that URL')
  } finally {
    clearTimeout(timeout)
  }

  if (!response.ok) throw new Error(`Source returned ${response.status}`)

  const contentType = response.headers.get('content-type') || ''
  if (!contentType.startsWith('image/')) {
    throw new Error('That URL did not return an image')
  }

  const declaredLength = Number(response.headers.get('content-length') || 0)
  if (declaredLength > MAX_URL_FETCH_BYTES) {
    throw new Error('Image too large. Max size is 2MB.')
  }

  const reader = response.body.getReader()
  const chunks = []
  let total = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.length
    if (total > MAX_URL_FETCH_BYTES) {
      reader.cancel()
      throw new Error('Image too large. Max size is 2MB.')
    }
    chunks.push(value)
  }

  return { buffer: Buffer.concat(chunks), contentType }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-File-Name, Authorization')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const admin = await requireAdminUser(req, supabase)
  if (!admin) return res.status(403).json({ error: 'Admin access required' })

  const rawContentType = req.headers['content-type'] || ''

  try {
    let fileBuffer, fileContentType, requestedFolder

    if (rawContentType.startsWith('application/json')) {
      // Fetch-by-URL mode: admin pastes a source image link and the
      // server fetches it and re-hosts it in our own storage bucket,
      // same as a direct file upload from here on.
      const { url, folder } = req.body || {}
      if (!url) return res.status(400).json({ error: 'Missing url' })
      requestedFolder = folder
      const fetched = await fetchImageFromUrl(url)
      fileBuffer = fetched.buffer
      fileContentType = fetched.contentType
    } else {
      const chunks = []
      for await (const chunk of req) chunks.push(chunk)
      const buffer = Buffer.concat(chunks)

      requestedFolder = new URL(req.url, 'http://localhost').searchParams.get('folder')

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
    }

    const folder = ALLOWED_FOLDERS.has(requestedFolder) ? requestedFolder : 'products'

    const ext = getExt(fileContentType)
    const fileName = `${folder}/${Date.now()}.${ext}`

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
