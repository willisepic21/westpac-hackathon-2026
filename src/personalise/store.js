// Holds the finalised onboarding answers outside React, so the personalised home
// survives switching tabs (App.js unmounts HomeScreen when you leave the Home tab).
// The theme and the widgets on Home are also saved to the database (via database/server.mjs) and
// restored by loadFromDatabase() when the app starts. The onboarding answers themselves stay in memory.
// It also holds the signed-in user's accounts and transactions for the widgets (useBankData()).
// If the database API isn't running, everything still works, it just resets on reload.

import { useSyncExternalStore } from 'react';

import * as db from '../db/client';
import { MOCK_DATA, fromDatabase } from './bankData';
import { buildHome } from './buildHome';
import { DEFAULT_ANSWERS } from './questions';
import { WIDGETS, newSection, widgetType } from './widgetCatalog';

// null = standard home, otherwise { answers, sections? }.
// `sections` is set when the AI assistant adds / removes / moves widgets; it replaces the template's list.
let state = null;
// The saved theme, applied when a standard home becomes personalised by the AI.
let savedTheme = null;
// Numbers shown in the widgets: mock data until the database answers.
let bank = MOCK_DATA;
const listeners = new Set();

const subscribe = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const emit = (next) => {
  state = next;
  listeners.forEach((l) => l());
};

const startingAnswers = () => (savedTheme ? { ...DEFAULT_ANSWERS, palette: savedTheme } : DEFAULT_ANSWERS);
const currentHome = () => buildHome(state.answers, { sections: state.sections });

// Resolves true once saved, false (with a warning) if the database API can't be reached.
const save = (what, promise) =>
  promise.then(
    () => true,
    (e) => {
      console.warn(`Could not save ${what} to the database: ${e.message}`);
      return false;
    },
  );

// Writes the widgets now on Home, top first (none on the standard home).
const saveWidgets = () =>
  save('home widgets', db.saveHomepage(state ? currentHome().sections.map((s) => WIDGETS[s.type].id) : []));

const saveCurrentTheme = () => {
  savedTheme = currentHome().paletteKey;
  return save('theme', db.saveTheme(savedTheme));
};

const all = async (...saves) => (await Promise.all(saves)).every(Boolean);

// Finalising the questions picks a fresh template, so any AI widget edits are dropped.
export function setPersonalisation(answers) {
  emit(answers ? { answers } : null);
  return answers ? all(saveWidgets(), saveCurrentTheme()) : saveWidgets();
}

// Save the AI's edited widget list. From the standard home this starts a personalised home with default answers.
export function setHomeSections(sections) {
  emit({ answers: state?.answers ?? startingAnswers(), sections });
  return saveWidgets();
}

// Save the AI's theme choice (a PALETTES key). From the standard home this starts a personalised home.
export function setTheme(theme) {
  const wasStandard = !state;
  emit({ ...state, answers: { ...(state?.answers ?? DEFAULT_ANSWERS), palette: theme } });
  return wasStandard ? all(saveCurrentTheme(), saveWidgets()) : saveCurrentTheme();
}

// The widgets and themes the database offers, for the AI.
export async function getCatalog() {
  const { widgets, themes } = await db.getHome();
  return { widgets, themes };
}

// Called once at start-up: loads the widgets' banking data, restores the saved theme and, if there are saved
// widgets, the personalised home.
export async function loadFromDatabase() {
  await Promise.all([loadHome(), loadBanking()]);
}

async function loadBanking() {
  try {
    bank = fromDatabase(await db.getBanking());
    listeners.forEach((l) => l());
  } catch (e) {
    console.warn(`Could not load accounts from the database, showing mock data: ${e.message}`);
  }
}

async function loadHome() {
  try {
    const { theme, homepage } = await db.getHome();
    savedTheme = theme;
    const types = homepage.map(widgetType).filter(Boolean);
    // Don't overwrite anything the user already changed while this was loading.
    if (state || !types.length) return;
    emit({ answers: startingAnswers(), sections: types.map((type) => newSection(type)) });
  } catch (e) {
    console.warn(`Could not load the home from the database (is \`npm run db\` running?): ${e.message}`);
  }
}

export function getPersonalisation() {
  return state;
}

// Accounts, transactions, goals etc. for the widgets, in the same shape as mockData.js.
export function useBankData() {
  return useSyncExternalStore(subscribe, () => bank, () => bank);
}

export function usePersonalisation() {
  return useSyncExternalStore(subscribe, () => state, () => state);
}
