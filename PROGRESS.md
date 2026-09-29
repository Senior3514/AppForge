# PROGRESS

Living status of the AppForge build. Update on every milestone.

## Scope note
Only sections 0, 1, 3.1–3.3 and 11 of the master prompt were supplied. Sections 2 and 4–10 (including the module list in §4, plans/entitlements detail, analytics, publishing specifics) were not available, so the module set is my own choice and later phases follow §1/§3 only.

## Phases
| # | Phase | State |
|---|---|---|
| 1 | Foundation: docs, monorepo, spec engine, i18n, tokens, module contract, generator, tenant schema, API, web studio, runtime renderer | **done** (see below) |
| 2 | Studio depth: inspector (visual edit), drag-and-drop tabs, revision-history UI, QR / share link, branding kit | next |
| 3 | Backend: Postgres persistence behind the API, real auth (email, magic link, Google/Apple), anonymous draft → signup, storage | planned |
| 4 | Payments (Stripe Connect), SaaS billing + entitlements, push, analytics | planned |
| 5 | Publishing wizard (EAS), store-listing generator, checklist | planned |

## Phase 1 status
| Area | State | Notes |
|---|---|---|
| ARCHITECTURE.md, THIRD_PARTY.md, .env.example, docker-compose, CI | done | |
| `packages/i18n` | done | 8 locales, RTL for he/ar, platform UI strings + example chips, all keys tested for every locale |
| `packages/ui-tokens` | done | tokens, per-script fonts, palette generator with WCAG AA guarantee (tested) |
| `packages/spec` | done | Zod envelope, JSON Schema export, migration chain, RFC 6902 patch, revision log with undo/redo |
| `packages/modules` | done (data contract) | 9 modules (schema + defaults + references + feature requirements), semantic validation, contract tests that cover every module automatically |
| `services/generator` | done | prompt → AppSpec, repair loop (max 3), patch iteration, prompt sanitising + untrusted-input wrapping, cache, token/cost tracking |
| `services/api` | done (in-memory) | tenant-scoped REST: create/get/chat/undo/redo; mock auth |
| Tenant isolation SQL | done | `migrations/001_init.sql` with forced RLS; proven with 6 tests on real Postgres semantics (PGlite) |
| `apps/web` | partial | localized landing (hero, mic, chips, modules grid), studio (chat, undo/redo, phone preview with language/RTL/dark/platform switches), 4 Playwright e2e tests pass |
| `apps/runtime` | partial | Expo Router app rendering any AppSpec natively; Metro bundles for Android (Hermes) successfully |

## Mocked vs real
| Capability | Default | Real adapter | Verified real? |
|---|---|---|---|
| LLM | `MockLlm` (keyword archetypes, en + he copy only) | `AnthropicLlm` (forced tool call, JSON Schema from Zod) — flags `APPFORGE_FLAG_REAL_LLM` + `ANTHROPIC_API_KEY` | **No** — unit-tested against a stubbed `fetch`; never called against the live API |
| Transcription | refuses with an explicit error | Whisper-compatible multipart adapter | **No** — stubbed `fetch` only; Hebrew (`language=he`) is passed but unverified end to end |
| Auth | `Bearer mock:<tenant>` | — | not built |
| Persistence | in-memory | Postgres schema exists, API not wired to it | RLS verified; wiring not built |
| Stripe / PayPal / push / EAS | not built | — | — |

## Not yet done (Phase 1 gaps, honestly)
- Web landing lacks how-it-works, demo gallery, pricing, FAQ, footer, sitemap/OpenGraph images; Lighthouse not measured.
- Module renderers exist twice (web preview in `apps/web`, RN in `apps/runtime`) instead of inside `packages/modules`; admin editors and backend handlers per module are not built. Consolidating is Phase 2.
- Preview loading from the Previewer needs an unauthenticated (or signed) preview endpoint; today the runtime uses a bearer token env var.
- Mock generator writes only English/Hebrew copy; other languages need the real LLM. `translations` is in the schema but nothing fills it yet.
- Studio progress steps are timed labels over one request, not real streaming.
- Runtime UI has no automated render test; Maestro flows are not written and cannot run in this sandbox (no device/emulator).
- iOS bundle not attempted; Android bundle only.
- The web preview uses the pnpm `node-linker=hoisted` layout required by Metro; verify it stays compatible with Vercel-style installs.

## Honest limitations
- Store publishing requires the user's own Apple Developer ($99/yr) and Google Play Console accounts; Apple review and store policies cannot be automated or guaranteed.
- "Native preview in ~60s" is unproven for the real LLM path: the mock is instant, and no live latency has been measured.
- Real-device preview (Expo Go / Previewer) is untested here.
- Cost defaults ($3 / $15 per M tokens) are placeholders, not a price list.
