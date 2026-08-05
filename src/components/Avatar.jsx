// Reusable avatar: renders the uploaded photo (avatarUrl) if present,
// otherwise falls back to the existing navy initials circle. Drop-in
// replacement for the old `<div className="avatar">{initials}</div>`
// pattern used across Layout, Profile, FoundersWall, and AdminPanel —
// same global .avatar CSS class, so sizing/border/radius stay identical.
export default function Avatar({
  avatarUrl,
  firstName,
  lastName,
  username,
  size = 36,
  fontSize,
  className = '',
  style,
}) {
  const initials =
    firstName && lastName
      ? (firstName[0] + lastName[0]).toUpperCase()
      : (username || 'M').slice(0, 2).toUpperCase()

  const dimStyle = { width: size, height: size, ...(fontSize ? { fontSize } : {}), ...style }

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={username ? `${username}'s avatar` : 'Avatar'}
        className={`avatar ${className}`.trim()}
        style={{ ...dimStyle, objectFit: 'cover' }}
      />
    )
  }

  return (
    <div className={`avatar ${className}`.trim()} style={dimStyle}>
      {initials}
    </div>
  )
}
