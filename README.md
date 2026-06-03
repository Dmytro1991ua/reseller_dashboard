# FlashProxy Reseller Dashboard

A full-featured reseller management dashboard for the [FlashProxy](https://flashproxy.com) Reseller API. Manage proxy plans, monitor usage and metrics, handle billing, and run AI-powered diagnostics — all from a single, responsive interface with light and dark mode.

> Built from scratch in under 48 hours with [Claude Code](https://claude.ai/code).

---

## Screenshots

|               Overview                |              Plans              |
| :-----------------------------------: | :-----------------------------: |
| ![Overview](screenshots/overview.png) | ![Plans](screenshots/plans.png) |

|                 Plan Detail                 |              Login              |
| :-----------------------------------------: | :-----------------------------: |
| ![Plan Detail](screenshots/plan-detail.png) | ![Login](screenshots/login.png) |

---

## Prerequisites

- Node.js 20+
- A FlashProxy reseller API key (`fp_live_...` for production, `fp_test_...` for sandbox)

---

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Create `.env.local` in the project root:

```env
# FlashProxy API base URL
# Sandbox:
NEXT_PUBLIC_API_BASE_URL=https://rapi.flashproxy.com/sandbox/api/v1
# Production:
# NEXT_PUBLIC_API_BASE_URL=https://rapi.flashproxy.com/api/v1

# FLASHPROXY_API_KEY=your_flash_proxy_api_key

# Session encryption key — min 32 random characters
SESSION_SECRET=change-this-to-a-long-random-string-at-least-32-chars
```

> **Warning:** Never commit `.env.local`. It is in `.gitignore`.

### 3. Set up the database

```bash
npx prisma migrate deploy
```

Creates `dev.db` (SQLite) with the `AuditEvent` table for login/logout/mutation logging.

### 4. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and log in with your FlashProxy API key.

---

## Environment Variables

| Variable                   | Required | Description                                     |
| -------------------------- | -------- | ----------------------------------------------- |
| `NEXT_PUBLIC_API_BASE_URL` | ✅       | FlashProxy API base URL (sandbox or production) |
| `SESSION_SECRET`           | ✅       | iron-session encryption password (min 32 chars) |
| `FLASHPROXY_API_KEY`       | ✅       | Issued Falash Proxy API key

---

## Features

### Authentication

- **API key login** — no email/password or OAuth. Enter your `fp_live_` or `fp_test_` key; it is validated live against `GET /balance` before the session is created.
- Session stored in an encrypted, httpOnly cookie (iron-session, 7-day TTL). The key is never written to disk.
- All mutations (POST/PUT/DELETE/PATCH) are logged to an audit table (SQLite via Prisma).

### Overview

- Balance hero card with available balance and all-time spend
- Bandwidth usage chart (last 30 days)
- Recent plans and recent transactions at a glance

### Plans

- **List** — paginated table with search and status filter
- **Detail** — credentials, bandwidth usage, connection info, extend/cancel actions
- **Create** — supports all 15 product types across three billing models:
  - Bandwidth (residential-lite, residential, mobile, mobile_usa, pool1–5)
  - Hybrid — bandwidth or time-billed (datacenter, shared_isp, ipv6-residential, ipv6-datacenter)
  - Unlimited residential (trial or full plan with Mbps cap)
  - Dedicated ISP (quantity + pool selection from live API)
- Two-step flow: configure → check price → review → confirm (idempotency key prevents double-charges)
- **Proxy download** — dedicated ISP proxy list as `.txt` (host:port:user:pass per line)

### Metrics _(datacenter / shared_isp / ipv6-_ plans only)\*

- Aggregate summary: traffic, connections, success rate, peak throughput
- Throughput chart (Mbps over time with rate cap overlay)
- Latency chart (p50 / p95 / p99)

### AI Investigations _(datacenter / shared_isp / ipv6-_ plans only)\*

- Submit a customer complaint (max 400 chars)
- AI queries real-time monitoring data and returns a structured diagnosis: severity, headline, root cause, evidence, and two recommendation variants (customer-facing + internal)
- $0.50 per investigation, automatically refunded on failure
- Investigation history with expandable results

### Transactions

- Paginated ledger with type filter

### Settings

- API key display (masked, with reveal toggle)
- Session info (environment, endpoint, login time)
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
| Auth / Session | iron-session (encrypted cookie)     |
| Audit log      | Prisma v7 + SQLite (better-sqlite3) |
| Icons          | Lucide React                        |
| Toasts         | Sonner                              |

---

## Project Structure

```
src/
├── app/
│   ├── (auth)/login/        # Login page + split-screen layout
│   ├── (dashboard)/         # All authenticated pages
│   │   ├── page.tsx         # Overview
│   │   ├── plans/           # Plans list, detail, new
│   │   ├── transactions/    # Transactions list
│   │   └── settings/        # Settings
│   └── api/
│       ├── auth/            # Login / logout route handlers
│       └── proxy/[...path]/ # Universal proxy → FlashProxy API
├── features/                # Feature-sliced components
│   ├── auth/
│   ├── overview/
│   ├── plans/
│   └── transactions/
├── components/
│   ├── layout/              # AppSidebar, Header, ThemeToggle, PageWrapper
│   └── ui/                  # shadcn/ui components
├── lib/
│   ├── api-client.ts        # Server-side flashproxyFetch helper
│   ├── session.ts           # iron-session config
│   ├── audit.ts             # Audit event logger
│   └── apiConfig.ts         # Base URL config
└── types/api.ts             # Full FlashProxy API type definitions
```

---

## Known Sandbox Limitations

The sandbox API (`/sandbox/api/v1`) does not implement all endpoints. The following features are blocked in sandbox but work correctly with a production key:

| Feature           | Endpoint                     | Status in Sandbox                              |
| ----------------- | ---------------------------- | ---------------------------------------------- |
| Check price       | `POST /plans/check-price`    | ❌ 404 — shows "Price check not available"     |
| Plan metrics      | `GET /plans/{id}/metrics/*`  | ❌ 404 — shows "No time-series data available" |
| AI Investigations | `POST /investigate/{planId}` | ❌ 404 — works in production                   |

---

## What's Not Implemented

The following are documented in the FlashProxy API spec but not yet built:

- **Server Management** — restart, stats, monitoring for `unlimited_residential` plans
- **Sub-Users** — create and manage reseller sub-accounts
- **Geo Catalog** — country/state/city targeting reference per product
- **Crypto top-up** — balance top-up via crypto deposit address

---

## Audit Logging

Every login, logout, and mutating API call is recorded in the local SQLite database. The API key is stored as a SHA-256 hash — the plaintext key is never persisted.

To inspect audit events:

```bash
npx prisma studio
```

---

## Acknowledgements

Built from scratch in under 48 hours with **[Claude Code](https://claude.ai/code)** (Anthropic's AI coding tool), working from the FlashProxy Reseller API OpenAPI specification.
