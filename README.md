# ProxyDesk — Reseller Dashboard

A full-featured self-contained reseller management dashboard. Manage proxy plans, monitor usage and metrics, handle billing, and run rule-based diagnostics — all from a single, responsive interface with light and dark mode.

> Built from scratch with [Claude Code](https://claude.ai/code).

---

## Screenshots

### Overview

<img width="1920" height="836" alt="Screenshot 2026-06-03 at 17 27 05" src="https://github.com/user-attachments/assets/5d7b9d75-db02-41c0-a2be-40d536034ed2" />

### Plans

<img width="1917" height="847" alt="Screenshot 2026-06-03 at 17 27 46" src="https://github.com/user-attachments/assets/516a6aa4-1efb-4614-af11-616b8e0dc078" />

### Transactions

<img width="1918" height="837" alt="Screenshot 2026-06-03 at 17 28 27" src="https://github.com/user-attachments/assets/c7abea15-2f0b-49ec-a300-f770d273352a" />

### Plan Detail

<img width="1902" height="839" alt="Screenshot 2026-06-03 at 17 29 33" src="https://github.com/user-attachments/assets/34b33c95-28b8-4274-a567-4d900323d605" />

### Login

<img width="1908" height="841" alt="Screenshot 2026-06-03 at 17 30 14" src="https://github.com/user-attachments/assets/7cd01b2b-e0c1-455f-8c07-649909968a23" />

### Theme

<img width="1897" height="834" alt="Screenshot 2026-06-03 at 17 31 04" src="https://github.com/user-attachments/assets/635e8595-fb37-4931-9fb0-4f57759452f6" />
<img width="1916" height="837" alt="Screenshot 2026-06-03 at 17 32 03" src="https://github.com/user-attachments/assets/9e0f4212-fa3f-4045-8168-61f5752e88f3" />

---

## Architecture

ProxyDesk is **fully self-contained** — it does not call any external proxy API. All data lives in a local SQLite database managed by Prisma. The custom API layer (`src/lib/handlers/`) mimics a real reseller API and is exposed via a single Next.js route handler at `/api/proxy/[...path]`.

```
Browser → /api/proxy/[...path] → routeRequest() → handlers → SQLite (Prisma)
```

No third-party reseller API key is required. No charges are incurred by any action in the app.

---

## Prerequisites

- Node.js 20+

---

## Quick Start

### 1. Install packages

```bash
npm install
```

### 2. Set up environment files

#### `.env` — database path

```env
DATABASE_URL="file:./dev.db"
```

#### `.env.local` — secrets

```env
# Session encryption secret — generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
SESSION_SECRET=paste-your-generated-secret-here

# SQLite path (same as .env — Next.js loads .env.local separately)
DATABASE_URL="file:./dev.db"
```

### 3. Set up the database

Apply migrations, generate the Prisma client, and seed sample data:

```bash
npx prisma migrate deploy
npx prisma generate
npx prisma db seed
```

The seed creates:

- An **admin user**: `admin@proxydesk.local` / `proxydesk123`
- A starting **balance** of `$500.00`
- Three **sample plans** (datacenter, residential, shared_isp)
- Sample transactions

> To use a different email or password: `SEED_EMAIL=you@example.com SEED_PASSWORD=secret npx prisma db seed`

### 4. Start the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). You will be redirected to the login page.

---

### Setup Checklist

- [ ] `npm install` completed without errors
- [ ] `.env` exists with `DATABASE_URL=file:./dev.db`
- [ ] `.env.local` exists with `SESSION_SECRET` filled in
- [ ] `npx prisma migrate deploy && npx prisma generate && npx prisma db seed` completed
- [ ] `npm run dev` is running

---

## Environment Variables

| Variable         | File         | Required | Description                                     |
| ---------------- | ------------ | -------- | ----------------------------------------------- |
| `SESSION_SECRET` | `.env.local` | ✅       | iron-session encryption password (min 32 chars) |
| `DATABASE_URL`   | `.env`       | ✅       | SQLite file path — use `file:./dev.db`          |

---

## Features

### Authentication

- **Email + password login** — credentials are stored as bcrypt hashes in SQLite. No API keys, no OAuth.
- Session stored in an encrypted, httpOnly cookie (iron-session, 7-day TTL).
- All logins, logouts, and mutating API calls are recorded to an audit table.

### Overview

- Balance hero card with available balance and all-time spend
- **Add funds** shortcut (links to Settings top-up)
- Bandwidth usage chart (last 30 days, synthetic daily breakdown)
- Recent plans and recent transactions at a glance

### Plans

- **List** — paginated table with search and status filter
- **Detail** — credentials, bandwidth usage bar, connection info, extend/cancel actions
- **Create** — supports all 15 product types across three billing models:
  - Bandwidth (residential-lite, residential, mobile, mobile_usa, pool1–5)
  - Hybrid — bandwidth or time-billed (datacenter, shared_isp, ipv6-residential, ipv6-datacenter)
  - Unlimited residential (trial or full plan with Mbps cap)
  - Dedicated ISP (quantity + pool selection)
- Two-step flow: configure → check price → review → confirm
- **Cancel with proportional refund** — bandwidth plans refund unused GB; time/per-IP plans refund remaining duration. Refund amount shown in the confirmation toast.
- **Proxy download** — downloads credentials as `.txt` (host:port:user:pass per line). Works for all plan types — dedicated ISP returns the full proxy list; other types return a single credential entry.

### Metrics _(datacenter / shared_isp / ipv6-datacenter / ipv6-residential only)_

- Aggregate summary: total traffic, connections, success rate, peak throughput (last 24 h)
- Throughput chart (Mbps over time with rate cap overlay)
- Latency chart (p50 / p95 / p99)
- Synthetic time-series data generated with a seeded PRNG — deterministic per plan, realistic distribution

### Rule-Based Investigations _(same plan types as Metrics)_

Located inside the **Metrics** tab of a plan detail page. Lets you submit a customer complaint and get an instant structured diagnosis — no AI API, no per-call cost.

**How it works:**

1. User types a complaint (max 400 chars) and clicks **Start Investigation**
2. The engine classifies the complaint by keyword category (blocking, auth, timeout, gateway, rate limit, DNS, TLS, no activity)
3. It queries the plan's last-24-hour metrics snapshot (success rate, error breakdown, top destinations)
4. It builds a deterministic `Diagnosis` object and saves it to SQLite immediately (status = `complete`)
5. The UI polls once and renders the full result — no waiting

**Diagnosis output includes:**

- Severity (`info` / `warning` / `critical`)
- Headline and root cause
- Evidence table (metric → value → context)
- Customer-facing recommendation
- Internal staff recommendation

**Categories covered:** IP blocking / captcha, proxy auth errors, timeouts / latency, gateway errors (5xx), rate limiting, DNS resolution, TLS/SSL, and no-activity (catches misconfigured clients).

**Cost:** $0 — fully local, no external API calls.

### Balance & Top-Up

- Balance displayed in the Overview hero and Settings page
- **Add funds** via Settings: preset buttons ($10 / $25 / $50 / $100) or custom amount
- Direct top-up is an instant local admin operation — no payment gateway is involved
- All top-up and purchase events appear in the Transactions ledger

### Transactions

- Paginated ledger with type filter (all / topup / purchase / cancel / refund)

### Settings

- Account details (email, name, login time)
- Balance display with all-time spend
- Add funds form
- Logout

---

## Tech Stack

| Layer          | Choice                              |
| -------------- | ----------------------------------- |
| Framework      | Next.js 16 (App Router, React 19)   |
| Language       | TypeScript                          |
| Styling        | Tailwind CSS v4                     |
| Components     | shadcn/ui v4 (base-ui)              |
| Forms          | React Hook Form + Zod v4            |
| Charts         | Recharts v3                         |
| Auth / Session | iron-session + bcryptjs             |
| Database       | Prisma v7 + SQLite (better-sqlite3) |
| Icons          | Lucide React                        |
| Toasts         | Sonner                              |

---

## Project Structure

```
src/
├── app/
│   ├── (auth)/login/            # Login page + split-screen layout
│   ├── (dashboard)/             # All authenticated pages
│   │   ├── page.tsx             # Overview
│   │   ├── plans/               # Plans list, detail ([planId]), new
│   │   ├── transactions/        # Transactions list
│   │   └── settings/            # Settings + top-up
│   └── api/
│       ├── auth/                # Login / logout route handlers
│       └── proxy/[...path]/     # Universal internal API gateway
├── features/                    # Feature-sliced components
│   ├── auth/
│   ├── overview/
│   ├── plans/
│   ├── settings/
│   └── transactions/
├── components/
│   ├── layout/                  # AppSidebar, Header, ThemeToggle, PageWrapper
│   └── ui/                      # shadcn/ui components
├── lib/
│   ├── handlers/                # Business logic (balance, plans, metrics, investigate, …)
│   ├── router.ts                # Route dispatcher — maps method + path → handler
│   ├── dbFetch.ts               # Server-component helper (calls internal API)
│   ├── pricing.ts               # Price table + computePrice()
│   ├── session.ts               # iron-session config
│   ├── audit.ts                 # Audit event logger
│   └── db.ts                    # Prisma client (better-sqlite3 adapter)
├── proxy.ts                     # Next.js 16 auth proxy (replaces middleware.ts)
└── types/api.ts                 # Full API type definitions
prisma/
├── schema.prisma                # DB schema (User, Balance, Plan, Transaction, …)
└── seed.ts                      # Seeds admin user + sample plans
```

---

## Database Schema

| Model           | Purpose                                                  |
| --------------- | -------------------------------------------------------- |
| `User`          | Admin account (email + bcrypt hash)                      |
| `Balance`       | Single-row ledger: current balance + all-time spend      |
| `Plan`          | Proxy plans with billing type, credentials, usage        |
| `Transaction`   | Ledger entries (topup / purchase / cancel / refund)      |
| `Investigation` | Rule-based diagnoses with full serialised diagnosis JSON |
| `SubUser`       | Reseller sub-accounts (backend only — no UI)             |
| `AuditEvent`    | Login, logout, and mutation audit log                    |

---

## Audit Logging

Every login, logout, and mutating API call is recorded in the local SQLite database. Passwords are stored as bcrypt hashes — plaintext credentials are never persisted.

To inspect the database:

```bash
npx prisma studio
```

---

## What's Not Implemented

| Feature               | Notes                                                          |
| --------------------- | -------------------------------------------------------------- |
| **Server Management** | Backend stubs exist (restart, stats) but no UI                 |
| **Sub-Users UI**      | Backend routes exist (`/sub-users`) but no frontend navigation |
| **Geo Catalog**       | Endpoint stubbed, no UI                                        |
| **Crypto top-up**     | Stubbed response only — no real payment integration            |

---

## Acknowledgements

Built with **[Claude Code](https://claude.ai/code)** (Anthropic's AI coding tool).
