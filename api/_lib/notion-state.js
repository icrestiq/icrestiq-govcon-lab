// api/_lib/notion-state.js
//
// Signs/verifies the OAuth `state` param for the Notion connect flow.
// Notion's authorize→callback round trip carries no session of its own, so
// state is what ties a callback back to the GovCon Lab profile that started
// it and guards against a forged callback (CSRF). Stateless by design (HMAC
// + timestamp, no server-side lookup table needed) since Vercel functions
// don't share memory between invocations.

import { createHmac, timingSafeEqual } from 'node:crypto'

const MAX_AGE_MS = 10 * 60 * 1000 // 10 minutes — plenty for a user to complete Notion's consent screen

function sign(payload) {
  return createHmac('sha256', process.env.NOTION_OAUTH_STATE_SECRET).update(payload).digest('hex')
}

export function createState(profileId) {
  const payload = `${profileId}.${Date.now()}`
  return Buffer.from(`${payload}.${sign(payload)}`).toString('base64url')
}

// Returns the profileId on success, or null if the state is missing, malformed,
// expired, or fails signature verification.
export function verifyState(state) {
  if (!state) return null
  let decoded
  try {
    decoded = Buffer.from(state, 'base64url').toString('utf8')
  } catch {
    return null
  }

  const parts = decoded.split('.')
  if (parts.length !== 3) return null
  const [profileId, timestamp, signature] = parts
  const payload = `${profileId}.${timestamp}`
  const expected = sign(payload)

  const expectedBuf = Buffer.from(expected)
  const gotBuf = Buffer.from(signature)
  if (expectedBuf.length !== gotBuf.length || !timingSafeEqual(expectedBuf, gotBuf)) return null

  if (Date.now() - Number(timestamp) > MAX_AGE_MS) return null
  return profileId
}
