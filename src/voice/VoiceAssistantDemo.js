import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { VoiceAssistant } from './index';
import { useVoiceRecorder } from './useVoiceRecorder';

export default function VoiceAssistantDemo() {
  const assistant = useRef(null);
  if (!assistant.current) assistant.current = new VoiceAssistant();
  const recorder = useVoiceRecorder();

  const [input, setInput] = useState('');
  const [log, setLog] = useState([]);
  const [busy, setBusy] = useState(null); // null | 'Transcribing…' | 'Thinking…'
  const [error, setError] = useState(null);

  const addMessage = (role, text) => setLog((l) => [...l, { role, text }]);

  async function run(task) {
    setError(null);
    try {
      await task();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  }

  function sendText() {
    const text = input.trim();
    if (!text || busy) return;
    setInput('');
    addMessage('user', text);
    setBusy('Thinking…');
    run(async () => addMessage('ai', await assistant.current.ask(text)));
  }

  function toggleMic() {
    if (busy) return;
    if (!recorder.isRecording) {
      run(() => recorder.start());
      return;
    }
    setBusy('Transcribing…');
    run(async () => {
      const uri = await recorder.stop();
      const { reply } = await assistant.current.respondToRecording(uri, {
        onTranscript: (transcript) => {
          addMessage('user', transcript);
          setBusy('Thinking…');
        },
      });
      addMessage('ai', reply);
    });
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.log} contentContainerStyle={{ gap: 8 }}>
        {log.map((m, i) => (
          <Text key={i} style={[styles.bubble, m.role === 'user' ? styles.user : styles.ai]}>
            {m.text}
          </Text>
        ))}
        {busy && <Text style={styles.status}>{busy}</Text>}
        {recorder.isRecording && <Text style={styles.status}>Listening… tap ■ to send</Text>}
        {error && <Text style={styles.error}>{error}</Text>}
      </ScrollView>

      <View style={styles.row}>
        <Pressable
          style={[styles.button, recorder.isRecording && styles.recording]}
          onPress={toggleMic}
          disabled={!!busy}
          accessibilityLabel={recorder.isRecording ? 'Stop recording' : 'Start recording'}
        >
          <Text style={styles.buttonText}>{recorder.isRecording ? '■' : '🎤'}</Text>
        </Pressable>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          onSubmitEditing={sendText}
          placeholder="Or type a message…"
          editable={!busy && !recorder.isRecording}
        />
        {busy ? (
          <ActivityIndicator style={styles.button} color="#fff" />
        ) : (
          <Pressable style={styles.button} onPress={sendText} disabled={recorder.isRecording}>
            <Text style={styles.buttonText}>Send</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, paddingTop: 64, gap: 12, alignSelf: 'stretch' },
  log: { flex: 1 },
  bubble: { padding: 10, borderRadius: 12, maxWidth: '85%' },
  user: { alignSelf: 'flex-end', backgroundColor: '#D5002B', color: '#fff' },
  ai: { alignSelf: 'flex-start', backgroundColor: '#f0f0f0', color: '#111' },
  status: { color: '#666', fontStyle: 'italic' },
  error: { color: '#b00020' },
  row: { flexDirection: 'row', gap: 8 },
  input: { flex: 1, borderWidth: 1, borderColor: '#ccc', borderRadius: 8, paddingHorizontal: 12, height: 44 },
  button: {
    backgroundColor: '#D5002B',
    borderRadius: 8,
    paddingHorizontal: 14,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 52,
  },
  recording: { backgroundColor: '#7a0019' },
  buttonText: { color: '#fff', fontWeight: '600' },
});
