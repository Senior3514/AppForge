# Demo — Phase 1

Runs entirely offline on mock adapters. No keys needed.

## 1. Tests
```bash
pnpm install
pnpm typecheck && pnpm test      # 8 packages, ~100 tests incl. tenant RLS on real Postgres semantics
```

## 2. Web studio
```bash
pnpm --filter @appforge/web build && pnpm --filter @appforge/web start   # http://localhost:3000
```
1. Open `/en`, click **Salon booking** (or type a prompt, or use the 🎙 button once a transcription provider is configured).
2. The studio opens with a phone-frame preview. Tap the tabs; use the Book form.
3. In the chat type **add a loyalty tab** → a *Rewards* tab appears and the chat lists what changed. Tap **+1** to collect stamps.
4. **Undo** removes the tab, **Redo** brings it back.
5. Switch preview language, tick **RTL** / **Dark**, switch iOS/Android.
6. Open `/he` or `/ar` — page direction flips; try the Hebrew prompt `אפליקציה למסעדה שלי`.

Browser e2e: `cd apps/web && CHROMIUM_PATH=<chromium> pnpm e2e` (after `next build`).

## 3. API
```bash
pnpm --filter @appforge/api dev     # :8787
curl -s -XPOST localhost:8787/v1/apps -H 'authorization: Bearer mock:demo' -d '{"prompt":"fitness coach"}'
```
Then `POST /v1/apps/:id/chat {"message":"add a loyalty tab"}`, `/undo`, `/redo`. Another tenant's token gets 404.

## 4. Native runtime
```bash
cd apps/runtime && npx expo start          # scan the QR with Expo Go: renders the bundled sample app
EXPO_PUBLIC_API_URL=http://<host>:8787 EXPO_PUBLIC_PREVIEW_TOKEN=mock:demo  # then open appforge://?app=<id>
```
Verified here only by bundling (`expo export --platform android`), not on a device.

## 5. Real LLM
Set `APPFORGE_FLAG_REAL_LLM=true` and `ANTHROPIC_API_KEY`. Not exercised against the live API in this phase.

## Summary
**Works:** spec engine, module validation, generator pipeline with repair loop, patch iteration with revisions, tenant isolation SQL, tenant-scoped API, localized web landing and studio, native renderer bundle.
**Mocked:** LLM, transcription, auth, persistence.
**Next:** Phase 2 (inspector, drag-and-drop, history UI, QR/share link, branding kit), then Postgres wiring and real auth.
