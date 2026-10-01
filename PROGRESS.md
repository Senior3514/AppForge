# PROGRESS

## Scope note
The master prompt I received contained sections 0, 1, 3.1–3.3 and 11. Sections 2 and 4–10 were not included, so the module list, plan limits and some UX details are my own choices.

## Product shape (current)
- **Desktop agent** (`desktop/`, Electron): one installer per OS. It starts the bundled API + web on loopback, in *local mode* (`APPFORGE_LOCAL`): one built-in owner, no sign-in, unlimited plan, data in the user's app-data folder, their own AI key encrypted on disk. Every API request must carry a per-launch key that only the local web proxy knows, and the proxy refuses foreign `Origin`/`Host`, so a web page the user visits cannot drive their local app (tested).
- **Public site**: the same web build without the key shows a download page (no prompt box, no accounts, no pricing).
- **Dormant**: the hosted multi-user mode (signup, email verification, password reset, plans, operator console) is still in the API with its tests, but has no UI and is not shipped. It can be revived for a cloud edition.
- **Supabase**: not used by the agent. The empty `AppForge` Supabase project is untouched; it would only matter for a future cloud sync/license service.

## What works today (verified)
Run `pnpm install && pnpm dev` and open http://localhost:3000 — no keys needed (demo adapters).

| Area | State | How it is verified |
|---|---|---|
| Prompt → app | Text prompt or example chip → validated AppSpec in seconds; anonymous "try first" | API + 9 browser (Playwright) tests |
| Chat iteration | "add a loyalty tab" → JSON Patch → new revision | API + e2e |
| Revisions | Undo / redo / jump back, AI and manual edits alike, persisted | API + e2e (incl. reload) |
| Visual editor | Name, tagline, colour, radius, font, drag-and-drop tabs, screens, add/remove/reorder modules, edit content rows, per-language copy | unit tests for every patch + e2e |
| Preview | Phone frame, iOS/Android, dark, RTL, English or Hebrew; share link + QR; public read-only preview page | e2e |
| Auth | Email+password (scrypt), magic link, sessions; signup claims the anonymous draft; login adopts it | API tests |
| Multi-tenancy | Postgres RLS on every tenant table; tenant A gets 404 on every endpoint for tenant B's app | API tests on **embedded and real Postgres 16**, also with a non-superuser owner |
| Publishing | Snapshot publish (edits stay private until republished), unpublish, hosted privacy-policy page | API + e2e |
| End-user data | Bookings submitted by an app → owner inbox, CSV export (formula-injection safe), validated, rate-limited | API + e2e |
| Analytics | DAU/MAU, returning users, top screens, revenue | API tests |
| Push | Device registration, scheduled campaigns, exactly-once sending, failure handling | API tests with a stub provider |
| Payments | Server-side pricing from the spec, Stripe Connect checkout on the owner's account, signed-webhook verification with replay window, PayPal adapter | API tests with stubbed providers |
| Platform billing | Free/Starter/Pro/Business, 7-day trial, limits enforced (apps, store builds), Stripe subscription webhooks, downgrade keeps data | API tests with stubbed provider |
| Store prep | Branding kit (icons/splash PNG at exact store sizes, adaptive icon, palette, fonts, names), store listing within store limits, privacy policy + data-safety answers derived from the app's real features, screenshot mock-ups | API tests incl. pixel-size/alpha checks, visual check |
| Builds | White-label build via EAS CLI (name, bundle id, app id from env) | adapter unit-tested with a fake exec; **never run against EAS** |
| Runtime | Expo app renders any AppSpec natively; loads by share token or published id; submits bookings, sends analytics, registers push, checks out, persists loyalty | logic unit-tested; **bundles for Android and iOS** |
| i18n | 265 UI strings in English (default) and Hebrew, type-checked complete and placeholder-consistent; full RTL for Hebrew; the generator writes complete English and Hebrew apps | unit + e2e |
| Site | Landing (hero, how it works, demo gallery, modules, pricing, FAQ), sitemap, robots, hreflang, OG image | e2e |

| Accounts (hosted mode, dormant) | Signup/login, email verification, password reset (single-use, revokes sessions), change password, data export, account deletion, operator console with block | API tests (incl. squatted operator address) + e2e |
| Own AI key per workspace | OpenRouter / Anthropic / OpenAI key in Settings; AES-256-GCM at rest, never returned, last 4 shown; test button; usage metering; fixed provider URLs; provider failures shown as 502 with the provider's message | API tests with a fake provider (request URL/auth/model asserted) + e2e |

