# iCrestiQ GovCon Lab — Deployment Guide
## Stack: React (Vite) + Supabase + Vercel

---

## STEP 1 — Set Up Supabase (your backend + database)

1. Go to **supabase.com** → Create a free account
2. Click **New Project** → Name it `icrestiq-govcon-lab`
3. Set a strong database password (save it somewhere safe)
4. Wait ~2 minutes for project to initialize

### Run the database schema:
1. In your Supabase dashboard → click **SQL Editor** (left sidebar)
2. Click **New Query**
3. Open `supabase-schema.sql` from this project folder
4. Paste the entire contents → Click **Run**
5. You should see "Success. No rows returned."

### Get your API keys:
1. In Supabase → **Settings** (gear icon) → **API**
2. Copy two values:
   - **Project URL** (looks like: `https://abc123.supabase.co`)
   - **anon public** key (long JWT string)

### Enable Realtime (for live chat):
1. Supabase → **Database** → **Replication**
2. Find the `messages` table → toggle it ON

---

## STEP 2 — Configure Environment Variables

1. In the project folder, copy `.env.example` to `.env.local`:
   ```
   cp .env.example .env.local
   ```
2. Open `.env.local` and paste your Supabase values:
   ```
   VITE_SUPABASE_URL=https://your-project-id.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key-here
   ```

---

## STEP 3 — Test Locally

```bash
# Install dependencies
npm install

# Start dev server
npm run dev
```

Open `http://localhost:5173` — you should see the landing page.

**Test the flow:**
1. Click "Join the Lab" → create an account
2. After signup, go to Supabase → Table Editor → `profiles`
3. Find your row → change `role` from `member` to `admin`
4. Now you can access `/admin`

---

## STEP 4 — Deploy to Vercel

### Option A: Via Vercel Dashboard (easiest)
1. Push your project to GitHub:
   ```bash
   git init
   git add .
   git commit -m "Initial iCrestiQ GovCon Lab deployment"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/icrestiq-govcon-lab.git
   git push -u origin main
   ```
2. Go to **vercel.com** → Sign up with GitHub
3. Click **Add New Project** → Import your repo
4. Framework: **Vite** (auto-detected)
5. **Before deploying**, click **Environment Variables** and add:
   - `VITE_SUPABASE_URL` → your Supabase URL
   - `VITE_SUPABASE_ANON_KEY` → your Supabase anon key
6. Click **Deploy**

### Option B: Via Vercel CLI
```bash
npm install -g vercel
vercel login
vercel --prod
```
When prompted, add environment variables.

---

## STEP 5 — Connect Your Custom Domain

1. In Vercel → your project → **Settings** → **Domains**
2. Add your domain (e.g. `govconlab.com`)
3. Vercel will show you DNS records to add
4. Go to your domain registrar (GoDaddy, Namecheap, etc.)
5. Add the DNS records Vercel provides (usually an A record or CNAME)
6. Wait 10-30 minutes for DNS to propagate
7. Vercel auto-provisions SSL certificate (HTTPS) — free

---

## STEP 6 — Make Yourself Admin

1. Sign up on your live site
2. Go to Supabase → **Table Editor** → `profiles`
3. Find your row
4. Click the `role` cell → change to `admin` → Save
5. Sign out → Sign back in → You'll see the Admin panel

---

## STEP 7 — Add Products to the Store

**Via Admin Panel** (recommended):
1. Log in to your site as admin
2. Go to `/admin`
3. Click **Add Product**
4. Fill in: title, description, price, category
5. Toggle **Active** → Save
6. Product appears live in the store immediately

---

## What's Ready Now

| Feature | Status |
|---|---|
| Landing page | ✅ Live |
| Member signup / login | ✅ Live |
| Dashboard with GovCon links | ✅ Live |
| Community chat (6 rooms) | ✅ Real-time via Supabase |
| Online presence indicator | ✅ Live |
| Store with product cards | ✅ Live |
| Cart system | ✅ Live (in-memory) |
| Product detail pages | ✅ Live |
| Admin panel (products + members) | ✅ Live |
| Mobile responsive | ✅ All pages |

---

## Next Phases (when you're ready)

**Payment Processing:**
- Install Stripe: `npm install @stripe/stripe-js`
- Add Stripe Checkout on the cart → order confirmation flow
- Store orders in the `orders` table

**Course Library:**
- Add `courses` and `lessons` tables to Supabase
- Build lesson player component with video embed (YouTube/Vimeo/Pictory)
- Add progress tracking per user

**Email Integration:**
- Use Supabase Edge Functions to send welcome emails via Resend or SendGrid
- Trigger on new signup

---

## Support

