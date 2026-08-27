import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Newspaper, Search, Clock } from 'lucide-react'
import styles from './Blog.module.css'
import useDocumentTitle from '../hooks/useDocumentTitle'

const CATEGORY_COLORS = [
  { bg: '#EBF4FF', color: '#2B6CB0', border: '#BEE3F8' },
  { bg: '#F0FFF4', color: '#276749', border: '#9AE6B4' },
  { bg: '#FAF5FF', color: '#6B46C1', border: '#D6BCFA' },
  { bg: '#FFFAF0', color: '#C05621', border: '#FBD38D' },
  { bg: '#FFF5F5', color: '#C53030', border: '#FEB2B2' },
]

// Deterministic color per category name so the same category always
// gets the same badge color, without needing a lookup table maintained
// alongside whatever categories admins type into the blog form.
function categoryColor(category) {
  let hash = 0
  for (let i = 0; i < category.length; i++) hash = (hash * 31 + category.charCodeAt(i)) >>> 0
  return CATEGORY_COLORS[hash % CATEGORY_COLORS.length]
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

export default function Blog() {
  useDocumentTitle('Blog — GovCon Lab')
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState('All')
  const [search, setSearch] = useState('')

  useEffect(() => {
    loadPosts()
  }, [])

  async function loadPosts() {
    try {
      const { data } = await supabase
        .from('blog_posts')
        .select('*')
        .eq('published', true)
        .order('published_at', { ascending: false })
      if (data) setPosts(data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const categories = useMemo(() => {
    const unique = [...new Set(posts.map(p => p.category).filter(Boolean))]
    return ['All', ...unique]
  }, [posts])

  const filtered = posts.filter(p => {
    const matchCat = category === 'All' || p.category === category
    const matchSearch = !search || p.title.toLowerCase().includes(search.toLowerCase())
    return matchCat && matchSearch
  })

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>GovCon Lab Blog</h1>
          <p className={styles.sub}>Notes from the field — what we're seeing in solicitations, pricing, and the process.</p>
        </div>
      </div>

      {categories.length > 1 && (
        <div className={styles.filters}>
          <div className={styles.searchWrap}>
            <Search size={15} className={styles.searchIcon} />
            <input
              className={`input ${styles.searchInput}`}
              placeholder="Search posts..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className={styles.categories}>
            {categories.map(cat => (
              <button
                key={cat}
                className={`${styles.catBtn} ${category === cat ? styles.catActive : ''}`}
                onClick={() => setCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className={styles.grid}>
        {loading && (
          <div className={styles.empty}>
            <p>Loading posts...</p>
          </div>
        )}
        {!loading && filtered.length === 0 && (
          <div className={styles.empty}>
            <Newspaper size={32} style={{ color: 'var(--text-muted)', marginBottom: 'var(--sp-3)' }} />
            <p>No posts yet — check back soon.</p>
          </div>
        )}
        {filtered.map(post => (
          <PostCard key={post.id} post={post} />
        ))}
      </div>
    </div>
  )
}

function PostCard({ post }) {
  const catColor = categoryColor(post.category || 'GovCon Notes')

  return (
    <Link to={`/blog/${post.slug}`} className={`card card-hover ${styles.postCard}`}>
      {post.cover_image_url && (
        <div style={{ margin: '-24px -24px 16px', borderRadius: '12px 12px 0 0', overflow: 'hidden', aspectRatio: '16/9' }}>
          <img
            src={post.cover_image_url}
            alt={post.title}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        </div>
      )}

      <span style={{
        display: 'inline-flex', alignItems: 'center', width: 'fit-content',
        padding: '3px 10px', borderRadius: '100px',
        fontSize: '0.6875rem', fontWeight: 700,
        fontFamily: 'var(--font-display)', textTransform: 'uppercase',
        letterSpacing: '0.05em', marginBottom: 'var(--sp-3)',
        background: catColor.bg, color: catColor.color, border: `1px solid ${catColor.border}`
      }}>{post.category || 'GovCon Notes'}</span>

      <h3 className={styles.postTitle}>{post.title}</h3>
      {post.excerpt && <p className={styles.postExcerpt}>{post.excerpt}</p>}

      <div className={styles.postFooter}>
        <span>{formatDate(post.published_at)}</span>
        <span className={styles.readingTime}>
          <Clock size={12} />
          {post.reading_minutes} min read
        </span>
      </div>
    </Link>
  )
}
