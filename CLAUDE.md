This is a project for the westpac hackathon 2026.

The aim of the project is a proof of concept of a ai driven personalising home page.

for the ai implementation in the app all the rules for the ai are written in ai_perms.md
(including what it may do to the home page widgets).

## Progress at a glance

| Area | Status |
| --- | --- |
| App shell + floating glass tab bar | Done |
| Sign-in page (email picks the DB user, no real passwords) | Done |
| Standard Westpac home (header gradient, logo, search box) | Done |
| Personalised widget home (7 questions → 10 templates) | Done, tested |
| Voice / chat AI assistant (Groq) | Done, tested |
| AI rules (`ai_perms.md`) wired into the assistant prompt | Done |
| AI adds / removes / moves Home widgets on request | Done, tested |
| AI changes the colour theme on request | Done, tested |
| SQLite database + API (`database/`) | Theme + Home widgets saved and restored; widgets show DB accounts + transactions |
| Actions: AI-set-up money automations, alerts, More > Actions page, Home card | Done, tested |
| Accounts, Payments, Search screens | Placeholders, waiting on teammate mockups |
| More screen | Menu with Actions; other sections waiting on teammate mockups |
| Persisting personalisation across reloads | Theme + widgets persist (via `npm run db`); question answers don't |

## App structure

- Expo (SDK 58) / React Native 0.88 / React 19 app, runs on iOS, Android and web.
  - `npm start` (or `npm run web` / `npm run android` / `npm run ios`), plus `npm run db` in a second terminal for the
    database API (the app still runs without it, but nothing is saved)
  - `npm test` runs `tests/actions.test.mjs` (action rules, API + scheduler, AI tools), `tests/voice.test.mjs` (Groq client, tool loop, rate-limit retry, `ai_perms.md` in the prompt),
    `tests/personalise.test.mjs` (templates, `buildHome`, AI widget + theme edits) and `tests/database.test.mjs`
    (API against an in-memory copy of `schema.sql`). node:test, no device needed.
- See `AGENTS.md` for general Expo guidance. Note: the app does NOT use Expo Router — navigation is manual.
- `index.js` registers `App.js` as the root component.
- `App.js` reads the active tab from `src/navigation.js` (`navigate(tab, screen?)` / `useRoute()`, so any screen can
  jump elsewhere, e.g. `navigate('More', 'Actions')`), renders the matching screen, shows `ActionAlert`, and overlays
  `components/GlassTabBar.js`: a floating, translucent (expo-blur) tab bar absolutely positioned over the screens,
  coloured from the personalised home palette (Westpac palette by default).
  Tabs: Home, Accounts, Payments (raised centre button), Search, More.
  **Every screen must pad its bottom with `useTabBarSpace()`** (exported from `GlassTabBar.js`) so content scrolls
  clear of the bar.
