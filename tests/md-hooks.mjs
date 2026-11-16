// Node loader hooks: import .md files as a default-exported string (matches md-transformer.js in Metro).
// Registered by register-md.mjs.
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

export async function load(url, context, nextLoad) {
  if (url.endsWith('.md')) {
    const text = await readFile(fileURLToPath(url), 'utf8');
    return { format: 'module', source: `export default ${JSON.stringify(text)};`, shortCircuit: true };
  }
  return nextLoad(url, context);
}
