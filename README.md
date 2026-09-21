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
- **Internal linking engine** — related packages, destinations and travel guides built from real relationships (same destination, category, themes, comparable price and length), never random filler
- Full SEO: per-record overrides (canonical, robots, OG, X/Twitter, focus keyword, custom JSON-LD), JSON-LD (TravelAgency, WebSite, TouristTrip, TouristDestination, Article, FAQPage, BreadcrumbList), noindex-aware `sitemap.xml`, `robots.txt`, and a working **redirect manager** that keeps indexed URLs alive when a slug changes

**Admin panel** (`/admin`)
- Secure credentials login, **permission-based access control** (see Roles below), enforced in the middleware *and* independently in every page, Server Action and API route
- **Business dashboard** — revenue (gross / paid / pending / refunded), leads, bookings, conversion rate, average booking value, upcoming trips, with a date filter (today → custom range) and trend, funnel, source, top-package and top-destination charts
- **CRM** — pipeline statuses, priorities, assignment, activity timeline, follow-up scheduling with overdue/today/upcoming views, search and filters on every field, bulk status change and bulk assignment, marketing attribution (UTM, gclid/fbclid, landing page, referrer) captured server-side
- **Activity log** (`/admin/activity-log`) — every sign-in and every change, searchable and filterable by user, action, area and date
- **Packages CRUD** with dynamic, unlimited repeaters (itinerary, highlights, inclusions, exclusions, hotels, activities, FAQs, gallery) organised into tabs
- **Media library** — folders, search, pagination, alt/title/caption editing, missing-alt warnings, and a storage abstraction (local / Vercel Blob / any S3-compatible bucket)
- **SEO panel** on every content type — search preview, social cards, index/follow controls and custom JSON-LD
- Destinations CRUD, Leads, Bookings, Customers, Testimonials, Blog CMS (rich-text), Coupons, Redirects, Quotations & Invoices, Settings, Team

**Engineering**
- Zod validation on client + server — including query and route parameters, so a hand-edited URL cannot widen a database query
- Prisma transactions for bookings/payments, with idempotent payment verification and webhooks (a replayed callback is a no-op)
- Allow-list HTML sanitisation of all rich-text before it is stored
- Uploads validated from their magic bytes, never their name or Content-Type
- Named rate limits on login, enquiries, bookings, pricing, payments, uploads and exports
- Structured JSON logging with automatic secret redaction; user-facing errors never expose internals
- Graceful fallbacks when SMTP / Razorpay aren't configured (nothing breaks)

---

## 👥 Roles

Defined in `lib/permissions.ts`, which is the single source of truth for the sidebar, the middleware and every server-side check.

| Role | Scope |
|------|-------|
| `SUPER_ADMIN` | Everything. Only a Super Admin can create or change another Super Admin. |
| `ADMIN` | Everything except promoting someone to Super Admin. |
| `MANAGER` | Leads, bookings, customers, documents, catalogue, reports, activity log. |
| `BOOKING_MANAGER` | Sales desk: bookings, leads, customers, documents, coupons, reports. |
| `CONTENT_MANAGER` | Website content: packages, destinations, blogs, pages, media, SEO, redirects. |
| `SALES` | Leads, customers, bookings, quotations. |
| `SALES_EXECUTIVE` | Bookings and documents, plus **only the leads assigned to them**. |
| `EDITOR` | Edits existing content. Cannot create, delete or publish. |
| `AGENT` | **Only the leads and bookings assigned to them.** |
| `VIEWER` | Read-only. |

Hiding a menu item is never the security boundary: `requirePermission()` in `lib/guard.ts` is, and it re-reads the session on every call.

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

`User`, `Account`, `Session`, `VerificationToken`, `Destination`, `DestinationImage`, `PackageCategory`, `TravelPackage`, `PackageImage`, `ItineraryDay`, `PackageInclusion`, `PackageExclusion`, `PackageHotel`, `PackageActivity`, `Faq`, `Customer`, `Booking`, `Payment`, `Lead`, `LeadNote`, `BlogCategory`, `BlogPost`, `Testimonial`, `Coupon`, `Media`, `Page`, `SiteSetting`, `SalesDocument`, `SalesDocumentItem`, `Redirect`, `ActivityLog`, `SeoMeta`.

### Upgrading an existing database

Schema changes are **additive only** — no table or column is ever dropped, and no existing row is rewritten. Take a backup, then run either:

```bash
npm run db:push      # Prisma applies the additive changes (the usual route)
npm run db:upgrade   # or apply prisma/sql/2026-09-19-platform-upgrade.sql with psql
```

