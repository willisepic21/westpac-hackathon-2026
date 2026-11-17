// Thin client for the Groq REST API (OpenAI-compatible): speech-to-text + chat.

const BASE_URL = 'https://api.groq.com/openai/v1';

export const DEFAULT_CHAT_MODEL = 'qwen/qwen3.8-27b';
export const DEFAULT_STT_MODEL = 'whisper-large-v3-turbo';
// Used when the AI has tools (e.g. editing Home widgets). In testing, qwen often said it had changed the home
// without calling a tool, while gpt-oss called the right tool every time.
export const DEFAULT_TOOL_MODEL = 'openai/gpt-oss-120b';

// The team's AI permission spec, imported as a string (see metro.config.js / md-transformer.js).
// Editing ai_perms.md changes the rules the assistant is given.
import AI_PERMS from '../../ai_perms.md';

export { AI_PERMS };

export const DEFAULT_SYSTEM_PROMPT = [
  'You are the Westpac banking assistant inside the Westpac mobile app.',
  'The user often speaks to you; their words are transcribed automatically and may contain ' +
  'small transcription errors, so infer what they meant.',
  'Keep answers short, friendly and conversational. Use Australian English and AUD.',
  'Reply in plain text only: the app cannot display markdown, so never use *, **, #, ` or tables, and never ' +
    'start a line with - or a bullet. To list things, put each item on its own new line with nothing in front of it.',
  "Rules you must always follow (from the team's AI permission spec):",
  AI_PERMS.trim(),
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

// Free tier rate limits are per minute; a short wait usually clears them.
const MAX_RETRY_WAIT_MS = 20000;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// How long to wait before retrying a 429: the retry-after header, or the "try again in 1.5s" text in the
// error (browsers can hide the header). null if unknown or too long to wait.
function retryWaitMs(response, message) {
  let ms = Number(response.headers?.get?.('retry-after')) * 1000;
  if (!(ms > 0)) {
    const m = /try again in (?:(\d+)m)?([\d.]+)(ms|s)/.exec(message ?? '');
    if (m) ms = (Number(m[1] ?? 0) * 60 + Number(m[2]) / (m[3] === 'ms' ? 1000 : 1)) * 1000;
  }
  return ms > 0 && ms <= MAX_RETRY_WAIT_MS ? ms : null;
}

async function groqFetch(path, body, { apiKey, fetchImpl = fetch, retries = 2 } = {}) {
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
    // Rate limited (common with tool calls, which make several requests per question): wait and retry.
    const wait = response.status === 429 && retries > 0 ? retryWaitMs(response, message) : null;
    if (wait != null) {
      await sleep(wait);
      return groqFetch(path, body, { apiKey, fetchImpl, retries: retries - 1 });
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

// One chat completion; returns Groq's message object ({ content, tool_calls? }).
async function complete(
  messages,
  { model = DEFAULT_CHAT_MODEL, maxTokens = DEFAULT_MAX_TOKENS, tools, toolChoice, ...options } = {},
) {
  const body = { model, messages, max_completion_tokens: maxTokens };
  // Qwen models "think" before answering, which spends output tokens and adds delay.
  // A quick conversational reply doesn't need it, so switch reasoning off.
  if (model.startsWith('qwen/')) body.reasoning_effort = 'none';
  // gpt-oss can't switch reasoning off; keep it short.
  if (model.startsWith('openai/gpt-oss')) body.reasoning_effort = 'low';
  if (tools?.length) {
    body.tools = tools.map(({ name, description, parameters }) => ({
      type: 'function',
      function: { name, description, parameters },
    }));
    if (toolChoice) body.tool_choice = toolChoice;
  }

  const response = await groqFetch('/chat/completions', body, options);
  const json = await response.json();
  return json.choices?.[0]?.message ?? {};
}

// Drop reasoning if a model still returns it inline.
const cleanReply = (content) => toPlainText((content ?? '').replace(/<think>[\s\S]*?(<\/think>|$)/g, ''));

/**
 * The chat bubble shows raw text, so strip any markdown the model uses anyway (it sometimes ignores the prompt):
 * **bold**, *italics*, `code`, # headings and "- " / "* " / "• " bullets. Line breaks are kept, and a written-out
 * "\\n" or "/n" (models copy these from the rules) becomes a real line break.
 */
export function toPlainText(text) {
  return text
    .replace(/\\n/g, '\n')
    .replace(/\/n(?=[\sA-Z0-9]|$)/g, '\n')
    .replace(/\*\*|__|`/g, '')
    .replace(/\*([^*\n]+)\*/g, '$1')
    .replace(/^[ \t]*#{1,6}[ \t]+/gm, '')
    .replace(/^[ \t]*[-*•][ \t]+/gm, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Send a chat conversation to Groq and return the reply text. */
export async function chat(messages, options) {
  return cleanReply((await complete(messages, options)).content);
}

async function runTool(tools, call) {
  const tool = tools.find((t) => t.name === call.function?.name);
  if (!tool) return `Error: there is no tool called "${call.function?.name}".`;
  try {
    const args = call.function.arguments ? JSON.parse(call.function.arguments) : {};
    return String(await tool.run(args));
  } catch (e) {
    return `Error: ${e.message}`;
  }
}

/**
 * Chat where the AI may call tools: [{ name, description, parameters (JSON schema), run(args) -> string }].
 * Runs the tools it asks for, sends the results back, and repeats until it replies with text
 * (after `maxRounds` tool rounds it must answer). Returns { reply, messages } with the full history.
 */
export async function chatWithTools(messages, { tools = [], maxRounds = 3, ...options } = {}) {
  if (tools.length && !options.model) options = { ...options, model: DEFAULT_TOOL_MODEL };
  const history = [...messages];
  for (let round = 0; ; round++) {
    const message = await complete(history, {
      ...options,
      tools,
      toolChoice: round >= maxRounds ? 'none' : undefined,
    });
    const calls = message.tool_calls ?? [];
    if (!calls.length) {
      const reply = cleanReply(message.content);
      history.push({ role: 'assistant', content: reply });
      return { reply, messages: history };
    }
    history.push({ role: 'assistant', content: message.content ?? '', tool_calls: calls });
    for (const call of calls) {
      history.push({ role: 'tool', tool_call_id: call.id, content: await runTool(tools, call) });
    }
  }
}
