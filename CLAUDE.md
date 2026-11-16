This is a project for the westpac hackathon 2026.

The aim of the project is a proof of concept of a ai driven personalising home page.

for the ai implementation in the app all the rules for the ai are written in ai_perms.md

## Progress at a glance

| Area | Status |
| --- | --- |
| App shell + floating glass tab bar | Done |
| Standard Westpac home (header gradient, logo, search box) | Done |
| Personalised widget home (7 questions → 10 templates) | Done, tested |
| Voice / chat AI assistant (Groq) | Done, tested |
| AI rules (`ai_perms.md`) wired into the assistant prompt | Done |
| AI adds / removes / moves Home widgets on request | Done, tested |
| SQLite database schema (`database/`) | Schema + `app.db` created, **not yet used by the app** |
| Accounts, Payments, Search, More screens | Placeholders, waiting on teammate mockups |
| Persisting personalisation across reloads | Not started (in memory only) |

## App structure

- Expo (SDK 58) / React Native 0.88 / React 19 app, runs on iOS, Android and web.
  - `npm start` (or `npm run web` / `npm run android` / `npm run ios`)
  - `npm test` runs `tests/voice.test.mjs` and `tests/personalise.test.mjs` (node:test, no device needed).
- See `AGENTS.md` for general Expo guidance. Note: the app does NOT use Expo Router — navigation is manual.
- `index.js` registers `App.js` as the root component.
- `App.js` keeps the active tab in `useState`, renders the matching screen, and overlays
  `components/GlassTabBar.js`: a floating, translucent (expo-blur) tab bar absolutely positioned over the screens,
  coloured from the personalised home palette (Westpac palette by default).
  Tabs: Home, Accounts, Payments (raised centre button), Search, More.
  **Every screen must pad its bottom with `useTabBarSpace()`** (exported from `GlassTabBar.js`) so content scrolls
  clear of the bar.
- `components/WestpacLogo.js` SVG Westpac "W" logo (`react-native-svg`), props `width` / `color`.
- `screens/` has one file per tab, each owned by a teammate to build their mockup:
  `HomeScreen.js` (built), `AccountsScreen.js`, `SearchScreen.js`, `PaymentsScreen.js`, `MoreScreen.js` (placeholders).

## AI assistant (built)

- `src/voice/`: Groq speech-to-text (`whisper-large-v3-turbo`) + Groq chat (`qwen/qwen3.8-27b`, or
  `openai/gpt-oss-120b` when the AI has tools — qwen was unreliable at calling tools).
- The Home search box sends typed questions, and its mic button records voice; both open
  `src/voice/AssistantSheet.js`.
- The system prompt in `src/voice/groq.js` imports `ai_perms.md` directly (`metro.config.js` + `md-transformer.js`
  let Metro import `.md` as a string; `tests/register-md.mjs` does the same for Node), so edit the rules in
  `ai_perms.md`, not in code.
- Needs `EXPO_PUBLIC_GROQ_API_KEY` in `.env` (see `.env.example`). The key is bundled into the app — demo only.
- Replies are capped at 600 tokens (Groq free tier: 1000 output tokens/min), plain text only (no markdown).
  429 rate-limit errors are retried automatically if Groq asks for a wait of 20s or less.
- Tool calling: `chatWithTools()` in `groq.js` runs any tools the AI asks for (`{ name, description, parameters,
  run }`) and loops until it replies with text. `VoiceAssistant` takes `tools` plus `getContext()`, which is added
  to the system prompt fresh on every question.

### AI widget editing

The assistant can see which widgets are on Home and add, remove or move them when the user asks
("put my bills at the top", "get rid of move money").
- `src/personalise/widgetCatalog.js` lists every widget (`WIDGETS`: name, description, variants) and has pure
  `editLayout()` / `describeLayout()` helpers. **Add new widgets here too**, or the AI won't know about them.
- `src/personalise/homeTools.js` builds the `add_widget` / `remove_widget` / `move_widget` tools and the live
  layout context. The AI only sees widget names and order, never balances (rule added to `ai_perms.md`).
