import { useEffect, useRef } from 'react'

const FOCUSABLE_SELECTOR = [
  'a[href]', 'button:not([disabled])', 'textarea:not([disabled])',
  'input:not([disabled])', 'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

// Shared keyboard/focus behavior for this app's hand-rolled modals and the
// mobile nav drawer, covering what every one of them was missing: focus
// moves into the dialog when it opens, Tab/Shift+Tab is trapped inside it
// while open, Escape closes it, and focus returns to whatever triggered
// it once it closes. Works whether the dialog is conditionally mounted
// (Pipeline's DealDetailModal, Chat's ChatRulesModal, AdminPanel's
// PersonDetailModal — isOpen is always true for the component's whole
// lifetime, cleanup runs on unmount) or always-mounted and toggled by a
// boolean (CartDrawer, the mobile nav sidebar).
export default function useDialogA11y({ isOpen, onClose, containerRef }) {
  const previouslyFocused = useRef(null)

  useEffect(() => {
    if (!isOpen) return undefined

    previouslyFocused.current = document.activeElement

    const container = containerRef.current
    const focusFirst = () => {
      const focusable = container?.querySelectorAll(FOCUSABLE_SELECTOR)
      if (focusable && focusable.length > 0) focusable[0].focus()
      else container?.focus()
    }
    // Deferred a tick so conditionally-mounted dialogs have finished
    // painting their content before focus moves.
    const raf = requestAnimationFrame(focusFirst)

    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose?.()
        return
      }
      if (e.key !== 'Tab' || !container) return
      const focusable = Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR))
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', handleKeyDown, true)

    return () => {
      cancelAnimationFrame(raf)
      document.removeEventListener('keydown', handleKeyDown, true)
      const toRestore = previouslyFocused.current
      if (toRestore && document.contains(toRestore)) toRestore.focus()
    }
  }, [isOpen, onClose, containerRef])
}
