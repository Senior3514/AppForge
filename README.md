# AppForge

AI-native app builder (working name): describe an app in plain language, get a native preview, keep iterating in chat, publish later.

The LLM never writes app code. It composes vetted modules into a validated **AppSpec** JSON document that a universal Expo runtime renders. See [ARCHITECTURE.md](ARCHITECTURE.md), [PROGRESS.md](PROGRESS.md) and [docs/demo-phase1.md](docs/demo-phase1.md).

```bash
pnpm install
pnpm typecheck && pnpm test
```
