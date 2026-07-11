import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { Send, Hash, Users, MessageCircle, X, Lock, SmilePlus, Trash2, Flag } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import EmojiPicker from '../components/EmojiPicker'
import styles from './Chat.module.css'

const DEFAULT_ROOMS = [
  { id: 'general',      name: 'General',          desc: 'Open discussion for all members',    color: '#4F6BED' },
  { id: 'rfq-help',     name: 'RFQ Help',          desc: 'Get eyes on your quotes and bids',   color: '#38A169' },
  { id: 'vendor-intel', name: 'Vendor Intel',       desc: 'Share and discover supplier leads',  color: '#C05621' },
  { id: 'wins',         name: 'Wins',               desc: 'Post your awards and milestones',    color: '#C9A84C' },
  { id: 'dibbs',        name: 'DIBBS',              desc: 'DIBBS-specific sourcing talk',       color: '#6B46C1' },
  { id: 'tools',        name: 'Tools & Automation', desc: 'Make.com, AI, workflow talk',        color: '#C53030' },
  { id: 'founding-members', name: 'Founding Members', desc: 'Private room for Founding Members only', color: '#C9A84C', foundingOnly: true },
]

const LIKES_NEEDED = 5
const REPORT_REASONS = [
  { id: 'spam', label: 'Spam' },
  { id: 'harassment', label: 'Harassment' },
  { id: 'inappropriate', label: 'Inappropriate content' },
  { id: 'other', label: 'Other' },
]

