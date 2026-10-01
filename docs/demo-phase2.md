# Demo — the whole product, locally

```bash
pnpm install
pnpm dev            # API on :8787 (embedded Postgres in .data/pg) + web on :3000
```
Open http://localhost:3000 — everything below works with **no keys** on demo adapters.

1. **Generate:** click *Salon booking* (or type; Hebrew works: `אפליקציה למספרה`). You land in the studio with a live phone preview. No signup needed yet.
2. **Chat:** type `add a loyalty tab` → a *Rewards* tab appears and the chat lists what changed. *Undo / Redo* work; the **History** tab lets you go back to any point.
3. **Edit visually** (right panel): rename the app, change colour/corners/font, drag tabs to reorder, add a module to a screen, edit menu/price rows, type a translation and switch the preview language. Try **RTL** and **Dark**.
4. **Preview on your phone:** *Preview on your phone* → QR + link (set `APPFORGE_PUBLIC_URL` to an address your phone can reach). Anyone with the link sees the live draft; *Stop sharing* closes it.
5. **Create an account** (banner): your draft is kept. Dashboard lists your apps.
6. **Publish and manage:** *Publish now*, then the checklist (what we do vs what you must own), *Generate listing* (store text, privacy policy, data-safety answers, screenshots), *Brand kit* (icons/splash PNGs), *Start build* (needs a paid plan: go to **Pricing** → *Start free trial*; builds are **simulated** in demo mode).
7. **Run it like a customer:** submit a booking to the published app
   `curl -XPOST localhost:3000/api/v1/public/apps/<APP_ID>/data/bookings -H 'content-type: application/json' -d '{"data":{"name":"Dana","phone":"+972501234567"}}'`
   → it appears under **Submissions** (CSV export). **Notifications** schedules a push (recorded in demo mode). **Orders** shows shop orders paid through the demo checkout.
8. **Native app:** `cd apps/runtime && npx expo start` and open with Expo Go; link it to an app with `appforge://?token=<share token>` (preview) or `?app=<id>` (published). Needs `EXPO_PUBLIC_API_URL=http://<your-ip>:8787`.

## Tests
```bash
pnpm typecheck && pnpm test                       # all packages
TEST_DATABASE_URL=postgres://… pnpm --filter @appforge/api test   # same API suite on a real Postgres
pnpm --filter @appforge/web build && pnpm e2e     # browser tests against the real stack (set CHROMIUM_PATH if needed)
```
