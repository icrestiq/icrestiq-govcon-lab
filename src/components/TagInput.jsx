import { useState } from 'react'

// Small reusable tag-style input — type a value, press Enter/comma (or
// blur) to add it as a chip, backspace on an empty field to pop the last
// one. Used anywhere a member enters a short free-text list (PSC codes,
// agency allow/deny lists) with no fixed reference dataset to validate
// against, unlike the NAICS selector which always looks up real codes.
export default function TagInput({ value = [], onChange, placeholder, transform = (s) => s.trim(), maxItems, id, ariaLabel }) {
  const [text, setText] = useState('')
  const atLimit = maxItems != null && value.length >= maxItems

  function commit() {
    const t = transform(text)
    setText('')
    if (!t || value.includes(t) || atLimit) return
    onChange([...value, t])
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      commit()
    } else if (e.key === 'Backspace' && !text && value.length > 0) {
      onChange(value.slice(0, -1))
    }
  }

  function remove(item) {
    onChange(value.filter((v) => v !== item))
  }

  return (
    <div>
      {value.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
          {value.map((item) => (
            <span
              key={item}
              className="badge badge-navy"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              {item}
              <button
                type="button"
                onClick={() => remove(item)}
                aria-label={`Remove ${item}`}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontSize: 13, lineHeight: 1, padding: 0 }}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      {!atLimit ? (
        <input
          id={id}
          className="input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={commit}
          placeholder={placeholder}
          aria-label={ariaLabel}
        />
      ) : (
        <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
          Maximum of {maxItems} reached. Remove one to add another.
        </p>
      )}
    </div>
  )
}
