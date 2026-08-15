-- ════════════════════════════════════════════════════════════
-- iCrestiQ GovCon Lab — Supabase Database Schema
-- Run this in Supabase SQL Editor (supabase.com → SQL Editor)
-- ════════════════════════════════════════════════════════════

-- ── Profiles ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id          UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  username    TEXT UNIQUE NOT NULL,
  email       TEXT,
  role        TEXT DEFAULT 'member' CHECK (role IN ('member', 'admin')),
  avatar_url  TEXT,
  bio         TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all profiles"
  ON profiles FOR SELECT USING (true);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- ── Products ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS products (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  title           TEXT NOT NULL,
  description     TEXT,
  long_description TEXT,
  price           NUMERIC(10, 2) NOT NULL DEFAULT 0,
  category        TEXT NOT NULL DEFAULT 'Playbooks',
  badge           TEXT,
  badge_type      TEXT DEFAULT 'green',
  tag_line        TEXT,
  active          BOOLEAN DEFAULT TRUE,
  file_url        TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active products"
  ON products FOR SELECT USING (active = true OR auth.role() = 'authenticated');

CREATE POLICY "Admins can manage products"
  ON products FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- ── Messages (Chat) ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS messages (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id     TEXT NOT NULL,
  user_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  username    TEXT NOT NULL,
  membership_tier TEXT,
  content     TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast room queries
CREATE INDEX IF NOT EXISTS idx_messages_room_id ON messages(room_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read messages"
  ON messages FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can send messages"
  ON messages FOR INSERT WITH CHECK (
    auth.role() = 'authenticated'
    AND auth.uid() = user_id
  );

CREATE POLICY "Users can delete own messages"
  ON messages FOR DELETE USING (auth.uid() = user_id);

-- ── Orders ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS orders (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  product_id  TEXT REFERENCES products(id),
  amount      NUMERIC(10, 2),
  status      TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'refunded')),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own orders"
  ON orders FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all orders"
  ON orders FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- ── Enable Realtime for messages ───────────────────────────
-- Go to: Supabase Dashboard → Database → Replication
-- Enable realtime for the 'messages' table
-- OR run:
ALTER PUBLICATION supabase_realtime ADD TABLE messages;

-- ════════════════════════════════════════════════════════════
-- OPTIONAL: Seed your first admin user
-- After signing up, run this with your user's UUID:
-- ════════════════════════════════════════════════════════════
-- UPDATE profiles SET role = 'admin' WHERE email = 'your@email.com';

-- ════════════════════════════════════════════════════════════
-- STRIPE ADDITIONS — Run after initial schema
-- ════════════════════════════════════════════════════════════

-- ── Add Stripe columns to profiles ────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS membership_tier TEXT DEFAULT 'free'
    CHECK (membership_tier IN ('free', 'member', 'pro', 'founding', 'admin')),
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'inactive',
  ADD COLUMN IF NOT EXISTS subscription_period_end TIMESTAMPTZ;

-- ── Add Stripe columns to orders ──────────────────────────
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS stripe_session_id TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'card';

-- ── User purchases (digital product access) ───────────────
CREATE TABLE IF NOT EXISTS user_purchases (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id   TEXT REFERENCES products(id),
  purchased_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, product_id)
);

ALTER TABLE user_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own purchases"
  ON user_purchases FOR SELECT USING (auth.uid() = user_id);

-- ── Index for fast Stripe customer lookups ─────────────────
CREATE INDEX IF NOT EXISTS idx_profiles_stripe_customer
  ON profiles(stripe_customer_id);

-- ════════════════════════════════════════════════════════════
-- OPTIONAL: Seed founding member offer product
-- ════════════════════════════════════════════════════════════
-- INSERT INTO products (id, title, description, price, category, badge, badge_type, active)
-- VALUES (
--   'founding-member',
--   'Founding Member — Lifetime Access',
--   'One-time purchase. Lifetime Lab Pro access. First 25 spots only.',
--   297.00, 'Bundles', 'Limited', 'amber', true
-- );

-- ════════════════════════════════════════════════════════════
-- NAME FIELDS ADDITION — Run this in Supabase SQL Editor
-- ════════════════════════════════════════════════════════════
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS first_name TEXT,
  ADD COLUMN IF NOT EXISTS last_name  TEXT;

-- ════════════════════════════════════════════════════════════
-- STORAGE BUCKET FOR PRODUCT IMAGES
-- Run in Supabase SQL Editor
-- ════════════════════════════════════════════════════════════

-- Add thumbnail_url column to products
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;

-- Create storage bucket (run in Supabase Dashboard → Storage → New Bucket)
-- Name: product-images
-- Public: YES (so images display on the site)

-- Storage policy — allow admin uploads
-- In Supabase Dashboard → Storage → product-images → Policies → Add policy:
-- Allow uploads for authenticated users with role = admin

-- ════════════════════════════════════════════════════════════
-- STORAGE BUCKET SETUP — Run ONCE in Supabase SQL Editor
-- ════════════════════════════════════════════════════════════

-- Step 1: Create the storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

-- Step 2: Allow public read access to all files
CREATE POLICY "Public can view product images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'product-images');

-- Step 3: Allow authenticated users to upload
CREATE POLICY "Authenticated users can upload product images"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'product-images' AND auth.role() = 'authenticated');

