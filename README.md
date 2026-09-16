# Nocturne Riding Academy

A Next.js web app for a riding academy — public marketing pages backed by a
real booking and enrollment flow: riders sign up, book a trial session, get
assigned a level by a coach, and enroll in a paid plan. Coaches manage
riders, the weekly trial schedule, plans, and payments from a dedicated
dashboard.

## Features

**Public site**

- Marketing homepage with a live pricing section — plan cards (name,
  price, session count, what's included) are pulled straight from the
  database, so they always match what's configured in the coach dashboard.

**Riders**

- Email/password and Google sign-in, registration, and password reset.
- Book an open trial session from the weekly schedule.
- Once a coach sets their riding level, enroll in a plan for that level.
- Cash-only payment for now — enrollment starts "pending" until a coach
  marks it paid.

**Coaches** (`/coach`, restricted to an email allowlist)

- **Riders** — every registered rider, searchable, with their trial status
  and a control to set their riding level.
- **Weekly schedule** — add, edit, or deactivate the recurring trial-session
  slots riders book into.
- **Plans** — create, edit, or deactivate the paid plans offered per level.
- **Payments** — every enrollment across all riders; mark cash payments as
  paid or cancel a pending one.

## Tech stack

- [Next.js 16](https://nextjs.org) (App Router, Turbopack, Server Actions)
- [React 19](https://react.dev) + TypeScript
- [Supabase](https://supabase.com) — Postgres, Auth, and Row Level Security
  as the sole backend (no separate API server)

## Getting started

```bash
npm install
npm run dev
```

Requires a configured Supabase project and a `.env` file first — see
**[AUTH_SETUP.md](./AUTH_SETUP.md)** for the full walkthrough (creating the
Supabase project, running `supabase/schema.sql`, environment variables,
enabling Google sign-in, and deploying).

## Project structure

```
app/                  Routes (App Router)
  account/            Rider account, trial booking
  coach/               Coach dashboard (riders, schedule, plans, payments)
  auth/callback/       OAuth callback (exchanges code for a session)
  signin/, register/   Auth pages
components/           UI components, shared across public + app pages
lib/                  Data access (Supabase queries) and server actions
  actions/             "use server" mutations, one file per feature area
  supabase/            Supabase client factories (browser + server)
proxy.ts              Route protection (Next.js 16's middleware.ts equivalent)
supabase/schema.sql   Full database schema — tables, RLS policies, seed data
```

## License

Proprietary — all rights reserved. See [LICENSE](./LICENSE).

See [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md) for third-party media
credits.
