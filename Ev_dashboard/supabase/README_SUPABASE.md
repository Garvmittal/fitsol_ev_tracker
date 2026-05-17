# Supabase setup and deployment (EV Dashboard)

This file explains steps to create a Supabase project, run the SQL migration, and connect the existing Node server.

1) Create a Supabase project
   - Go to https://app.supabase.com and create a new project.
   - Note the `Project URL` and `anon` / `service_role` keys from Project Settings → API.

2) Run migrations
   - From your local machine, install `psql` or use the Supabase CLI.
   - Example using `psql` (replace placeholders):

```bash
export SUPABASE_URL=https://your-project-ref.supabase.co
export SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
psql "postgresql://postgres:$(echo $SUPABASE_SERVICE_ROLE_KEY)@db.your-supabase-host:5432/postgres" -f supabase/migrations/001_init.sql
```

   - Or use `supabase db push` with the Supabase CLI: refer to Supabase docs.

3) Seed data
   - Convert your Google Sheets data to CSV and import using Supabase Table Editor or `psql`.

4) Auth & RLS
   - Enable Auth providers you need (email) in Supabase Auth settings.
   - Add RLS policies on tables if you want row-level access control. Start with permissive policies during migration, then tighten them.

5) Connect server
   - Set environment variables in production:

```
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
USE_SUPABASE=true
```

   - `server/supabaseClient.js` expects `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.

6) Edge Functions (optional)
   - You can port specific endpoints to Supabase Edge Functions (Deno) for lower latency.
   - Keep sensitive service role operations in server-side Node code.

7) Deployment
   - Deploy frontend to Vercel / Netlify / Supabase Hosting (static) using `vite build` outputs in `dist`.
   - Deploy Node server to a platform (Railway, Render, Heroku) and set the env vars above.

If you want, I can generate SQL to import CSVs from your Sheets export and prepare a minimal seed file.
