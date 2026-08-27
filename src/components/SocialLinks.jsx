// Filled brand-mark SVGs for all four platforms, built from the standard
// published paths for each logo (the same shapes used broadly across the
// web for these brands) rather than lucide-react's generic outline icons —
// lucide has Facebook/Instagram/the old Twitter bird but no current X
// logo and no Threads icon at all, and mixing "real logo" with "generic
// outline" reads inconsistently, so all four are the same filled style.
// Reproduced from memory of the standard versions, not traced from an
// image — if any of these look even slightly off once deployed, worth a
// visual check against the real brand assets.

function XLogo({ size = 18, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  )
}

function ThreadsLogo({ size = 18, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.03-3.579.879-6.43 2.525-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.304-6.015-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.914 3.589 12c.027 3.086.718 5.496 2.057 7.164 1.43 1.781 3.631 2.695 6.54 2.717 2.623-.02 4.358-.631 5.8-2.045 1.647-1.613 1.618-3.593 1.09-4.798-.31-.71-.873-1.3-1.634-1.75-.192 1.352-.622 2.446-1.284 3.272-.886 1.102-2.14 1.704-3.73 1.79-1.202.065-2.361-.218-3.259-.801-1.063-.689-1.685-1.74-1.752-2.964-.065-1.19.408-2.285 1.33-3.082.88-.76 2.119-1.207 3.583-1.29a13.853 13.853 0 0 1 3.02.142c-.126-.742-.375-1.335-.75-1.774-.516-.605-1.313-.917-2.37-.926h-.028c-.85 0-2.007.235-2.75 1.354l-1.744-1.187c.994-1.512 2.606-2.343 4.54-2.343h.033c3.216.02 5.13 1.99 5.323 5.454.11.047.219.095.325.145 1.5.708 2.6 1.786 3.18 3.115.802 1.84.874 4.84-1.548 7.208-1.85 1.81-4.094 2.628-7.277 2.65Zm1.156-11.986c-.216 0-.435.006-.655.02-1.816.104-2.936.98-2.882 2.14.06 1.263 1.487 1.885 2.906 1.812 1.294-.067 2.98-.596 3.283-3.858-.874-.196-1.752-.296-2.652-.296Z" />
    </svg>
  )
}

function FacebookLogo({ size = 18, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 8.14 8.14 0 0 0-.629-.001c-.958 0-1.501.226-1.865.611-.359.379-.53.958-.53 1.848v1.513h3.596l-.474 3.667h-3.122v7.98H9.101z" />
    </svg>
  )
}

function InstagramLogo({ size = 18, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M12 0C8.74 0 8.333.014 7.053.072 5.775.132 4.905.333 4.14.63a5.883 5.883 0 0 0-2.126 1.384A5.883 5.883 0 0 0 .63 4.14C.333 4.905.131 5.775.072 7.053.014 8.333 0 8.74 0 12s.014 3.667.072 4.947c.06 1.277.261 2.148.558 2.913.306.789.717 1.459 1.384 2.126.667.666 1.336 1.079 2.126 1.384.766.296 1.636.499 2.913.558C8.333 23.986 8.74 24 12 24s3.667-.014 4.947-.072c1.277-.06 2.148-.262 2.913-.558a5.89 5.89 0 0 0 2.126-1.384 5.89 5.89 0 0 0 1.384-2.126c.296-.765.499-1.636.558-2.913.058-1.28.072-1.687.072-4.947s-.014-3.667-.072-4.947c-.06-1.277-.262-2.148-.558-2.913a5.89 5.89 0 0 0-1.384-2.126A5.89 5.89 0 0 0 19.86.63c-.766-.297-1.636-.499-2.913-.558C15.667.014 15.26 0 12 0zm0 2.16c3.203 0 3.585.016 4.85.071 1.17.055 1.805.249 2.227.415.562.217.96.477 1.382.896.419.42.679.819.896 1.381.164.422.36 1.057.413 2.227.057 1.266.07 1.646.07 4.85s-.015 3.585-.074 4.85c-.061 1.17-.256 1.805-.421 2.227a3.81 3.81 0 0 1-.899 1.382c-.42.419-.824.679-1.38.896-.422.164-1.065.36-2.235.413-1.274.057-1.649.07-4.859.07-3.211 0-3.586-.015-4.859-.074-1.171-.061-1.816-.256-2.236-.421a3.71 3.71 0 0 1-1.379-.899c-.421-.419-.69-.824-.9-1.38-.165-.422-.359-1.065-.42-2.235-.045-1.26-.061-1.649-.061-4.844 0-3.196.016-3.586.061-4.861.061-1.17.255-1.814.42-2.234.21-.577.479-.98.9-1.381.4-.42.802-.69 1.379-.899.42-.166 1.051-.361 2.221-.421 1.275-.045 1.65-.06 4.859-.06l.045.03zm0 3.678a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm7.846-10.405a1.441 1.441 0 1 1-2.883 0 1.441 1.441 0 0 1 2.883 0z" />
    </svg>
  )
}

const LINKS = [
  { href: 'https://x.com/govconlab', label: 'X (Twitter)', Icon: XLogo },
  { href: 'https://www.facebook.com/profile.php?id=61592367374514', label: 'Facebook', Icon: FacebookLogo },
  { href: 'https://www.threads.net/@govconlab', label: 'Threads', Icon: ThreadsLogo },
  { href: 'https://www.instagram.com/govconlab', label: 'Instagram', Icon: InstagramLogo },
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
          <Icon size={size} aria-hidden="true" />
        </a>
      ))}
    </div>
  )
}
