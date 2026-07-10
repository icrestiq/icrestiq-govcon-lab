import { useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../lib/AuthContext'
import {
  LayoutDashboard, MessageSquare, ShoppingBag,
  LogOut, Menu, X, Shield, ChevronRight, CreditCard, User
} from 'lucide-react'
import Footer from './Footer'
import styles from './Layout.module.css'

const NAV = [
  { to: '/dashboard',  icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/chat',       icon: MessageSquare,   label: 'Community' },
  { to: '/store',      icon: ShoppingBag,     label: 'Store' },
  { to: '/membership', icon: CreditCard,      label: 'Membership' },
  { to: '/profile',    icon: User,            label: 'Profile' },
]

export default function Layout() {
  const { profile, signOut, isAdmin } = useAuth()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)

  async function handleSignOut() {
    await signOut()
    navigate('/')
  }

  const initials = profile?.first_name && profile?.last_name
    ? (profile.first_name[0] + profile.last_name[0]).toUpperCase()
    : profile?.username
      ? profile.username.slice(0, 2).toUpperCase()
      : '??'

  const displayName = profile?.first_name
    ? `${profile.first_name} ${profile.last_name || ''}`.trim()
    : profile?.username || 'Member'

  return (
    <div className={styles.shell}>
      {/* Mobile header */}
      <header className={styles.mobileHeader}>
        <div className={styles.mobileLogo}>
          <div className={styles.logoMark}>iQ</div>
          <div>
            <span className={styles.logoText}>GovCon Lab</span>
            <span className={styles.logoSub}> by iCrestiQ</span>
          </div>
        </div>
        <button className={styles.menuBtn} onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </header>

      {mobileOpen && <div className={styles.overlay} onClick={() => setMobileOpen(false)} />}

      {/* Sidebar */}
      <aside className={`${styles.sidebar} ${mobileOpen ? styles.sidebarOpen : ''}`}>
        <div className={styles.logo}>
          <div className={styles.logoMark}>iQ</div>
          <div>
            <div className={styles.logoText}>GovCon Lab</div>
            <div className={styles.logoSub}>by iCrestiQ</div>
          </div>
        </div>

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

        <div className={styles.userSection}>
          <div className={styles.userInfo}>
            <div className="avatar">{initials}</div>
            <div className={styles.userMeta}>
              <div className={styles.userName}>{displayName}</div>
              <div className={styles.userRole}>{profile?.membership_tier || profile?.role || 'member'}</div>
            </div>
          </div>
          <button className={styles.signOutBtn} onClick={handleSignOut} title="Sign out">
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      {/* Main content + footer */}
      <div className={styles.mainWrap}>
        <main className={styles.main}>
          <Outlet />
        </main>
        <Footer />
      </div>
    </div>
  )
}
