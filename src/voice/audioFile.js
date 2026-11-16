// Native (iOS/Android): React Native's FormData uploads a local file from { uri, name, type }.
// expo-audio's HIGH_QUALITY preset records AAC in an .m4a file on both platforms.
export async function audioFormData(uri) {
  const form = new FormData();
  form.append('file', { uri, name: 'recording.m4a', type: 'audio/m4a' });
  return form;
}
