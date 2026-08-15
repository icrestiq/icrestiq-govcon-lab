import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { Send, Hash, Users, MessageCircle, X, Lock, SmilePlus, Trash2, Flag, Pin, PinOff, ScrollText } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import EmojiPicker from '../components/EmojiPicker'
import FounderBadge from '../components/FounderBadge'
import styles from './Chat.module.css'

// Turns a URL in a message into a real clickable link — including a
// bare domain typed without "https://" (e.g. "govconlab.com"), which
// people type far more often in casual chat than a full URL. The TLD
// whitelist keeps this from false-positiving on things like "e.g.",
// "U.S.", or "3.5 million". Chat messages are plain text (no markdown
// authoring), so this is pattern detection, not a paste-format
// converter — just enough to make a link actually work instead of
// sitting as dead text. Trims trailing punctuation (.,!?'")]}:;) that's
// more likely to be sentence punctuation than part of the URL/domain.
function linkifyText(text) {
  const urlRegex = /\b(?:https?:\/\/|www\.)[^\s<]+|\b[a-zA-Z0-9][a-zA-Z0-9-]*\.(?:com|net|org|gov|edu|io|co|us|mil)(?:\/[^\s<]*)?/gi
  const trailingPunctuation = /[.,!?'")\]}:;]+$/
  const parts = []
  let lastIndex = 0
  let match
  let i = 0
  while ((match = urlRegex.exec(text)) !== null) {
    let matched = match[0]
    let end = match.index + matched.length
    const trimMatch = matched.match(trailingPunctuation)
    if (trimMatch) {
      matched = matched.slice(0, -trimMatch[0].length)
      end -= trimMatch[0].length
    }
    if (!matched) continue
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index))
    const href = /^https?:\/\//i.test(matched) ? matched : `https://${matched}`
    parts.push(
      <a key={i++} href={href} target="_blank" rel="noopener noreferrer" className={styles.messageLink}>
        {matched}
      </a>
    )
    lastIndex = end
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex))
  return parts
}

const DEFAULT_ROOMS = [
  { id: 'general',      name: 'General',          desc: 'Open discussion for everyone — introductions, general questions, and anything that doesn\u2019t fit a specific room. If you\u2019re new, this is the best place to say hello and get oriented.', color: '#4F6BED' },
  { id: 'rfq-help',     name: 'RFQ Help',          desc: 'Post a quote or bid you\u2019re working on and get real feedback from other members before you submit. Great for a second set of eyes on pricing, compliance, or anything that feels off before it goes to a contracting officer.', color: '#38A169' },
  { id: 'vendor-intel', name: 'Vendor Intel',       desc: 'Share and discover supplier leads — who\u2019s reliable, who\u2019s fast, who ships what. A place to swap real sourcing intel instead of hunting for it alone.', color: '#C05621' },
  { id: 'wins',         name: 'Wins',               desc: 'Post your awards, milestones, and contract wins to celebrate progress with the community. It\u2019s also a good source of motivation and proof that the process actually works.', color: '#C9A84C' },
  { id: 'dibbs',        name: 'DIBBS',              desc: 'Focused talk specifically on DIBBS sourcing, solicitations, and DLA contracting quirks. The place to go for anything specific to that platform rather than general GovCon questions.', color: '#6B46C1' },
  { id: 'tools',        name: 'Tools & Automation', desc: 'Discussion on Make.com workflows, AI tools, and anything that automates or speeds up your GovCon process. Share what\u2019s working (or not) so people aren\u2019t rebuilding the same automation from scratch.', color: '#C53030' },
  { id: 'founding-members', name: 'Founding Members', desc: 'Private room for Founding Members only', color: '#C9A84C', foundingOnly: true },
]

// Rooms currently bridged to Slack. Must match the mapping in
// api/slack/notify.js. Used only to decide whether to fire the
// outbound notify call — the actual channel routing lives server-side.
const SLACK_BRIDGED_ROOMS = new Set(['general'])

const LIKES_NEEDED = 5
const REPORT_REASONS = [
  { id: 'spam', label: 'Spam' },
  { id: 'harassment', label: 'Harassment' },
  { id: 'inappropriate', label: 'Inappropriate content' },
  { id: 'other', label: 'Other' },
]

