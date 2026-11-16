import assert from 'node:assert/strict';
import { test } from 'node:test';

import { chat, transcribe } from '../src/voice/groq.js';

const fakeFetch = (handler) => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    return handler(url, init);
  };
  return { calls, fetchImpl };
};

test('transcribe uploads multipart audio to Groq Whisper', async () => {
  const { calls, fetchImpl } = fakeFetch(() => ({ ok: true, json: async () => ({ text: '  What is a term deposit? ' }) }));
  const form = new FormData();
  form.append('file', new Blob([new Uint8Array([1, 2, 3])], { type: 'audio/webm' }), 'recording.webm');

  const text = await transcribe(form, { apiKey: 'k', fetchImpl, language: 'en' });

  assert.equal(text, 'What is a term deposit?');
  const { url, init } = calls[0];
  assert.ok(url.endsWith('/audio/transcriptions'));
  assert.equal(init.headers.Authorization, 'Bearer k');
  assert.equal(init.headers['Content-Type'], undefined, 'fetch must set the multipart boundary itself');
  assert.equal(init.body.get('model'), 'whisper-large-v3-turbo');
  assert.equal(init.body.get('language'), 'en');
  assert.equal(init.body.get('file').name, 'recording.webm');
});

test('chat caps output tokens, disables Qwen reasoning and strips <think> text', async () => {
  const { calls, fetchImpl } = fakeFetch(() => ({
    ok: true,
    json: async () => ({ choices: [{ message: { content: '<think>hmm</think> Hello!' } }] }),
  }));
  const reply = await chat([{ role: 'user', content: 'hi' }], { apiKey: 'k', fetchImpl });
  const body = JSON.parse(calls[0].init.body);
  assert.equal(reply, 'Hello!');
  assert.equal(body.model, 'qwen/qwen3.8-27b');
  assert.equal(body.max_completion_tokens, 600);
  assert.equal(body.reasoning_effort, 'none');
  assert.equal(calls[0].init.headers['Content-Type'], 'application/json');

  await chat([], { apiKey: 'k', fetchImpl, model: 'llama-3.3-70b-versatile', maxTokens: 300 });
  const body2 = JSON.parse(calls[1].init.body);
  assert.equal(body2.max_completion_tokens, 300);
  assert.equal(body2.reasoning_effort, undefined);
});

test('Groq errors surface their message', async () => {
  const { fetchImpl } = fakeFetch(() => ({
    ok: false, status: 401, statusText: 'Unauthorized',
    json: async () => ({ error: { message: 'Invalid API Key' } }),
  }));
  await assert.rejects(chat([], { apiKey: 'bad', fetchImpl }), /Invalid API Key/);
  await assert.rejects(transcribe(new FormData(), { apiKey: 'bad', fetchImpl }), /Invalid API Key/);
});

test('system prompt includes every line of ai_perms.md', async () => {
  const { readFileSync } = await import('node:fs');
  const { DEFAULT_SYSTEM_PROMPT } = await import('../src/voice/groq.js');
  const lines = readFileSync(new URL('../ai_perms.md', import.meta.url), 'utf8')
    .split('\n')
    .map((line) => line.replace(/^\s*-\s*/, '').trim())
    .filter(Boolean);
  assert.ok(lines.length > 0);
  for (const line of lines) assert.ok(DEFAULT_SYSTEM_PROMPT.includes(line), `missing: ${line}`);
});

