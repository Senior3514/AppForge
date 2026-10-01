# AppForge

Describe an app in plain language (text or voice, English and Hebrew with full RTL; English by default) and get a working native-app preview in seconds. Keep improving it by chatting or with a visual editor, share a QR preview, collect bookings/orders/analytics, send push notifications, and prepare the store listing and build.

The AI never writes app code: it composes vetted modules into a validated **AppSpec** JSON document that one universal Expo runtime renders. See [ARCHITECTURE.md](ARCHITECTURE.md).

```bash
pnpm install
pnpm dev        # http://localhost:3000 — works with no API keys (demo adapters)
```

- What's verified, what's mocked, and the honest limitations: [PROGRESS.md](PROGRESS.md)
- Walkthrough: [docs/demo-phase2.md](docs/demo-phase2.md)
- Adding real keys (Claude, Stripe, Resend, Expo): [docs/go-live.md](docs/go-live.md)
- Container: `docker compose up --build`
