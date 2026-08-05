import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './lib/AuthContext'
import Layout from './components/layout/Layout'
import Landing from './pages/Landing'
import About from './pages/About'
import Login from './pages/Login'
import Register from './pages/Register'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import Dashboard from './pages/Dashboard'
import Chat from './pages/Chat'
import Store from './pages/Store'
import ProductDetail from './pages/ProductDetail'
import Membership from './pages/Membership'
import FoundersWall from './pages/FoundersWall'
import ProposalBuilder from './pages/ProposalBuilder'
import Profile from './pages/Profile'
import AdminPanel from './pages/AdminPanel'
import CheckoutSuccess from './pages/CheckoutSuccess'
import CheckoutCancel from './pages/CheckoutCancel'
import DigestConfirmed from './pages/DigestConfirmed'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return (
    <div className="loading-screen">
      <div className="spinner" />
      <span className="mono">Loading iCrestiQ GovCon Lab...</span>
    </div>
  )
  return user ? children : <Navigate to="/login" replace />
}

function AdminRoute({ children }) {
  const { user, isAdmin, loading } = useAuth()
  if (loading) return <div className="loading-screen"><div className="spinner" /></div>
  if (!user) return <Navigate to="/login" replace />
  if (!isAdmin) return <Navigate to="/dashboard" replace />
  return children
}

export default function App() {
  const { user, loading } = useAuth()

  if (loading) return (
    <div className="loading-screen">
      <div className="spinner" />
      <span className="mono">Initializing...</span>
    </div>
  )

  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={user ? <Navigate to="/dashboard" /> : <Landing />} />
      <Route path="/login" element={user ? <Navigate to="/dashboard" /> : <Login />} />
      <Route path="/register" element={user ? <Navigate to="/dashboard" /> : <Register />} />
      {/* Forgot/reset password are deliberately NOT wrapped in the
          user-redirect pattern like /login and /register above.
          /reset-password in particular must stay reachable even when the
          visitor technically has a session — clicking the emailed
          recovery link is itself what creates that session, so
          redirecting away from this route for "already logged in" would
          break the exact flow it exists to serve. */}
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/about" element={<About />} />

      {/* Stripe checkout result pages - public so Stripe can redirect */}
      <Route path="/checkout/success" element={<CheckoutSuccess />} />
      <Route path="/checkout/cancel" element={<CheckoutCancel />} />

      {/* Digest signup confirmation - public so the emailed link works for anyone */}
      <Route path="/digest-confirmed" element={<DigestConfirmed />} />

      {/* Public marketing pages — browsable without an account.
          Still wrapped in Layout for consistent nav/shell; only the
          purchase actions inside these pages require sign-in (see
          ProductDetail.jsx / Membership.jsx). */}
      <Route path="/" element={<Layout />}>
        <Route path="store" element={<Store />} />
        <Route path="store/:productId" element={<ProductDetail />} />
        <Route path="membership" element={<Membership />} />
        <Route path="founders" element={<FoundersWall />} />
      </Route>

      {/* Protected - inside layout */}
      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="chat" element={<Chat />} />
        <Route path="chat/:roomId" element={<Chat />} />
        <Route path="tools/proposal-builder" element={<ProposalBuilder />} />
        <Route path="profile" element={<Profile />} />
      </Route>

      {/* Admin */}
      <Route path="/admin" element={<AdminRoute><Layout /></AdminRoute>}>
        <Route index element={<AdminPanel />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}