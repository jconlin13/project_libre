# Family Book Club — Setup & Architecture Guide

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Set up the database
npx prisma db push

# 3. Start the dev server
npx next dev

# 4. Open in browser
open http://localhost:3000
```

Register with any name and email, then go to **Settings** to connect your Hardcover API token.

---

## Configuration

Copy `.env.example` to `.env` and adjust as needed. The defaults work out of the box for local development.

| Variable | Default | Purpose |
|---|---|---|
| `DATABASE_URL` | `file:./dev.db` | SQLite database path |
| `AUTH_MODE` | `local` | `local` for cookie auth, omit for Supabase |
| `HARDCOVER_API_URL` | `https://api.hardcover.app/v1/graphql` | Hardcover GraphQL endpoint |
| `ENCRYPTION_KEY` | (example key) | 32-byte hex key for encrypting stored tokens |
| `NEXT_PUBLIC_SUPABASE_URL` | (empty) | Set to enable Supabase auth |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | (empty) | Set to enable Supabase auth |

**Important:** Generate a real encryption key for anything beyond local testing:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## Architecture Overview

```
Browser (localhost:3000)
   │
   ├── Landing page (public)
   ├── Login/Register (local cookie auth)
   └── Protected app (/dashboard, /recommendations, /settings)
          │
          ├── Client components fetch from internal API routes
          │
          └── /api/* routes (server-side)
                 │
                 ├── SQLite via Prisma (users, households, recommendations)
                 └── Hardcover GraphQL API (reading data, book search)
```

**Data flow:** The browser never talks to Hardcover directly. All Hardcover calls go through our API routes, which decrypt the user's stored token, make the GraphQL request server-side, and return the results. Tokens are encrypted at rest with AES-256-GCM.

---

## Local-First Substitutions

The original spec called for several hosted services. Each was replaced with a local equivalent that fills the same role.

| Original Spec | Local Substitute | Why Equivalent |
|---|---|---|
| **Supabase Postgres** (hosted database) | **SQLite** via Prisma | Same ORM, same schema, same queries. SQLite runs as a local file with zero setup. Switch back by changing `provider` in `prisma/schema.prisma` and updating `DATABASE_URL`. |
| **Supabase Auth** (Google OAuth, magic links) | **Cookie-based sessions** | Same outcome: identify the logged-in user on each request. Local mode sets a session cookie with the user ID. No passwords, no external auth provider needed. Supabase auth code is preserved in `src/lib/supabase/` and can be reactivated by setting `NEXT_PUBLIC_SUPABASE_URL` and updating the middleware. |
| **Vercel** (cloud hosting) | **Local Next.js dev server** | `next dev` serves the same app locally. For production, `next build && next start` works on any machine. |
| **Vercel deployment pipeline** | **Git + local build** | `git commit` for versioning, `npm run build` to verify. No CI/CD needed for local use. |

**To upgrade to hosted services later:**
1. Set up a Supabase project and fill in the env vars
2. Change `prisma/schema.prisma` provider to `postgresql` and update `DATABASE_URL`
3. Run `npx prisma db push` against the new database
4. Remove `AUTH_MODE=local` from `.env`
5. Deploy to Vercel (or any Node.js host) with `next build`

---

## Database Schema

Six tables managed by Prisma:

- **users** — Name, email, optional Hardcover connection (encrypted token)
- **households** — Named groups with unique invite codes
- **household_members** — Links users to households with roles (admin/member)
- **recommendations** — Book suggestions from one user to another, with status tracking
- **plus_ones** — "I want to read that too" markers on books
- **snapshots** — Cached reading activity from Hardcover (for the activity feed)

To inspect the database directly:
```bash
npx prisma studio
```

---

## API Routes

| Route | Methods | Purpose |
|---|---|---|
| `/api/auth/local` | POST | Register, login, logout (local mode) |
| `/api/user` | GET | Current user info |
| `/api/households` | GET, POST | List and create households |
| `/api/households/join` | POST | Join via invite code |
| `/api/hardcover` | GET | Proxy to Hardcover for current user |
| `/api/hardcover/member` | GET | Proxy to Hardcover for a household member |
| `/api/hardcover/rating` | POST | Update book rating (0-5, half-star increments) |
| `/api/hardcover/status` | POST | Update book status (Want to Read, Reading, Read, DNF) |
| `/api/hardcover/progress` | POST | Update reading progress (pages or percentage) |
| `/api/settings/hardcover` | POST, DELETE | Connect/disconnect Hardcover account |
| `/api/recommendations` | GET, POST, PATCH | Send, list, update recommendation status |
| `/api/plus-ones` | GET, POST, DELETE | Manage +1 wishlist |
| `/api/activity` | GET | Merged activity feed for household |
| `/api/feedback` | POST | Submit user feedback |

---

## Testing

```bash
npx jest           # Run all 23 tests
npx jest --watch   # Watch mode
```

