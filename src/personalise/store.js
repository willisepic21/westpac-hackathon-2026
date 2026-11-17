// Holds the finalised onboarding answers outside React, so the personalised home
// survives switching tabs (App.js unmounts HomeScreen when you leave the Home tab).
// The theme and the widgets on Home are also saved to the database (via database/server.mjs) and
// restored by loadFromDatabase() when the app starts. The onboarding answers themselves stay in memory.
// It also holds the signed-in user's accounts and transactions for the widgets (useBankData()).
// If the database API isn't running, everything still works, it just resets on reload.

import { useSyncExternalStore } from 'react';

import * as db from '../db/client';
import { MOCK_DATA, fromDatabase } from './bankData';
import { buildHome, STANDARD_ANSWERS, standardSections } from './buildHome';
import { WIDGETS, newSection, widgetType } from './widgetCatalog';

// null = standard home (every widget, see buildStandardHome()), otherwise { answers, sections? }.
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

const startingAnswers = () => (savedTheme ? { ...STANDARD_ANSWERS, palette: savedTheme } : STANDARD_ANSWERS);
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

// Writes the widgets now on Home, top first, with each one's style (none on the standard home).
const saveWidgets = () =>
  save(
    'home widgets',
    db.saveHomepage(
      state
        ? currentHome().sections.map((s) => ({ id: WIDGETS[s.type].id, variant: s.variant ?? null, count: s.count ?? null }))
        : [],
    ),
  );

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

// Save the AI's theme choice (a PALETTES key). From the standard home this starts a personalised home
// with the standard home's widgets.
export function setTheme(theme) {
  const wasStandard = !state;
  emit({
    answers: { ...(state?.answers ?? STANDARD_ANSWERS), palette: theme },
    sections: state ? state.sections : standardSections(),
  });
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

// A section from a saved widget, keeping its style if the widget still supports it.
const savedSection = ({ type, variant, count }) => {
  const section = newSection(type, variant ?? undefined);
  if (type === 'recent' && count) section.count = count;
  return section;
};

async function loadHome() {
  try {
    const { theme, homepage, homepageSettings, wallpaper: savedWallpaper } = await db.getHome();
    savedTheme = theme;
    wallpaper = savedWallpaper ?? 0;
    listeners.forEach((l) => l());
    // homepageSettings has each widget's saved style; older servers only send the IDs in `homepage`.
    const saved = (homepageSettings ?? homepage.map((id) => ({ id })))
      .map((w) => ({ ...w, type: widgetType(w.id) }))
      .filter((w) => w.type);
    // Don't overwrite anything the user already changed while this was loading.
    if (state || !saved.length) return;
    emit({ answers: startingAnswers(), sections: saved.map(savedSection) });
  } catch (e) {
    console.warn(`Could not load the home from the database (is \`npm run db\` running?): ${e.message}`);
  }
}

// Signing out (or in as someone else): forget the last user's home and banking data, without saving.
export function clearLocal() {
  savedTheme = null;
  wallpaper = 0;
  bank = MOCK_DATA;
  emit(null);
}

// ---- Home wallpaper (More > Wallpaper). 0 = none, n = WALLPAPERS entry with id n (src/personalise/wallpapers.js) ----

let wallpaper = 0;

export const useWallpaper = () => useSyncExternalStore(subscribe, () => wallpaper, () => wallpaper);

/** Shows the wallpaper straight away and saves it; resolves false if the database couldn't be reached. */
export function setWallpaper(n) {
  wallpaper = n;
  listeners.forEach((l) => l());
  return save('wallpaper', db.saveWallpaper(n));
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
