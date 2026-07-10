import { useState, useRef, useEffect } from 'react'
import styles from './EmojiPicker.module.css'

const EMOJI = [
  '😀', '😂', '😍', '😎', '🤔', '😢', '😮', '😡',
  '👍', '👎', '👏', '🙌', '🙏', '💪', '🤝', '👋',
  '❤️', '🔥', '🎉', '💯', '⭐', '✅', '🚀', '💰',
]

// A small button that opens a grid of emoji. Calls onSelect(emoji) and closes.
export default function EmojiPicker({ onSelect, trigger }) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)

  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <button type="button" className={styles.triggerBtn} onClick={() => setOpen(o => !o)}>
        {trigger}
      </button>
      {open && (
        <div className={styles.popover}>
          <div className={styles.grid}>
            {EMOJI.map(e => (
              <button
                key={e}
                type="button"
                className={styles.emojiBtn}
                onClick={() => { onSelect(e); setOpen(false) }}
              >
                {e}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