If you hit any issue during setup, the most common fixes:
- **Blank page**: Check `.env.local` values are correct (no extra spaces)
- **Auth not working**: Check Supabase Auth → Email confirmations (disable for testing)
- **Chat not real-time**: Confirm messages table is enabled in Supabase Replication
- **Domain not loading**: DNS propagation can take up to 48 hours (usually 30 min)

---

## STRIPE SETUP GUIDE

### Step 1 — Create Stripe Account
1. Go to **dashboard.stripe.com** → Create account
2. Complete business verification (iCrestiQ LLC, SC)
3. Enable **test mode** first — toggle top-left of dashboard

### Step 2 — Enable Klarna & Affirm
1. Stripe Dashboard → **Settings** → **Payment Methods**
2. Find **Klarna** → Click Enable → Complete their brief application
3. Find **Affirm** → Click Enable → Complete their brief application
4. Both typically approve within 1–2 business days
5. Also enable: **Apple Pay**, **Google Pay** (instant — no approval needed)

### Step 3 — Create Products in Stripe
For each product, go to: **Stripe Dashboard → Products → Add Product**

| Product | Price | Type |
|---|---|---|
| Hardware & Fasteners Playbook | $97 | One-time |
| Janitorial & Sanitation Playbook | $97 | One-time |
| Safety & PPE Playbook | $97 | One-time |
| MRO & Industrial Parts Playbook | $97 | One-time |
| MIL-SPEC Packaging Bible™ | $147 | One-time |
| Founding Member — Lifetime | $297 | One-time |
| iCrestiQ GovCon Lab — Monthly | $47 | Recurring (monthly) |
| iCrestiQ GovCon Lab Pro — Monthly | $97 | Recurring (monthly) |

After creating each product, copy the **Price ID** (starts with `price_...`)

### Step 4 — Update Price IDs in Code
Open `src/lib/stripe.js` and replace each `price_REPLACE_...` value with your real Price IDs.

Also add to Vercel environment variables:
```
STRIPE_PRICE_HW_FASTENERS=price_xxxxx
STRIPE_PRICE_JAN_SAN=price_xxxxx
STRIPE_PRICE_SAFETY_PPE=price_xxxxx
STRIPE_PRICE_MRO=price_xxxxx
STRIPE_PRICE_MIL_SPEC=price_xxxxx
STRIPE_PRICE_FOUNDING=price_xxxxx
STRIPE_PRICE_LAB_MONTHLY=price_xxxxx
STRIPE_PRICE_LAB_PRO=price_xxxxx
```

### Step 5 — Add Secret Keys to Vercel
In Vercel → your project → **Settings → Environment Variables**, add:

```
STRIPE_SECRET_KEY=sk_live_xxxxx          ← From Stripe Dashboard → API Keys
STRIPE_WEBHOOK_SECRET=whsec_xxxxx        ← From Step 6 below
SUPABASE_SERVICE_ROLE_KEY=xxxxx          ← From Supabase → Settings → API → service_role
NEXT_PUBLIC_SITE_URL=https://govconlab.com
```

⚠️ NEVER put sk_live keys in your .env.local or commit them to GitHub.

### Step 6 — Set Up Stripe Webhook
1. Stripe Dashboard → **Developers → Webhooks → Add Endpoint**
2. Endpoint URL: `https://govconlab.com/api/stripe/webhook`
3. Select events to listen for:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`
4. Click **Add Endpoint** → Copy the **Signing Secret** (whsec_...)
5. Paste it as `STRIPE_WEBHOOK_SECRET` in Vercel env vars

### Step 7 — Enable Stripe Billing Portal
1. Stripe Dashboard → **Settings → Billing → Customer Portal**
2. Enable the portal
3. Configure: allow cancellations, allow payment method updates, show invoice history
4. Save

### Step 8 — Run the Stripe Schema Update
In Supabase SQL Editor, run the **STRIPE ADDITIONS** section at the bottom of `supabase-schema.sql`

### Step 9 — Test End-to-End (in test mode)
1. Use Stripe test card: `4242 4242 4242 4242` / any future date / any CVC
2. Test Klarna: Use test credentials from stripe.com/docs/testing#klarna
3. Test Affirm: Use test credentials from stripe.com/docs/testing#affirm
4. Verify order appears in Supabase `orders` table after checkout
5. Verify `user_purchases` row is created
6. Switch Stripe to **Live Mode** when ready to accept real payments

---

## GOING LIVE CHECKLIST

- [ ] Stripe account fully verified (business details, bank account)
- [ ] Klarna approved
- [ ] Affirm approved  
- [ ] All Price IDs updated in code
- [ ] Webhook endpoint registered and signing secret in Vercel
- [ ] Supabase Stripe schema additions run
- [ ] Test purchase completed end-to-end
- [ ] Stripe switched from test → live mode
- [ ] Live publishable key updated in Vercel (VITE_STRIPE_PUBLISHABLE_KEY)