Test suites cover encryption, Hardcover helper functions, recommendation validation, and plus-one deduplication logic.

---

## Project Structure

```
src/
  app/
    page.tsx                    — Landing page
    login/                      — Auth page (local + Supabase modes)
    (app)/                      — Protected routes
      dashboard/                — Household overview with reading cards
      book/[id]/                — Book detail page (status, rating, progress, activity)
      person/[id]/              — Household member profile
      recommendations/          — Book search, send, and manage recommendations
      settings/                 — Hardcover connection management
      about/                    — About page
      feedback/                 — Feedback submission form
    api/                        — Server-side API endpoints
  components/
    app-shell.tsx               — Navigation, header (logo, nav, font size, theme), user menu
    book-card.tsx               — Book display with cover, half-star rating, progress, Libby link
    star-rating.tsx             — Shared half-star rating component (left/right half-click detection)
    font-size-provider.tsx      — Global text size scaling context (localStorage persistence)
    loading-skeleton.tsx        — Loading state placeholders
    icons/                      — Custom SVG icon components (Amazon, Libby, Hardcover)
    ui/                         — shadcn/ui components
  lib/
    auth.ts                     — Dual-mode auth (local + Supabase)
    encryption.ts               — AES-256-GCM for token storage
    hardcover.ts                — GraphQL client, rating/status/progress mutations
    prisma.ts                   — Database client singleton
    supabase/                   — Supabase client helpers (dormant in local mode)
public/
  logos/logo.svg                — Celtic tree of life app logo
prisma/
  schema.prisma                 — Database schema definition
__tests__/                      — Unit tests
```

---

## Features

- **Dashboard** — Book carousels grouped by reading status, with carousel navigation, ratings, and progress tracking
- **Book detail** (`/book/[id]`) — Status management, half-star ratings, reading progress (% or pages), activity log, external links (Libby, Hardcover, Amazon)
- **Recommendations** — Search Hardcover, send book recommendations to household members
- **Households** — Create/join groups via invite code, view member profiles and reading activity
- **Settings** — Connect/disconnect Hardcover API token (encrypted at rest)
- **Accessibility** — Font size scaling (Cmd+/Cmd-), dark/light theme toggle

---

## Roadmap

### Phase 1 — Solo Reading View ✅
Core functionality: dashboard with book carousels, book detail pages with status/rating/progress, Hardcover API integration, local auth, household management, recommendations.

### Phase 2 — Discovery & Library Management ✅
- ✅ **Global `Cmd+K` search bar** — search your books, Hardcover catalog, and household network
  - Debounced search (300ms, 3-char minimum) with three result sections: My Books, Books (Hardcover), In Your Network
  - Two-step Hardcover search: Typesense for relevance → batch GraphQL for cover images
  - Inline "+ Add" to Want to Read from search results
  - Network results show household members' reading status with links to profiles
  - ⌘K keyboard shortcut and header search bar trigger
- ✅ **Library category pages** (`/books/[category]`) — dedicated pages for All, Want to Read, Currently Reading, Read, Not Finished
  - Tab navigation bar across all category pages
  - Card view: cover, title, author, contextual dates (Added/Started/Finished), recommend button
  - Shelf view: responsive cover grid with hover overlay (title, author, recommend)
  - "See All >" links on dashboard category headers
- ✅ **Dashboard improvements** — renamed "Recently Finished" → "Read", hoverable category headers
- ✅ **Recommend button** (placeholder) — added to book detail page, card view, and shelf view for future functionality

### Phase 3 — Social & Recommendations
- Household member reading activity feeds
- Enhanced recommendation workflow (wire up Recommend buttons)
- Cached member activity snapshots (reduce API calls)
- Social reading feed — see when household members finish or start books
- "Who's read this?" on book detail pages

### Phase 4 — Mobile & Polish
- Mobile-responsive refinements
- ISBN barcode scanner for quick book lookup
- Push notifications for recommendations and activity

### Phase 5 — Goals & Stats
- Reading goals (books per year, pages per month)
- Stats dashboard (genres, pace, streaks)
- Libby availability checker
- Notification preferences

### Production Migration
- Deploy to Vercel
- Switch from SQLite to Supabase PostgreSQL
- Enable Supabase Auth (Google OAuth)
- Configure `FEEDBACK_EMAIL` env var for feedback form delivery

---

## Hardcover API Notes

- **Endpoint:** `https://api.hardcover.app/v1/graphql`
- **Auth:** Bearer token in `authorization` header
- **Rate limit:** 60 requests per minute
- **Token expiry:** 1 year, resets January 1st
- **Status IDs:** 1 = Want to Read, 2 = Currently Reading, 3 = Read, 5 = Did Not Finish
- **Reading progress:** Available via `user_book_reads` → `progress` (percentage) and `progress_pages`
- **Server-side only:** Tokens must not be exposed to the browser
