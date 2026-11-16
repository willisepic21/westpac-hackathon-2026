// Holds the finalised onboarding answers outside React, so the personalised home
// survives switching tabs (App.js unmounts HomeScreen when you leave the Home tab).
// In-memory only: answers reset when the app reloads.

import { useSyncExternalStore } from 'react';

let state = null; // null = standard home, otherwise { answers }
const listeners = new Set();

const subscribe = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export function setPersonalisation(answers) {
  state = answers ? { answers } : null;
  listeners.forEach((l) => l());
}

export function usePersonalisation() {
  return useSyncExternalStore(subscribe, () => state, () => state);
}
