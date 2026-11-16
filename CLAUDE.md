This is a project for the westpac hackathon 2026.

The aim of the project is a proof of concept of a ai driven personalising home page.

for the ai implementation in the app all the rules for the ai are written in ai_perms.md

## Current state

- Expo (SDK 58) / React Native 0.88 / React 19 app, runs on iOS, Android and web.
  - `npm start` (or `npm run web` / `npm run android` / `npm run ios`)
- See `AGENTS.md` for general Expo guidance. Note: the app does NOT use Expo Router yet — navigation is manual.
- `index.js` registers `App.js` as the root component.
- `App.js` holds a custom bottom tab bar (Ionicons, active colour Westpac red `#D5002B`) with tabs:
  Home, Accounts, Search, Payments, More. Active tab is tracked with `useState` and a `switch` renders the screen.
- `screens/` has one placeholder file per tab, each owned by a teammate to build their mockup:
  `HomeScreen.js`, `AccountsScreen.js`, `SearchScreen.js`, `PaymentsScreen.js`, `MoreScreen.js`.
- AI assistant: `src/voice/` (Groq speech-to-text with Whisper + Groq chat with `qwen/qwen3.8-27b`).
  The Home search box has a mic button that opens `src/voice/AssistantSheet.js`. Its system prompt in
  `src/voice/groq.js` imports `ai_perms.md` directly (`metro.config.js` + `md-transformer.js` let Metro
  import `.md` as a string; `tests/register-md.mjs` does the same for Node), so edit the rules there. Needs `EXPO_PUBLIC_GROQ_API_KEY` in `.env`
  (see `.env.example`). Replies are capped at 600 tokens (Groq free tier: 1000 output tokens/min).
- `npm test` runs `tests/voice.test.mjs` and `tests/personalise.test.mjs` (node:test, no device needed).

## Personalised widget home page (built)

Onboarding asks the user 7 questions; the answers pick which widget templates appear on Home and how they are laid out.

Code lives in `src/personalise/`:
- `questions.js` the 7 questions and answer options (bubbles). `QuestionSheet.js` is the pop-up: one question at a
  time, "Next" once answered, and after the last question "Back to start" or "Finalise".
- `templates.js` 10 templates: 1-4 follow the Figma mockups (Daily check-in, House saver, Debt freedom, Shared money),
  5-10 cover the other goal x frequency combos. Each is a list of `sections` (`type` + `variant`).
- `buildHome.js` scores templates against the answers, picks the best, then applies the user's tweaks (palette,
  density, pinned accounts, weekly tracker on/off, contacts vs transfer) and the frequency priority rule. Pure JS, tested.
- `themes.js` palettes + compact/spacious spacing. `mockData.js` fake balances, bills, contacts, etc.
- `PersonalisedHome.js` renders the sections; widgets are in `widgets/` and share `ui.js` (Card, Carousel, Bar, Gauge...).
- `store.js` keeps the finalised answers in memory (lost on reload) so the home survives tab switches.
- `screens/HomeScreen.js` shows the standard home with a "Make this home yours" banner until answers are finalised,
  then the personalised home ("Edit home" reopens the questions; "Use standard home" resets).

To add a template: add an entry to `TEMPLATES`. To add a widget: build it in `widgets/`, register its `type` in
`SECTIONS` in `PersonalisedHome.js`, then use it in templates.

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
