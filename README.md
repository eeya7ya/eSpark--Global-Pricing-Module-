# eSpark · Global Pricing Module

Precision-driven pricing workspace for multi-manufacturer product catalogs — JOD conversion, shipping, customs, and profit modelling. Built on Next.js 15 with an eSpark-branded dark-first UI and a serverless Neon Postgres backend.

## Stack

- **Next.js 15** (App Router, Turbopack dev)
- **React 19** with Tailwind CSS 4
- **Drizzle ORM** + **@neondatabase/serverless** — serverless Postgres over HTTP (Neon), with a postgres.js fallback for any non-Neon Postgres URL.
- **lucide-react** icons (eSpark brand standard)
- **jose** + bcryptjs for auth (JWT in httpOnly cookie)

## Design system

The UI follows the [eSpark design system](https://github.com/eeya7ya/eSpark) — dark-first, indigo→cyan gradient, glass panels, soft glow. Key tokens live in `src/app/globals.css`:

- **Background:** `#0c0e1a` with ambient blur blobs (indigo + cyan)
- **Surface tiers:** `#121420 → #1c1e2e → #2a2d42`
- **Primary:** `#6366f1` (indigo 500) · **Accent:** `#06b6d4` (cyan 500)
- **Signature gradient:** `linear-gradient(135deg, #6366f1, #06b6d4)` — on the wordmark, primary CTAs, and title highlights
- **Typography:** Geist (sans) via Google Fonts

## Database

Database URL is resolved in priority order from `DATABASE_URL` → `POSTGRES_URL` → `POSTGRES_PRISMA_URL` → `POSTGRES_URL_NON_POOLING`. Neon URLs (`*.neon.tech`) use the `@neondatabase/serverless` HTTP driver automatically — no connection pool required on Vercel edge/serverless.

## Local setup

```bash
cp .env.example .env.local   # fill in DATABASE_URL, JWT_SECRET, etc.
npm install
npm run db:push              # sync Drizzle schema to your Neon DB
npm run dev
```

Then visit [http://localhost:3000](http://localhost:3000).
