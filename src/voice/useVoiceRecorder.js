import { useState } from 'react';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
} from 'expo-audio';

/**
 * Microphone recording for speech-to-text.
 *   const { isRecording, start, stop } = useVoiceRecorder();
 *   await start();            // asks for mic permission the first time
 *   const uri = await stop(); // local file (native) or blob: URL (web)
 */
export function useVoiceRecorder() {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [isRecording, setIsRecording] = useState(false);

  async function start() {
    const { granted } = await requestRecordingPermissionsAsync();
    if (!granted) throw new Error('Microphone permission was denied.');
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
    setIsRecording(true);
  }

  async function stop() {
    await recorder.stop();
    setIsRecording(false);
    await setAudioModeAsync({ allowsRecording: false });
    if (!recorder.uri) throw new Error('Recording failed: no audio was saved.');
    return recorder.uri;
  }

  return { isRecording, start, stop };
}
