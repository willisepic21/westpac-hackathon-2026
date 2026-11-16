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

test('system prompt carries the ai_perms.md rules', async () => {
  const { DEFAULT_SYSTEM_PROMPT } = await import('../src/voice/groq.js');
  for (const rule of [/only help with banking/i, /never ask for.*passwords/i, /cannot approve loans/i, /cannot move money/i]) {
    assert.match(DEFAULT_SYSTEM_PROMPT, rule);
  }
});
