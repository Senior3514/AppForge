# Going live — what you must provide

The product runs without any of this (demo mode). To make each part real, set its flag **and** credentials in `.env` (see `.env.example`). Nothing half-configured activates.

| To get… | You need | Notes |
|---|---|---|
| Real AI generation | `APPFORGE_FLAG_REAL_LLM=true`, `ANTHROPIC_API_KEY` | Not yet exercised against the live API: try one prompt first and check cost (`costUsd` in the create response). |
| Voice input | `APPFORGE_FLAG_REAL_TRANSCRIBE=true`, `TRANSCRIBE_API_URL`, `TRANSCRIBE_API_KEY` | Any Whisper-compatible `/audio/transcriptions`. The browser sends the UI language (`he` for Hebrew). |
| Sign-in emails | `RESEND_API_KEY`, `MAIL_FROM` | Without it, magic links print in the server log. |
| Customer payments | `APPFORGE_FLAG_STRIPE=true`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`; enable Connect in Stripe; webhook → `POST {PUBLIC_URL}/api/v1/webhooks/payments` | Money goes to each owner's own connected account. Enable Apple Pay / Google Pay in the Stripe dashboard. |
| Your subscriptions | same Stripe keys + `STRIPE_PRICE_STARTER/PRO/BUSINESS`; webhook → `/api/v1/webhooks/billing` (events `customer.subscription.*`) | Create the prices in Stripe (the $ amounts in the UI are placeholders). |
| Push | `APPFORGE_FLAG_PUSH=true`; users' builds need APNs/FCM credentials in EAS | Uses Expo Push Service. |
| Store builds | `APPFORGE_FLAG_EAS=true`, `EXPO_TOKEN` | Each app owner needs their own Apple Developer and Google Play accounts set up in EAS. Apple/Google review is out of our hands. |
| Production database | `DATABASE_URL` (Postgres 14+; user needs CREATEROLE on first run) | Migrations run at boot under an advisory lock. |
| Public address | `APPFORGE_PUBLIC_URL` (https) | Used in share links/QR, emails, checkout returns. Put a TLS reverse proxy in front of port 3000 that sets `X-Forwarded-For`. |

Container: `docker compose up --build` (not built in our sandbox — check the first build).
