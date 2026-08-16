// middleware.js — Vercel Edge Middleware, runs before vercel.json's rewrites
// on every request to a matched path.
//
// WHY THIS EXISTS: govconlab.com is a client-rendered Vite/React SPA with
// no server-side rendering. A real browser runs the JS, fetches the post
// from Supabase, and paints it — but most AI/search crawlers relevant to
// this site's robots.txt allowances (GPTBot, ClaudeBot, PerplexityBot,
// CCBot) are documented to NOT execute JavaScript at all; they read the
// raw HTML response. For a Vite SPA that raw HTML is just an empty
// <div id="root"> and a script tag — no title, no description, no post
// content. robots.txt permits these crawlers, but without this file the
// content itself was invisible to them regardless.
//
// This middleware detects known bot/crawler user agents requesting
// /blog or /blog/:slug and, only for them, serves a complete, self-
// contained HTML document with the real title, meta description, Open
// Graph tags, Twitter card tags, a JSON-LD Article schema, and the post
// body already rendered as real HTML — no JS execution required to see
// any of it. Real visitors (and any user agent that doesn't match the
// bot pattern) are untouched: the function returns nothing, which lets
// the request fall through to the normal SPA exactly as before.
//
// The body-parsing logic below (renderInlineHtml/parseListBlock/
// parseTableBlock) intentionally mirrors src/pages/BlogPost.jsx's
// renderInline/parseList/parseTable — same lightweight paste-formatting
// convention, just producing an HTML string instead of React elements,
// since Edge Middleware can't import JSX. Keep the two in sync if the
// paste-formatting rules ever change.

export const config = {
  matcher: ['/blog', '/blog/:slug*'],
}

const SITE_URL = process.env.SITE_URL || 'https://www.govconlab.com'

// Covers the three specifically allowed in robots.txt (GPTBot, ClaudeBot,
// PerplexityBot), the other major AI/search crawlers also allowed there
// (CCBot, Google-Extended, Googlebot), and the social link-unfurl bots
// that have the exact same "doesn't run JS" limitation (Facebook, Twitter/X,
// LinkedIn, Slack, Discord, WhatsApp, Telegram) — those need the Open
// Graph tags in raw HTML too, for the same underlying reason.
const BOT_UA_PATTERN = /GPTBot|ChatGPT-User|ClaudeBot|Claude-Web|PerplexityBot|CCBot|Google-Extended|Googlebot|Bingbot|Applebot|DuckDuckBot|YandexBot|Baiduspider|facebookexternalhit|Facebot|Twitterbot|LinkedInBot|Slackbot|Discordbot|WhatsApp|TelegramBot|Pinterest|redditbot/i

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// Google truncates meta descriptions in search results around ~155-160
// characters — an untruncated excerpt just gets cut off mid-word there.
// OG/Twitter descriptions and JSON-LD tolerate longer text fine, so this
// is only applied to the <meta name="description"> tag specifically.
function truncateForMetaDescription(text, max = 155) {
  const clean = String(text ?? '').replace(/\s+/g, ' ').trim()
  if (clean.length <= max) return clean
  return clean.slice(0, max - 1).replace(/\s+\S*$/, '') + '…'
}

// Mirrors BlogPost.jsx's renderInline — **bold**, __underline__, *italic*,
// [text](url) — recursing into bold/italic/underline content so a link
// inside italic copy still renders as a real <a>, not literal brackets.
function renderInlineHtml(text) {
  const regex = /\*\*(.+?)\*\*|__(.+?)__|\*(.+?)\*|\[(.+?)\]\((.+?)\)/g
  let result = ''
  let lastIndex = 0
  let match
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) result += escapeHtml(text.slice(lastIndex, match.index))
    const [, bold, underline, italic, linkText, linkUrl] = match
    if (bold !== undefined) result += `<strong>${renderInlineHtml(bold)}</strong>`
    else if (underline !== undefined) result += `<u>${renderInlineHtml(underline)}</u>`
    else if (italic !== undefined) result += `<em>${renderInlineHtml(italic)}</em>`
    else result += `<a href="${escapeHtml(linkUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(linkText)}</a>`
    lastIndex = regex.lastIndex
  }
  if (lastIndex < text.length) result += escapeHtml(text.slice(lastIndex))
  return result
}

