# Vacationdeal — Travel Agency Management & Booking Platform

A production-ready, full-stack travel agency website with a public booking frontend and a secure admin panel. Built with Next.js (App Router), TypeScript, PostgreSQL, Prisma, NextAuth, Tailwind, Zod, Razorpay and Nodemailer.

---

## ✨ Features

**Public site**
- Dynamic home, destinations (list + detail), packages (search/filter/sort + detail)
- Database-driven day-by-day itinerary timeline, gallery, hotels, activities, inclusions/exclusions, FAQs, reviews
- Booking flow with **server-side price calculation**, coupons, Razorpay checkout + **server-side signature verification**
- Reusable enquiry popup (Enquire Now / Get Quote / Plan My Trip / Request Callback)
- Floating & contextual WhatsApp CTAs (number from settings, never hard-coded)
- Blog, CMS pages, testimonials
- Full SEO: dynamic metadata, canonical URLs, Open Graph, JSON-LD (Product, TouristDestination, Article, FAQ, Breadcrumb), `sitemap.xml`, `robots.txt`

**Admin panel** (`/admin`)
- Secure credentials login, role-based access, middleware-protected routes
- Dashboard with KPIs and recent activity
- **Packages CRUD** with dynamic, unlimited repeaters (itinerary, highlights, inclusions, exclusions, hotels, activities, FAQs, gallery) organised into tabs
- Destinations CRUD, Leads (status + notes), Bookings (status), Customers, Testimonials, Blog CMS (rich-text), Coupons, Media library (upload), Settings, Team

**Engineering**
- Zod validation on client + server, Prisma transactions for bookings/payments
- Rate limiting, secure webhook verification, no secrets in client code
- Graceful fallbacks when SMTP / Razorpay aren't configured (nothing breaks)

---

## 🧰 Tech stack

| Layer | Choice |
|------|--------|
| Framework | Next.js 15 (App Router, RSC, Server Actions) + TypeScript |
| Styling | Tailwind CSS |
| Database | PostgreSQL + Prisma ORM |
| Auth | NextAuth v5 (Auth.js) — Credentials + JWT sessions + roles |
| Payments | Razorpay (server-verified) |
| Email | Nodemailer (SMTP) |
| Validation | Zod + React Hook Form |
| Icons | lucide-react |
| Tests | Vitest |

---

## 🗄️ Database models

`User`, `Account`, `Session`, `VerificationToken`, `Destination`, `DestinationImage`, `PackageCategory`, `TravelPackage`, `PackageImage`, `ItineraryDay`, `PackageInclusion`, `PackageExclusion`, `PackageHotel`, `PackageActivity`, `Faq`, `Customer`, `Booking`, `Payment`, `Lead`, `LeadNote`, `BlogCategory`, `BlogPost`, `Testimonial`, `Coupon`, `Media`, `Page`, `SiteSetting`.

---

## 🚀 Getting started

### 1. Prerequisites
- Node.js 20+ (built on Node 24)
- A PostgreSQL database (local, or a cloud provider like [Neon](https://neon.tech) / [Supabase](https://supabase.com))

### 2. Install
```bash
npm install
```

### 3. Configure environment
```bash
cp .env.example .env
```
Then set at least `DATABASE_URL` and `AUTH_SECRET` (generate one with `npx auth secret` or `openssl rand -base64 32`). See `.env.example` for every variable.

### 4. Create the schema & seed demo data
```bash
npm run prisma:migrate      # create tables (dev)   — or: npm run db:push
npm run db:seed             # 8 destinations, 12 packages, blog, leads, bookings…
```

### 5. Run
```bash
npm run dev                 # http://localhost:3000
```

### Admin login (seeded)
| | |
|--|--|
| URL | `http://localhost:3000/admin/login` |
| Email | `admin@vacationdeal.test` (or `SEED_ADMIN_EMAIL`) |
| Password | `Admin@12345` (or `SEED_ADMIN_PASSWORD`) |

> ⚠️ Change these credentials before deploying to production.

---

## 📜 Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start the dev server |
| `npm run build` | `prisma generate` + production build |
| `npm run start` | Start the production server |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript check |
| `npm run test` | Vitest unit tests |
| `npm run prisma:migrate` | Create/apply a dev migration |
| `npm run prisma:deploy` | Apply migrations in production |
| `npm run db:push` | Push schema without a migration |
| `npm run db:seed` | Seed demo data |
| `npm run prisma:studio` | Visual DB browser |

---

## 💳 Payment setup (Razorpay)

1. Create an account at [razorpay.com](https://razorpay.com) and copy your **Test mode** keys.
2. Set in `.env`:
   - `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`
   - `NEXT_PUBLIC_RAZORPAY_KEY_ID` (same as `RAZORPAY_KEY_ID`)
   - `RAZORPAY_WEBHOOK_SECRET` (from the webhook you create)
3. Add a webhook in the Razorpay dashboard pointing to `https://YOURDOMAIN/api/payments/webhook` for `payment.captured` and `payment.failed` events.

If keys are **not** set, the booking is still saved (as a request the team follows up on) — the UI shows an appropriate state instead of a broken checkout. Payment success is **always verified server-side** via HMAC signature — never trusted from the browser.

## ✉️ Email setup

Set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `EMAIL_FROM`, `ADMIN_NOTIFY_EMAIL`. Without SMTP configured, emails are logged to the console (flows never break). Transactional emails: new lead, new booking, booking confirmation, payment receipt, payment failed.

---

## 🌐 Deployment

**Vercel (recommended)**
1. Push to a Git repo and import into Vercel.
2. Add all env vars from `.env.example` in the Vercel project settings.
3. Use a managed Postgres (Neon/Supabase/Vercel Postgres) for `DATABASE_URL`.
4. Build command `npm run build`; the Prisma client is generated automatically.
5. Run `npm run prisma:deploy` against the production DB (e.g. as a release step), then `npm run db:seed` once if you want demo data.
6. For media uploads in production, set `BLOB_READ_WRITE_TOKEN` (Vercel Blob) — local `/public/uploads` is for development only.

**Any Node host**: `npm run build` then `npm run start` behind a reverse proxy, with `DATABASE_URL` reachable.

---

## 🔐 Security notes
- Passwords hashed with bcrypt; admin routes protected by middleware + per-action role checks.
- All inputs validated with Zod on the server; Prisma prevents SQL injection.
- Razorpay signature + webhook verification, basic rate limiting on public endpoints.
- Settings, WhatsApp number, tax, currency and analytics IDs are all configurable from the admin panel — nothing is hard-coded.
