// Pop-up AI assistant: talk (speech-to-text via Groq) or type, and get a reply from the Groq LLM.
//
//   <AssistantSheet visible={open} onClose={() => setOpen(false)}
//                   initialQuestion="..." autoListen context="Account summary..."
//                   tools={[...]} getContext={() => '...'} />   (tools / getContext: see VoiceAssistant)
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import ProposalCard from '../actions/ProposalCard';
import { declineProposal } from '../actions/store';
import { VoiceAssistant } from './index';
import { useVoiceRecorder } from './useVoiceRecorder';

const RED = '#D5002B';
const NAVY = '#1F1C4F';

export default function AssistantSheet({
  visible,
  onClose,
  initialQuestion,
  autoListen,
  context,
  tools,
  getContext,
  hint, // optional text shown before the first message
}) {
  const insets = useSafeAreaInsets();
  const assistant = useRef(null);
  if (!assistant.current) assistant.current = new VoiceAssistant({ context, tools, getContext, language: 'en' });
  const recorder = useVoiceRecorder();
  const scroll = useRef(null);
  const session = useRef(0); // bumped on close, so replies that arrive after closing are dropped

  const [input, setInput] = useState('');
  const [log, setLog] = useState([]);
  const [busy, setBusy] = useState(null); // null | 'Listening…' | 'Thinking…'
  const [error, setError] = useState(null);

  const addMessage = (role, text) => setLog((l) => [...l, { role, text }]);

  async function run(task) {
    const current = session.current;
    const stillOpen = () => current === session.current;
    setError(null);
    try {
      await task(stillOpen);
    } catch (e) {
      if (stillOpen()) setError(e.message);
    } finally {
      if (stillOpen()) setBusy(null);
    }
  }

  function ask(text) {
    if (!text || busy) return;
    addMessage('user', text);
    setBusy('Thinking…');
    run(async (stillOpen) => {
      const reply = await assistant.current.ask(text);
      if (stillOpen()) addMessage('ai', reply);
    });
  }

  function sendText() {
    const text = input.trim();
    setInput('');
    ask(text);
  }

  function toggleMic() {
    if (busy) return;
    if (!recorder.isRecording) {
      run(() => recorder.start());
      return;
    }
    setBusy('Transcribing…');
    run(async (stillOpen) => {
      const uri = await recorder.stop();
      const { reply } = await assistant.current.respondToRecording(uri, {
        onTranscript: (transcript) => {
          if (!stillOpen()) return;
          addMessage('user', transcript);
          setBusy('Thinking…');
        },
      });
      if (stillOpen()) addMessage('ai', reply);
    });
  }

  // When opened from the home screen: ask the typed question, or start listening.
  useEffect(() => {
    if (!visible) return;
    if (initialQuestion?.trim()) ask(initialQuestion.trim());
    else if (autoListen) toggleMic();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  async function close() {
    if (recorder.isRecording) await recorder.stop().catch(() => {});
    declineProposal(); // closing with an action waiting for approval counts as "no"
    // Start fresh next time: clear the AI's memory of the chat and the on-screen log.
    session.current += 1;
    assistant.current.reset();
    setLog([]);
    setInput('');
    setBusy(null);
    setError(null);
    onClose?.();
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={close} transparent>
      <View style={styles.backdrop}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={[styles.sheet, { paddingBottom: insets.bottom + 12 }]}
        >
          <View style={styles.header}>
            <Text style={styles.title}>Westpac Assistant</Text>
            <Pressable onPress={close} accessibilityLabel="Close assistant" hitSlop={12}>
              <Ionicons name="close" size={26} color={NAVY} />
            </Pressable>
          </View>

          <ScrollView
            ref={scroll}
            style={styles.log}
            contentContainerStyle={{ gap: 8, paddingVertical: 8 }}
            onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}
          >
            {log.length === 0 && !busy && !recorder.isRecording && (
              <Text style={styles.hint}>
                {hint ??
                  'Tap the mic and ask about your accounts, bills or spending, ask me to add or remove widgets on your home, or to set up an action like moving money to savings.'}
              </Text>
            )}
            {log.map((m, i) => (
              <Text key={i} style={[styles.bubble, m.role === 'user' ? styles.user : styles.ai]}>
                {m.text}
              </Text>
            ))}
            {recorder.isRecording && <Text style={styles.status}>Listening… tap stop when you're done</Text>}
            {/* AI-proposed action waiting for the user's approval */}
            <ProposalCard />
            {busy && <Text style={styles.status}>{busy}</Text>}
            {error && <Text style={styles.error}>{error}</Text>}
          </ScrollView>

          <View style={styles.row}>
            <Pressable
              style={[styles.iconButton, recorder.isRecording && styles.recording]}
              onPress={toggleMic}
              disabled={!!busy}
              accessibilityLabel={recorder.isRecording ? 'Stop recording' : 'Start recording'}
            >
              <Ionicons name={recorder.isRecording ? 'stop' : 'mic'} size={22} color="#fff" />
            </Pressable>
            <TextInput
              style={styles.input}
              value={input}
              onChangeText={setInput}
              onSubmitEditing={sendText}
              placeholder="Or type a question…"
              placeholderTextColor="#6B7280"
              editable={!busy && !recorder.isRecording}
              returnKeyType="send"
            />
            {busy ? (
              <ActivityIndicator style={styles.iconButton} color="#fff" />
            ) : (
              <Pressable
                style={styles.iconButton}
                onPress={sendText}
                disabled={recorder.isRecording}
                accessibilityLabel="Send"
              >
                <Ionicons name="send" size={20} color="#fff" />
              </Pressable>
            )}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  sheet: {
    height: '80%',
    backgroundColor: '#F9FAFB',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 18, fontWeight: '700', color: NAVY },
  log: { flex: 1 },
  hint: { color: '#6B7280', textAlign: 'center', marginTop: 24 },
  bubble: { padding: 10, borderRadius: 12, maxWidth: '85%', overflow: 'hidden' },
  user: { alignSelf: 'flex-end', backgroundColor: RED, color: '#fff' },
  ai: { alignSelf: 'flex-start', backgroundColor: '#fff', color: '#111827' },
  status: { color: '#6B7280', fontStyle: 'italic' },
  error: { color: '#B00020' },
  row: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  input: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
    color: '#111827',
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: RED,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recording: { backgroundColor: NAVY },
});