export default function Chat() {
  const { roomId } = useParams()
  const navigate = useNavigate()
  const { user, profile, isAdmin } = useAuth()
  const activeRoom = roomId || 'general'

  const isFoundingMember = isAdmin || profile?.membership_tier === 'founding'

  // Rooms this user is actually allowed to see in the sidebar
  const visibleRooms = DEFAULT_ROOMS.filter(room => !room.foundingOnly || isFoundingMember)

  const [messages, setMessages] = useState([])
  const [newMsg, setNewMsg] = useState('')
  const [sending, setSending] = useState(false)
  const [onlineCount, setOnlineCount] = useState(1)
  const [reactions, setReactions] = useState({})
  const [replyingTo, setReplyingTo] = useState(null)
  const [gate, setGate] = useState({ blocked: false, likesSoFar: 0, lastPostId: null })
  const [reportMenuFor, setReportMenuFor] = useState(null)
  const [reportedIds, setReportedIds] = useState(new Set())
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  // Guard: if someone lands on /chat/founding-members without access, bounce them to General.
  // (The Supabase RLS policy already blocks the actual data — this just keeps the UI honest.)
  useEffect(() => {
    const room = DEFAULT_ROOMS.find(r => r.id === activeRoom)
    if (room?.foundingOnly && !isFoundingMember) {
      navigate('/chat/general', { replace: true })
    }
  }, [activeRoom, isFoundingMember, navigate])

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

  async function checkGateStatus() {
    if (!user) return
    if (isAdmin) {
      setGate({ blocked: false, likesSoFar: 0, lastPostId: null })
      return
    }
    const { data: lastPost } = await supabase
      .from('messages')
      .select('id')
      .eq('user_id', user.id)
      .is('parent_id', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!lastPost) {
      setGate({ blocked: false, likesSoFar: 0, lastPostId: null })
      return
    }

    const { count } = await supabase
      .from('message_likes')
      .select('*', { count: 'exact', head: true })
      .eq('message_id', lastPost.id)

    const likesSoFar = count || 0
    setGate({
      blocked: likesSoFar < LIKES_NEEDED,
      likesSoFar,
      lastPostId: lastPost.id,
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
    if (!replyingTo && gate.blocked) return

    setSending(true)
    setNewMsg('')
    const wasReply = !!replyingTo
    try {
      await supabase.from('messages').insert({
        room_id: activeRoom,
        user_id: user.id,
        username: profile?.username || 'Member',
        content: text,
        parent_id: replyingTo?.id || null,
        created_at: new Date().toISOString(),
      })
      setReplyingTo(null)
      if (!wasReply) setTimeout(checkGateStatus, 300)
    } catch (err) {
      console.error('Send error:', err)
      setNewMsg(text)
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

  const currentRoom = DEFAULT_ROOMS.find(r => r.id === activeRoom) || DEFAULT_ROOMS[0]

  const topLevel = messages.filter(m => !m.parent_id)
  const repliesFor = id => messages.filter(m => m.parent_id === id)

  function renderMessage(msg, isReply = false) {
    const isOwn = msg.user_id === user?.id
    const canDelete = isAdmin || isOwn
    const alreadyReported = reportedIds.has(msg.id)
    const initials = (msg.username || 'M').slice(0, 2).toUpperCase()
    const msgReactions = reactions[msg.id] || {}
    const activeEmoji = Object.entries(msgReactions).filter(([, v]) => v.count > 0)

    return (
      <div key={msg.id} className={`${styles.message} ${isOwn ? styles.messageOwn : ''}`} style={isReply ? { marginLeft: isOwn ? 0 : 44, marginRight: isOwn ? 44 : 0 } : {}}>
        <div className="avatar" style={{ width: isReply ? 28 : 36, height: isReply ? 28 : 36, fontSize: isReply ? '0.6875rem' : undefined, ...(isOwn ? { order: 1 } : {}) }}>{initials}</div>
        <div className={styles.messageBubble}>
          <div className={styles.messageMeta}>
            <span className={styles.messageUser}>{msg.username || 'Member'}</span>
            <span className={styles.messageTime}>
              {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}
            </span>
          </div>
          <div className={`${styles.messageText} ${isOwn ? styles.messageTextOwn : ''}`}>
            {msg.content}
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
            {!isReply && (
              <button className={styles.actionBtn} onClick={() => { setReplyingTo(msg); inputRef.current?.focus() }}>
                <MessageCircle size={13} />
                Reply
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
            {room.foundingOnly && (
              <Lock size={12} style={{ marginLeft: 'auto', opacity: 0.6 }} />
            )}
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

        {gate.blocked && !replyingTo && (
          <div className={styles.gateBanner}>
            <Lock size={14} />
            <span>
              Your last post needs {LIKES_NEEDED - gate.likesSoFar} more like{LIKES_NEEDED - gate.likesSoFar === 1 ? '' : 's'} ({gate.likesSoFar}/{LIKES_NEEDED}) before you can start a new post. You can still reply to others anytime.
            </span>
          </div>
        )}

        {replyingTo && (
          <div className={styles.replyBanner}>
            <span>Replying to <strong>{replyingTo.username}</strong>: {replyingTo.content.slice(0, 60)}{replyingTo.content.length > 60 ? '…' : ''}</span>
            <button onClick={() => setReplyingTo(null)}><X size={14} /></button>
          </div>
        )}

        <form className={styles.inputArea} onSubmit={sendMessage}>
          <EmojiPicker trigger={<SmilePlus size={18} />} onSelect={insertEmojiIntoComposer} />
          <input
            ref={inputRef}
            className={`input ${styles.chatInput}`}
            placeholder={
              !replyingTo && gate.blocked
                ? 'Reply to others while your last post earns likes...'
                : replyingTo ? `Reply to ${replyingTo.username}...` : `Message #${currentRoom.name}...`
            }
            value={newMsg}
            onChange={e => setNewMsg(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                sendMessage(e)
              }
            }}
            disabled={!replyingTo && gate.blocked}
            maxLength={2000}
            autoComplete="off"
          />
          <button
            type="submit"
            className={`btn btn-primary ${styles.sendBtn}`}
            disabled={!newMsg.trim() || sending || (!replyingTo && gate.blocked)}
          >
            <Send size={16} />
          </button>
        </form>
      </div>
    </div>
  )
}
