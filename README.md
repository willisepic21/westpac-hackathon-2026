# westpac-hackathon-2026

Westpac Hackathon 2026: a proof of concept of an **AI-driven, personalised banking home page**.

The user answers 7 quick questions and the app builds a Home screen of widgets to match. A voice / chat
assistant (on [Groq](https://console.groq.com)) answers banking questions and can rearrange the Home widgets or
change the colour theme on request. Everything the AI may do is defined in [`ai_perms.md`](ai_perms.md).

## Status

| Area | Status |
| --- | --- |
| App shell + floating glass tab bar | Done |
| Standard Westpac home (header gradient, logo, search box) | Done |
| Personalised widget home (7 questions → 10 templates) | Done, tested |
| Voice / chat AI assistant (Groq) | Done, tested |
| AI rules (`ai_perms.md`) wired into the assistant prompt | Done |
| AI adds / removes / moves Home widgets on request | Done, tested |
| AI changes the colour theme on request | Done, tested |
| SQLite database + API (`database/`) | Theme + Home widgets saved and restored; widgets show DB accounts + transactions |
| Accounts, Payments, Search, More screens | Placeholders, waiting on mockups |
| Persisting personalisation across reloads | Theme + widgets persist (via `npm run db`); question answers don't |

## Getting started

Expo (SDK 58) / React Native 0.88 / React 19. Runs on iOS, Android (incl. Expo Go) and web.

```bash
npm install
cp .env.example .env   # then put your key in EXPO_PUBLIC_GROQ_API_KEY
npm start              # or npm run web / npm run android / npm run ios
npm run db             # in a second terminal: the database API on port 3001
```

The app still runs without `npm run db`, but nothing is saved and the widgets show mock data.
If a phone can't reach the API, set `EXPO_PUBLIC_DB_URL` in `.env` (see `.env.example`).
On web the mic needs https or localhost.

> **Hackathon only:** `EXPO_PUBLIC_` variables are bundled into the app, so the Groq key can be
> extracted by anyone who has the app. For anything beyond a demo, call Groq from a backend instead.

### Tests

```bash
npm test
```

Runs with `node:test`, no device needed:
- `tests/voice.test.mjs`: Groq client, tool loop, rate-limit retry, `ai_perms.md` in the prompt
- `tests/personalise.test.mjs`: templates, `buildHome`, AI widget + theme edits
- `tests/database.test.mjs`: the API against an in-memory copy of `schema.sql`

## Project structure

```
App.js                  active tab (useState, no Expo Router) + floating tab bar overlay
components/
  GlassTabBar.js        translucent tab bar: Home, Accounts, Payments (raised), Search, More
  WestpacLogo.js        SVG Westpac "W" logo
screens/                one file per tab (HomeScreen built, the rest are placeholders)
src/personalise/        questions, templates, buildHome, widgets, themes, store
src/voice/              Groq speech-to-text + chat, assistant sheet, tool calling
src/db/client.js        calls the database API
database/               schema.sql, app.db, server.mjs (the API)
ai_perms.md             the AI's rules (imported straight into its system prompt)
tests/                  node:test suites
```

Every screen must pad its bottom with `useTabBarSpace()` (from `GlassTabBar.js`) so content scrolls clear of
the floating tab bar.

## Personalised home (`src/personalise/`)

Until the user personalises it, Home shows the standard Westpac home with a "Make this home yours" banner.
Tapping it opens `QuestionSheet.js`, which asks one question at a time:

| # | Question | Effect on Home |
| --- | --- | --- |
| 1 | What is your current money goal? | House → save tracker; debt → debt paid-off bar; daily spending → daily spend gauge |
| 2 | How often do you check your bank app? | Daily → recent transactions first; weekly / monthly → net worth and bills first |
| 3 | Which accounts do you use most? | Pins those accounts (incl. joint) to the top |
| 4 | Do you want a weekly spending tracker? | Adds the weekly spend gauge |
| 5 | Do you send money to yourself or others? | Others → quick PayID contacts; myself → 1-tap transfer slider |
| 6 | Condensed or spaced-out layout? | Widget density (padding, card size) |
| 7 | Main and secondary theme colours? | Background and accent colours |

- `templates.js` has 10 templates (1-4 follow the Figma mockups: Daily check-in, House saver, Debt freedom,
  Shared money; 5-10 cover the other goal × frequency combos), mixing horizontal carousel rows with stacked widgets.
- `buildHome.js` scores the templates against the answers, picks the best, then applies the user's tweaks.
- `PersonalisedHome.js` renders the sections using the widgets in `widgets/` and the shared pieces in `ui.js`.
- `themes.js` has the colour palettes (`PALETTES`) and compact / spacious spacing.
- `bankData.js` turns the database's accounts and transactions into widget data (balances, net worth, recent
  transactions, spent today / week / month, top places). Bills, goal targets, budgets, joint accounts, PayID
  contacts and transfers are still mock data (`mockData.js`).
- `store.js` keeps the answers and AI edits in memory and saves the theme and Home widgets to the database.

"Edit home" reopens the questions and "Use standard home" resets.

**Adding a widget:** build it in `widgets/`, register its `type` in `SECTIONS` in `PersonalisedHome.js`, add it to
`WIDGETS` in `widgetCatalog.js` (so the AI knows about it), add it to the `widgets` seed in `database/schema.sql`,
then use it in templates. **Adding a template:** add an entry to `TEMPLATES` in `templates.js`.

## AI assistant (`src/voice/`)

Type a question in the "How can we help you today?" box on Home, or tap its mic and speak. The assistant sheet
(`AssistantSheet.js`) shows your words and the AI's reply.

- Speech-to-text: Groq Whisper (`whisper-large-v3-turbo`).
- Chat: `qwen/qwen3.8-27b`, or `openai/gpt-oss-120b` when the AI has tools (qwen was unreliable at calling tools).
- Replies are plain text, capped at 600 tokens (Groq free tier: 1000 output tokens / min). 429 rate-limit errors
  are retried automatically if Groq asks for a wait of 20s or less.
- Closing the sheet clears the chat, so each time it opens is a fresh conversation.
- The rules in `ai_perms.md` are imported directly into the system prompt (`metro.config.js` + `md-transformer.js`
  let Metro import `.md` files), so change the AI's rules there, not in code. In short: banking questions only,
  never asks for credentials, can't approve loans or touch security settings, no direct SQL or write access, and
  it never sees balances or transactions.

### Editing Home with the AI

Ask things like "put my bills at the top", "get rid of move money" or "make it green". The AI gets the
`add_widget`, `remove_widget`, `move_widget` and `set_theme` tools (`src/personalise/homeTools.js`) plus a live
description of which widgets are on Home and which themes exist. The available widgets and themes are read from
the database API on every question (falling back to `WIDGETS` / `PALETTES` if it's down), and the AI only sees
widget names, order and theme names.

### In code

```js
import { VoiceAssistant, useVoiceRecorder } from './src/voice';

const assistant = new VoiceAssistant({
  language: 'en',  // optional
  tools,           // optional: [{ name, description, parameters, run(args) }]
  getContext,      // optional: () => string, added to the system prompt fresh on every question
});
const recorder = useVoiceRecorder();                       // inside a component

await recorder.start();                 // asks for mic permission the first time
const uri = await recorder.stop();
const { transcript, reply } = await assistant.respondToRecording(uri);

const text = await assistant.transcribe(uri);     // just speech-to-text
const answer = await assistant.ask('Follow-up?'); // just the LLM (keeps conversation history, runs tools)
assistant.reset();                                // clear history
```

## Database (`database/`)

SQLite (`app.db`, built from `schema.sql`), served by `server.mjs` using Node's built-in `node:sqlite`.

- Tables: `users`, `accounts`, `transactions`, `themes`, `customisation` (each user's theme), `widgets`
  (the 9 widgets, in `WIDGETS` order), `homepage_widgets` (which widgets each user has on Home, priority 1 = top)
  and `session` (who is signed in, user 1 by default; switch with `UPDATE session SET user_ID = 2;`).
- API (port 3001, rate-limited, always for the session user):
  - `GET /api/home`: theme, Home widgets, and the widget / theme catalog
  - `GET /api/banking`: accounts and transactions, for the widgets only (never the AI)
  - `PUT /api/theme`, `PUT /api/homepage`: save the theme and Home widgets
- The API is the only way in: the AI never gets SQL or direct write access.
- Transaction dates in `app.db` are `dd/mm/yyyy`; `parseDate()` in `bankData.js` reads them.
