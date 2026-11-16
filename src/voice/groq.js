// Thin client for the Groq REST API (OpenAI-compatible): speech-to-text + chat.

const BASE_URL = 'https://api.groq.com/openai/v1';

export const DEFAULT_CHAT_MODEL = 'qwen/qwen3.8-27b';
export const DEFAULT_STT_MODEL = 'whisper-large-v3-turbo';

// The team's AI permission spec, imported as a string (see metro.config.js / md-transformer.js).
// Editing ai_perms.md changes the rules the assistant is given.
import AI_PERMS from '../../ai_perms.md';

export { AI_PERMS };

export const DEFAULT_SYSTEM_PROMPT = [
  'You are the Westpac banking assistant inside the Westpac mobile app.',
  'The user often speaks to you; their words are transcribed automatically and may contain ' +
    'small transcription errors, so infer what they meant.',
  'Keep answers short, friendly and conversational. Use Australian English and AUD.',
  'Reply in plain text only: the app cannot display markdown, so no asterisks, headings or tables.',
  "Rules you must always follow (from the team's AI permission spec):",
  AI_PERMS.trim(),
  'In practice this means:',
  '- Only help with banking, money and app-related questions. Politely decline anything else.',
  '- You have read-only access to the account summary provided below (if any). Never invent ' +
    'balances or transactions that are not in it.',
  '- Never ask for, repeat or reveal passwords, PINs, MFA codes, TFNs, card numbers or full ' +
    'account numbers. If the user shares one, tell them not to and do not repeat it.',
  '- You cannot change security settings, passwords, MFA or whitelists.',
  '- You cannot approve loans or increase credit limits; direct the user to apply through the app.',
  '- You cannot move money yourself. You may suggest transfers between the user\'s own accounts, ' +
    'but they must confirm and approve them in the app.',
  '- General information only, not personal financial advice.',
].join('\n');

// Groq rejects requests whose *possible* output exceeds the account's output-tokens-per-minute
// limit (1000 on the free tier), and without a cap it assumes a large default. So always send
// an explicit cap below that limit.
export const DEFAULT_MAX_TOKENS = 600;

function resolveKey(apiKey) {
  // EXPO_PUBLIC_ vars are inlined into the app bundle at build time.
  const key = apiKey ?? process.env.EXPO_PUBLIC_GROQ_API_KEY;
  if (!key) {
    throw new Error('Missing Groq API key. Set EXPO_PUBLIC_GROQ_API_KEY in .env.local.');
  }
  return key;
}

async function groqFetch(path, body, { apiKey, fetchImpl = fetch } = {}) {
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData;
  const headers = { Authorization: `Bearer ${resolveKey(apiKey)}` };
  // For FormData, let fetch set the multipart Content-Type (with its boundary).
  if (!isForm) headers['Content-Type'] = 'application/json';

  const response = await fetchImpl(`${BASE_URL}${path}`, {
    method: 'POST',
    headers,
    body: isForm ? body : JSON.stringify(body),
  });
  if (!response.ok) {
    let message = `${response.status} ${response.statusText}`;
    try {
      const err = await response.json();
      message = err?.error?.message ?? message;
    } catch {
      // body wasn't JSON; keep the status text
    }
    throw new Error(`Groq API error: ${message}`);
  }
  return response;
}

/**
 * Transcribe audio to text with Groq Whisper.
 * `form` is a FormData that already has the audio appended as `file` (see appendAudioFile).
 */
export async function transcribe(form, { model = DEFAULT_STT_MODEL, language, ...options } = {}) {
  form.append('model', model);
  form.append('response_format', 'json');
  if (language) form.append('language', language);
  const response = await groqFetch('/audio/transcriptions', form, options);
  const json = await response.json();
  return (json.text ?? '').trim();
}

/** Send a chat conversation to Groq and return the reply text. */
export async function chat(
  messages,
  { model = DEFAULT_CHAT_MODEL, maxTokens = DEFAULT_MAX_TOKENS, ...options } = {},
) {
  const body = { model, messages, max_completion_tokens: maxTokens };
  // Qwen models "think" before answering, which spends output tokens and adds delay.
  // A quick conversational reply doesn't need it, so switch reasoning off.
  if (model.startsWith('qwen/')) body.reasoning_effort = 'none';

  const response = await groqFetch('/chat/completions', body, options);
  const json = await response.json();
  const content = json.choices?.[0]?.message?.content ?? '';
  // Drop reasoning if a model still returns it inline.
  return content.replace(/<think>[\s\S]*?(<\/think>|$)/g, '').trim();
}
