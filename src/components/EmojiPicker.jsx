import { useState, useRef, useEffect } from 'react'
import useDialogA11y from '../hooks/useDialogA11y'
import styles from './EmojiPicker.module.css'

const EMOJI = [
  ['😀', 'grinning face'], ['😂', 'face with tears of joy'], ['😍', 'heart eyes'], ['😎', 'smiling face with sunglasses'],
  ['🤔', 'thinking face'], ['😢', 'crying face'], ['😮', 'surprised face'], ['😡', 'angry face'],
  ['👍', 'thumbs up'], ['👎', 'thumbs down'], ['👏', 'clapping hands'], ['🙌', 'raising hands'],
  ['🙏', 'folded hands'], ['💪', 'flexed biceps'], ['🤝', 'handshake'], ['👋', 'waving hand'],
  ['❤️', 'red heart'], ['🔥', 'fire'], ['🎉', 'party popper'], ['💯', 'hundred points'],
  ['⭐', 'star'], ['✅', 'check mark'], ['🚀', 'rocket'], ['💰', 'money bag'],
]

// A small button that opens a grid of emoji. Calls onSelect(emoji) and closes.
// `label` names the trigger for screen readers, since `trigger` is always
// a bare icon with no visible text of its own (e.g. "React with emoji" vs
// "Insert emoji" — the two current call sites do different things).
export default function EmojiPicker({ onSelect, trigger, label = 'Choose an emoji' }) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)
  const triggerRef = useRef(null)

  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  useDialogA11y({ isOpen: open, onClose: () => setOpen(false), containerRef: wrapRef })

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <button
        ref={triggerRef}
        type="button"
        className={styles.triggerBtn}
        onClick={() => setOpen(o => !o)}
        aria-label={label}
        aria-haspopup="true"
        aria-expanded={open}
      >
        {trigger}
      </button>
      {open && (
        <div className={styles.popover} role="menu" aria-label={label}>
          <div className={styles.grid}>
            {EMOJI.map(([e, name]) => (
              <button
                key={e}
                type="button"
                role="menuitem"
                className={styles.emojiBtn}
                aria-label={name}
                onClick={() => { onSelect(e); setOpen(false); triggerRef.current?.focus() }}
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
