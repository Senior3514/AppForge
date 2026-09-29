# PROGRESS

## Phase plan
1. **Phase 1 — Foundation**: docs, monorepo, spec engine, i18n, tokens, module contract, generator with mock adapter. *(in progress)*
2. Studio + preview (web), runtime renderer.
3. Backend (RLS), auth, persistence, revisions API.
4. Payments, billing, push, analytics.
5. Publishing wizard, branding kit, store listing generator.

Only sections 0, 1, 3.x and 11 of the master prompt were supplied; sections 2, 4–10 (incl. the module list in §4) are not available, so the module set below is my own choice.

## Status
| Area | State |
|---|---|
| ARCHITECTURE.md / PROGRESS.md / THIRD_PARTY.md | done |
| Monorepo config (pnpm, Turbo, TS strict) | in progress |

## Mocked vs real
Everything external is mocked by default (see ARCHITECTURE.md adapters).

## Honest limitations
- Store publishing requires the user's own Apple Developer ($99/yr) and Google Play accounts; Apple review and store policies cannot be automated or guaranteed.
- "Native preview in ~60s" depends on LLM latency; the mock generator is instant, the real one is not measured yet.
- Sandbox here has no iOS/Android device, so runtime e2e (Maestro) can't be run in this environment.
