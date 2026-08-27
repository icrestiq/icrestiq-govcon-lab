import { Link, useParams, Navigate } from 'react-router-dom'
import useDocumentTitle from '../hooks/useDocumentTitle'
import { POLICIES } from '../data/policies'
import styles from './PolicyPage.module.css'

// Renders one block of a policy document. Kept as a flat, ordered list of
// typed blocks (h2/h3/p/ul/callout/legalCaps/table) rather than a nested
// tree — it mirrors how the source document reads top-to-bottom and keeps
// every policy's content file simple to author/compare against the
// original draft.
function Block({ block, i }) {
  switch (block.type) {
    case 'h2':
      return <h2 key={i} className={styles.h2}>{block.text}</h2>
    case 'h3':
      return <h3 key={i} className={styles.h3}>{block.text}</h3>
    case 'p':
      return <p key={i} className={styles.p}>{block.text}</p>
    case 'legalCaps':
      return <p key={i} className={styles.legalCaps}>{block.text}</p>
    case 'ul':
      return (
        <ul key={i} className={styles.ul}>
          {block.items.map((item, j) => <li key={j}>{item}</li>)}
        </ul>
      )
    case 'callout':
      return (
        <div key={i} className={styles.callout}>
          <p className={styles.p}>{block.text}</p>
        </div>
      )
    case 'table':
      return (
        <div key={i} className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>{block.headers.map((h, j) => <th key={j}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {block.rows.map((row, r) => (
                <tr key={r}>{row.map((cell, c) => <td key={c}>{cell}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    default:
      return null
  }
}

export default function PolicyPage() {
  const { slug } = useParams()
  const policy = POLICIES.find((p) => p.slug === slug)

  useDocumentTitle(policy ? `${policy.label} — iCrestiQ GovCon Lab` : 'Policy — iCrestiQ GovCon Lab')

  if (!policy) return <Navigate to="/" replace />

  return (
    <div className={styles.page}>
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <nav className={styles.nav}>
        <Link to="/" className={styles.navLogo}>
          <div className={styles.logoMark}>iQ</div>
          <div>
            <div className={styles.logoText}>iCrestiQ GovCon Lab</div>
            <div className={styles.logoSub}>by iCrestiQ LLC</div>
          </div>
        </Link>
        <div className={styles.navActions}>
          <Link to="/login" className="btn btn-ghost hide-mobile">Sign In</Link>
          <Link to="/register" className="btn btn-primary">Join the Lab</Link>
        </div>
      </nav>

      <main id="main-content" className={styles.content}>
        <div className={styles.eyebrow}>Policy</div>
        <h1 className={styles.heading}>{policy.label}</h1>
        <div className={styles.dates}>
          Effective: {policy.effectiveDate} · Last updated: {policy.effectiveDate}
        </div>

        {policy.intro && <p className={styles.intro}>{policy.intro}</p>}

        <div className={styles.section}>
          {policy.blocks.map((block, i) => <Block key={i} block={block} i={i} />)}
        </div>

        <nav className={styles.footerLinks} aria-label="Other policies">
          {POLICIES.filter((p) => p.slug !== slug).map((p) => (
            <Link key={p.slug} to={`/policies/${p.slug}`}>{p.label}</Link>
          ))}
        </nav>
      </main>
    </div>
  )
}
