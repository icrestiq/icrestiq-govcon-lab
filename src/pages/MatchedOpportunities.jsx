import { useState, useEffect, useMemo, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { createSuggestedBidCheckout, SUGGESTED_BID_PRICING } from '../lib/stripe'
import { Radar, ExternalLink, Settings, ChevronDown, ChevronUp, Sparkles, Loader, RefreshCw, Copy, Check, FileText, Users, Truck, DollarSign, Database, Eye, EyeOff, Maximize2, X } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import useDialogA11y from '../hooks/useDialogA11y'
import useDocumentTitle from '../hooks/useDocumentTitle'
import styles from './MatchedOpportunities.module.css'

const RECOMMENDATION_BADGE = {
  go: 'badge-green',
  review: 'badge-amber',
  'no-go': 'badge-red',
}

const RECOMMENDATION_LABEL = {
  go: 'Go',
  review: 'Review',
  'no-go': 'No-Go',
}

// Below this, a match is collapsed behind the "show lower-scoring
// matches" toggle by default — keeps the list feeling curated rather
// than a flat dump of everything that happened to overlap on a code.
const LOW_SCORE_THRESHOLD = 50

// Rows in these states are still waiting on the checkout webhook or the
// generation Edge Function — worth re-checking; anything else is final.
const IN_FLIGHT_STATUSES = ['pending', 'paid', 'generating']
const POLL_INTERVAL_MS = 5000

function scoreBadgeClass(score) {
  if (score >= 80) return 'badge-green'
  if (score >= LOW_SCORE_THRESHOLD) return 'badge-amber'
  return 'badge-red'
}

// Deadline-window filter — separate from the closed/no-go/low-score
// collapse toggles below (those hide things by default; this narrows the
// list on request). "none" checks the deadline is missing rather than a
// day-count range, since a missing deadline can't fall in any of the
// numbered windows.
const DEADLINE_BUCKETS = [
  { value: 'all', label: 'All deadlines' },
  { value: '0-10', label: '0–10 days left' },
  { value: '11-15', label: '11–15 days left' },
  { value: '16-20', label: '16–20 days left' },
  { value: '21-25', label: '21–25 days left' },
  { value: '26-30', label: '26–30 days left' },
  { value: '31+', label: '31+ days — older' },
  { value: 'none', label: 'No deadline listed' },
]

function matchesDeadlineBucket(m, bucket) {
  if (bucket === 'all') return true
  const deadline = m.opportunities.response_deadline
  if (bucket === 'none') return !deadline
  if (!deadline) return false
  const daysLeft = Math.ceil((new Date(deadline).getTime() - Date.now()) / 86400000)
  if (bucket === '31+') return daysLeft >= 31
  const [min, max] = bucket.split('-').map(Number)
  return daysLeft >= min && daysLeft <= max
}

export default function MatchedOpportunities() {
  useDocumentTitle('Matched Opportunities — GovCon Lab')
  const { user, profile, isAdmin } = useAuth()
  const [searchParams] = useSearchParams()
  const [matches, setMatches] = useState([])
  const [bidRequests, setBidRequests] = useState({}) // keyed by opportunity_id
  const [dealsByBidRequestId, setDealsByBidRequestId] = useState({}) // Sourcing Pipeline Phase 1 — keyed by bid_request_id
  const [loading, setLoading] = useState(true)
  const [showLowScoring, setShowLowScoring] = useState(false)
  const [showClosed, setShowClosed] = useState(false)
  const [showNoGo, setShowNoGo] = useState(false)
  const [showHidden, setShowHidden] = useState(false)
  const [deadlineBucket, setDeadlineBucket] = useState('all')
  const [expandedIds, setExpandedIds] = useState(() => new Set())
  const [refreshing, setRefreshing] = useState(false)
  const [refreshMessage, setRefreshMessage] = useState('')
  const pollRef = useRef(null)

  useEffect(() => {
    if (user) {
      loadMatches()
      loadBidRequests()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  // Poll while anything is in flight (just paid, or generating) —
  // covers both a fresh return from Stripe and a request left running
  // from an earlier visit.
  useEffect(() => {
    const hasInFlight = Object.values(bidRequests).some((r) => IN_FLIGHT_STATUSES.includes(r.status))
    if (hasInFlight && !pollRef.current) {
      pollRef.current = setInterval(loadBidRequests, POLL_INTERVAL_MS)
    } else if (!hasInFlight && pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bidRequests])

  // A return from Stripe checkout (?bid_request=...) needs its row expanded
  // automatically — the row itself is collapsed by default now, so without
  // this the purchase a member just paid for would land on a page where
  // their result is hidden behind a click they don't know to make.
  useEffect(() => {
    const highlightedBidRequestId = searchParams.get('bid_request')
    if (!highlightedBidRequestId) return
    const match = matches.find((m) => bidRequests[m.opportunities.id]?.id === highlightedBidRequestId)
    if (match) setExpandedIds((prev) => new Set(prev).add(match.id))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matches, bidRequests])

  async function loadMatches() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('opportunity_matches')
        .select(`
          id, match_reason, match_score, recommendation, recommendation_basis, hidden_by_user,
          opportunities ( id, title, agency, solicitation_number, response_deadline, sam_gov_url, set_aside_type, estimated_value )
        `)
        .eq('profile_id', user.id)
      if (error) throw error
      const filtered = (data || []).filter((m) => m.opportunities)
      setMatches(filtered)
      return filtered
    } catch (err) {
      console.error('Failed to load matched opportunities:', err)
      return null
    } finally {
      setLoading(false)
    }
  }

  // On-demand match run for just this profile — the daily cron is the only
  // other thing that triggers matching, so without this, changing NAICS/PSC
  // codes wouldn't show new matches until the next scheduled run.
  async function handleRefreshMatches() {
    setRefreshing(true)
    setRefreshMessage('')
    // Captured before the call, not read from the function's own response —
    // match_opportunities also runs silently in the background right after
    // a profile save (see Profile.jsx), so by the time someone clicks this
    // button that earlier run may already have inserted everything. This
    // function's own newMatches count would then correctly report 0, but
    // showing "No new matches" next to a total that grew since this page
    // last loaded read as a contradiction to the user. Comparing totals
    // instead reflects what actually changed since they last looked,
    // regardless of which invocation of match_opportunities did the work.
    const beforeCount = matches.length
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('https://zohrpargudmogfywciik.supabase.co/functions/v1/match_opportunities', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ profileId: user.id }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Refresh failed')
      const updated = await loadMatches()
      const afterCount = updated ? updated.length : beforeCount
      const totalText = updated ? ` — ${afterCount} total.` : '.'
      const grew = afterCount - beforeCount
      setRefreshMessage(
        grew > 0
          ? `Found ${grew} new match${grew === 1 ? '' : 'es'}${totalText}`
          : `No new matches since your last visit${totalText}`
      )
    } catch (err) {
      console.error('Refresh matches failed:', err)
      setRefreshMessage('Could not refresh matches. Please try again.')
    } finally {
      setRefreshing(false)
    }
  }

  function toggleExpanded(matchId) {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(matchId)) next.delete(matchId)
      else next.add(matchId)
      return next
    })
  }

  async function handleToggleHidden(matchId, hide) {
    try {
      const { error } = await supabase.from('opportunity_matches').update({ hidden_by_user: hide }).eq('id', matchId)
      if (error) throw error
      setMatches((prev) => prev.map((m) => (m.id === matchId ? { ...m, hidden_by_user: hide } : m)))
    } catch (err) {
      console.error('Failed to update hidden state:', err)
    }
  }

  async function loadBidRequests() {
    try {
      const { data, error } = await supabase
        .from('bid_requests')
        .select('id, opportunity_id, status, amount_charged_cents, suggested_bid, supplier_research, error_message')
        .eq('profile_id', user.id)
      if (error) throw error
      const byOpportunity = {}
      for (const r of data || []) byOpportunity[r.opportunity_id] = r
      setBidRequests(byOpportunity)
    } catch (err) {
      console.error('Failed to load bid requests:', err)
    }

    // Sourcing Pipeline Phase 1 — a completed bid_request auto-creates a
    // Deal; this lookup is what lets "View in Pipeline" deep-link straight
    // to it. Best-effort and separate from the bid_requests fetch above:
    // a hiccup here shouldn't block the member from seeing their
    // Suggested Bid results, which is the primary thing this page does.
    try {
      const { data: deals, error: dealsError } = await supabase
        .from('deals')
        .select('id, bid_request_id')
        .eq('profile_id', user.id)
        .not('bid_request_id', 'is', null)
      if (dealsError) throw dealsError
      const byBidRequest = {}
      for (const d of deals || []) byBidRequest[d.bid_request_id] = d.id
      setDealsByBidRequestId(byBidRequest)
    } catch (err) {
      console.error('Failed to load pipeline deals:', err)
    }
  }

  // A past deadline is chronologically "earliest," which used to let closed
  // opportunities sort above active ones in the unscored tiebreak below —
  // closed always sorts last now, full stop, regardless of score.
  const isClosed = (m) => {
    const d = m.opportunities.response_deadline
    return d ? new Date(d).getTime() < Date.now() : false
  }

  // Sorted client-side (not via PostgREST): hidden-by-user matches always
  // last of all (a member's own explicit "don't show me this" beats every
  // other signal), then closed opportunities (most-recently-closed first);
  // within still-open, unhidden ones, scored matches first by fit, unscored
  // ones (match_score still null, awaiting the AI pass) fall to the end
  // ordered by soonest deadline.
  const sortedMatches = useMemo(() => {
    return [...matches].sort((a, b) => {
      if (a.hidden_by_user !== b.hidden_by_user) return a.hidden_by_user ? 1 : -1

      const aClosed = isClosed(a)
      const bClosed = isClosed(b)
      if (aClosed !== bClosed) return aClosed ? 1 : -1

      if (aClosed && bClosed) {
        const aDeadline = a.opportunities.response_deadline ? new Date(a.opportunities.response_deadline).getTime() : -Infinity
        const bDeadline = b.opportunities.response_deadline ? new Date(b.opportunities.response_deadline).getTime() : -Infinity
        return bDeadline - aDeadline
      }

      if (a.match_score != null && b.match_score != null) {
        if (a.match_score !== b.match_score) return b.match_score - a.match_score
      } else if (a.match_score != null) {
        return -1
      } else if (b.match_score != null) {
        return 1
      }
      const aDeadline = a.opportunities.response_deadline ? new Date(a.opportunities.response_deadline).getTime() : Infinity
      const bDeadline = b.opportunities.response_deadline ? new Date(b.opportunities.response_deadline).getTime() : Infinity
      return aDeadline - bDeadline
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matches])

  // A member who's actually paid for a Suggested Bid on an opportunity has
  // made an explicit, deliberate decision that overrides any automatic
  // scoring or bid-criteria assessment — closed/no-go/low-score should
  // never auto-collapse it. Mirrors the same "purchases are protected, not
  // disposable list clutter" principle already applied server-side in
  // purge_expired_matches and match_opportunities' NAICS/PSC pruning.
  // Explicit hidden_by_user is the one exception: a member's own "hide
  // this" still wins even over their own purchase.
  const hasPurchase = (m) => !!bidRequests[m.opportunities.id]

  const hiddenCount = sortedMatches.filter((m) => m.hidden_by_user).length
  const closedCount = sortedMatches.filter((m) => !m.hidden_by_user && !hasPurchase(m) && isClosed(m)).length
  // A member's own bid criteria (min/max value, agency allow/deny, deadline,
  // set-aside match) is a stronger, more deliberate signal than raw fit
  // score — checked ahead of low-scoring so a 90/100-scored match that
  // still fails their own deadline rule collapses here, not in the main list.
  const noGoCount = sortedMatches.filter((m) => !m.hidden_by_user && !hasPurchase(m) && !isClosed(m) && m.recommendation === 'no-go').length
  const lowScoreCount = sortedMatches.filter((m) => !m.hidden_by_user && !hasPurchase(m) && !isClosed(m) && m.recommendation !== 'no-go' && m.match_score != null && m.match_score < LOW_SCORE_THRESHOLD).length
  const visibleMatches = sortedMatches
    .filter((m) => {
      if (m.hidden_by_user) return showHidden
      if (hasPurchase(m)) return true
      if (isClosed(m)) return showClosed
      if (m.recommendation === 'no-go') return showNoGo
      if (m.match_score != null && m.match_score < LOW_SCORE_THRESHOLD) return showLowScoring
      return true
    })
    .filter((m) => matchesDeadlineBucket(m, deadlineBucket))

  const deadlineLabel = (deadline) => {
    if (!deadline) return 'No deadline listed'
    const d = new Date(deadline)
    const daysLeft = Math.ceil((d.getTime() - Date.now()) / 86400000)
    const formatted = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    if (daysLeft < 0) return `${formatted} (closed)`
    if (daysLeft === 0) return `${formatted} (today)`
    return `${formatted} (${daysLeft} day${daysLeft === 1 ? '' : 's'} left)`
  }

  // Compact "Days Left" column value — the table row itself only has room
  // for a number, not the full formatted date; that still shows in the
  // expanded detail row via deadlineLabel above.
  const daysLeftValue = (deadline) => {
    if (!deadline) return '—'
    const daysLeft = Math.ceil((new Date(deadline).getTime() - Date.now()) / 86400000)
    if (daysLeft < 0) return 'Closed'
    return String(daysLeft)
  }

  // Deadline pressure is a real purchase driver — style it accordingly
  // rather than treating it the same as static metadata like the
  // solicitation number.
  const deadlineUrgencyClass = (deadline) => {
    if (!deadline) return ''
    const daysLeft = Math.ceil((new Date(deadline).getTime() - Date.now()) / 86400000)
    if (daysLeft < 0) return styles.deadlineClosed
    if (daysLeft <= 3) return styles.deadlineUrgent
    if (daysLeft <= 14) return styles.deadlineSoon
    return ''
  }

  // Reframes the raw SAM.gov set-aside code into what it actually means
  // for the reader: less (or no) competition.
  const competitionLabel = (setAsideType) => {
    if (!setAsideType) return null
    return setAsideType.toUpperCase() === 'NONE'
      ? 'Full & open competition'
      : `Reduced competition — ${setAsideType}`
  }

  const highlightedBidRequestId = searchParams.get('bid_request')

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.iconWrap}>
          <Radar size={22} />
        </div>
        <h1 className={styles.title}>Matched Opportunities</h1>
        <p className={styles.sub}>
          SAM.gov opportunities matched to your NAICS/PSC codes, ranked by fit.
        </p>
        {profile?.matching_enabled && (
          <div style={{ marginTop: 'var(--sp-3)' }}>
            <div className={styles.headerActions}>
              <button type="button" className={`btn btn-ghost ${styles.btnGreen}`} onClick={handleRefreshMatches} disabled={refreshing}>
                <RefreshCw size={14} className={refreshing ? styles.spin : ''} />
                {refreshing ? 'Refreshing…' : 'Refresh My Matches'}
              </button>
              <Link to="/profile" className={`btn btn-ghost ${styles.btnBlue}`}>
                <Settings size={14} /> Edit Matching Preferences
              </Link>
              <select
                className="btn btn-ghost"
                value={deadlineBucket}
                onChange={(e) => setDeadlineBucket(e.target.value)}
                aria-label="Filter by deadline window"
              >
                {DEADLINE_BUCKETS.map((b) => (
                  <option key={b.value} value={b.value}>{b.label}</option>
                ))}
              </select>
            </div>
            {refreshMessage && <p className={styles.refreshHint}>{refreshMessage}</p>}
          </div>
        )}
      </div>

      <SuggestedBidPitchCard />
      <SampleBidPreview />

      {!profile?.matching_enabled && !loading && (
        <div className={styles.notice}>
          Matching is currently off. <Link to="/profile">Turn it on in Matching Preferences</Link> to start
          getting matched against new opportunities.
        </div>
      )}

      {loading && <p className={styles.empty}>Loading matches...</p>}

      {!loading && matches.length === 0 && (
        <p className={styles.empty}>
          No matches yet. {profile?.matching_enabled
            ? 'New SAM.gov opportunities are checked against your profile daily — check back soon.'
            : 'Enable matching and set your NAICS/PSC codes in Matching Preferences to get started.'}
        </p>
      )}

      {!loading && visibleMatches.length > 0 && (
        <div className={styles.list}>
          {visibleMatches.map((m) => {
            const opp = m.opportunities
            const purchased = hasPurchase(m)
            const isExpanded = expandedIds.has(m.id)

            // Unpurchased — everything always visible. This is the scan-and-
            // decide view: no click should stand between a member and the
            // information they need to judge whether to bid.
            if (!purchased) {
              return (
                <div key={m.id} className={styles.card}>
                  <div className={styles.cardTop}>
                    <h3 className={styles.oppTitle}>{opp.title}</h3>
                    <div className={styles.badgeGroup}>
                      {opp.estimated_value != null && (
                        <span className="badge badge-green">Est. ${Number(opp.estimated_value).toLocaleString()}</span>
                      )}
                      {m.match_score != null && (
                        <span className={`badge ${scoreBadgeClass(m.match_score)}`}>{m.match_score}/100</span>
                      )}
                      {m.recommendation && (
                        <span className={`badge ${RECOMMENDATION_BADGE[m.recommendation] || 'badge-navy'}`}>
                          {RECOMMENDATION_LABEL[m.recommendation] || m.recommendation}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className={styles.metaRow}>
                    <span>{opp.agency || 'Agency not listed'}</span>
                    <span>·</span>
                    <span className={deadlineUrgencyClass(opp.response_deadline)}>{deadlineLabel(opp.response_deadline)}</span>
                    <span>·</span>
                    <span>Sol. #{opp.solicitation_number}</span>
                    {opp.set_aside_type && (
                      <>
                        <span>·</span>
                        <span>{competitionLabel(opp.set_aside_type)}</span>
                      </>
                    )}
                  </div>
                  {m.match_reason && <p className={styles.reason}>{m.match_reason}</p>}
                  <div className={styles.cardActions}>
                    {opp.sam_gov_url && (
                      <a href={opp.sam_gov_url} target="_blank" rel="noopener noreferrer" className={styles.link}>
                        View on SAM.gov <ExternalLink size={13} />
                      </a>
                    )}
                    <button
                      type="button"
                      className={styles.hideLink}
                      onClick={() => handleToggleHidden(m.id, !m.hidden_by_user)}
                    >
                      {m.hidden_by_user ? <Eye size={13} /> : <EyeOff size={13} />}
                      {m.hidden_by_user ? 'Unhide' : 'Hide this opportunity'}
                    </button>
                  </div>

                  <SuggestedBidSection
                    opportunityId={opp.id}
                    userId={user.id}
                    tier={isAdmin ? 'admin' : profile?.membership_tier}
                    bidRequest={bidRequests[opp.id]}
                    dealId={dealsByBidRequestId[bidRequests[opp.id]?.id]}
                    autoExpand={bidRequests[opp.id]?.id === highlightedBidRequestId}
                    onRequested={loadBidRequests}
                  />
                </div>
              )
            }

            // Purchased — already decided, already bought. Collapsed by
            // default so it doesn't clutter the scan-and-decide view; click
            // to check on it when you actually want to.
            return (
              <div key={m.id} className={styles.card}>
                <div
                  className={styles.cardTop}
                  style={{ cursor: 'pointer' }}
                  onClick={() => toggleExpanded(m.id)}
                  role="button"
                  tabIndex={0}
                  aria-expanded={isExpanded}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      toggleExpanded(m.id)
                    }
                  }}
                >
                  <h3 className={styles.oppTitle}>{opp.title}</h3>
                  <div className={styles.badgeGroup}>
                    <span className={deadlineUrgencyClass(opp.response_deadline)}>{daysLeftValue(opp.response_deadline)} days left</span>
                    {m.recommendation && (
                      <span className={`badge ${RECOMMENDATION_BADGE[m.recommendation] || 'badge-navy'}`}>
                        {RECOMMENDATION_LABEL[m.recommendation] || m.recommendation}
                      </span>
                    )}
                    <span className="badge badge-navy">Purchased</span>
                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </div>
                </div>
                {isExpanded && (
                  <>
                    <div className={styles.metaRow}>
                      <span>{opp.agency || 'Agency not listed'}</span>
                      <span>·</span>
                      <span>{deadlineLabel(opp.response_deadline)}</span>
                      <span>·</span>
                      <span>Sol. #{opp.solicitation_number}</span>
                      {opp.set_aside_type && (
                        <>
                          <span>·</span>
                          <span>{competitionLabel(opp.set_aside_type)}</span>
                        </>
                      )}
                    </div>
                    {m.match_reason && <p className={styles.reason}>{m.match_reason}</p>}
                    <div className={styles.cardActions}>
                      {opp.sam_gov_url && (
                        <a href={opp.sam_gov_url} target="_blank" rel="noopener noreferrer" className={styles.link}>
                          View on SAM.gov <ExternalLink size={13} />
                        </a>
                      )}
                      <button
                        type="button"
                        className={styles.hideLink}
                        onClick={() => handleToggleHidden(m.id, !m.hidden_by_user)}
                      >
                        {m.hidden_by_user ? <Eye size={13} /> : <EyeOff size={13} />}
                        {m.hidden_by_user ? 'Unhide' : 'Hide this opportunity'}
                      </button>
                    </div>

                    <SuggestedBidSection
                      opportunityId={opp.id}
                      userId={user.id}
                      tier={isAdmin ? 'admin' : profile?.membership_tier}
                      bidRequest={bidRequests[opp.id]}
                      dealId={dealsByBidRequestId[bidRequests[opp.id]?.id]}
                      autoExpand={bidRequests[opp.id]?.id === highlightedBidRequestId}
                      onRequested={loadBidRequests}
                    />
                  </>
                )}
              </div>
            )
          })}
        </div>
      )}

      {!loading && noGoCount > 0 && (
        <button type="button" className="btn btn-ghost" style={{ margin: '0 auto', display: 'flex' }} onClick={() => setShowNoGo((v) => !v)}>
          {showNoGo ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          {showNoGo ? 'Hide' : 'Show'} {noGoCount} match{noGoCount === 1 ? '' : 'es'} that don't meet your bid criteria
        </button>
      )}

      {!loading && lowScoreCount > 0 && (
        <button type="button" className="btn btn-ghost" style={{ margin: 'var(--sp-2) auto 0', display: 'flex' }} onClick={() => setShowLowScoring((v) => !v)}>
          {showLowScoring ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          {showLowScoring ? 'Hide' : 'Show'} {lowScoreCount} lower-scoring match{lowScoreCount === 1 ? '' : 'es'}
        </button>
      )}

      {!loading && closedCount > 0 && (
        <button type="button" className="btn btn-ghost" style={{ margin: 'var(--sp-2) auto 0', display: 'flex' }} onClick={() => setShowClosed((v) => !v)}>
          {showClosed ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          {showClosed ? 'Hide' : 'Show'} {closedCount} closed opportunit{closedCount === 1 ? 'y' : 'ies'}
        </button>
      )}

      {!loading && hiddenCount > 0 && (
        <button type="button" className="btn btn-ghost" style={{ margin: 'var(--sp-2) auto 0', display: 'flex' }} onClick={() => setShowHidden((v) => !v)}>
          {showHidden ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          {showHidden ? 'Hide' : 'Show'} {hiddenCount} hidden opportunit{hiddenCount === 1 ? 'y' : 'ies'}
        </button>
      )}

      <div className={styles.footerLink}>
        <Link to="/profile" className="btn btn-ghost">
          <Settings size={14} /> Edit Matching Preferences
        </Link>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------
// Explains what a Suggested Bid purchase actually includes and where the
// information comes from, before anyone pays for one. Static — pricing
// mirrors SUGGESTED_BID_PRICING but isn't the source of truth for it.
// ---------------------------------------------------------------------
function SuggestedBidPitchCard() {
  return (
    <div className={styles.pitchCard}>
      <h2 className={styles.pitchTitle}>What You Get With Suggested Bid</h2>
      <div className={styles.pitchGrid}>
        <div className={styles.pitchItem}>
          <DollarSign size={18} />
          <div>
            <strong>A suggested price range</strong>
            <p>Grounded in real historical federal award data for the same NAICS code, not a guess.</p>
          </div>
        </div>
        <div className={styles.pitchItem}>
          <FileText size={18} />
          <div>
            <strong>Approach &amp; risk notes</strong>
            <p>A technical approach summary and honest risk flags — approved-source restrictions, certification gaps, and more.</p>
          </div>
        </div>
        <div className={styles.pitchItem}>
          <Users size={18} />
          <div>
            <strong>Possible suppliers</strong>
            <p>AI-researched leads on who might supply or manufacture the item, with sources — yours to verify and contact.</p>
          </div>
        </div>
        <div className={styles.pitchItem}>
          <Truck size={18} />
          <div>
            <strong>Possible packaging/shipping</strong>
            <p>Same research, for freight and packaging partners who could quote the logistics side.</p>
          </div>
        </div>
        <div className={styles.pitchItem} style={{ gridColumn: '1 / -1' }}>
          <Copy size={18} />
          <div>
            <strong>Two ready-to-send RFQ emails</strong>
            <p>Pre-written quote-request drafts for a supplier and a shipper, referencing the actual solicitation — copy, paste, send.</p>
          </div>
        </div>
      </div>
      <div className={styles.pitchSource}>
        <Database size={13} />
        <span>
          Sourced from live SAM.gov data, real historical contract awards (USASpending.gov), and AI web research —
          the price and leads are estimates and leads to verify, not certified figures or vetted vendors.
        </span>
      </div>
      <p className={styles.pitchPrice}>$2 per opportunity — Founding members get deeper research (8 web searches vs. 5)</p>
    </div>
  )
}

// Fictional — never tied to a real opportunity or a real generation run.
// Exists purely to show what a purchase actually looks like before anyone
// pays for one. Styled with the exact same classes as a real completed
// result (bidBlock/rfqBlock/etc.) so it's an honest preview, not a mockup
// that looks nicer than the real thing.
const SAMPLE_BID = {
  oppTitle: 'Example: Hydraulic Actuator Assembly — U.S. Navy',
  agency: 'Department of Defense · Naval Air Systems Command',
  solicitation: 'N0042126QSAMPLE',
  priceRange: { low: 18500, high: 24000 },
  approach: 'Machine and finish the actuator housing to spec using existing CNC capacity, source the seal kit from an approved distributor, and perform final assembly and functional testing in-house before shipment.',
  riskNotes: 'Solicitation lists a single approved source (CAGE 3CFJ8) for the actuator body — confirm approved-source or alternate qualification before bidding, or the submission may be rejected on eligibility grounds.',
  suppliers: [
    { name: 'Precision Aerostructures LLC', note: 'CNC machine shop with existing NAVAIR approved-source status for similar actuator housings.' },
    { name: 'Coastal Hydraulics Supply', note: 'Distributor stocking the seal kit and fastener hardware called out in the drawing package.' },
  ],
  shipping: [
    { name: 'Anchor Freight Solutions', note: 'Handles MIL-STD-2073 compliant packaging for precision aerospace hardware.' },
    { name: 'Redline Logistics', note: 'Expedited freight lanes to NAS Jacksonville with tracked delivery confirmation.' },
  ],
  rfqSupplier: {
    subject: 'RFQ Support — Hydraulic Actuator Assembly (Sol. N0042126QSAMPLE)',
    body: 'Hello [Supplier Name],\n\n[Your Company] is preparing a response to NAVAIR solicitation N0042126QSAMPLE for a Hydraulic Actuator Assembly.\n\nCould you confirm pricing, lead time, and approved-source status for [QUANTITY] units?\n\nPlease reply by [DATE] so we can finalize our submission.\n\nThank you,\n[Your Name]',
  },
  rfqShipping: {
    subject: 'Freight/Packaging Quote Needed — Sol. N0042126QSAMPLE',
    body: 'Hello [Provider Name],\n\nWe need a quote to package and ship [QUANTITY] units, estimated weight [WEIGHT], from [ORIGIN] to [DESTINATION].\n\nPlease include MIL-STD-2073 compliant packaging and estimated transit time.\n\nThank you,\n[Your Name]',
  },
}

function SampleBidContent() {
  return (
    <>
      <p className={styles.bidPrice}>
        Suggested range: ${SAMPLE_BID.priceRange.low.toLocaleString()} – ${SAMPLE_BID.priceRange.high.toLocaleString()}
      </p>
      <div className={styles.bidBlock}>
        <h4>Suggested Approach</h4>
        <p>{SAMPLE_BID.approach}</p>
      </div>
      <div className={styles.bidBlock}>
        <h4>Risk Notes</h4>
        <p>{SAMPLE_BID.riskNotes}</p>
      </div>
      <div className={styles.bidBlock}>
        <h4>Possible Suppliers</h4>
        <ul>
          {SAMPLE_BID.suppliers.map((s, i) => (
            <li key={i}><strong>{s.name}</strong> — {s.note} <span className={styles.sampleSourceTag}>(source)</span></li>
          ))}
        </ul>
        <div className={styles.rfqBlock}>
          <div className={styles.rfqHeader}>
            <span className={styles.rfqSubject}>{SAMPLE_BID.rfqSupplier.subject}</span>
            <span className="btn btn-gold" style={{ fontSize: '0.75rem', padding: 'var(--sp-2) var(--sp-4)', pointerEvents: 'none' }}>
              <Copy size={13} /> Copy Supplier RFQ Email
            </span>
          </div>
          <p className={styles.rfqBody}>{SAMPLE_BID.rfqSupplier.body}</p>
        </div>
      </div>
      <div className={styles.bidBlock}>
        <h4>Possible Packaging / Shipping</h4>
        <ul>
          {SAMPLE_BID.shipping.map((s, i) => (
            <li key={i}><strong>{s.name}</strong> — {s.note} <span className={styles.sampleSourceTag}>(source)</span></li>
          ))}
        </ul>
        <div className={styles.rfqBlock}>
          <div className={styles.rfqHeader}>
            <span className={styles.rfqSubject}>{SAMPLE_BID.rfqShipping.subject}</span>
            <span className="btn btn-gold" style={{ fontSize: '0.75rem', padding: 'var(--sp-2) var(--sp-4)', pointerEvents: 'none' }}>
              <Copy size={13} /> Copy Shipping/Packaging RFQ Email
            </span>
          </div>
          <p className={styles.rfqBody}>{SAMPLE_BID.rfqShipping.body}</p>
        </div>
      </div>
    </>
  )
}

// Cropped thumbnail (fixed height, faded bottom edge) that expands into a
// full modal on click — lets a member see exactly what they'd get before
// paying for one, without needing to scroll a full example inline.
function SampleBidPreview() {
  const [open, setOpen] = useState(false)
  const dialogRef = useRef(null)
  useDialogA11y({ isOpen: open, onClose: () => setOpen(false), containerRef: dialogRef })

  return (
    <>
      <div className={styles.sampleWrap}>
        <div className={styles.sampleLabel}>
          <Eye size={13} /> See a Sample
        </div>
        <button type="button" className={styles.sampleThumb} onClick={() => setOpen(true)}>
          <div className={styles.sampleThumbHeader}>
            <strong>{SAMPLE_BID.oppTitle}</strong>
            <span className={styles.sampleBadge}>Sample</span>
          </div>
          <div className={styles.sampleThumbBody}>
            <SampleBidContent />
          </div>
          <div className={styles.sampleFade}>
            <span className={styles.sampleExpandHint}><Maximize2 size={14} /> Click to see the full example</span>
          </div>
        </button>
      </div>

      {open && (
        <div className={styles.sampleModalOverlay} onClick={() => setOpen(false)}>
          <div
            ref={dialogRef}
            className={styles.sampleModal}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="sample-bid-title"
          >
            <div className={styles.sampleModalHeader}>
              <div>
                <span className={styles.sampleBadge}>Sample — Example Only</span>
                <h3 id="sample-bid-title">{SAMPLE_BID.oppTitle}</h3>
                <p className={styles.sampleModalMeta}>{SAMPLE_BID.agency} · Sol. #{SAMPLE_BID.solicitation}</p>
              </div>
              <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>
                <X size={16} aria-hidden="true" /> Close
              </button>
            </div>
            <div className={styles.sampleModalBody}>
              <SampleBidContent />
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ---------------------------------------------------------------------
// Per-opportunity "Suggested Bid" purchase + results panel. Price and
// search depth shown here are display-only — api/stripe/suggested-bid-
// checkout.js re-derives both server-side from the caller's real
// membership_tier before ever creating a charge.
// ---------------------------------------------------------------------
function SuggestedBidSection({ opportunityId, userId, tier, bidRequest, dealId, autoExpand, onRequested }) {
  const [starting, setStarting] = useState(false)
  const [startError, setStartError] = useState('')
  const [expanded, setExpanded] = useState(!!autoExpand)

  const pricing = SUGGESTED_BID_PRICING[tier]
  if (!pricing) return null // Suggested Bid is Lab Member / Founding only

  async function handleStart() {
    setStartError('')
    setStarting(true)
    try {
      const { url } = await createSuggestedBidCheckout({ opportunityId, userId })
      window.location.href = url
    } catch (err) {
      setStartError(err.message || 'Could not start checkout. Please try again.')
      setStarting(false)
    }
  }

  if (!bidRequest) {
    return (
      <div className={styles.bidSection}>
        <button type="button" className="btn btn-gold" onClick={handleStart} disabled={starting}>
          {starting ? <Loader size={14} className={styles.spin} /> : <Sparkles size={14} />}
          {starting ? 'Starting checkout…' : `Get Suggested Bid — ${pricing.label}`}
        </button>
        <p className={styles.ctaIncludes}>
          Includes: price range · supplier &amp; shipping leads · 2 ready-to-send RFQ emails
        </p>
        <p className={styles.ctaGuarantee}>Auto-refunded if generation ever fails.</p>
        {startError && <p className={styles.bidError}>{startError}</p>}
      </div>
    )
  }

  // 'pending' means a checkout session was created but never confirmed —
  // e.g. the member closed the Stripe tab without paying. That's not
  // "payment confirmed," and unlike paid/generating, there's no webhook
  // coming to move it along, so it needs its own escape hatch rather than
  // spinning forever.
  if (bidRequest.status === 'pending') {
    return (
      <div className={styles.bidSection}>
        <div className={styles.bidPending}>
          Checkout started but not completed. Finish payment in that tab, or start over below.
        </div>
        <button type="button" className="btn btn-ghost" onClick={handleStart} disabled={starting}>
          <RefreshCw size={14} /> {starting ? 'Starting checkout…' : 'Start Over'}
        </button>
        {startError && <p className={styles.bidError}>{startError}</p>}
      </div>
    )
  }

  if (bidRequest.status === 'paid' || bidRequest.status === 'generating') {
    const label = bidRequest.status === 'generating'
      ? 'Researching suppliers and drafting your suggested bid…'
      : 'Payment confirmed — starting research…'
    return (
      <div className={styles.bidSection}>
        <div className={styles.bidPending}>
          <Loader size={14} className={styles.spin} /> {label}
        </div>
      </div>
    )
  }

  if (bidRequest.status === 'failed' || bidRequest.status === 'refunded') {
    return (
      <div className={styles.bidSection}>
        <p className={styles.bidError}>
          {bidRequest.status === 'failed' ? 'Generation failed — you were automatically refunded.' : 'This request was refunded.'}
        </p>
        <button type="button" className="btn btn-ghost" onClick={handleStart} disabled={starting}>
          <RefreshCw size={14} /> {starting ? 'Starting checkout…' : 'Try again'}
        </button>
        {startError && <p className={styles.bidError}>{startError}</p>}
      </div>
    )
  }

  // completed
  const bid = bidRequest.suggested_bid || {}
  const research = bidRequest.supplier_research || {}
  return (
    <div className={styles.bidSection}>
      <button type="button" className={`btn btn-ghost ${styles.btnGreen}`} onClick={() => setExpanded((v) => !v)}>
        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        {expanded ? 'Hide' : 'View'} Suggested Bid
      </button>
      {dealId && (
        <Link to={`/pipeline?tab=deals&deal=${dealId}`} className="btn btn-ghost" style={{ marginLeft: 'var(--sp-2)' }}>
          View in Pipeline <ExternalLink size={13} />
        </Link>
      )}

      {expanded && (
        <div className={styles.bidResults}>
          {bid.price_range && (
            <p className={styles.bidPrice}>
              Suggested range: ${Number(bid.price_range.low).toLocaleString()} – ${Number(bid.price_range.high).toLocaleString()}
            </p>
          )}
          {bid.technical_approach && (
            <div className={styles.bidBlock}>
              <h4>Suggested Approach</h4>
              <BidBullets content={bid.technical_approach} />
            </div>
          )}
          {bid.risk_notes && (
            <div className={styles.bidBlock}>
              <h4>Risk Notes</h4>
              <BidBullets content={bid.risk_notes} />
            </div>
          )}

          <p className={styles.bidDisclaimer}>
            AI-researched leads below — verify independently before contacting.
          </p>

          {research.suppliers?.length > 0 && (
            <div className={styles.bidBlock}>
              <h4>Possible Suppliers</h4>
              <ul>
                {research.suppliers.map((s, i) => (
                  <li key={i}>
                    <strong>{s.name}</strong> — {s.note}
                    {s.source_url && (
                      <a href={s.source_url} target="_blank" rel="noopener noreferrer" className={styles.link}>
                        {' '}source <ExternalLink size={11} />
                      </a>
                    )}
                  </li>
                ))}
              </ul>
              <RfqDraftBlock label="Copy Supplier RFQ Email" draft={bid.rfq_drafts?.supplier_email} />
            </div>
          )}

          {research.shipping_packing?.length > 0 && (
            <div className={styles.bidBlock}>
              <h4>Possible Packaging / Shipping</h4>
              <ul>
                {research.shipping_packing.map((s, i) => (
                  <li key={i}>
                    <strong>{s.name}</strong> — {s.note}
                    {s.source_url && (
                      <a href={s.source_url} target="_blank" rel="noopener noreferrer" className={styles.link}>
                        {' '}source <ExternalLink size={11} />
                      </a>
                    )}
                  </li>
                ))}
              </ul>
              <RfqDraftBlock label="Copy Shipping/Packaging RFQ Email" draft={bid.rfq_drafts?.shipping_email} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// Ready-to-send quote-request email draft with a one-click copy button —
// deliberately copy-paste only, never auto-sent. The member always
// chooses the recipient and reviews before it goes out.
function RfqDraftBlock({ label, draft }) {
  const [copied, setCopied] = useState(false)
  if (!draft) return null

  async function handleCopy() {
    const text = `Subject: ${draft.subject}\n\n${draft.body}`
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Copy failed:', err)
    }
  }

  return (
    <div className={styles.rfqBlock}>
      <div className={styles.rfqHeader}>
        <span className={styles.rfqSubject}>{draft.subject}</span>
        <button type="button" className="btn btn-gold" onClick={handleCopy} style={{ fontSize: '0.75rem', padding: 'var(--sp-2) var(--sp-4)' }}>
          {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? 'Copied' : label}
        </button>
      </div>
      <p className={styles.rfqBody}>{draft.body}</p>
    </div>
  )
}

const URL_PATTERN = /(https?:\/\/[^\s)]+)/g

// Turns any raw URL in a string into a real clickable link — used so a
// risk-note bullet that recommends a specific product (see
// buildBidDraftPrompt's productCatalogText) renders as a link instead of
// plain text pasted mid-sentence. Checks with startsWith rather than
// re-testing the shared global regex, since a stateful /g regex's
// lastIndex would otherwise carry over incorrectly across repeated
// .test() calls in the same map().
function linkifyText(text) {
  const parts = String(text).split(URL_PATTERN)
  return parts.map((part, i) =>
    part.startsWith('http://') || part.startsWith('https://')
      ? <a key={i} href={part} target="_blank" rel="noopener noreferrer" className={styles.bulletLink}>{part}</a>
      : <span key={i}>{part}</span>
  )
}

// Renders Suggested Approach / Risk Notes as a bullet list. Newer bids
// store these as string arrays (one bullet per entry); bids generated
// before this change stored a single prose string — rendered as a plain
// paragraph so already-purchased results don't break.
function BidBullets({ content }) {
  if (Array.isArray(content)) {
    return (
      <ul>
        {content.map((line, i) => <li key={i}>{linkifyText(line)}</li>)}
      </ul>
    )
  }
  return <p>{linkifyText(content)}</p>
}
