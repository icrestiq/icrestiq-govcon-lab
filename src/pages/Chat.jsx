import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { Send, Hash, Users, ChevronRight, Heart, MessageCircle, X, Lock } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import styles from './Chat.module.css'

const DEFAULT_ROOMS = [
  { id: 'general',      name: 'General',          desc: 'Open discussion for all members',    color: '#4F6BED' },
  { id: 'rfq-help',     name: 'RFQ Help',          desc: 'Get eyes on your quotes and bids',   color: '#38A169' },
  { id: 'vendor-intel', name: 'Vendor Intel',       desc: 'Share and discover supplier leads',  color: '#C05621' },
  { id: 'wins',         name: 'Wins',               desc: 'Post your awards and milestones',    color: '#C9A84C' },
  { id: 'dibbs',        name: 'DIBBS',              desc: 'DIBBS-specific sourcing talk',       color: '#6B46C1' },
  { id: 'tools',        name: 'Tools & Automation', desc: 'Make.com, AI, workflow talk',        color: '#C53030' },
]

const LIKES_NEEDED = 5

export default function Chat() {
  const { roomId } = useParams()
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const activeRoom = roomId || 'general'

  const [messages, setMessages] = useState([])
  const [newMsg, setNewMsg] = useState('')
  const [sending, setSending] = useState(false)
  const [onlineCount, setOnlineCount] = useState(1)
  const [likes, setLikes] = useState({}) // { [message_id]: { count, likedByMe } }
  const [replyingTo, setReplyingTo] = useState(null) // message object or null
  const [gate, setGate] = useState({ blocked: false, likesSoFar: 0, lastPostId: null })
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  // Load messages for the active room
  useEffect(() => {
    setMessages([])
    loadMessages()
    checkGateStatus()

    // Subscribe to real-time messages
    const channel = supabase
      .channel(`room:${activeRoom}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `room_id=eq.${activeRoom}`,
      }, payload => {
        setMessages(prev => [...prev, payload.new])
        loadLikesFor([payload.new.id])
        setTimeout(scrollToBottom, 50)
      })
      .subscribe()

    // Subscribe to real-time likes (no room_id column, so filter client-side)
    const likesChannel = supabase
      .channel(`likes:${activeRoom}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'message_likes' }, () => {
        refreshVisibleLikes()
        checkGateStatus()
      })
      .subscribe()

    // Track presence (online count)
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
      supabase.removeChannel(likesChannel)
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
      loadLikesFor(data.map(m => m.id))
    }
  }

  async function loadLikesFor(messageIds) {
    if (!messageIds.length) return
    const { data } = await supabase
      .from('message_likes')
      .select('message_id, user_id')
      .in('message_id', messageIds)
    if (!data) return
    setLikes(prev => {
      const next = { ...prev }
      messageIds.forEach(id => { next[id] = { count: 0, likedByMe: false } })
      data.forEach(row => {
        if (!next[row.message_id]) next[row.message_id] = { count: 0, likedByMe: false }
        next[row.message_id].count += 1
        if (row.user_id === user?.id) next[row.message_id].likedByMe = true
      })
      return next
    })
  }

  function refreshVisibleLikes() {
    const ids = messages.map(m => m.id)
    if (ids.length) loadLikesFor(ids)
  }

  async function checkGateStatus() {
    if (!user) return
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

  async function toggleLike(message) {
    if (!user) return
    const current = likes[message.id] || { count: 0, likedByMe: false }
    // Optimistic update
    setLikes(prev => ({
      ...prev,
      [message.id]: {
        count: current.likedByMe ? current.count - 1 : current.count + 1,
        likedByMe: !current.likedByMe,
      },
    }))
    try {
      if (current.likedByMe) {
        await supabase.from('message_likes').delete().eq('message_id', message.id).eq('user_id', user.id)
      } else {
        await supabase.from('message_likes').insert({ message_id: message.id, user_id: user.id })
      }
    } catch (err) {
      console.error('Like error:', err)
      loadLikesFor([message.id]) // revert on failure
    }
  }

  async function sendMessage(e) {
    e.preventDefault()
    const text = newMsg.trim()
    if (!text || sending) return
    if (!replyingTo && gate.blocked) return // gated from new top-level posts

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
      setNewMsg(text) // restore on failure
    } finally {
      setSending(false)
      inputRef.current?.focus()
    }
  }

  const currentRoom = DEFAULT_ROOMS.find(r => r.id === activeRoom) || DEFAULT_ROOMS[0]

  // Group messages: top-level posts, each followed by its replies
  const topLevel = messages.filter(m => !m.parent_id)
  const repliesFor = id => messages.filter(m => m.parent_id === id)

  function renderMessage(msg, isReply = false) {
    const isOwn = msg.user_id === user?.id
    const initials = (msg.username || 'M').slice(0, 2).toUpperCase()
    const likeInfo = likes[msg.id] || { count: 0, likedByMe: false }

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
          <div className={styles.messageActions}>
            <button
              className={`${styles.actionBtn} ${likeInfo.likedByMe ? styles.actionBtnActive : ''}`}
              onClick={() => toggleLike(msg)}
            >
              <Heart size={13} fill={likeInfo.likedByMe ? 'currentColor' : 'none'} />
              {likeInfo.count > 0 && <span>{likeInfo.count}</span>}
            </button>
            {!isReply && (
              <button className={styles.actionBtn} onClick={() => { setReplyingTo(msg); inputRef.current?.focus() }}>
                <MessageCircle size={13} />
                Reply
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.shell}>
      {/* Room sidebar */}
      <div className={styles.roomList}>
        <div className={styles.roomListHeader}>
          <span className="mono" style={{ color: 'var(--text-muted)', fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Rooms</span>
        </div>
        {DEFAULT_ROOMS.map(room => (
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
          </button>
        ))}
      </div>

      {/* Chat area */}
      <div className={styles.chatArea}>
        {/* Chat header */}
        <div className={styles.chatHeader}>
          <div className={styles.chatHeaderLeft}>
            <Hash size={18} style={{ color: 'var(--green)' }} />
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

        {/* Messages */}
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

        {/* Gate banner — only affects new top-level posts, never replies */}
        {gate.blocked && !replyingTo && (
          <div className={styles.gateBanner}>
            <Lock size={14} />
            <span>
              Your last post needs {LIKES_NEEDED - gate.likesSoFar} more like{LIKES_NEEDED - gate.likesSoFar === 1 ? '' : 's'} ({gate.likesSoFar}/{LIKES_NEEDED}) before you can start a new post. You can still reply to others anytime.
            </span>
          </div>
        )}

        {/* Replying-to banner */}
        {replyingTo && (
          <div className={styles.replyBanner}>
            <span>Replying to <strong>{replyingTo.username}</strong>: {replyingTo.content.slice(0, 60)}{replyingTo.content.length > 60 ? '…' : ''}</span>
            <button onClick={() => setReplyingTo(null)}><X size={14} /></button>
          </div>
        )}

        {/* Input */}
        <form className={styles.inputArea} onSubmit={sendMessage}>
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
