import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react'

// Site key is public by design — it's meant to ship in client code (it
// identifies the widget, not a secret; the actual verification secret
// lives server-side in Supabase's Attack Protection settings).
const SITE_KEY = '0x4AAAAAAEQ5qXqIODs9pgvr'

// Renders a Cloudflare Turnstile challenge and reports the resulting
// token via onVerify. Exposes a `reset()` method via ref, since a
// Turnstile token is single-use — after any failed submit that consumed
// it (or a Supabase rejection), the widget must be reset before the
// visitor can retry.
const Turnstile = forwardRef(function Turnstile({ onVerify }, ref) {
  const containerRef = useRef(null)
  const widgetIdRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    let pollInterval = null

    function renderWidget() {
      if (cancelled || !containerRef.current || !window.turnstile) return
      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: SITE_KEY,
        // Cloudflare's default 'normal' size is a fixed ~300px wide and
        // doesn't shrink to fit its container. 'flexible' tracks the
        // container's width instead, but still has a 300px floor of its
        // own — on a narrow phone the auth card's own padding (.page +
        // .card, ~112px combined) leaves less than 300px of usable width,
        // so 'flexible' still overflowed. 'compact' has a much smaller
        // (~150px) footprint with no risk of hitting that floor, so it's
        // used below the point where 'flexible' can't fit reliably.
        size: window.innerWidth < 400 ? 'compact' : 'flexible',
        // Auth.module.css's .card is always white/light regardless of
        // device dark mode, but Turnstile's default 'auto' theme follows
        // the OS — on a dark-mode phone that rendered as a heavy black
        // square against the light card. Forcing 'light' keeps it visually
        // consistent with the card it's actually sitting inside.
        theme: 'light',
        callback: token => onVerify(token),
        'expired-callback': () => onVerify(''),
        'error-callback': () => onVerify(''),
      })
    }

    if (window.turnstile) {
      renderWidget()
    } else {
      // The script tag in index.html loads with async/defer, so it may
      // not be ready yet on first mount — poll briefly until it is.
      pollInterval = setInterval(() => {
        if (window.turnstile) {
          clearInterval(pollInterval)
          renderWidget()
        }
      }, 100)
    }

    return () => {
      cancelled = true
      if (pollInterval) clearInterval(pollInterval)
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useImperativeHandle(ref, () => ({
    reset: () => {
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.reset(widgetIdRef.current)
      }
    },
  }))

  return <div ref={containerRef} style={{ margin: '4px 0', width: '100%' }} />
})

export default Turnstile