- Sign-in: `App.js` shows `screens/SignInScreen.js` until `useUser()` (`src/session.js`) has a user. `signIn(email)`
  calls `PUT /api/session`, which sets the `session` user, then loads their home, banking data and Actions and opens the Home tab. Demo only: the
  `users` table has no passwords, so any password works; if the API is down it signs in offline with mock data.
  `signOut()` (the standard home's "Sign out" link) clears the local home and returns to the sign-in page.
- `components/WestpacLogo.js` SVG Westpac "W" logo (`react-native-svg`), props `width` / `color`.
- `screens/` has one file per tab, each owned by a teammate to build their mockup:
  `HomeScreen.js` (built), `AccountsScreen.js`, `SearchScreen.js`, `PaymentsScreen.js`, `MoreScreen.js` (placeholders).

## AI assistant (built)

- `src/voice/`: Groq speech-to-text (`whisper-large-v3-turbo`) + Groq chat (`qwen/qwen3.8-27b`, or
  `openai/gpt-oss-120b` when the AI has tools — qwen was unreliable at calling tools).
- The search box on both the standard and personalised home sends typed questions, and its mic button records
  voice; both open `src/voice/AssistantSheet.js`.
- The system prompt in `src/voice/groq.js` imports `ai_perms.md` directly (`metro.config.js` + `md-transformer.js`
  let Metro import `.md` as a string; `tests/register-md.mjs` does the same for Node), so edit the rules in
  `ai_perms.md`, not in code.
- Needs `EXPO_PUBLIC_GROQ_API_KEY` in `.env` (see `.env.example`). The key is bundled into the app — demo only.
- Closing the assistant sheet clears the chat: the AI forgets the conversation (`VoiceAssistant.reset()`) and any
  reply still loading is dropped, so each time it opens is a fresh chat.
- Replies are capped at 600 tokens (Groq free tier: 1000 output tokens/min), plain text only (no markdown).
  429 rate-limit errors are retried automatically if Groq asks for a wait of 20s or less.
- Tool calling: `chatWithTools()` in `groq.js` runs any tools the AI asks for (`{ name, description, parameters,
  run }`) and loops until it replies with text. `VoiceAssistant` takes `tools` plus `getContext()`, which is added
  to the system prompt fresh on every question.

### AI widget and theme editing

The assistant can see which widgets are on Home and add, remove or move them when the user asks
("put my bills at the top", "get rid of move money"), and change the colour theme ("make it green").
- `src/personalise/widgetCatalog.js` lists every widget (`WIDGETS`: database `id`, name, description, variants) and has pure
  `editLayout()` / `describeLayout()` helpers. **Add new widgets here too**, or the AI won't know about them.
- `src/personalise/homeTools.js` builds the `add_widget` / `remove_widget` / `move_widget` / `set_theme` tools and the
  live context. On every question the context re-reads the available widgets and themes from the database
  (`getCatalog()`), and the tools only accept those; if the API is down it falls back to `WIDGETS` / `PALETTES`.
  The AI only sees widget names, order and theme names, never balances (rules in `ai_perms.md`).
- Edits are saved with `setHomeSections()` in `store.js` as `{ answers, sections }`; `buildHome(answers, { sections })`
  then uses that list instead of the template's. Editing from the standard home switches to a personalised home
  that starts from the standard home's widgets (`STANDARD_ANSWERS` + `standardSections()`). Finalising the questions again drops the AI edits. `setTheme()` sets `answers.palette`.
- `HomeScreen.js` passes the tools to `AssistantSheet`, and renders the sheets outside the home branches so the
  assistant isn't remounted when the home switches.

## Actions (built)

Money automations between the user's own accounts, e.g. "if Choice has more than $500, move the extra to savings
every week". Code in `src/actions/`:
- `rules.js` (pure, tested, shared with the server): the 3 kinds (`sweep` = move anything over a threshold,
  `top_up` = keep an account above a minimum, `transfer` = fixed amount), `normaliseAction()` (validates; accepts
  account names or "savings" / "everyday"), `describeAction()`, `planRun()` (never overdraws), dates. Actions run at
  9am on `nextRun` (`RUN_HOUR`); daily / weekly / monthly.
- `store.js` keeps the actions from the API (`useActions()`), refreshed every minute by `startActionPolling()` in
  `App.js`, plus the AI's pending proposal (`proposeAction()` / `usePendingProposal()`).
- AI: `actionTools.js` (pure, tested) gives the assistant `create_action` / `edit_action` / `delete_action`; wired up
  in `assistantTools.js` and added to the Home assistant in `HomeScreen.js`. The AI only sees account names and the
  rules, never balances. New or changed actions appear as an approval card (`ProposalCard.js`, inside
  `AssistantSheet`) and the tool waits for Approve / Decline; closing the assistant declines.
- `ActionsScreen.js` = More > Actions (list, Ask the AI, New action, Edit, Skip, Run now, Delete). `ActionForm.js` is
  the create / edit pop-up. `ActionsCard.js` is the card on both homes (opens More > Actions).
- `ActionAlert.js` is the in-app notification on every screen (hidden on the Actions page) when an action runs within
  24 hours: "Skip this week", "Delete automation", "Edit"; the ✕ lets it run. Not a push / OS notification yet.

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
  `mockData.js` fake balances, bills, contacts, etc. `bankData.js` (pure, tested) turns the database's accounts and
  transactions into the same shapes (`fromDatabase()`); widgets read it with `useBankData()` from `store.js`, which
  shows mock data until the database answers. From the database: accounts (kind guessed from the product name:
  everyday / savings / credit / loan), total available, net worth, recent transactions, spent today / this week /
  this month (own `Payment to/from Westpac ...` transfers don't count, "today" = latest transaction date), and the
  week's top places in place of categories. Still mock (no tables yet): bills, goal targets, budgets, joint
  accounts, PayID contacts, transfers.
- `PersonalisedHome.js` renders the sections; widgets are in `widgets/` (`GoalWidgets.js`, `MoneyWidgets.js`,
  `MoveMoney.js`) and share `ui.js` (Card, Carousel, Bar, Gauge...).
- `store.js` keeps the finalised answers (and any AI widget edits) in memory so the home survives tab switches. The
  tab bar also reads it to pick its colours. Every change (questions finalised, AI edit, theme, reset) also saves the
  theme and Home widgets to the database, and `loadFromDatabase()` (called by `signIn()` in `src/session.js`) restores them on sign-in.
  Restored widgets use their default variant, and the question answers themselves aren't saved.
- The standard home (no saved `homepage_widgets`) is the Westpac header + search, the "Make this home yours" banner, the Actions card,
  then every widget in `WIDGETS` order in Westpac colours (`buildStandardHome()` in `buildHome.js`, rendered with
  `HomeWidgets` from `PersonalisedHome.js`).
- `screens/HomeScreen.js` shows the standard home until answers are finalised or widgets are saved,
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

## Database

- `database/schema.sql` defines SQLite tables `users`, `accounts`, `transactions` and `customisation`
  (a `theme` per user, a `themes.name`); `database/app.db` is the built database.
- `themes` (`name` PK, `label`) lists the colour themes, matching `PALETTES` in `themes.js`.
- `widgets` (`widget_ID` PK, `name`) lists the 9 widgets in `WIDGETS` order from `widgetCatalog.js` (1 = Money goal …
  9 = Total available); `homepage_widgets` (`user_ID`, `widget_ID`, `priority`, no PK) is which widgets each user
  has on Home, 1 = top. Add new widgets to the seed `INSERT` in `schema.sql` too.
- `actions` (one row per automation: `kind`, `from_account_ID`, `to_account_ID`, `threshold` / `amount`, `frequency`,
  `next_run` ISO date, `created_by` user / ai, `alert_dismissed_for`) and `action_runs` (history: moved / nothing /
  skipped / failed). `server.mjs` runs due actions on start and every minute: it moves the balances and adds a pair of
  `Payment to/from Westpac ...` transactions (so they don't count as spending). `npm run db` also applies
  `schema.sql` to `app.db` on start, so new tables appear automatically.
- `session` holds who is signed in: always one row (`ID` locked to 1), `user_ID` defaults to 1. Switch user with
  `UPDATE session SET user_ID = 2;`.
- `database/server.mjs` (`npm run db`, port 3001, built-in `node:sqlite`) is the only way in: `GET /api/home`,
  `GET /api/banking` (accounts + transactions, for the widgets only, never the AI), `PUT /api/theme`,
  `PUT /api/homepage`, `PUT /api/session` (`{ email }`, signs that user in), and `/api/actions` (`GET`, `POST`,
  `PUT|DELETE /:id`, `POST /:id/skip|dismiss|run`), always for the `session` user, rate-limited. `src/db/client.js` calls it
  (`EXPO_PUBLIC_DB_URL` overrides the address). Per `ai_perms.md`, the AI never gets direct SQL or write access.
- Transaction dates in `app.db` are `dd/mm/yyyy` (not ISO as the schema comment says), so don't sort them as text;
  `parseDate()` in `bankData.js` reads both.
