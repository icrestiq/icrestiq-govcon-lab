// api/slack/events.js
// Inbound half of the Slack bridge — this is the Request URL you'll enter
// in Slack's Event Subscriptions settings.
//
// Verifies every request is genuinely from Slack (signing secret check),
// handles the one-time URL verification handshake, then writes real user
// messages into Supabase, tagged source:'slack' so the outbound side
// (api/slack/notify.js) never echoes them back into Slack in a loop.

import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Reverse of the mapping in api/slack/notify.js
const SLACK_CHANNEL_TO_ROOM = {
  C0BN8G10KU0: 'general',
}

function verifySlackSignature(rawBody, headers) {
  const timestamp = headers['x-slack-request-timestamp']
  const slackSignature = headers['x-slack-signature']
  if (!timestamp || !slackSignature) return false

  // Reject requests older than 5 minutes — prevents replay attacks
  const now = Math.floor(Date.now() / 1000)
  if (Math.abs(now - Number(timestamp)) > 60 * 5) return false

  const sigBasestring = `v0:${timestamp}:${rawBody}`
  const mySignature = 'v0=' + crypto
    .createHmac('sha256', process.env.SLACK_SIGNING_SECRET)
    .update(sigBasestring, 'utf8')
    .digest('hex')

  const a = Buffer.from(mySignature, 'utf8')
  const b = Buffer.from(slackSignature, 'utf8')
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}

async function getSlackDisplayName(userId) {
  try {
    const res = await fetch(`https://slack.com/api/users.info?user=${userId}`, {
      headers: { 'Authorization': `Bearer ${process.env.SLACK_BOT_TOKEN}` },
    })
    const data = await res.json()
    if (!data.ok) return 'Slack User'
    return data.user?.profile?.display_name || data.user?.real_name || 'Slack User'
  } catch {
    return 'Slack User'
  }
}

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', chunk => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const rawBody = await getRawBody(req)

  if (!verifySlackSignature(rawBody, req.headers)) {
    console.error('Slack signature verification failed')
    return res.status(401).json({ error: 'Invalid signature' })
  }

  const body = JSON.parse(rawBody)

  // One-time handshake when you first save the Request URL in Slack's
  // Event Subscriptions settings.
  if (body.type === 'url_verification') {
    return res.status(200).json({ challenge: body.challenge })
  }

  // Slack retries delivery if it doesn't get a 200 within 3 seconds.
  // Don't reprocess retries — avoids duplicate messages landing in Supabase.
  if (req.headers['x-slack-retry-num']) {
    return res.status(200).json({ ok: true, skipped: 'retry' })
  }

  const event = body.event
  if (!event) return res.status(200).json({ ok: true })

  try {
    // Only handle plain user messages in mapped channels:
    //  - ignore anything with a subtype (edits, joins, deletions, etc.)
    //  - ignore messages FROM our own bot (prevents the outbound post
    //    from being picked back up as a new inbound event)
    if (event.type === 'message' && !event.subtype && !event.bot_id) {
      const roomId = SLACK_CHANNEL_TO_ROOM[event.channel]
      if (roomId) {
        const displayName = await getSlackDisplayName(event.user)

        const { error } = await supabase.from('messages').insert({
          room_id: roomId,
          user_id: process.env.SLACK_BRIDGE_USER_ID,
          username: `${displayName} (via Slack)`,
          membership_tier: null,
          content: event.text,
          parent_id: null,
          source: 'slack',
          created_at: new Date().toISOString(),
        })

        if (error) {
          console.error('Failed to insert Slack-origin message:', error.message)
        }
      }
    }
  } catch (err) {
    console.error('Slack event handling error:', err)
  }

  // Always 200 quickly — Slack doesn't care about the body here,
  // only that you acknowledged within 3 seconds.
  return res.status(200).json({ ok: true })
}

export const config = { api: { bodyParser: false } }
