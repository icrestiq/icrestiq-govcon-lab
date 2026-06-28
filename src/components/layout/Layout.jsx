import { useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../lib/AuthContext'
import {
  LayoutDashboard, MessageSquare, ShoppingBag,
  Settings, LogOut, Menu, X, Shield, ChevronRight, CreditCard
} from 'lucide-react'
import styles from './Layout.module.css'

const NAV = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/chat',      icon: MessageSquare,   label: 'Community' },
  { to: '/store',      icon: ShoppingBag,     label: 'Store' },
  { to: '/membership', icon: CreditCard,      label: 'Membership' },
]

export default function Layout() {
  const { profile, signOut, isAdmin } = useAuth()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)

  async function handleSignOut() {
    await signOut()
    navigate('/')
  }

  const initials = profile?.username
    ? profile.username.slice(0, 2).toUpperCase()
    : '??'

  return (
    <div className={styles.shell}>
      {/* Mobile header */}
      <header className={styles.mobileHeader}>
        <div className={styles.mobileLogo}>
          <span className={styles.logoMark}>iQ</span>
          <span className={styles.logoText}>GovCon Lab</span>
        </div>
        <button className={styles.menuBtn} onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </header>

      {/* Overlay */}
      {mobileOpen && (
        <div className={styles.overlay} onClick={() => setMobileOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`${styles.sidebar} ${mobileOpen ? styles.sidebarOpen : ''}`}>
        {/* Logo */}
        <div className={styles.logo}>
          <div className={styles.logoMark}>iQ</div>
          <div>
            <div className={styles.logoText}>GovCon Lab</div>
            <div className={styles.logoSub}>by iCrestiQ</div>
          </div>
        </div>

        {/* Nav */}
        <nav className={styles.nav}>
          <div className={styles.navLabel}>Navigation</div>
          {NAV.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `${styles.navItem} ${isActive ? styles.navActive : ''}`
              }
              onClick={() => setMobileOpen(false)}
            >
              <Icon size={18} />
              <span>{label}</span>
              <ChevronRight size={14} className={styles.navChevron} />
            </NavLink>
          ))}

          {isAdmin && (
            <>
              <div className={styles.navLabel} style={{ marginTop: 'var(--sp-6)' }}>Admin</div>
              <NavLink
                to="/admin"
                className={({ isActive }) =>
                  `${styles.navItem} ${isActive ? styles.navActive : ''}`
                }
                onClick={() => setMobileOpen(false)}
              >
                <Shield size={18} />
                <span>Admin Panel</span>
                <ChevronRight size={14} className={styles.navChevron} />
              </NavLink>
            </>
          )}
        </nav>

        {/* User */}
        <div className={styles.userSection}>
          <div className={styles.userInfo}>
            <div className="avatar">{initials}</div>
            <div className={styles.userMeta}>
              <div className={styles.userName}>{profile?.username || 'Member'}</div>
              <div className={styles.userRole}>{profile?.role || 'member'}</div>
            </div>
          </div>
          <button className={styles.signOutBtn} onClick={handleSignOut} title="Sign out">
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  )
}