function parseListBlock(block) {
  const lines = block.split('\n').map(l => l.trim()).filter(Boolean)
  if (lines.length === 0) return null
  if (lines.every(l => l.startsWith('- '))) return { ordered: false, items: lines.map(l => l.slice(2)) }
  if (lines.every(l => /^\d+\.\s*/.test(l))) return { ordered: true, items: lines.map(l => l.replace(/^\d+\.\s*/, '')) }
  return null
}

function splitTableRowStr(line) {
  return line.trim().slice(1, -1).split(/(?<!\\)\|/).map(cell => cell.trim().replace(/\\\|/g, '|'))
}

function parseTableBlock(block) {
  const lines = block.split('\n').map(l => l.trim()).filter(Boolean)
  if (lines.length < 2 || !lines.every(l => l.startsWith('|') && l.endsWith('|'))) return null
  const separatorCells = splitTableRowStr(lines[1])
  if (!separatorCells.every(c => /^:?-{3,}:?$/.test(c))) return null
  return { headers: splitTableRowStr(lines[0]), rows: lines.slice(2).map(splitTableRowStr) }
}

function renderBodyHtml(body) {
  return body.split(/\n\s*\n/).map(block => {
    const trimmed = block.trim()
    if (!trimmed) return ''
    if (trimmed.startsWith('### ')) return `<h3>${renderInlineHtml(trimmed.slice(4))}</h3>`
    if (trimmed.startsWith('## ')) return `<h2>${renderInlineHtml(trimmed.slice(3))}</h2>`
    const list = parseListBlock(trimmed)
    if (list) {
      const tag = list.ordered ? 'ol' : 'ul'
      return `<${tag}>${list.items.map(item => `<li>${renderInlineHtml(item)}</li>`).join('')}</${tag}>`
    }
    const table = parseTableBlock(trimmed)
    if (table) {
      return `<table><thead><tr>${table.headers.map(h => `<th>${renderInlineHtml(h)}</th>`).join('')}</tr></thead><tbody>${table.rows.map(row => `<tr>${row.map(cell => `<td>${renderInlineHtml(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table>`
    }
    return `<p>${renderInlineHtml(trimmed)}</p>`
  }).join('\n')
}

function pageShell({ title, description, canonical, ogType, ogImage, extraHead, bodyHtml, robots }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(truncateForMetaDescription(description))}" />
<meta name="robots" content="${robots || 'index,follow'}" />
<link rel="canonical" href="${escapeHtml(canonical)}" />
<meta property="og:title" content="${escapeHtml(title)}" />
<meta property="og:description" content="${escapeHtml(description)}" />
<meta property="og:type" content="${ogType}" />
<meta property="og:url" content="${escapeHtml(canonical)}" />
${ogImage ? `<meta property="og:image" content="${escapeHtml(ogImage)}" />` : ''}
<meta name="twitter:card" content="${ogImage ? 'summary_large_image' : 'summary'}" />
<meta name="twitter:title" content="${escapeHtml(title)}" />
<meta name="twitter:description" content="${escapeHtml(description)}" />
${ogImage ? `<meta name="twitter:image" content="${escapeHtml(ogImage)}" />` : ''}
${extraHead || ''}
<style>
  body{font-family:system-ui,sans-serif;max-width:720px;margin:0 auto;padding:32px 20px;color:#1B2A4A;line-height:1.6}
  a{color:#4F6BED}
  img{max-width:100%;border-radius:8px}
  table{border-collapse:collapse;width:100%}
  td,th{border:1px solid #DDE1EA;padding:8px;text-align:left}
</style>
</head>
<body>
${bodyHtml}
</body>
</html>`
}

async function fetchFromSupabase(path) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseAnonKey) return null
  const res = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    headers: { apikey: supabaseAnonKey, Authorization: `Bearer ${supabaseAnonKey}` },
  })
  if (!res.ok) return null
  return res.json()
}

async function renderIndex() {
  const posts = await fetchFromSupabase(
    'blog_posts?published=eq.true&select=slug,title,excerpt,category,published_at&order=published_at.desc'
  )
  const title = 'Blog | GovCon Lab'
  const description = 'Weekly notes on federal product contracting — RFQs, DIBBS/DLA, compliance, and what actually wins bids, from an operator who bids every week.'
  const canonical = `${SITE_URL}/blog`

  const listHtml = (posts || []).length
    ? (posts || []).map(p => `
      <article style="margin-bottom:28px;padding-bottom:28px;border-bottom:1px solid #DDE1EA">
        <h2><a href="${SITE_URL}/blog/${escapeHtml(p.slug)}">${escapeHtml(p.title)}</a></h2>
        <p>${escapeHtml(p.excerpt || '')}</p>
      </article>`).join('\n')
    : '<p>No posts yet — check back soon.</p>'

  return pageShell({
    title,
    description,
    canonical,
    ogType: 'website',
    ogImage: null,
    bodyHtml: `<h1>GovCon Lab Blog</h1>\n${listHtml}`,
  })
}

async function renderPost(slug) {
  const rows = await fetchFromSupabase(
    `blog_posts?slug=eq.${encodeURIComponent(slug)}&published=eq.true&select=*&limit=1`
  )
  const post = rows && rows[0]
  if (!post) {
    return {
      status: 404,
      html: pageShell({
        title: 'Post not found | GovCon Lab Blog',
        description: 'This post could not be found.',
        canonical: `${SITE_URL}/blog`,
        ogType: 'website',
        ogImage: null,
        robots: 'noindex,follow',
        bodyHtml: `<p>Post not found. <a href="${SITE_URL}/blog">Back to the blog</a>.</p>`,
      }),
    }
  }

  const canonical = `${SITE_URL}/blog/${post.slug}`
  const publishedIso = post.published_at ? new Date(post.published_at).toISOString() : undefined
  const updatedIso = post.updated_at ? new Date(post.updated_at).toISOString() : publishedIso
  const dateLabel = post.published_at
    ? new Date(post.published_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : ''

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.excerpt || undefined,
    image: post.cover_image_url || undefined,
    datePublished: publishedIso,
    dateModified: updatedIso,
    author: { '@type': 'Person', name: post.author || 'Keith Atkinson' },
    publisher: {
      '@type': 'Organization',
      name: 'iCrestiQ GovCon Lab',
      logo: { '@type': 'ImageObject', url: `${SITE_URL}/favicon.svg` },
    },
    mainEntityOfPage: { '@type': 'WebPage', '@id': canonical },
  }

  const bodyHtml = `
    <p><a href="${SITE_URL}/blog">&larr; Back to Blog</a></p>
    <p><strong>${escapeHtml(post.category || 'GovCon Notes')}</strong></p>
    <h1>${escapeHtml(post.title)}</h1>
    <p>${escapeHtml(post.author || '')} &middot; ${escapeHtml(dateLabel)} &middot; ${escapeHtml(String(post.reading_minutes || ''))} min read</p>
    ${post.cover_image_url ? `<img src="${escapeHtml(post.cover_image_url)}" alt="${escapeHtml(post.title)}" />` : ''}
    ${renderBodyHtml(post.body || '')}
  `

  return {
    status: 200,
    html: pageShell({
      title: `${post.title} | GovCon Lab Blog`,
      description: post.excerpt || post.title,
      canonical,
      ogType: 'article',
      ogImage: post.cover_image_url || null,
      extraHead: `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>`,
      bodyHtml,
    }),
  }
}

export default async function middleware(request) {
  const userAgent = request.headers.get('user-agent') || ''
  if (!BOT_UA_PATTERN.test(userAgent)) return // real visitors: fall through to the normal SPA, untouched

  const url = new URL(request.url)

  try {
    if (url.pathname === '/blog' || url.pathname === '/blog/') {
      const html = await renderIndex()
      return new Response(html, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } })
    }

    const slugMatch = url.pathname.match(/^\/blog\/([^/]+)\/?$/)
    if (slugMatch) {
      const { status, html } = await renderPost(decodeURIComponent(slugMatch[1]))
      return new Response(html, { status, headers: { 'content-type': 'text/html; charset=utf-8' } })
    }
  } catch (err) {
    // Never let a prerender failure block a crawler entirely — fall
    // through to the normal SPA rather than returning a hard error.
    console.error('blog middleware error:', err)
    return
  }
}
