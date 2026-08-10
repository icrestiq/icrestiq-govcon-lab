// api/_lib/site-url.js
//
// Canonical public site URL. Every server-side handler that needs to build
// an absolute link (confirmation emails, redirects, download links, etc.)
// should import SITE_URL from here instead of building its own.
//
// Reads SITE_URL from the environment ONLY. Deliberately does NOT fall back
// to VERCEL_URL, req headers, or any other *.vercel.app value — those are
// per-deployment hostnames, not the canonical public domain. A previous
// version of this logic fell back to a *different* env var
// (NEXT_PUBLIC_SITE_URL, a leftover Next.js naming convention that doesn't
// apply to this Vite app) which had been set in the Vercel dashboard to the
// raw vercel.app domain — that's what caused confirmation links to leak the
// Vercel domain instead of www.govconlab.com. Do not reintroduce that
// pattern here.

export const SITE_URL = process.env.SITE_URL || 'https://www.govconlab.com'