# Punch House

A simple, paper-inspired house punch list on **Next.js + Vercel**, with data in **Supabase**.

- Email/password and Google sign-in
- Each user has their own rooms, items, photos, and address
- Photos stored in Supabase Storage (`punch-photos`)

## Live

- **App:** https://punch-house.vercel.app
- **Vercel team:** `orches-chaim` / project `punch-house`
- **Supabase:** org `aron-innovations`, project `punch-house` (`btebuqpblnkoxnslfhvb`)

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000/

Requires `.env.local` with:

```
NEXT_PUBLIC_SUPABASE_URL=https://btebuqpblnkoxnslfhvb.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

## Auth setup (required once)

In Supabase → Authentication → URL Configuration:

- **Site URL:** `https://punch-house.vercel.app`
- **Redirect URLs:** `https://punch-house.vercel.app/auth/callback`, `http://localhost:3000/auth/callback`

For Google: Authentication → Providers → Google, add Client ID/Secret. Callback:

`https://btebuqpblnkoxnslfhvb.supabase.co/auth/v1/callback`
