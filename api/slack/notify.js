// api/slack/notify.js
// Outbound half of the Slack bridge.
// Called from the client right after a message is successfully inserted
// into Supabase — pushes it into the mapped Slack channel.
//
// Fire-and-forget by design: if Slack is down or misconfigured, the site's
// chat should keep working regardless. Failures here are logged, not thrown
// back to the user.

// Room <-> Slack channel mapping. Add more rooms here as you bridge them —
// see api/slack/events.js for the reverse mapping used on the inbound side.
const ROOM_TO_SLACK_CHANNEL = {
  general: 'C0BN8G10KU0',
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  try {
    const { roomId, username, content } = req.body

    const channelId = ROOM_TO_SLACK_CHANNEL[roomId]
    if (!channelId) {
      // Room isn't bridged to Slack — not an error, just nothing to do.
      return res.status(200).json({ skipped: true, reason: 'room not bridged' })
    }

    const slackRes = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Authorization': `Bearer ${process.env.SLACK_BOT_TOKEN}`,
      },
      body: JSON.stringify({
        channel: channelId,
        text: `*${username}*: ${content}`,
      }),
    })

    const slackData = await slackRes.json()
    if (!slackData.ok) {
      console.error('Slack API error:', slackData.error)
      return res.status(200).json({ sent: false, error: slackData.error })
    }

    return res.status(200).json({ sent: true })
  } catch (err) {
    console.error('Slack notify error:', err)
    // Still 200 — this endpoint failing should never surface as a user-facing error
    return res.status(200).json({ sent: false, error: err.message })
  }
}
