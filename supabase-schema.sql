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