Test totals: 9 packages, ~210 unit/integration tests + 13 browser tests, typecheck strict everywhere.

## Demo mode vs real (honest)
Each integration needs its flag **and** its credentials; otherwise the mock runs, and the UI says so (`/v1/me` reports the active adapters).

| Capability | Default | Real adapter | Verified against the real service? |
|---|---|---|---|
| AI generation | keyword-based generator (en + he copy only) | Claude API (platform key) or the user's own OpenRouter / Anthropic / OpenAI key (forced tool call, JSON Schema from Zod) | **No** (request shapes tested against a fake provider) |
| Voice input | refuses with a clear error | Whisper-compatible endpoint | **No** |
| Email | logged to server console | Resend | **No** |
| Payments | demo checkout page | Stripe Connect; PayPal | **No** (signature logic and request shapes are tested) |
| Platform billing | instant upgrade with trial | Stripe Billing | **No** |
| Push | recorded, not delivered | Expo Push Service | **No** |
| Store builds | simulated; log says SIMULATED | EAS CLI | **No** |
| Database | embedded Postgres (PGlite) | any Postgres via `DATABASE_URL` (Supabase: see docs/deploy.md) | **Yes** (Postgres 16); **Supabase itself not tried** |

## Honest limitations
- **Installers: only Linux was exercised.** The bundled agent and the *unpacked* Linux Electron app were started here (under a virtual display), served the UI, built an app and kept data across restarts. The macOS/Windows installers and the Linux AppImage are produced by `release.yml`, which has never run; expect first-run fixes. Installers are **unsigned**, so Windows SmartScreen / macOS Gatekeeper will warn (the download page says so). No auto-update yet.
- **Phone preview/QR only works on the same computer** in the agent (servers bind to loopback for safety); sharing a preview to a phone needs a tunnel or a cloud edition.
- Desktop agent has no multi-user: one owner per computer.
- **Nobody has run this against live Claude/Stripe/Expo/EAS/Resend yet.** Expect first-contact fixes when real keys are added. The "about a minute" generation target is unmeasured for the real LLM.
- **Store publishing needs the owner's own Apple Developer ($99/yr) and Google Play Console accounts.** Apple and Google review every app; approval and timing cannot be guaranteed. The checklist says which steps are the user's.
- The native runtime has not been run on a device or simulator (no device here). Maestro flows are not written.
- The Dockerfile/compose are **not built in our sandbox** (no Docker daemon); CI now builds the image and smoke-tests it, so the first CI run is the real check. The exact command they run (`node scripts/run.mjs start`) was run and restart-tested.
- Generated screenshots are simplified mock-ups of each tab, not captures of a running app.
- Legal text (privacy policy) is a template derived from the app's features; it is not legal advice.
- Apple Pay / Google Pay work through Stripe Checkout when enabled in the Stripe dashboard; there is no separate code for them.
- Google / Apple sign-in are not implemented (email + magic link only).
- Image/logo upload is not built (apps use generated icons and text); there is no object storage yet.
- Users' own AI keys: with a real database, `APPFORGE_SECRET` is required or the feature turns itself off; changing the secret makes saved keys unreadable (users re-enter them). Cost figures are estimates at fixed per-token prices, not the provider's invoice.
- Not yet gated: unverified emails can still use the product (a banner asks them to confirm).
- Rate limiting is in-process; running several API instances needs a shared store. `X-Forwarded-For` must come from a trusted reverse proxy.
- Plan prices are placeholders ($0/19/49/149); create real prices in Stripe.
- Custom admin domains are an entitlement flag only; there is no domain-mapping feature yet.
- **The Hebrew UI text was written by an AI, not reviewed by a native speaker**; have it reviewed before a public launch. Only English and Hebrew are supported by design (more languages are a small addition to `packages/i18n`).
- Server-rendered images (icons, store screenshots) need a font with Hebrew glyphs installed (the Dockerfile installs Noto); a bare server without one shows empty boxes for Hebrew text.

## Next
1. Deploy per `docs/deploy.md` (Supabase Postgres needs a direct/session connection and a user with CREATEROLE).
2. Put real keys in `.env` and walk the checklist in `docs/go-live.md` (Claude, Stripe, Resend, Expo).
3. Run the Previewer/runtime on a device; write Maestro flows.
4. Image upload + storage, Google/Apple sign-in, custom domains, shared rate-limit store.