-- Step 4: Allow authenticated users to update/delete their uploads
CREATE POLICY "Authenticated users can update product images"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'product-images' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete product images"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'product-images' AND auth.role() = 'authenticated');

-- ════════════════════════════════════════════════════════════
-- DIGEST SUBSCRIBERS — free weekly RFQ digest signup (homepage)
-- Run in Supabase SQL Editor
-- ════════════════════════════════════════════════════════════

-- Note: the prompt asked for (email, created_at, source, confirmed).
-- Two columns beyond that are added because double opt-in needs them:
--   confirm_token — an unguessable value sent in the confirmation email
--                   link. Without it, anyone could confirm anyone else's
--                   email just by knowing the address.
--   confirmed_at  — when it was actually confirmed, for a real audit
--                   trail rather than just a boolean flip.
CREATE TABLE IF NOT EXISTS digest_subscribers (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email         TEXT NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  source        TEXT DEFAULT 'homepage',
  confirmed     BOOLEAN DEFAULT FALSE,
  confirm_token TEXT UNIQUE,
  confirmed_at  TIMESTAMPTZ
);

-- One row per email address — resubmitting the form just refreshes the
-- confirm_token rather than creating a duplicate row.
CREATE UNIQUE INDEX IF NOT EXISTS idx_digest_subscribers_email
  ON digest_subscribers (lower(email));

ALTER TABLE digest_subscribers ENABLE ROW LEVEL SECURITY;

-- Reads: admins only, via the admin panel's Subscribers tab. Everyone
-- else — including a signed-in non-admin member — gets zero rows back,
-- same as before this policy existed (verified: the anon key returned an
-- empty array; that stays true, since anon requests have no auth.uid()
-- and so never satisfy the EXISTS check below).
CREATE POLICY "Admins can view digest subscribers"
  ON digest_subscribers FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Writes: deliberately no INSERT/UPDATE/DELETE policy for anyone,
-- including admins. Every write still goes through /api/digest/subscribe
-- and /api/digest/confirm using the service role key server-side —
-- nothing in the browser, admin or not, can create, edit, or delete a
-- subscriber row.

