// Web: the recording URI is a blob: URL (WebM audio), so fetch it into a Blob first.
export async function audioFormData(uri) {
  const blob = await (await fetch(uri)).blob();
  const form = new FormData();
  form.append('file', blob, 'recording.webm');
  return form;
}
