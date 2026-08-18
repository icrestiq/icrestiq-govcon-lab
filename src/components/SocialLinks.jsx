import { Facebook, Instagram, X } from 'lucide-react'

// Threads has no icon in lucide-react (checked the installed package —
// Facebook/Instagram/Twitter exist, Threads doesn't at all). Built as a
// simple stroke-style glyph matching lucide's own icon conventions
// (viewBox 0 0 24 24, stroke-based, currentColor) so it sits visually
// consistent next to the library icons rather than looking like a
// mismatched brand asset.
function ThreadsIcon({ size = 18, ...props }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M12 2c-5 0-8 3-8 8v4c0 5 3 8 8 8s8-3 8-8c0-2-1-3.5-3-3.5-1.5 0-2.5 1-2.5 2.5 0 1 .5 1.5 1.5 1.5" />
    </svg>
  )
}

// X's current logo isn't in lucide-react either (only the old Twitter
// bird), but lucide's own generic `X` glyph — a bold crossed line mark —
// already reads correctly as the platform's logo in a social-icon row,
// so it's reused here rather than adding another custom SVG.
const LINKS = [
  { href: 'https://x.com/govconlab', label: 'X (Twitter)', Icon: X },
  { href: 'https://www.facebook.com/profile.php?id=61592367374514', label: 'Facebook', Icon: Facebook },
  { href: 'https://www.threads.net/@govconlab', label: 'Threads', Icon: ThreadsIcon },
  { href: 'https://www.instagram.com/govconlab', label: 'Instagram', Icon: Instagram },
]

export default function SocialLinks({ size = 18, gap = 'var(--sp-4)', className, style, linkClassName }) {
  return (
    <div className={className} style={{ display: 'flex', alignItems: 'center', gap, ...style }}>
      {LINKS.map(({ href, label, Icon }) => (
        <a
          key={label}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={label}
          title={label}
          className={linkClassName}
          style={{ color: 'inherit', display: 'flex' }}
        >
          <Icon size={size} />
        </a>
      ))}
    </div>
  )
}
