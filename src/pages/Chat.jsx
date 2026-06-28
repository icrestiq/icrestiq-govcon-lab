import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { Send, Hash, Users, ChevronRight } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import styles from './Chat.module.css'

const DEFAULT_ROOMS = [
  { id: 'general',    name: 'General',       desc: 'Open discussion for all members' },
  { id: 'rfq-help',  name: 'RFQ Help',       desc: 'Get eyes on your quotes and bids' },
  { id: 'vendor-intel', name: 'Vendor Intel', desc: 'Share and discover supplier leads' },
  { id: 'wins',      name: 'Wins',            desc: 'Post your awards and milestones' },
  { id: 'dibbs',     name: 'DIBBS',           desc: 'DIBBS-specific sourcing talk' },
  { id: 'tools',     name: 'Tools & Automation', desc: 'Make.com, AI, workflow talk' },
]

export default function Chat() {
  const { roomId } = useParams()
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const activeRoom = roomId || 'general'

  const [messages, setMessages] = useState([])
  const [newMsg, setNewMsg] = useState('')
  const [sending, setSending] = useState(false)
  const [onlineCount, setOnlineCount] = useState(1)
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  // Load messages for the active room
  useEffect(() => {
    setMessages([])
    loadMessages()

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
        setTimeout(scrollToBottom, 50)
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
      supabase.removeChannel(presence)
    }
  }, [activeRoom, user?.id, profile?.username])

  useEffect(() => { scrollToBottom() }, [messages])

  async function loadMessages() {
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('room_id', activeRoom)
      .order('created_at', { ascending: true })
      .limit(100)
    if (data) setMessages(data)
  }

  async function sendMessage(e) {
    e.preventDefault()
    const text = newMsg.trim()
    if (!text || sending) return

    setSending(true)
    setNewMsg('')
    try {
      await supabase.from('messages').insert({
        room_id: activeRoom,
        user_id: user.id,
        username: profile?.username || 'Member',
        content: text,
        created_at: new Date().toISOString(),
      })
    } catch (err) {
      console.error('Send error:', err)
      setNewMsg(text) // restore on failure
    } finally {
      setSending(false)
      inputRef.current?.focus()
    }
  }

  const currentRoom = DEFAULT_ROOMS.find(r => r.id === activeRoom) || DEFAULT_ROOMS[0]

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
            <Hash size={14} />
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

          {messages.map((msg, i) => {
            const isOwn = msg.user_id === user?.id
            const showAvatar = i === 0 || messages[i - 1]?.user_id !== msg.user_id
            const initials = (msg.username || 'M').slice(0, 2).toUpperCase()

            return (
              <div key={msg.id || i} className={`${styles.message} ${isOwn ? styles.messageOwn : ''}`}>
                {showAvatar ? (
                  <div className="avatar" style={isOwn ? { order: 1 } : {}}>{initials}</div>
                ) : (
                  <div style={{ width: 36, flexShrink: 0 }} />
                )}
                <div className={styles.messageBubble}>
                  {showAvatar && (
                    <div className={styles.messageMeta}>
                      <span className={styles.messageUser}>{msg.username || 'Member'}</span>
                      <span className={styles.messageTime}>
                        {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}
                      </span>
                    </div>
                  )}
                  <div className={`${styles.messageText} ${isOwn ? styles.messageTextOwn : ''}`}>
                    {msg.content}
                  </div>
                </div>
              </div>
            )
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <form className={styles.inputArea} onSubmit={sendMessage}>
          <input
            ref={inputRef}
            className={`input ${styles.chatInput}`}
            placeholder={`Message #${currentRoom.name}...`}
            value={newMsg}
            onChange={e => setNewMsg(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                sendMessage(e)
              }
            }}
            maxLength={2000}
            autoComplete="off"
          />
          <button
            type="submit"
            className={`btn btn-primary ${styles.sendBtn}`}
            disabled={!newMsg.trim() || sending}
          >
            <Send size={16} />
          </button>
        </form>
      </div>
    </div>
  )
}
