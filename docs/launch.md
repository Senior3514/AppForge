# Launch kit

Drafts to edit, not to paste blindly. Nothing here has been posted anywhere. Every claim below is one the product can back up today; the "Before you launch" list says what must be true first.

## Positioning

**One line:** Describe your business, get a working mobile app you can change by chatting — and update it without going back to the app stores.

**Who it is for:** owners of small businesses (salon, restaurant, studio, clinic, bakery) who want bookings, a menu or catalog, loyalty and announcements in an app, and who will never write code. First market: Hebrew-speaking owners (Hebrew and right-to-left are first-class; English too).

**What is genuinely different (and how to prove each):**

| Claim | Why it is true | How to show it |
|---|---|---|
| The AI never writes app code | It only produces a validated JSON description built from vetted modules; invalid output is rejected and repaired | Show the JSON next to the app; show a bad output being rejected |
| Every change can be undone | Each edit is a small patch with an inverse; history lists them | Screen recording: three edits, undo, redo |
| Updates don't need a new store release | The installed app renders from the published description, so content/design changes ship instantly (new module types would still need a release) | Change the menu, reload the phone, no store involved |
| Hebrew/RTL done properly | Direction, fonts and layout are tested in both languages | Same app, switch language, side by side |
| You pay your AI provider directly | Each user adds their own key; no markup, key stored encrypted | Settings screen; the "Test key" button |

**Do not claim** (not true yet): "publishes to the App Store for you", "works offline", "more reliable than <competitor>" (unmeasured — run `pnpm eval` first), real payments/push/builds (demo mode until credentials are added), any user numbers or testimonials you don't have.

## 60-second demo (the asset everything else reuses)

1. 0–5s: blank prompt. Type (or speak): "A hair salon where customers can book and see prices."
2. 5–20s: the phone preview appears. Tap through Home → Services → Book.
3. 20–35s: chat "add a loyalty card and make it dark green" → the app changes; show History, hit Undo.
4. 35–45s: scan the QR code with a real phone; the same app opens.
5. 45–55s: switch to Hebrew; layout flips to RTL.
6. 55–60s: end card: name, link, "free to try".
Record at 1080×1920 for Reels/TikTok/Shorts and 1920×1080 for the site. Subtitles on (Hebrew and English).

## Where to announce, in order

1. **10 hand-picked businesses** (free, personal help). Goal: 3 real apps in daily use, 3 quotes you are allowed to publish. Do this before anything else.
2. **Hebrew communities** where owners already talk: small-business Facebook groups, WhatsApp groups, local founder communities. Lead with the 60-second video, not a link dump. Read each group's rules first.
3. **Short video** (TikTok/Reels/Shorts) of the demo and one "before → after" per business type.
4. **Show HN** and **Product Hunt** once the live site and a real-AI eval exist. HN angle is technical: "An app builder where the AI can't write code".
5. **Per-business landing pages** ("app for a hair salon") for search.
6. **Open-source the core** (`packages/spec`, `packages/modules`) for credibility with developers — a decision for you, not a default.

## Draft: Hebrew post for a business-owners group

> בניתי כלי קטן לבעלי עסקים: מתארים במילים את העסק ("מספרה עם הזמנת תורים ומחירון") ותוך דקה מקבלים אפליקציה שעובדת בטלפון. אפשר לשנות בצ'אט ("תוסיף כרטיסיית נאמנות"), לבטל כל שינוי, ולעדכן בלי לחכות לאישור של אפל או גוגל. אני מחפש 10 עסקים שינסו בחינם ויגידו לי בכנות מה לא ברור. מי רוצה?

## Draft: Show HN

> **Show HN: An app builder where the AI can't write code**
> You describe an app; the model only emits a JSON document made from a fixed set of vetted modules, which a schema validator checks before anything is saved. One native runtime renders it, edits are RFC 6902 patches with inverses (undo/redo), and content changes don't need a store release. Hebrew/RTL is first-class. Bring your own key (OpenRouter/Anthropic/OpenAI). Honest limits: payments/push/store builds are demo-mode until you add credentials; <what you measured with `pnpm eval`>. Feedback welcome, especially on where the module set is too limiting.

## Draft: message to a business you know (Hebrew)

> היי {שם}, אני בונה כלי שיוצר אפליקציה לעסק מתוך תיאור קצר. אשמח שתנסה אותו בחינם על {סוג העסק} שלך — אני אשב איתך 20 דקות ואבנה את זה יחד. אם זה מועיל, אשמח לציטוט קצר; אם לא, אשמח לדעת למה.

## Before you launch (blocking)

- [ ] **Name:** "AppForge" is a placeholder. Check trademark and domain availability in your markets first; renaming later is expensive.
- [ ] **Real AI numbers:** run `pnpm eval` with a real key (see below) and read the failures. Publish only what it shows.
- [ ] **A real phone:** open one generated app in the native runtime on an iPhone and an Android phone (Expo Go works for a first look).
- [ ] **Hebrew review:** have a native speaker go through `docs/hebrew-review.md`.
- [ ] **Hosting decision** and a live URL; privacy policy and terms reviewed by a person (the generated privacy text is a template, not legal advice).
- [ ] A support email and a place to collect feedback.
- [ ] Measure from day one: time to first preview, share of users who share a preview, return after 7 days.

## Measuring the AI

```bash
EVAL_PROVIDER=openrouter EVAL_MODEL=anthropic/claude-sonnet-4.5 EVAL_API_KEY=… pnpm eval
```

Reports, over 14 varied prompts (English and Hebrew, vague, very long, and a prompt-injection attempt): how many produce a valid app, how many needed repair, whether the expected modules appear, language correctness, time and estimated cost, plus how many of 18 edit instructions apply. Without `EVAL_PROVIDER` it runs the built-in keyword generator — a baseline that proves the harness works, not a measure of AI quality. Cost uses placeholder prices (`EVAL_IN_PER_M`, `EVAL_OUT_PER_M`); take real ones from your provider.