-- Source breakdown (Source / Confirmed / Pending / Total), computed as a
-- real GROUP BY in Postgres rather than shipping every row to the browser
-- for JS to aggregate — the whole point of the "don't fetch the whole
-- list into memory" constraint. Returns one row per distinct source
-- value, so the payload stays a handful of rows even once
-- digest_subscribers has thousands. SECURITY DEFINER lets it bypass RLS
-- internally, so it enforces its own admin check up front instead of
-- relying on the SELECT policy above.
CREATE OR REPLACE FUNCTION digest_subscriber_source_breakdown()
RETURNS TABLE (source TEXT, confirmed_count BIGINT, pending_count BIGINT, total_count BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  RETURN QUERY
  SELECT
    COALESCE(ds.source, 'unknown') AS source,
    COUNT(*) FILTER (WHERE ds.confirmed = true) AS confirmed_count,
    COUNT(*) FILTER (WHERE ds.confirmed IS DISTINCT FROM true) AS pending_count,
    COUNT(*) AS total_count
  FROM digest_subscribers ds
  GROUP BY ds.source
  ORDER BY total_count DESC;
END;
$$;

-- Public, counts-only stats — safe to call with the anon key, no login.
-- Column names match the real live schema (verified via information_schema
-- earlier in this project: id, email, created_at, source, confirmed,
-- confirm_token, confirmed_at), so no adjustment was needed. This is
-- additive: digest_subscriber_source_breakdown() above is untouched and
-- the admin panel keeps using that one — this function exists purely so
-- something like a public landing-page counter can show subscriber counts
-- without needing any credential that could also read email addresses.
--
-- Hard requirements this function must never violate:
--   - returns aggregate counts only — never an email, id, or row
--   - takes no parameters — nothing for a caller to filter or fan out by
CREATE OR REPLACE FUNCTION public.digest_subscriber_public_stats()
RETURNS json
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT json_build_object(
    'total',       (SELECT count(*) FROM digest_subscribers),
    'confirmed',   (SELECT count(*) FROM digest_subscribers WHERE confirmed),
    'pending',     (SELECT count(*) FROM digest_subscribers WHERE NOT confirmed),
    'new_7_days',  (SELECT count(*) FROM digest_subscribers
                    WHERE created_at >= now() - interval '7 days'),
    'by_source',   (SELECT COALESCE(json_agg(t), '[]'::json) FROM (
                      SELECT source,
                             count(*) AS total,
                             count(*) FILTER (WHERE confirmed) AS confirmed
                      FROM digest_subscribers
                      GROUP BY source ORDER BY count(*) DESC) t)
  );
$$;

GRANT EXECUTE ON FUNCTION public.digest_subscriber_public_stats() TO anon, authenticated;

-- ════════════════════════════════════════════════════════════
-- BLOG POSTS — /blog + /blog/:slug, published from the admin panel
-- Run in Supabase SQL Editor
-- ════════════════════════════════════════════════════════════

-- body is plain text: paragraphs separated by a blank line, and a line
-- starting with "## " renders as a subheading on the post page — same
-- lightweight convention ProductDetail.jsx already uses for
-- long_description, just split on blank lines instead of a single \n.
CREATE TABLE IF NOT EXISTS blog_posts (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  slug            TEXT UNIQUE NOT NULL,
  title           TEXT NOT NULL,
  excerpt         TEXT,
  body            TEXT NOT NULL,
  category        TEXT DEFAULT 'GovCon Notes',
  author          TEXT DEFAULT 'Keith Atkinson',
  cover_image_url TEXT,
  reading_minutes INTEGER DEFAULT 4,
  published       BOOLEAN DEFAULT FALSE,
  published_at    TIMESTAMPTZ DEFAULT NOW(),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_blog_posts_published_at ON blog_posts(published_at DESC);

ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;

-- Tighter than the products policy (which lets any authenticated user see
-- inactive products) — drafts should only be visible to admins.
CREATE POLICY "Anyone can view published posts"
  ON blog_posts FOR SELECT USING (published = true);

CREATE POLICY "Admins can manage all posts"
  ON blog_posts FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Cover images reuse the existing public product-images bucket (its
-- storage policies aren't prefix-restricted) under a blog/ prefix
-- instead of products/ — no new bucket or storage policy needed.
