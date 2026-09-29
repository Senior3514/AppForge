# AppForge — Architecture

AppForge turns a plain-language description (text or voice, 8 languages) into a working native app preview, then lets the user keep iterating in chat and finally publish to the stores. "AppForge" is a placeholder name.

## Core decision: server-driven UI, not per-app code generation

| Concept | Meaning |
|---|---|
| **AppSpec** | One JSON document = the single source of truth for a generated app (theme, navigation, screens, module instances, data models, copy, monetization). Defined in `packages/spec` with Zod. |
| **Universal runtime** | `apps/runtime` (Expo / React Native) renders any AppSpec from a vetted module library. Every tenant app = runtime + AppSpec + branding. Real native UI. |
| **Generator** | `services/generator`: prompt → Claude (structured output from the Zod-derived JSON Schema) → validate → repair loop (max 3) → persist. The LLM only composes known modules and never emits code. |
| **Iteration** | Current AppSpec + instruction → RFC 6902 JSON Patch → apply → validate → new revision (undo/redo). |

## Monorepo (pnpm + Turborepo, TypeScript strict)

```
apps/web            Next.js App Router + Tailwind: marketing, auth, dashboard, studio, admin, billing
apps/runtime        Expo + Expo Router: universal AppSpec renderer
packages/spec       Zod schemas, JSON Schema export, version migrations, patch + revision engine
packages/modules    Module library: schema + RN renderer + web preview + admin editor + handlers + tests
packages/ui-tokens  Shared design tokens (brand) for web + runtime
packages/i18n       en, he (RTL), ar (RTL), es, fr, de, pt, ru
services/generator  prompt → AppSpec pipeline (Claude, repair loop, safety, cost tracking, cache)
services/api        Postgres + RLS tenant isolation, auth, storage, realtime, edge handlers
```

## Boundaries and adapters

Every third-party integration sits behind an interface with a **mock adapter (default)** and a **real adapter behind a feature flag**, so the system boots with zero external keys.

| Capability | Interface | Mock | Real (flagged) |
|---|---|---|---|
| LLM | `LlmClient` | deterministic template generator | Anthropic Claude API |
| Transcription | `Transcriber` | echo stub | Whisper-compatible provider |
| End-user payments | `PaymentProvider` | in-memory | Stripe Connect (full); PayPal (flag) |
| SaaS billing | `BillingProvider` | in-memory plans | Stripe Billing |
| Push | `PushProvider` | log | Expo Push / FCM / APNs |
| Builds | `BuildProvider` | simulated | EAS Build + Submit |

## Multi-tenancy
Postgres row-level security on every tenant table; `tenant_id` derived from the JWT, never from request bodies. Storage buckets are namespaced per tenant.

## Preview
1. In-browser phone frame: react-native-web running the same runtime + module renderers.
2. Device: Expo Go / branded Previewer loads an AppSpec by app id.

## Publishing
White-label builds per tenant via EAS (unique bundle id, icon, splash, name). The user must own an Apple Developer and Google Play Console account; the wizard shows the checklist and generates store listing assets. See "Honest limitations" in PROGRESS.md.

## Testing and CI
Vitest (unit, module contract tests), Playwright (web e2e), Maestro (runtime flows). GitHub Actions: lint, typecheck, test, build.
