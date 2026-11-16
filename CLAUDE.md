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
  `src/voice/groq.js` implements the `ai_perms.md` rules. Needs `EXPO_PUBLIC_GROQ_API_KEY` in `.env`
  (see `.env.example`). Replies are capped at 600 tokens (Groq free tier: 1000 output tokens/min).
- `npm test` runs `tests/voice.test.mjs` (node:test, no device needed).

## Known issues

- `App.js` still imports `ActivityScreen`, `WidgetScreen`, `ProfileScreen` (files no longer exist) and does not import
  `SearchScreen`; the `switch` has no cases for Accounts, Payments, More. The app will not build until this is fixed.
- `.history/` (VS Code local history) is committed and should be added to `.gitignore`.