test('chatWithTools runs the tools the AI asks for, then returns its reply', async () => {
  const { chatWithTools } = await import('../src/voice/groq.js');
  const replies = [
    { tool_calls: [{ id: 'c1', type: 'function', function: { name: 'add_widget', arguments: '{"type":"bills"}' } }] },
    { content: 'Added your upcoming bills.' },
  ];
  const { calls, fetchImpl } = fakeFetch(() => ({ ok: true, json: async () => ({ choices: [{ message: replies.shift() }] }) }));
  const ran = [];
  const tools = [{
    name: 'add_widget',
    description: 'Add a widget',
    parameters: { type: 'object', properties: { type: { type: 'string' } } },
    run: (args) => { ran.push(args); return 'Added Upcoming bills.'; },
  }];

  const { reply, messages } = await chatWithTools([{ role: 'user', content: 'add my bills' }], { tools, apiKey: 'k', fetchImpl });

  assert.equal(reply, 'Added your upcoming bills.');
  assert.deepEqual(ran, [{ type: 'bills' }]);
  const first = JSON.parse(calls[0].init.body);
  assert.equal(first.tools[0].function.name, 'add_widget');
  assert.equal(first.tools[0].run, undefined, 'run() is not sent to Groq');
  const second = JSON.parse(calls[1].init.body);
  assert.deepEqual(second.messages.at(-1), { role: 'tool', tool_call_id: 'c1', content: 'Added Upcoming bills.' });
  assert.equal(messages.at(-1).content, 'Added your upcoming bills.');
});

test('chatWithTools reports tool errors back to the AI instead of throwing', async () => {
  const { chatWithTools } = await import('../src/voice/groq.js');
  const replies = [
    { tool_calls: [{ id: 'c1', type: 'function', function: { name: 'remove_widget', arguments: '{}' } }] },
    { content: "That widget isn't on your home." },
  ];
  const { calls, fetchImpl } = fakeFetch(() => ({ ok: true, json: async () => ({ choices: [{ message: replies.shift() }] }) }));
  const tools = [{ name: 'remove_widget', description: '', parameters: { type: 'object' }, run: () => { throw new Error('not on the home'); } }];

  const { reply } = await chatWithTools([], { tools, apiKey: 'k', fetchImpl });
  assert.equal(reply, "That widget isn't on your home.");
  assert.equal(JSON.parse(calls[1].init.body).messages.at(-1).content, 'Error: not on the home');
});

test('rate limits (429) are retried after the wait Groq asks for', async () => {
  let n = 0;
  const { calls, fetchImpl } = fakeFetch(() => (n++ === 0
    ? { ok: false, status: 429, statusText: 'Too Many Requests', headers: new Headers(),
        json: async () => ({ error: { message: 'Rate limit reached ... Please try again in 20ms.' } }) }
    : { ok: true, json: async () => ({ choices: [{ message: { content: 'Hi!' } }] }) }));
  assert.equal(await chat([], { apiKey: 'k', fetchImpl }), 'Hi!');
  assert.equal(calls.length, 2);

  const { fetchImpl: tooLong } = fakeFetch(() => ({
    ok: false, status: 429, statusText: 'Too Many Requests', headers: new Headers(),
    json: async () => ({ error: { message: 'Please try again in 7m12s.' } }),
  }));
  await assert.rejects(chat([], { apiKey: 'k', fetchImpl: tooLong }), /try again in 7m12s/);
});

test('chatWithTools uses the tool model unless one is given, with short gpt-oss reasoning', async () => {
  const { chatWithTools, DEFAULT_TOOL_MODEL } = await import('../src/voice/groq.js');
  const { calls, fetchImpl } = fakeFetch(() => ({ ok: true, json: async () => ({ choices: [{ message: { content: 'ok' } }] }) }));
  const tools = [{ name: 't', description: '', parameters: { type: 'object' }, run: () => '' }];
  await chatWithTools([], { tools, apiKey: 'k', fetchImpl });
  const body = JSON.parse(calls[0].init.body);
  assert.equal(body.model, DEFAULT_TOOL_MODEL);
  assert.equal(body.reasoning_effort, 'low');

  await chatWithTools([], { apiKey: 'k', fetchImpl });
  assert.equal(JSON.parse(calls[1].init.body).model, 'qwen/qwen3.8-27b', 'no tools: normal chat model');
});
