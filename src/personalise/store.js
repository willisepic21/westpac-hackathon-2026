// Holds the finalised onboarding answers outside React, so the personalised home
// survives switching tabs (App.js unmounts HomeScreen when you leave the Home tab).
// In-memory only: answers reset when the app reloads.

import { useSyncExternalStore } from 'react';

import { DEFAULT_ANSWERS } from './questions';

// null = standard home, otherwise { answers, sections? }.
// `sections` is set when the AI assistant adds / removes / moves widgets; it replaces the template's list.
let state = null;
const listeners = new Set();

const subscribe = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const emit = (next) => {
  state = next;
  listeners.forEach((l) => l());
};

// Finalising the questions picks a fresh template, so any AI widget edits are dropped.
export function setPersonalisation(answers) {
  emit(answers ? { answers } : null);
}

// Save the AI's edited widget list. From the standard home this starts a personalised home with default answers.
export function setHomeSections(sections) {
  emit({ answers: state?.answers ?? DEFAULT_ANSWERS, sections });
}

export function getPersonalisation() {
  return state;
}

export function usePersonalisation() {
  return useSyncExternalStore(subscribe, () => state, () => state);
}
