# Nocturne Riding Academy — Next.js app setup

This is a Next.js 16 app (App Router + TypeScript). Auth, database, and row
level security all run on [Supabase](https://supabase.com) (hosted Postgres +
auth), with sessions handled server-side via `@supabase/ssr`, so `/account`
and `/coach` are protected in `proxy.ts` — no flash of protected content
before a redirect.

## 0. Requirements

- Node.js 20.9 or later (Next.js 16's minimum).

## 1. Install dependencies

```
npm install
```

## 2. Create a Supabase project

Go to https://supabase.com, sign up (free tier is fine), and create a new
project. Wait for it to finish provisioning (~2 minutes).

## 3. Run the database schema

1. In Supabase: **SQL Editor → New query**.
2. Paste the contents of `supabase/schema.sql` (in this project) and run it.

Coach access (`/coach`) is controlled by a single `is_coach` boolean column on
`profiles` — everyone starts `false`. Once you've registered an account
(step 7 below), flip yours on: **SQL Editor → New query** →
`update profiles set is_coach = true where email = 'you@example.com';`. Add
more coaches the same way as they join. `is_coach()` and the notification
system both read this one column, so there's exactly one place to manage who
has coach access — no function to edit and keep in sync.

This creates: `profiles` (auto-created per signup, holds each rider's level),
`trial_slots` + `trial_bookings` (the weekly trial-session schedule and
bookings), and `plans` + `enrollments` (what a rider can enroll in once their
level is set, with cash-only payment tracked as pending/paid).

## 4. Set your environment variables

1. Copy `.env.example` to a new file named `.env`.
2. In Supabase: **Project Settings → API Keys**, copy the **Project URL**,
   **publishable** key, and **secret** key into `.env`:

   ```
   NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
   SUPABASE_SECRET_KEY=your-secret-key
   ```

   Supabase renamed the old "anon" key to "publishable" and "service_role" to
   "secret" — if your dashboard still uses the old labels, those are the same
   keys. **Never** prefix the secret key with `NEXT_PUBLIC_` — that bundles it
   into client-side JS and exposes it to every visitor.

   `.env` is in `.gitignore` — it won't be committed.

## 5. Turn on email/password sign-up

On by default. Optionally turn off "Confirm email" (**Authentication →
Providers → Email**) while testing locally, so new accounts don't need a
confirmation link first. Turn it back on before going live.

**Rate limit while testing:** Supabase's built-in email sender (used for
confirmation/reset emails) is capped very low (a handful of emails/hour).
Repeatedly registering test accounts trips
`over_email_send_rate_limit`. Fastest fix is the "Confirm email" toggle
above — with it off, no email is sent at all. For production, add a custom
SMTP provider (**Authentication → Settings → SMTP Settings**) instead of
relying on Supabase's shared sender. [Resend](https://resend.com) is the
easiest free option (3,000 emails/month, 100/day; it's what Supabase's own
docs use as the example) — verify a domain, grab an API key, paste it in.
Brevo (300/day free) or SendGrid (100/day free) work too if you need an
alternative.

## 6. Turn on Google sign-in

1. In Supabase: **Authentication → Providers → Google** → toggle it on.
2. Create an OAuth Client ID (type "Web application") in the
   [Google Cloud Console](https://console.cloud.google.com/apis/credentials),
   using the **Authorized redirect URI** Supabase shows on that same screen
   (looks like `https://xxxxxxxx.supabase.co/auth/v1/callback`).
3. Paste the Client ID and Secret into Supabase's Google provider screen and
   save.
4. In Supabase: **Authentication → URL Configuration**, add your app's
   `/auth/callback` URL (e.g. `http://localhost:3000/auth/callback`) to
   **Redirect URLs** — Supabase will otherwise silently refuse the redirect
   back to your app after Google sign-in.

Until this is done, "Continue with Google" will show an error toast —
email/password sign-in and registration work independently of this step.

## 7. Run it locally

```
npm run dev
```

(Next.js 16 uses Turbopack automatically now — no flags needed.)

Open http://localhost:3000 and try **Register** → check your email (or
Supabase's **Authentication → Users** tab) → **Sign in** → you should land on
**My account**. Now flip on coach access for that account (see step 3) and
sign in again — you should land on `/coach` instead of `/account`. Visiting
`/account` or `/coach` signed-out redirects to `/signin`.

## 8. Deploy

This app needs Node hosting (not a static host), since `proxy.ts` and most
pages run server-side. [Vercel](https://vercel.com) is the easiest fit for
Next.js: connect the repo, add the env vars from step 4 in the project
settings, and deploy. Remember to add your production domain's
`/auth/callback` URL to Supabase's Redirect URLs too (step 6.4).

## What's built vs. what's next

Built now: registration (email/password + Google), sign-in/out, password
reset, a protected `/account` and `/coach` dashboard (riders directory,
weekly trial-slot schedule, plans CRUD, cash-payment tracking), trial-session
booking, rider enrollment in a plan once a coach sets their level, and — once
paid — either a recurring weekly **group** class (coach-editable time slots
per level, riders assigned into one from `/coach/groups`) or ad-hoc
**private** sessions (individual dates scheduled from `/coach/sessions`),
with attendance tracked either way and visible to the rider on `/account`.

Not built yet, on purpose: a real payment provider (cash-only for now).

If you're on an existing Supabase project (not a fresh one running
`supabase/schema.sql`), run the numbered files in `supabase/migrations/` in
order in the SQL Editor to pick up schema changes made after your project was
set up.