const CHAT_RULES_INTRO = [
  'Welcome to GovCon Lab—a community for small businesses, new contractors, and experienced professionals working to grow in government contracting.',
  'Our goal is to create a helpful, professional environment where members can learn, share resources, ask questions, and support one another.',
  'How posting works: every paid member can reply to any post right away. Starting your own new top-level post unlocks once your comments have earned 5 total likes across the community — this keeps the focus on genuine participation rather than drive-by posting. Free-tier members can read every room but cannot post or comment.',
]

const CHAT_RULES_SECTIONS = [
  {
    title: '1. Be Respectful',
    body: [
      'Treat every member with professionalism and respect.',
      'Disagreements are allowed, but personal attacks, insults, harassment, bullying, threats, discrimination, or hostile behavior will not be tolerated.',
    ],
  },
  {
    title: '2. No Spam or Excessive Promotion',
    body: [
      'Do not repeatedly promote your business, products, services, affiliate links, social media accounts, or outside communities.',
      'Helpful recommendations are welcome when they are relevant to the conversation. Self-promotion should be limited to designated channels or approved posts.',
    ],
  },
  {
    title: '3. Do Not Share Sensitive Information',
    body: [
      'Never post:',
    ],
    bullets: [
      'Social Security numbers',
      'Banking or payment information',
      'Passwords or login credentials',
      'Controlled Unclassified Information',
      'Export-controlled information',
      'Proprietary customer or government information',
      'Personally identifiable information',
      'Unredacted bid, employee, or vendor documents',
    ],
    footer: 'Remove sensitive information before uploading screenshots, solicitations, proposals, invoices, or other documents.',
  },
  {
    title: '4. Protect Procurement Integrity',
    body: [
      'Do not request, share, or discuss confidential source-selection information, competitor proposal information, nonpublic government estimates, or information obtained improperly from a contracting official.',
      'Do not encourage bribery, bid rigging, false certifications, collusion, fraud, or other unethical conduct.',
    ],
  },
  {
    title: '5. No Guaranteed-Win Claims',
    body: [
      'Members may share strategies, experiences, tools, and opinions, but no one can guarantee that a business will receive a contract, certification, award, loan, grant, or government approval.',
      'Be cautious of anyone promising guaranteed awards or requesting large payments through private messages.',
    ],
  },
  {
    title: '6. Keep Advice Honest and Clearly Labeled',
    body: [
      'Clearly distinguish between:',
    ],
    bullets: [
      'Personal experience',
      'General guidance',
      'Professional advice',
      'Confirmed facts',
      'Opinions or estimates',
    ],
    footer: 'Government contracting requirements can vary by agency, solicitation, industry, and contract. Members should verify important information using the solicitation, official regulations, and government sources.',
  },
  {
    title: '7. Stay on Topic',
    body: [
      'Keep discussions related to government contracting, business development, sourcing, proposals, compliance, certifications, operations, tools, and other approved community topics.',
      'Use the appropriate chat room or discussion category whenever possible.',
    ],
  },
  {
    title: '8. No Solicitation Harassment',
    body: [
      'Do not send unwanted sales messages, recruiting messages, partnership requests, or repeated private messages to other members.',
      'A member\u2019s participation in the community is not permission to add them to an email list or contact them outside GovCon Lab.',
    ],
  },
  {
    title: '9. Respect Intellectual Property',
    body: [
      'Do not upload or distribute copyrighted courses, paid templates, proprietary databases, subscription-only content, software, or documents that you do not have permission to share.',
      'Give proper credit when sharing another person\u2019s work.',
    ],
  },
  {
    title: '10. No False Identity or Misrepresentation',
    body: [
      'Do not impersonate a government official, contracting officer, business owner, community administrator, certification provider, or another member.',
      'Do not falsely claim certifications, contract awards, past performance, business relationships, or professional qualifications.',
    ],
  },
  {
    title: '11. Vendors and Service Providers Must Be Transparent',
    body: [
      'If you recommend a company, product, service, course, consultant, software platform, or affiliate offer from which you may benefit financially, disclose that relationship.',
      'Paid promotions and vendor solicitations may require prior approval.',
    ],
  },
  {
    title: '12. Report Suspicious Activity',
    body: [
      'Report scams, fraudulent offers, harassment, suspicious private messages, misinformation, or possible security concerns to a moderator.',
      'Do not publicly post another member\u2019s private information while reporting an issue.',
    ],
  },
  {
    title: '13. Moderation Decisions',
    body: [
      'GovCon Lab may remove content, limit posting privileges, suspend accounts, or permanently remove members who violate these rules or disrupt the community.',
      'Serious violations may result in immediate removal without warning.',
    ],
  },
  {
    title: '14. Educational Disclaimer',
    body: [
      'Information shared in GovCon Lab is provided for general educational and informational purposes. It is not legal, accounting, tax, cybersecurity, compliance, or financial advice.',
      'Members are responsible for reviewing the applicable solicitation, contract terms, laws, regulations, and official agency guidance before making business decisions.',
    ],
  },
  {
    title: '15. Help Build a Strong Community',
    body: [
      'Ask thoughtful questions, share useful information, celebrate member progress, and provide constructive feedback.',
      'We are here to learn, improve, and help one another compete responsibly.',
    ],
  },
]

