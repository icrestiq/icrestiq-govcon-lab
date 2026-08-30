// api/sitemap.js
// Dynamic replacement for the old hand-maintained public/sitemap.xml,
// which had already drifted out of sync — it never had /blog, /membership,
// /go, /sample, or /about, and never could have listed individual blog
// posts, since it was a static file with no way to know what's actually
// published. This queries blog_posts for every published post at request
// time so the sitemap always reflects reality without needing manual
// edits every time a post goes out. Wired up via the /sitemap.xml rewrite
// in vercel.json.

import { createClient } from '@supabase/supabase-js'
import { SITE_URL } from './_lib/site-url.js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
)

// Static pages that aren't dynamically listable from a database table.
// changefreq/priority mirror what was in the old static sitemap.
const STATIC_PAGES = [
  { path: '/', changefreq: 'weekly', priority: '1.0' },
  { path: '/store', changefreq: 'weekly', priority: '0.9' },
  { path: '/membership', changefreq: 'monthly', priority: '0.9' },
  { path: '/blog', changefreq: 'weekly', priority: '0.8' },
  { path: '/tools/proposal-builder', changefreq: 'monthly', priority: '0.8' },
  { path: '/about', changefreq: 'monthly', priority: '0.6' },
  { path: '/founders', changefreq: 'monthly', priority: '0.6' },
  { path: '/go', changefreq: 'monthly', priority: '0.5' },
  { path: '/sample', changefreq: 'monthly', priority: '0.5' },
]

function escapeXml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

// Best-effort, non-blocking — same alert endpoint the Supabase Edge
// Functions use on failure (api/sam-gov-alert.js), so a degraded sitemap
// (blog posts silently omitted) doesn't go unnoticed the way it did
// before: it used to fail back to static-only pages with no signal to
// anyone that it happened.
async function alertOnFailure(message, details) {
  try {
    await fetch(`${SITE_URL}/api/sam-gov-alert`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-webhook-secret': process.env.REPORT_WEBHOOK_SECRET || '',
      },
      body: JSON.stringify({ source: 'sitemap', message, details }),
    })
  } catch (err) {
    console.error('Failed to send sitemap failure alert:', err)
  }
}

function urlEntry({ loc, changefreq, priority, lastmod }) {
  return [
    '  <url>',
    `    <loc>${escapeXml(loc)}</loc>`,
    lastmod ? `    <lastmod>${lastmod}</lastmod>` : null,
    changefreq ? `    <changefreq>${changefreq}</changefreq>` : null,
    priority ? `    <priority>${priority}</priority>` : null,
    '  </url>',
  ].filter(Boolean).join('\n')
}

export default async function handler(req, res) {
  try {
    const { data: posts, error } = await supabase
      .from('blog_posts')
      .select('slug, published_at, updated_at')
      .eq('published', true)
      .order('published_at', { ascending: false })

    if (error) throw error

    const entries = [
      ...STATIC_PAGES.map(p => urlEntry({ loc: `${SITE_URL}${p.path}`, changefreq: p.changefreq, priority: p.priority })),
      ...(posts || []).map(post => urlEntry({
        loc: `${SITE_URL}/blog/${post.slug}`,
        changefreq: 'monthly',
        priority: '0.7',
        lastmod: (post.updated_at || post.published_at || '').slice(0, 10) || undefined,
      })),
    ]

    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join('\n')}\n</urlset>\n`

    res.setHeader('Content-Type', 'application/xml; charset=utf-8')
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=3600') // CDN caches an hour; browsers always revalidate
    return res.status(200).send(xml)
  } catch (err) {
    console.error('sitemap generation error:', err)
    // Fail safe: at minimum still return the static pages, so a transient
    // Supabase error never takes the whole sitemap down for crawlers. But
    // silently dropping every blog post URL used to have no signal
    // attached to it at all — alert so this degraded mode gets noticed
    // and fixed rather than persisting unnoticed.
    await alertOnFailure(err.message, { effect: 'blog post URLs omitted from sitemap.xml this request' })
    const fallback = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${STATIC_PAGES.map(p => urlEntry({ loc: `${SITE_URL}${p.path}`, changefreq: p.changefreq, priority: p.priority })).join('\n')}\n</urlset>\n`
    res.setHeader('Content-Type', 'application/xml; charset=utf-8')
    // Deliberately no s-maxage here (unlike the success path's 1-hour CDN
    // cache) — a degraded, post-less sitemap should get re-tried on the
    // next crawl/request instead of being stuck cached for an hour after
    // Supabase has already recovered.
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=0')
    return res.status(200).send(fallback)
  }
}
