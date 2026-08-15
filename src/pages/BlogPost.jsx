import { useState, useEffect } from 'react'
import { useParams, Link, Navigate } from 'react-router-dom'
import { ArrowLeft, Clock } from 'lucide-react'
import { supabase } from '../lib/supabase'
import styles from './BlogPost.module.css'

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

// Inline formatting within a paragraph/heading/list item/table cell:
// **bold**, *italic*, __underline__, and [text](url) links. Deliberately
// not a full markdown parser — just the inline forms admins actually
// need — so this stays a plain function instead of pulling in a
// markdown dependency. **bold** is checked before *italic* so a bold run
// doesn't get split by the single-star pattern first.
//
// Recurses into bold/italic/underline content so a link inside an
// italic sentence (a common shape in pasted CTA-style copy) still
// renders as a real <a> instead of literal "[text](url)" — without
// this, the outer *…* match swallows everything up to its closing
// asterisk as one plain-text run.
function renderInline(text) {
  const parts = []
  const regex = /\*\*(.+?)\*\*|__(.+?)__|\*(.+?)\*|\[(.+?)\]\((.+?)\)/g
  let lastIndex = 0
  let match
  let i = 0
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index))
    const [, bold, underline, italic, linkText, linkUrl] = match
    if (bold !== undefined) parts.push(<strong key={i++}>{renderInline(bold)}</strong>)
    else if (underline !== undefined) parts.push(<u key={i++}>{renderInline(underline)}</u>)
    else if (italic !== undefined) parts.push(<em key={i++}>{renderInline(italic)}</em>)
    else parts.push(
      <a key={i++} href={linkUrl} className={styles.link} target="_blank" rel="noopener noreferrer">{linkText}</a>
    )
    lastIndex = regex.lastIndex
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex))
  return parts
}

// A block is a list when every line starts with "- " (unordered) or
// "1. "/"2. " etc. (ordered) — standard markdown list syntax.
function parseList(block) {
  const lines = block.split('\n').map(l => l.trim()).filter(Boolean)
  if (lines.length === 0) return null
  if (lines.every(l => l.startsWith('- '))) {
    return { ordered: false, items: lines.map(l => l.slice(2)) }
  }
  if (lines.every(l => /^\d+\.\s/.test(l))) {
    return { ordered: true, items: lines.map(l => l.replace(/^\d+\.\s/, '')) }
  }
  return null
}

function splitTableRow(line) {
  return line
    .trim()
    .slice(1, -1)
    .split(/(?<!\\)\|/)
    .map(cell => cell.trim().replace(/\\\|/g, '|'))
}

// A block is a table when every line is "| cell | cell |" and the second
// line is the "|---|---|" header separator — standard markdown table
// syntax, so admins can paste tables straight from Word/Sheets exports.
function parseTable(block) {
  const lines = block.split('\n').map(l => l.trim()).filter(Boolean)
  if (lines.length < 2 || !lines.every(l => l.startsWith('|') && l.endsWith('|'))) return null
  const separatorCells = splitTableRow(lines[1])
  if (!separatorCells.every(c => /^:?-{3,}:?$/.test(c))) return null
  return { headers: splitTableRow(lines[0]), rows: lines.slice(2).map(splitTableRow) }
}

// body is plain text: paragraphs separated by a blank line. A line
// starting with "## " or "### " renders as a heading, a block of "- "/
// "1. " lines renders as a list, and a "| cell | cell |" block renders
// as a table. Same lightweight convention ProductDetail.jsx uses for
// long_description, split on blank lines instead of a single \n so
// admins can write real paragraphs.
function renderBody(body) {
  return body.split(/\n\s*\n/).map((block, i) => {
    const trimmed = block.trim()
    if (!trimmed) return null
    if (trimmed.startsWith('### ')) {
      return <h3 key={i} className={styles.subheading}>{renderInline(trimmed.slice(4))}</h3>
    }
    if (trimmed.startsWith('## ')) {
      return <h2 key={i} className={styles.heading}>{renderInline(trimmed.slice(3))}</h2>
    }
    const list = parseList(trimmed)
    if (list) {
      const ListTag = list.ordered ? 'ol' : 'ul'
      return (
        <ListTag key={i} className={styles.list}>
          {list.items.map((item, ii) => <li key={ii}>{renderInline(item)}</li>)}
        </ListTag>
      )
    }
    const table = parseTable(trimmed)
    if (table) {
      return (
        <div key={i} className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                {table.headers.map((h, hi) => <th key={hi}>{renderInline(h)}</th>)}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((row, ri) => (
                <tr key={ri}>
                  {row.map((cell, ci) => <td key={ci}>{renderInline(cell)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    }
    return <p key={i}>{renderInline(trimmed)}</p>
  })
}

export default function BlogPost() {
  const { slug } = useParams()
  const [post, setPost] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadPost()
  }, [slug])

  async function loadPost() {
    setLoading(true)
    try {
      const { data } = await supabase
        .from('blog_posts')
        .select('*')
        .eq('slug', slug)
        .eq('published', true)
        .single()
      setPost(data || null)
    } catch {
      setPost(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!post) return
    const prevTitle = document.title
    const metaDesc = document.querySelector('meta[name="description"]')
    const prevDescription = metaDesc?.getAttribute('content')

    document.title = `${post.title} | GovCon Lab Blog`
    if (metaDesc && post.excerpt) metaDesc.setAttribute('content', post.excerpt)

    return () => {
      document.title = prevTitle
      if (metaDesc && prevDescription) metaDesc.setAttribute('content', prevDescription)
    }
  }, [post])

  if (loading) return (
    <div style={{ padding: 'var(--sp-8)' }}>
      <p>Loading...</p>
    </div>
  )

  if (!post) return <Navigate to="/blog" replace />

  return (
    <div className={styles.page}>
      <Link to="/blog" className="btn btn-ghost" style={{ marginBottom: 'var(--sp-6)', display: 'inline-flex' }}>
        <ArrowLeft size={16} /> Back to Blog
      </Link>

      <span className="badge badge-blue">{post.category || 'GovCon Notes'}</span>

      <h1 className={styles.title}>{post.title}</h1>

      <div className={styles.meta}>
        <span>{post.author}</span>
        <span aria-hidden="true">&middot;</span>
        <span>{formatDate(post.published_at)}</span>
        <span aria-hidden="true">&middot;</span>
        <span className={styles.readingTime}>
          <Clock size={13} />
          {post.reading_minutes} min read
        </span>
      </div>

      {post.cover_image_url && (
        <img
          src={post.cover_image_url}
          alt={post.title}
          style={{ width: '100%', borderRadius: 10, marginTop: 'var(--sp-6)', marginBottom: 'var(--sp-2)', objectFit: 'cover', aspectRatio: '16/9' }}
        />
      )}

      <div className={styles.body}>
        {renderBody(post.body)}
      </div>
    </div>
  )
}