const CHAT_RULES_CLOSING = 'By participating in GovCon Lab chat, you agree to follow these community rules.'

function ChatRulesModal({ onClose }) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
        padding: 20,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#fff', borderRadius: 10, maxWidth: 620, width: '100%',
          maxHeight: '85vh', display: 'flex', flexDirection: 'column',
          boxShadow: '0 12px 40px rgba(0,0,0,0.25)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '20px 28px', borderBottom: '1px solid #eee', flexShrink: 0,
        }}>
          <h2 style={{ margin: 0, fontSize: 18, color: '#1F3864' }}>GovCon Lab Community Chat Rules</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888', flexShrink: 0 }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ padding: '20px 28px', overflowY: 'auto', fontSize: 14, color: '#333', lineHeight: 1.6 }}>
          {CHAT_RULES_INTRO.map((p, i) => (
            <p key={i} style={{ margin: '0 0 12px 0' }}>{p}</p>
          ))}

          {CHAT_RULES_SECTIONS.map((section, i) => (
            <div key={i} style={{ marginTop: 20 }}>
              <h3 style={{ fontSize: 14.5, color: '#1F3864', margin: '0 0 6px 0' }}>{section.title}</h3>
              {section.body.map((p, j) => (
                <p key={j} style={{ margin: '0 0 8px 0' }}>{p}</p>
              ))}
              {section.bullets && (
                <ul style={{ margin: '0 0 8px 0', paddingLeft: 20 }}>
                  {section.bullets.map((b, k) => (
                    <li key={k} style={{ marginBottom: 4 }}>{b}</li>
                  ))}
                </ul>
              )}
              {section.footer && (
                <p style={{ margin: '0 0 8px 0' }}>{section.footer}</p>
              )}
            </div>
          ))}

          <p style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid #eee', fontWeight: 600, color: '#1F3864' }}>
            {CHAT_RULES_CLOSING}
          </p>
        </div>
      </div>
    </div>
  )
}

