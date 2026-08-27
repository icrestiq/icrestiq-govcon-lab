import { useEffect } from 'react'

// Sets a descriptive, page-specific document.title (WCAG 2.4.2) and
// restores whatever title was there before on unmount, so navigating
// between routes never leaves a stale title behind.
export default function useDocumentTitle(title) {
  useEffect(() => {
    if (!title) return
    const previous = document.title
    document.title = title
    return () => { document.title = previous }
  }, [title])
}
