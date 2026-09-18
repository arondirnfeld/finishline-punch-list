# Punch House

A simple, paper-inspired house punch list on **Next.js + Vercel**, with data in **Supabase**.

- Email/password and Google sign-in
- Each user has their own rooms, items, photos, and address
- Photos stored in Supabase Storage (`punch-photos`)

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000/

Requires `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

## Google auth

In the Supabase dashboard → Authentication → Providers → Google, add your Google OAuth Client ID and Secret. Redirect URI:

`https://<your-project-ref>.supabase.co/auth/v1/callback`

Also add your app URLs under Authentication → URL Configuration (Site URL + Redirect URLs), e.g. `http://localhost:3000` and your Vercel domain.
