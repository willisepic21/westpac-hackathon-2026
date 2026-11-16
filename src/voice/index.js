// Voice AI: speech-to-text with Groq Whisper, then send the text to a Groq LLM.
//
//   import { VoiceAssistant, useVoiceRecorder } from './src/voice';
//   const assistant = new VoiceAssistant();
//   const { start, stop } = useVoiceRecorder();
//   await start(); ...; const uri = await stop();
//   const { transcript, reply } = await assistant.respondToRecording(uri);
import { audioFormData } from './audioFile';
import {
  chat,
  DEFAULT_CHAT_MODEL,
  DEFAULT_MAX_TOKENS,
  DEFAULT_STT_MODEL,
  DEFAULT_SYSTEM_PROMPT,
  transcribe,
} from './groq';

export { chat, transcribe } from './groq';
export { audioFormData } from './audioFile';
export { useVoiceRecorder } from './useVoiceRecorder';

/** Turn a recording (file or blob: URI) into text. */
export async function transcribeRecording(uri, options) {
  return transcribe(await audioFormData(uri), options);
}

export class VoiceAssistant {
  constructor({
    apiKey,
    chatModel = DEFAULT_CHAT_MODEL,
    maxTokens = DEFAULT_MAX_TOKENS,
    sttModel = DEFAULT_STT_MODEL,
    language, // optional ISO-639-1 code, e.g. 'en' — improves accuracy and speed
    systemPrompt = DEFAULT_SYSTEM_PROMPT,
  } = {}) {
    this.apiKey = apiKey;
    this.chatModel = chatModel;
    this.maxTokens = maxTokens;
    this.sttModel = sttModel;
    this.language = language;
    this.messages = [{ role: 'system', content: systemPrompt }];
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
    const messages = [...this.messages, { role: 'user', content: text }];
    const reply = await chat(messages, {
      model: this.chatModel,
      maxTokens: this.maxTokens,
      apiKey: this.apiKey,
    });
    this.messages = [...messages, { role: 'assistant', content: reply }];
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
