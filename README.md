# AppForge

Describe an app in plain language (text or voice, English and Hebrew with full RTL; English by default) and get a working native-app preview in seconds. Keep improving it by chatting or with a visual editor, share a QR preview, collect bookings/orders/analytics, send push notifications, and prepare the store listing and build.

The AI never writes app code: it composes vetted modules into a validated **AppSpec** JSON document that one universal Expo runtime renders. See [ARCHITECTURE.md](ARCHITECTURE.md).

## How it ships

AppForge is a **desktop app**. Users download the installer from the public site, open it, and start: no account, no sign-in, no server to run. Their apps and data stay on their computer, and they add their own AI key (OpenRouter, Anthropic or OpenAI) in Settings; without one a built-in demo generator runs. The public website is a download page.

```bash
pnpm install
pnpm start:local            # the desktop agent from source: http://localhost:3000, no sign-in (after `pnpm --filter @appforge/web build`)
node scripts/build-agent.mjs && node desktop/cli.mjs   # the bundled agent exactly as the installer runs it
cd desktop && npm ci && npm start                       # inside Electron
pnpm dev                    # the public download site + (dormant) hosted mode, http://localhost:3000
```

Installers are built by `.github/workflows/release.yml` when a `v*` tag is pushed (macOS arm64/Intel, Windows, Linux AppImage).

- What's verified, what's mocked, and the honest limitations: [PROGRESS.md](PROGRESS.md)
- Walkthrough: [docs/demo-phase2.md](docs/demo-phase2.md)
- Adding real keys (Claude, Stripe, Resend, Expo): [docs/go-live.md](docs/go-live.md)
- Deploying on Supabase + a container host: [docs/deploy.md](docs/deploy.md)
- Container: `docker compose up --build`
