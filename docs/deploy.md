# Deploying AppForge (Supabase Postgres + any container host)

AppForge is one container (API + web) and one Postgres. Supabase supplies the Postgres; Render, Fly.io, Railway, a VPS — anything that runs a Docker image — runs the container.

## 1. Database: Supabase

1. Create a project. In **Project → Connect**, copy the **Direct connection** string (port 5432) or the **Session pooler** string.
   Do **not** use the *Transaction pooler* (port 6543): we use `SET LOCAL ROLE`, advisory locks and multi-statement transactions that need a stable session.
2. The user in that string must be allowed to `CREATE ROLE` (Supabase's `postgres` user can). The first boot creates an unprivileged `app_user` role that every tenant query runs as, so Row Level Security is enforced.
3. Put the string in `DATABASE_URL`. Migrations (`services/api/migrations`) run automatically at boot, under an advisory lock, and are recorded in `_migrations`.
4. Our tables live in `public` and are only reached through our API (never the Supabase Data API): the `anon`/`authenticated` roles have no policies on them. If you want belt and braces, disable the Data API for the project.

## 2. Secrets

```
DATABASE_URL=postgres://postgres:…@db.<ref>.supabase.co:5432/postgres
APPFORGE_SECRET=$(openssl rand -hex 32)      # encrypts users' own AI keys; keep it stable
APPFORGE_PUBLIC_URL=https://app.example.com
APPFORGE_OPERATOR_EMAILS=you@example.com
RESEND_API_KEY=…  MAIL_FROM="AppForge <hello@example.com>"   # verification / reset / sign-in emails
```

Everything else in `.env.example` is optional: with no keys, the product runs on its demo adapters and says so in the UI.

## 3. Container

`docker build -t appforge .` then run with the env above, exposing **3000** (web, public). Port 8787 (API) is internal: the web app proxies `/api/v1/*` to it. Put TLS in front of 3000 with a proxy that sets `X-Forwarded-For` (rate limits use the last entry).

CI builds this image and smoke-tests `/health` and the web app on every push.

## 4. After the first boot

1. Sign up with an address listed in `APPFORGE_OPERATOR_EMAILS` and confirm the email → `/en/operator` appears in the header.
2. In **Settings → AI provider** paste an OpenRouter/Anthropic/OpenAI key and press **Test key**.
3. Generate an app. Check the cost in Settings → usage.

## Limits worth knowing

- Rate limits are in-process: with more than one instance, put a shared store behind `RateLimiter`.
- Uploaded images are not supported yet (apps use generated icons and text).
- Hosting and DB backups are your provider's job; use Supabase's backups/PITR.