The SQL file is idempotent, so re-running it is a no-op. **Never** run `prisma migrate reset` against a database with real bookings in it.

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
| `npm run check` | Lint + typecheck + tests in one go |
| `npm run db:upgrade` | Apply the additive upgrade SQL with `psql` |
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
6. For media uploads, set `STORAGE_DRIVER` to `vercel-blob` (with `BLOB_READ_WRITE_TOKEN`) or `s3` (with the `S3_*` variables). Local disk is not an option here: the filesystem is reset on every deploy and is not shared between instances.
7. Set `CRON_SECRET`; `/api/cron/crm` refuses to run in production without it. The schedule is already declared in `vercel.json`.

**VPS (Ubuntu/Debian, Node + nginx)**
1. `npm ci && npm run build`, then run `npm run start` under a process manager (systemd, PM2) behind nginx.
2. Point `DATABASE_URL` at Postgres on the same box or a managed one, and set `NEXTAUTH_URL` / `NEXT_PUBLIC_SITE_URL` to the real https:// address.
3. **Media can stay on the VPS** — that is the default. Keep `STORAGE_DRIVER="local"` and put the files outside the application directory:

   ```bash
   sudo mkdir -p /var/www/vacationdeal-uploads
   sudo chown -R $USER /var/www/vacationdeal-uploads   # the user Node runs as
   # in .env:
   UPLOAD_DIR="/var/www/vacationdeal-uploads"
   ```

   Anything under the app directory is destroyed by the deployment styles that replace it wholesale (a Docker rebuild, `output: "standalone"`, `rsync --delete`, swapping a release directory), and uploads are the one thing in there that cannot be rebuilt from git. Image URLs stay `/uploads/<folder>/<file>` whichever directory is used, so moving it later only means moving the files.

4. Optional — let nginx serve the images directly, so Node is not woken for a static file:

   ```nginx
   location /uploads/ {
       alias /var/www/vacationdeal-uploads/;
       access_log off;
       expires 1y;
       add_header Cache-Control "public, immutable";
       try_files $uri =404;
   }
   ```

   Without this the app serves them itself, correctly — the `alias` is a performance choice, not a requirement.

5. Back up the upload directory alongside the database. `pg_dump` alone will leave you with rows pointing at images that no longer exist.

### Getting images into that directory

Every admin form that holds a picture — destination cover and gallery, package gallery, blog cover, page OG image, the SEO share images, and images inside the rich-text editor — has a **Library** button next to it. It opens the media library, where an image can be uploaded from the machine you are sitting at or chosen from what is already there. Either way the bytes are written to `UPLOAD_DIR` and the field records a `/uploads/…` address, so the picture is served from this server.

The URL box beside the button still accepts a pasted link, because existing content holds them and they must keep working. A link is not stored locally, though: the site will be showing an image from someone else's server, which can change or disappear without notice.

To bring such an image across, paste it into the **"Paste an image URL to copy it onto this server"** box at the top of the media library and press Import. The server downloads it once and stores it like any upload. That request is guarded (`lib/fetch-image.ts`): http and https only, the resolved address is checked against the private, loopback, link-local and cloud-metadata ranges, redirects are refused rather than followed, and the response is capped and timed out — a URL an admin types is otherwise a way to make this server fetch things on the caller's behalf.

**Any other Node host**: `npm run build` then `npm run start` behind a reverse proxy, with `DATABASE_URL` reachable.

---

## 🔐 Security notes

- **Authorization is server-side and independent.** The middleware guards the section, the page guards itself, and every Server Action and route handler calls `requirePermission()` before it touches data. Invoking a Server Action directly gets you nothing your role does not already have.
- **Ownership is re-read, never trusted.** A role restricted to its own pipeline has the owner filter applied after every user-supplied filter, so a hand-edited query string cannot widen the result set.
- **Nothing financial comes from the browser.** Prices, discounts, coupons, totals and payment status are all derived server-side from database rows.
- **Payments are idempotent.** A replayed verification callback or a retried webhook is acknowledged without re-running the state change or resending emails, and a failure event can never overwrite a payment that already succeeded.
- **Rich text is sanitised** with an allow-list before it is stored, so a lower-privilege editor cannot plant script in a public page.
- **Uploads are identified by their magic bytes.** Filenames are generated, extensions come from the detected format, and the path is confined to the upload root — executables, PHP, HTML and script-carrying SVGs are all refused.
- Passwords are hashed with bcrypt (cost 12). Login is throttled per IP *and* per account, and failures are indistinguishable from an unknown email, so the form cannot be used to enumerate accounts.
- Disabling an account takes effect on the next request: the admin shell re-reads the user from the database rather than trusting the role in the JWT.
- All inputs validated with Zod on the server; Prisma parameterises every query.
- Security headers (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, HSTS, `frame-ancestors`) plus `X-Robots-Tag: noindex` on `/admin`, `/api`, `/my-trips` and `/booking`.
- Structured logs redact passwords, tokens and signatures automatically; user-facing errors never carry stack traces, SQL or file paths.
- Settings, WhatsApp number, tax, currency and analytics IDs are all configurable from the admin panel — nothing is hard-coded.
