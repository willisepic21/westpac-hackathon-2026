// Voice AI: speech-to-text with Groq Whisper, then send the text to a Groq LLM.
//
//   import { VoiceAssistant, useVoiceRecorder } from './src/voice';
//   const assistant = new VoiceAssistant();
//   const { start, stop } = useVoiceRecorder();
//   await start(); ...; const uri = await stop();
//   const { transcript, reply } = await assistant.respondToRecording(uri);
import { audioFormData } from './audioFile';
import {
  chatWithTools,
  DEFAULT_CHAT_MODEL,
  DEFAULT_TOOL_MODEL,
  DEFAULT_MAX_TOKENS,
  DEFAULT_STT_MODEL,
  DEFAULT_SYSTEM_PROMPT,
  transcribe,
} from './groq';

export { chat, chatWithTools, transcribe } from './groq';
export { audioFormData } from './audioFile';
export { useVoiceRecorder } from './useVoiceRecorder';

/** Turn a recording (file or blob: URI) into text. */
export async function transcribeRecording(uri, options) {
  return transcribe(await audioFormData(uri), options);
}

export class VoiceAssistant {
  constructor({
    apiKey,
    chatModel, // default: DEFAULT_CHAT_MODEL, or DEFAULT_TOOL_MODEL when `tools` are given
    maxTokens = DEFAULT_MAX_TOKENS,
    sttModel = DEFAULT_STT_MODEL,
    language, // optional ISO-639-1 code, e.g. 'en' — improves accuracy and speed
    systemPrompt = DEFAULT_SYSTEM_PROMPT,
    context, // optional read-only data for the AI, e.g. an account summary
    tools = [], // optional tools the AI can call, see chatWithTools in ./groq.js
    getContext, // optional () => string (or Promise<string>), added to the system prompt fresh on every question
  } = {}) {
    this.apiKey = apiKey;
    this.chatModel = chatModel ?? (tools.length ? DEFAULT_TOOL_MODEL : DEFAULT_CHAT_MODEL);
    this.maxTokens = maxTokens;
    this.sttModel = sttModel;
    this.language = language;
    this.tools = tools;
    this.getContext = getContext;
    const content = context
      ? `${systemPrompt}\n\nAccount summary (read-only):\n${context}`
      : systemPrompt;
    this.messages = [{ role: 'system', content }];
  }

  /** Speech-to-text: recording URI -> transcript. */
  transcribe(uri) {
    return transcribeRecording(uri, {
      model: this.sttModel,
      language: this.language,
      apiKey: this.apiKey,
    });
  }

  /** Send text to the AI, remembering the conversation. Returns the reply text. */
  async ask(text) {
    const [system, ...rest] = this.messages;
    const live = this.getContext
      ? { role: 'system', content: `${system.content}\n\n${await this.getContext()}` }
      : system;
    const { reply, messages } = await chatWithTools([live, ...rest, { role: 'user', content: text }], {
      tools: this.tools,
      model: this.chatModel,
      maxTokens: this.maxTokens,
      apiKey: this.apiKey,
    });
    // Keep the base system prompt; the live context is rebuilt next time.
    this.messages = [system, ...messages.slice(1)];
    return reply;
  }

  /**
   * Transcribe a recording and send the text to the AI.
   * `onTranscript` fires as soon as the speech is converted, before the AI replies.
   */
  async respondToRecording(uri, { onTranscript } = {}) {
    const transcript = await this.transcribe(uri);
    if (!transcript) throw new Error("Didn't catch that — no speech was detected.");
    onTranscript?.(transcript);
    const reply = await this.ask(transcript);
    return { transcript, reply };
  }

  reset() {
    this.messages = this.messages.slice(0, 1);
  }
}