export default function Chat() {
  const { roomId } = useParams()
  const navigate = useNavigate()
  const { user, profile, isAdmin } = useAuth()
  const activeRoom = roomId || 'general'

  const isFoundingMember = isAdmin || profile?.membership_tier === 'founding'

  // Free tier = no membership_tier set, or explicitly 'free'. Read-only across the board.
  const isFreeTier = !isAdmin && (!profile?.membership_tier || profile?.membership_tier === 'free')

  // Rooms this user is actually allowed to see in the sidebar
  const visibleRooms = DEFAULT_ROOMS.filter(room => !room.foundingOnly || isFoundingMember)

  const [messages, setMessages] = useState([])
  const [newMsg, setNewMsg] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState('')
  const [onlineCount, setOnlineCount] = useState(1)
  const [reactions, setReactions] = useState({})
  const [replyingTo, setReplyingTo] = useState(null)
  // canComment: can this user post/reply at all (false for free tier)
  // canPost: can this user start a NEW top-level post (false for paid tiers until they hit LIKES_NEEDED cumulative likes)
  const [gate, setGate] = useState({ canComment: false, canPost: false, likesSoFar: 0 })
  const [reportMenuFor, setReportMenuFor] = useState(null)
  const [reportedIds, setReportedIds] = useState(new Set())
  const [showRules, setShowRules] = useState(false)
  // Running total of messages per room, shown as a badge next to each room name.
  const [roomCounts, setRoomCounts] = useState({})
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  // The composer auto-grows via direct style writes in onChange (below), which
  // React won't undo on its own — reset it back to one line once the message
  // is cleared (after sending, canceling a reply, switching rooms, etc.).
  useEffect(() => {
    if (newMsg === '' && inputRef.current) {
      inputRef.current.style.height = 'auto'
    }
  }, [newMsg])

  // Guard: if someone lands on /chat/founding-members without access, bounce them to General.
  // (The Supabase RLS policy already blocks the actual data — this just keeps the UI honest.)
  useEffect(() => {
    const room = DEFAULT_ROOMS.find(r => r.id === activeRoom)
    if (room?.foundingOnly && !isFoundingMember) {
      navigate('/chat/general', { replace: true })
    }
  }, [activeRoom, isFoundingMember, navigate])

  // Per-room message counts: fetch once for every room the user can see,
  // then keep them live via a single unfiltered realtime subscription
  // (separate from the per-room message channel below, which only
  // listens to the currently active room). Runs independently of room
  // switching so counts for OTHER rooms keep updating in the background.
  useEffect(() => {
    let cancelled = false

    async function loadCounts() {
      const results = await Promise.all(
        visibleRooms.map(async room => {
          const { count } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('room_id', room.id)
          return [room.id, count || 0]
        })
      )
      if (!cancelled) setRoomCounts(Object.fromEntries(results))
    }
    loadCounts()

    const countsChannel = supabase
      .channel('room-message-counts')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
        setRoomCounts(prev => ({
          ...prev,
          [payload.new.room_id]: (prev[payload.new.room_id] || 0) + 1,
        }))
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages' }, payload => {
        setRoomCounts(prev => ({
          ...prev,
          [payload.old.room_id]: Math.max(0, (prev[payload.old.room_id] || 0) - 1),
        }))
      })
      .subscribe()

    return () => {
      cancelled = true
      supabase.removeChannel(countsChannel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFoundingMember])

  useEffect(() => {
    setMessages([])
    loadMessages()
    checkGateStatus()
    loadMyReports()

    const channel = supabase
      .channel(`room:${activeRoom}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'messages',
        filter: `room_id=eq.${activeRoom}`,
      }, payload => {
        if (payload.eventType === 'INSERT') {
          setMessages(prev => [...prev, payload.new])
          loadReactionsFor([payload.new.id])
          setTimeout(scrollToBottom, 50)
        } else if (payload.eventType === 'DELETE') {
          setMessages(prev => prev.filter(m => m.id !== payload.old.id))
        } else if (payload.eventType === 'UPDATE') {
          // Covers pin/unpin (and any other future edits) so every
          // viewer's pinned list stays in sync in real time.
          setMessages(prev => prev.map(m => m.id === payload.new.id ? payload.new : m))
        }
      })
      .subscribe()

    const reactionsChannel = supabase
      .channel(`reactions:${activeRoom}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'message_likes' }, () => {
        refreshVisibleReactions()
        checkGateStatus()
      })
      .subscribe()

    const presence = supabase.channel(`presence:${activeRoom}`)
    presence
      .on('presence', { event: 'sync' }, () => {
        const state = presence.presenceState()
        setOnlineCount(Object.keys(state).length)
      })
      .subscribe(async status => {
        if (status === 'SUBSCRIBED') {
          await presence.track({ user_id: user?.id, username: profile?.username })
        }
      })

    return () => {
      supabase.removeChannel(channel)
      supabase.removeChannel(reactionsChannel)
      supabase.removeChannel(presence)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRoom, user?.id, profile?.username])

  useEffect(() => { scrollToBottom() }, [messages])

  async function loadMessages() {
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('room_id', activeRoom)
      .order('created_at', { ascending: true })
      .limit(200)
    if (data) {
      setMessages(data)
      loadReactionsFor(data.map(m => m.id))
    }
  }

  async function loadMyReports() {
    if (!user) return
    const { data } = await supabase
      .from('message_reports')
      .select('message_id')
      .eq('reporter_id', user.id)
    if (data) setReportedIds(new Set(data.map(r => r.message_id)))
  }

  async function loadReactionsFor(messageIds) {
    if (!messageIds.length) return
    const { data } = await supabase
      .from('message_likes')
      .select('message_id, user_id, emoji')
      .in('message_id', messageIds)
    if (!data) return
    setReactions(prev => {
      const next = { ...prev }
      messageIds.forEach(id => { next[id] = {} })
      data.forEach(row => {
        const emoji = row.emoji || '❤️'
        if (!next[row.message_id]) next[row.message_id] = {}
        if (!next[row.message_id][emoji]) next[row.message_id][emoji] = { count: 0, reactedByMe: false }
        next[row.message_id][emoji].count += 1
        if (row.user_id === user?.id) next[row.message_id][emoji].reactedByMe = true
      })
      return next
    })
  }

  function refreshVisibleReactions() {
    const ids = messages.map(m => m.id)
    if (ids.length) loadReactionsFor(ids)
  }

  // Tier-based posting permissions:
  //   Free tier            -> read-only, cannot comment or post at all
  //   Paid tiers            -> can always comment/reply; can start a NEW top-level
  //                             post only after their messages have earned
  //                             LIKES_NEEDED cumulative likes (across ALL their
  //                             messages in this room, not just their last post)
  //   Admin / founding staff -> unrestricted
  async function checkGateStatus() {
    if (!user) {
      setGate({ canComment: false, canPost: false, likesSoFar: 0 })
      return
    }

    if (isAdmin) {
      setGate({ canComment: true, canPost: true, likesSoFar: 0 })
      return
    }

    if (isFreeTier) {
      setGate({ canComment: false, canPost: false, likesSoFar: 0 })
      return
    }

    // Paid tier: always allowed to comment/reply.
    // Sum likes across ALL of this user's messages in this room to decide
    // whether they've unlocked starting new top-level posts.
    const { data: myMessages } = await supabase
      .from('messages')
      .select('id')
      .eq('room_id', activeRoom)
      .eq('user_id', user.id)

    const ids = (myMessages || []).map(m => m.id)
    let likesSoFar = 0
    if (ids.length) {
      const { count } = await supabase
        .from('message_likes')
        .select('*', { count: 'exact', head: true })
        .in('message_id', ids)
      likesSoFar = count || 0
    }

    setGate({
      canComment: true,
      canPost: likesSoFar >= LIKES_NEEDED,
      likesSoFar,
    })
  }

  async function toggleReaction(message, emoji) {
    if (!user) return
    const current = reactions[message.id]?.[emoji] || { count: 0, reactedByMe: false }
    setReactions(prev => ({
      ...prev,
      [message.id]: {
        ...prev[message.id],
        [emoji]: {
          count: current.reactedByMe ? current.count - 1 : current.count + 1,
          reactedByMe: !current.reactedByMe,
        },
      },
    }))
    try {
      if (current.reactedByMe) {
        await supabase.from('message_likes').delete()
          .eq('message_id', message.id).eq('user_id', user.id).eq('emoji', emoji)
      } else {
        await supabase.from('message_likes').insert({ message_id: message.id, user_id: user.id, emoji })
      }
    } catch (err) {
      console.error('Reaction error:', err)
      loadReactionsFor([message.id])
    }
  }

  function insertEmojiIntoComposer(emoji) {
    const input = inputRef.current
    if (!input) { setNewMsg(prev => prev + emoji); return }
    const start = input.selectionStart ?? newMsg.length
    const end = input.selectionEnd ?? newMsg.length
    const updated = newMsg.slice(0, start) + emoji + newMsg.slice(end)
    setNewMsg(updated)
    setTimeout(() => {
      input.focus()
      const pos = start + emoji.length
      input.setSelectionRange(pos, pos)
    }, 0)
  }

  async function sendMessage(e) {
    e.preventDefault()
    const text = newMsg.trim()
    if (!text || sending) return
    if (!gate.canComment) return
    if (!replyingTo && !gate.canPost) return

    setSending(true)
    setSendError('')
    setNewMsg('')
    const wasReply = !!replyingTo
    try {
      const { error } = await supabase.from('messages').insert({
        room_id: activeRoom,
        user_id: user.id,
        username: profile?.username || 'Member',
        membership_tier: profile?.membership_tier || null,
        content: text,
        parent_id: replyingTo?.id || null,
        source: 'web',
        created_at: new Date().toISOString(),
      })
      if (error) throw error

      // Push to Slack if this room is bridged. Fire-and-forget on purpose —
      // Slack being slow or down should never block or error out the
      // person's actual chat experience on the site.
      if (SLACK_BRIDGED_ROOMS.has(activeRoom)) {
        fetch('/api/slack/notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            roomId: activeRoom,
            username: profile?.username || 'Member',
            content: text,
          }),
        }).catch(err => console.error('Slack notify failed (non-blocking):', err))
      }

      setReplyingTo(null)
      if (!wasReply) setTimeout(checkGateStatus, 300)
    } catch (err) {
      console.error('Send error:', err)
      setNewMsg(text)
      setSendError(err.message || 'Message failed to send. Please try again.')
    } finally {
      setSending(false)
      inputRef.current?.focus()
    }
  }

  async function deleteMessage(message) {
    if (!confirm('Delete this post? This also removes any replies to it. This cannot be undone.')) return
    try {
      await supabase.from('messages').delete().eq('id', message.id)
      setMessages(prev => prev.filter(m => m.id !== message.id && m.parent_id !== message.id))
    } catch (err) {
      console.error('Delete error:', err)
      alert('Could not delete this post: ' + err.message)
    }
  }

  async function submitReport(message, reason) {
    setReportMenuFor(null)
    try {
      const { error } = await supabase.from('message_reports').insert({
        message_id: message.id,
        reporter_id: user.id,
        reason,
      })
      if (error) throw error
      setReportedIds(prev => new Set([...prev, message.id]))
    } catch (err) {
      console.error('Report error:', err)
      alert('Could not submit report: ' + err.message)
    }
  }

  // Admin-only pin/unpin. Restricted to top-level posts (not replies) —
  // pinning a buried reply wouldn't make sense with per-room pinning.
  async function togglePin(message) {
    const nextValue = message.pinned_at ? null : new Date().toISOString()
    // Optimistic local update — don't wait on the realtime round-trip
    // for the admin's own screen to reflect the change.
    setMessages(prev => prev.map(m => m.id === message.id ? { ...m, pinned_at: nextValue } : m))
    try {
      const { error } = await supabase.from('messages').update({ pinned_at: nextValue }).eq('id', message.id)
      if (error) throw error
    } catch (err) {
      console.error('Pin toggle error:', err)
      // Roll back the optimistic update on failure
      setMessages(prev => prev.map(m => m.id === message.id ? { ...m, pinned_at: message.pinned_at } : m))
      alert('Could not update pin status: ' + err.message)
    }
  }

  const currentRoom = DEFAULT_ROOMS.find(r => r.id === activeRoom) || DEFAULT_ROOMS[0]

  // Pinned posts float to the top (most recently pinned first), then
  // everything else falls back to normal chronological order.
  const topLevel = messages
    .filter(m => !m.parent_id)
    .sort((a, b) => {
      const aPinned = !!a.pinned_at
      const bPinned = !!b.pinned_at
      if (aPinned && !bPinned) return -1
      if (!aPinned && bPinned) return 1
      if (aPinned && bPinned) return new Date(b.pinned_at) - new Date(a.pinned_at)
      return new Date(a.created_at) - new Date(b.created_at)
    })
  const repliesFor = id => messages.filter(m => m.parent_id === id)

  function renderMessage(msg, isReply = false) {
    const isOwn = msg.user_id === user?.id
    const canDelete = isAdmin || isOwn
    const alreadyReported = reportedIds.has(msg.id)
    const initials = (msg.username || 'M').slice(0, 2).toUpperCase()
    const msgReactions = reactions[msg.id] || {}
    const activeEmoji = Object.entries(msgReactions).filter(([, v]) => v.count > 0)
    const isPinned = !isReply && !!msg.pinned_at

    return (
      <div
        key={msg.id}
        className={`${styles.message} ${isOwn ? styles.messageOwn : ''}`}
        style={{
          ...(isReply ? { marginLeft: isOwn ? 0 : 44, marginRight: isOwn ? 44 : 0 } : {}),
          ...(isPinned ? { borderLeft: '3px solid #C9A84C', paddingLeft: 10, background: 'rgba(201, 168, 76, 0.06)', borderRadius: 6 } : {}),
        }}
      >
        <div className="avatar" style={{ width: isReply ? 28 : 36, height: isReply ? 28 : 36, fontSize: isReply ? '0.6875rem' : undefined, ...(isOwn ? { order: 1 } : {}) }}>{initials}</div>
        <div className={styles.messageBubble}>
          <div className={styles.messageMeta}>
            {isPinned && (
              <span title="Pinned" style={{ display: 'inline-flex', alignItems: 'center', color: '#C9A84C' }}>
                <Pin size={12} fill="#C9A84C" />
              </span>
            )}
            <span className={styles.messageUser}>{msg.username || 'Member'}</span>
            <FounderBadge tier={msg.membership_tier} />
            <span className={styles.messageTime}>
              {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}
            </span>
          </div>
          <div className={`${styles.messageText} ${isOwn ? styles.messageTextOwn : ''}`}>
            {linkifyText(msg.content)}
          </div>

          {activeEmoji.length > 0 && (
            <div className={styles.reactionRow}>
              {activeEmoji.map(([emoji, info]) => (
                <button
                  key={emoji}
                  className={`${styles.reactionPill} ${info.reactedByMe ? styles.reactionPillActive : ''}`}
                  onClick={() => toggleReaction(msg, emoji)}
                >
                  <span>{emoji}</span>
                  <span>{info.count}</span>
                </button>
              ))}
            </div>
          )}

          <div className={styles.messageActions}>
            <EmojiPicker
              trigger={<SmilePlus size={14} />}
              onSelect={emoji => toggleReaction(msg, emoji)}
            />
            {!isReply && gate.canComment && (
              <button className={styles.actionBtn} onClick={() => { setReplyingTo(msg); inputRef.current?.focus() }}>
                <MessageCircle size={13} />
                Reply
              </button>
            )}

            {!isReply && isAdmin && (
              <button className={styles.actionBtn} onClick={() => togglePin(msg)} title={msg.pinned_at ? 'Unpin this post' : 'Pin this post to the top of the room'}>
                {msg.pinned_at ? <PinOff size={13} /> : <Pin size={13} />}
                {msg.pinned_at ? 'Unpin' : 'Pin'}
              </button>
            )}

            {!isOwn && (
              <div className={styles.reportWrap}>
                <button
                  className={styles.actionBtn}
                  disabled={alreadyReported}
                  onClick={() => setReportMenuFor(reportMenuFor === msg.id ? null : msg.id)}
                  title={alreadyReported ? 'You already reported this' : 'Report this post'}
                >
                  <Flag size={13} fill={alreadyReported ? 'currentColor' : 'none'} />
                  {alreadyReported ? 'Reported' : 'Report'}
                </button>
                {reportMenuFor === msg.id && (
                  <div className={styles.reportMenu}>
                    {REPORT_REASONS.map(r => (
                      <button key={r.id} onClick={() => submitReport(msg, r.id)}>
                        {r.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {canDelete && (
              <button className={`${styles.actionBtn} ${styles.deleteBtn}`} onClick={() => deleteMessage(msg)}>
                <Trash2 size={13} />
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.shell}>
      <div className={styles.roomList}>
        <button
          onClick={() => setShowRules(true)}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            width: 'calc(100% - 16px)', margin: '10px 8px 12px', padding: '10px 12px',
            background: 'rgba(201, 168, 76, 0.12)', border: '1px solid #C9A84C', borderRadius: 8,
            color: '#8a6d1f', fontSize: '0.8125rem', fontWeight: 700, cursor: 'pointer',
            textAlign: 'center',
          }}
        >
          <ScrollText size={15} />
          Read the Community Chat Rules
        </button>

        <div style={{
          margin: '0 8px 12px', padding: '10px 12px', borderRadius: 8,
          background: 'rgba(79, 107, 237, 0.08)', border: '1px solid rgba(79, 107, 237, 0.25)',
          fontSize: '0.75rem', lineHeight: 1.5, color: 'var(--text-muted, #555)',
        }}>
          <strong style={{ color: '#4F6BED' }}>New here?</strong> You can reply to any post right away.
          Starting your own new post unlocks once your comments have earned {LIKES_NEEDED} total likes —
          it keeps the community focused on genuine participation over drive-by posting.
        </div>

        <div className={styles.roomListHeader}>
          <span className="mono" style={{ color: 'var(--text-muted)', fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Rooms</span>
        </div>
        {visibleRooms.map(room => (
          <button
            key={room.id}
            className={`${styles.roomItem} ${activeRoom === room.id ? styles.roomActive : ''}`}
            onClick={() => navigate(`/chat/${room.id}`)}
          >
            <span style={{
              width: 8, height: 8, borderRadius: '50%',
              background: room.color, flexShrink: 0,
              opacity: activeRoom === room.id ? 1 : 0.5,
            }} />
            <span className={styles.roomName}>{room.name}</span>
            <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
              {typeof roomCounts[room.id] === 'number' && (
                <span
                  title={`${roomCounts[room.id]} message${roomCounts[room.id] === 1 ? '' : 's'}`}
                  style={{
                    fontSize: '0.6875rem', color: 'var(--text-muted, #999)',
                    background: 'rgba(0,0,0,0.06)', borderRadius: 10,
                    padding: '1px 7px', lineHeight: '16px', fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {roomCounts[room.id]}
                </span>
              )}
              {room.foundingOnly && (
                <Lock size={12} style={{ opacity: 0.6 }} />
              )}
            </span>
          </button>
        ))}
      </div>

      <div className={styles.chatArea}>
        <div className={styles.chatHeader}>
          <div className={styles.chatHeaderLeft}>
            {currentRoom.foundingOnly ? (
              <Lock size={18} style={{ color: 'var(--green)' }} />
            ) : (
              <Hash size={18} style={{ color: 'var(--green)' }} />
            )}
            <div>
              <div className={styles.chatRoomName}>{currentRoom.name}</div>
              <div className={styles.chatRoomDesc}>{currentRoom.desc}</div>
            </div>
          </div>
          <div className={styles.onlineIndicator}>
            <Users size={14} />
            <span>{onlineCount} online</span>
          </div>
        </div>

        <div className={styles.messages}>
          {messages.length === 0 && (
            <div className={styles.emptyState}>
              <Hash size={32} style={{ color: 'var(--text-muted)', marginBottom: 'var(--sp-3)' }} />
              <p className={styles.emptyTitle}>#{currentRoom.name} is quiet</p>
              <p className={styles.emptySub}>Be the first to post in this room.</p>
            </div>
          )}

          {topLevel.map(post => (
            <div key={post.id}>
              {renderMessage(post, false)}
              {repliesFor(post.id).map(reply => renderMessage(reply, true))}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {isFreeTier && (
          <div className={styles.gateBanner}>
            <Lock size={14} />
            <span>
              Free members can read all rooms. Upgrade your membership to post and reply.
            </span>
          </div>
        )}

        {!isFreeTier && gate.canComment && !gate.canPost && !replyingTo && (
          <div className={styles.gateBanner}>
            <Lock size={14} />
            <span>
              You need {LIKES_NEEDED - gate.likesSoFar} more like{LIKES_NEEDED - gate.likesSoFar === 1 ? '' : 's'} ({gate.likesSoFar}/{LIKES_NEEDED}) across your posts before you can start a new top-level post. You can still reply to others anytime.
            </span>
          </div>
        )}

        {replyingTo && (
          <div className={styles.replyBanner}>
            <span>Replying to <strong>{replyingTo.username}</strong>: {replyingTo.content.slice(0, 60)}{replyingTo.content.length > 60 ? '…' : ''}</span>
            <button onClick={() => setReplyingTo(null)}><X size={14} /></button>
          </div>
        )}

        {sendError && (
          <div className={styles.replyBanner} style={{ color: '#c44' }}>
            <span>⚠️ {sendError}</span>
            <button onClick={() => setSendError('')}><X size={14} /></button>
          </div>
        )}

        <form className={styles.inputArea} onSubmit={sendMessage}>
          <EmojiPicker trigger={<SmilePlus size={18} />} onSelect={insertEmojiIntoComposer} />
          <textarea
            ref={inputRef}
            className={`input ${styles.chatInput}`}
            placeholder={
              isFreeTier
                ? 'Upgrade your membership to post...'
                : !replyingTo && !gate.canPost
                ? 'Reply to others while you earn likes to unlock posting...'
                : replyingTo ? `Reply to ${replyingTo.username}...` : `Message #${currentRoom.name}...`
            }
            value={newMsg}
            onChange={e => {
              setNewMsg(e.target.value)
              if (sendError) setSendError('')
              e.target.style.height = 'auto'
              e.target.style.height = `${e.target.scrollHeight}px`
            }}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                sendMessage(e)
              }
            }}
            disabled={!gate.canComment || (!replyingTo && !gate.canPost)}
            maxLength={2000}
            rows={1}
          />
          <button
            type="submit"
            className={`btn btn-primary ${styles.sendBtn}`}
            disabled={!newMsg.trim() || sending || !gate.canComment || (!replyingTo && !gate.canPost)}
          >
            <Send size={16} />
          </button>
        </form>
      </div>

      {showRules && <ChatRulesModal onClose={() => setShowRules(false)} />}
    </div>
  )
}
