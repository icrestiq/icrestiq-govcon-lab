import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './lib/AuthContext'
import { isProOrFounding } from './lib/tier'
import Layout from './components/layout/Layout'

// Route-level code splitting — previously every page was a static import,
// so Vite bundled the entire app (including the ~1900-line AdminPanel and
// the Proposal Builder's document generation) into one ~800KB chunk that
// every visitor downloaded on first paint, regardless of which page they
// actually landed on. Lazy-loading means each page ships as its own small
// chunk, fetched only when that route is actually visited. Layout stays a
// static import since it's the shared shell for nearly every route.
const Landing = lazy(() => import('./pages/Landing'))
const About = lazy(() => import('./pages/About'))
const Login = lazy(() => import('./pages/Login'))
const Register = lazy(() => import('./pages/Register'))
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'))
const ResetPassword = lazy(() => import('./pages/ResetPassword'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Chat = lazy(() => import('./pages/Chat'))
const Store = lazy(() => import('./pages/Store'))
const ProductDetail = lazy(() => import('./pages/ProductDetail'))
const Membership = lazy(() => import('./pages/Membership'))
const FoundersWall = lazy(() => import('./pages/FoundersWall'))
const Blog = lazy(() => import('./pages/Blog'))
const BlogPost = lazy(() => import('./pages/BlogPost'))
const ProposalBuilder = lazy(() => import('./pages/ProposalBuilder'))
const Profile = lazy(() => import('./pages/Profile'))
const MatchedOpportunities = lazy(() => import('./pages/MatchedOpportunities'))
const AdminPanel = lazy(() => import('./pages/AdminPanel'))
const CheckoutSuccess = lazy(() => import('./pages/CheckoutSuccess'))
const CheckoutCancel = lazy(() => import('./pages/CheckoutCancel'))
const DigestConfirmed = lazy(() => import('./pages/DigestConfirmed'))

// Same visual pattern as the auth-loading screens below, so a lazy chunk
// fetch never looks different from the loading states already in the app.
function RouteLoadingScreen() {
  return (
    <div className="loading-screen">
      <div className="spinner" />
    </div>
  )
}

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

// Gates Matched Opportunities behind Pro/Founding (or admin), same shape
// as AdminRoute above — signed-in-but-wrong-tier members bounce to
// /profile, where Matching Preferences (open to every tier) lives.
function TierRoute({ children }) {
  const { user, profile, isAdmin, loading } = useAuth()
  if (loading) return <div className="loading-screen"><div className="spinner" /></div>
  if (!user) return <Navigate to="/login" replace />
  if (!isProOrFounding(profile, isAdmin)) return <Navigate to="/profile" replace />
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
    <Suspense fallback={<RouteLoadingScreen />}>
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
        <Route path="blog" element={<Blog />} />
        <Route path="blog/:slug" element={<BlogPost />} />
      </Route>

      {/* Protected - inside layout */}
      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="chat" element={<Chat />} />
        <Route path="chat/:roomId" element={<Chat />} />
        <Route path="tools/proposal-builder" element={<ProposalBuilder />} />
        <Route path="profile" element={<Profile />} />
        <Route path="opportunities" element={<TierRoute><MatchedOpportunities /></TierRoute>} />
      </Route>

      {/* Admin */}
      <Route path="/admin" element={<AdminRoute><Layout /></AdminRoute>}>
        <Route index element={<AdminPanel />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </Suspense>
  )
}