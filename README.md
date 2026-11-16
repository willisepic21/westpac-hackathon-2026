# westpac-hackathon-2026
Westpac hackathon

## Voice AI (`src/voice/`)

Speak to the app: your voice is recorded, turned into text with Groq speech-to-text
(Whisper, `whisper-large-v3-turbo`), and that text is sent to an LLM on [Groq](https://console.groq.com)
(`qwen/qwen3.8-27b`). Works on iOS, Android (incl. Expo Go) and web (web needs https or localhost for the mic).

### Setup

```bash
npm install
cp .env.example .env   # then put your key in EXPO_PUBLIC_GROQ_API_KEY
npx expo start
```

On the **Home** tab, tap the mic in the "How can we help you today?" box and speak, or type a
question and press enter. The Westpac Assistant pop-up (`src/voice/AssistantSheet.js`) shows your
words and the AI's reply. The AI follows the rules in `ai_perms.md` (banking questions only, never
asks for credentials, can't approve loans or move money) and gets the Home screen's mock account
balances as read-only context.

> **Hackathon only:** `EXPO_PUBLIC_` variables are bundled into the app, so the Groq key can be
> extracted by anyone who has the app. For anything beyond a demo, call Groq from a backend instead.

### In code

```js
import { VoiceAssistant, useVoiceRecorder } from './src/voice';

const assistant = new VoiceAssistant({ language: 'en', context: 'Choice: $469.30' }); // both optional
const recorder = useVoiceRecorder();                       // inside a component

await recorder.start();                 // asks for mic permission the first time
const uri = await recorder.stop();
const { transcript, reply } = await assistant.respondToRecording(uri);

const text = await assistant.transcribe(uri);   // just speech-to-text
const answer = await assistant.ask('Follow-up?'); // just the LLM (keeps conversation history)
assistant.reset();                                // clear history
```

Replies are capped at 600 tokens (`new VoiceAssistant({ maxTokens })`) because Groq's free tier
rejects requests that could exceed 1000 output tokens per minute.

### Tests

```bash
npm test
```
