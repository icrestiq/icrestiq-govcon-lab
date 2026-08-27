import { useState, useRef } from 'react'
import { Outlet, NavLink, Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../lib/AuthContext'
import {
  LayoutDashboard, MessageSquare, ShoppingBag,
  LogOut, Menu, X, Shield, ChevronRight, CreditCard, User, Crown, FileText, Newspaper, Radar, Layers
} from 'lucide-react'
import Footer from './Footer'
import Avatar from '../Avatar'
import { isMemberOrFounding } from '../../lib/tier'
import useDialogA11y from '../../hooks/useDialogA11y'
import styles from './Layout.module.css'

const NAV = [
  { to: '/dashboard',  icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/chat',       icon: MessageSquare,   label: 'Community' },
  { to: '/store',      icon: ShoppingBag,     label: 'Store' },
  { to: '/blog',       icon: Newspaper,       label: 'Blog' },
  { to: '/membership', icon: CreditCard,      label: 'Membership' },
  { to: '/founders',   icon: Crown,           label: 'Founders' },
{ to: '/tools/proposal-builder', icon: FileText, label: 'Proposal Builder' },
  { to: '/profile',    icon: User,            label: 'Profile' },
]

export default function Layout() {
  const { user, profile, signOut, isAdmin } = useAuth()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)
  const sidebarRef = useRef(null)

  // A no-op on desktop: mobileOpen can only become true via the mobile
  // menu button below, which CSS hides outside the mobile breakpoint, so
  // this only ever traps focus/handles Escape when the drawer is actually
  // open on a narrow viewport — the always-visible desktop sidebar is
  // untouched.
  useDialogA11y({ isOpen: mobileOpen, onClose: () => setMobileOpen(false), containerRef: sidebarRef })

  async function handleSignOut() {
    await signOut()
    navigate('/')
  }

  const displayName = profile?.first_name
    ? `${profile.first_name} ${profile.last_name || ''}`.trim()
    : profile?.username || 'Member'

  return (
    <div className={styles.shell}>
      <a href="#main-content" className="skip-link">Skip to main content</a>

      {/* Mobile header */}
      <header className={`${styles.mobileHeader} no-print`}>
        <div className={styles.mobileLogo}>
          <div className={styles.logoMark}>iQ</div>
          <div>
            <span className={styles.logoText}>GovCon Lab</span>
            <span className={styles.logoSub}> by iCrestiQ</span>
          </div>
        </div>
        <button
          className={styles.menuBtn}
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={mobileOpen}
          aria-controls="primary-nav"
        >
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </header>

      {mobileOpen && <div className={`${styles.overlay} no-print`} onClick={() => setMobileOpen(false)} />}

      {/* Sidebar */}
      <aside id="primary-nav" ref={sidebarRef} className={`${styles.sidebar} ${mobileOpen ? styles.sidebarOpen : ''} no-print`}>
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

          {isMemberOrFounding(profile, isAdmin) && (
            <NavLink
              to="/opportunities"
              className={({ isActive }) =>
                `${styles.navItem} ${isActive ? styles.navActive : ''}`
              }
              onClick={() => setMobileOpen(false)}
            >
              <Radar size={18} />
              <span>Matched Opportunities</span>
              <ChevronRight size={14} className={styles.navChevron} />
            </NavLink>
          )}

          {isMemberOrFounding(profile, isAdmin) && (
            <NavLink
              to="/pipeline"
              className={({ isActive }) =>
                `${styles.navItem} ${isActive ? styles.navActive : ''}`
              }
              onClick={() => setMobileOpen(false)}
            >
              <Layers size={18} />
              <span>Sourcing Pipeline</span>
              <ChevronRight size={14} className={styles.navChevron} />
            </NavLink>
          )}

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

        {user ? (
          <div className={styles.userSection}>
            <div className={styles.userInfo}>
              <Avatar
                avatarUrl={profile?.avatar_url}
                firstName={profile?.first_name}
                lastName={profile?.last_name}
                username={profile?.username}
              />
              <div className={styles.userMeta}>
                <div className={styles.userName}>{displayName}</div>
                <div className={styles.userRole}>{profile?.membership_tier || profile?.role || 'member'}</div>
              </div>
            </div>
            <button className={styles.signOutBtn} onClick={handleSignOut} aria-label="Sign out">
              <LogOut size={16} aria-hidden="true" />
            </button>
          </div>
        ) : (
          <div className={styles.userSection}>
            <Link to="/login" className="btn btn-ghost" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setMobileOpen(false)}>
              Sign In
            </Link>
            <Link to="/register" className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setMobileOpen(false)}>
              Join
            </Link>
          </div>
        )}
      </aside>

      {/* Main content + footer */}
      <div className={styles.mainWrap}>
        <main id="main-content" className={styles.main} tabIndex={-1}>
          <Outlet />
        </main>
        <Footer />
      </div>
    </div>
  )
}