- Edits are saved with `setHomeSections()` in `store.js` as `{ answers, sections }`; `buildHome(answers, { sections })`
  then uses that list instead of the template's. Editing from the standard home switches to a personalised home
  built from `DEFAULT_ANSWERS`. Finalising the questions again drops the AI edits.
- `HomeScreen.js` passes the tools to `AssistantSheet`, and renders the sheets outside the home branches so the
  assistant isn't remounted when the home switches.

## Personalised widget home page (built)

Onboarding asks the user 7 questions; the answers pick which widget templates appear on Home and how they are laid out.

Code lives in `src/personalise/`:
- `questions.js` the 7 questions and answer options (bubbles). `QuestionSheet.js` is the pop-up: one question at a
  time, "Next" once answered, and after the last question "Back to start" or "Finalise".
- `templates.js` 10 templates: 1-4 follow the Figma mockups (Daily check-in, House saver, Debt freedom, Shared money),
  5-10 cover the other goal x frequency combos. Each is a list of `sections` (`type` + `variant`).
- `buildHome.js` scores templates against the answers, picks the best, then applies the user's tweaks (palette,
  density, pinned accounts, weekly tracker on/off, contacts vs transfer) and the frequency priority rule. Pure JS, tested.
- `themes.js` palettes (`PALETTES`, e.g. `westpac`, `forest`, ...) + compact/spacious spacing.
  `mockData.js` fake balances, bills, contacts, etc.
- `PersonalisedHome.js` renders the sections; widgets are in `widgets/` (`GoalWidgets.js`, `MoneyWidgets.js`,
  `MoveMoney.js`) and share `ui.js` (Card, Carousel, Bar, Gauge...).
- `store.js` keeps the finalised answers (and any AI widget edits) in memory (lost on reload) so the home survives tab switches. The tab bar
  also reads it to pick its colours.
- `screens/HomeScreen.js` shows the standard home with a "Make this home yours" banner until answers are finalised,
  then the personalised home ("Edit home" reopens the questions; "Use standard home" resets).

To add a template: add an entry to `TEMPLATES`. To add a widget: build it in `widgets/`, register its `type` in
`SECTIONS` in `PersonalisedHome.js`, add it to `WIDGETS` in `widgetCatalog.js` (so the AI can use it), then use
it in templates.

### Onboarding questions → widget templates

1. **What is your current money goal?**
   - Saving for a house → **Save tracker** (progress toward a deposit target)
   - Paying off debt → **Debt fulfilled bar** (amount paid off vs. total owed)
   - Track daily spending → **Daily spending gauge** (spent today vs. daily budget)
2. **How often do you plan to check your bank app?** Daily / Weekly / Monthly
   - Sets priority order: Daily → recent transactions first; Weekly/Monthly → net worth and upcoming bills first.
3. **Which accounts do you use most (or have joint accounts)?**
   - User can **pin accounts** to the top of Home (including joint accounts).
4. **Do you want a tracker for weekly spending?**
   - Yes → **Weekly spend gauge** widget.
5. **Do you frequently send money to yourself or others?**
   - Others → **Quick contacts PayID list**
   - Myself → **1-tap transfer slider** (e.g. Everyday → Savings)
6. **What layout are you more after?** More condensed / more spaced out
   - Controls widget density (padding, card size, how many widgets fit on screen).
7. **What are your main and secondary theme colours?**
   - Two complementary colours used for the background (main) and accents (secondary).

### Layout styles to template

- **Horizontal / carousel rows** (Netflix-style): sections the user scrolls left to right, e.g. a row of goal widgets, a row of pinned accounts, a row of quick contacts.
- **Vertical / stacked**: widgets in a single up-down list, in priority order.
- Provide several template variants of each, mixing horizontal rows inside a vertical page.

## Database (started, not wired in)

- `database/schema.sql` defines SQLite tables `users`, `accounts`, `transactions` and `customisation`
  (`primary_colour` / `secondary_colour` per user); `database/app.db` is the built database.
- Nothing in the app reads it yet — all data comes from `src/personalise/mockData.js`. Per `ai_perms.md`, the AI must
  never get direct SQL or write access.
