// Talks to the database API in database/server.mjs (start it with `npm run db`).
// Only these fixed calls exist; the app and the AI never send SQL.
//
//   const { theme, themes, widgets, homepage } = await getHome();
//   const { accounts, transactions } = await getBanking();   // for the widgets only, never the AI
//   await saveTheme('forest');
//   await saveHomepage([1, 5, 7]);   // widget IDs, top first
//   const { userId, name } = await signIn('will@example.com');
//   const { accounts, actions } = await getActions();   // + createAction, updateAction, deleteAction, skipAction ...

import Constants from 'expo-constants';
import { Platform } from 'react-native';

const PORT = 3001;

// EXPO_PUBLIC_DB_URL wins. Otherwise use the machine running Expo: on a phone that is the dev
// server's LAN address (from Expo's hostUri), on web it is the page's own host.
function baseUrl() {
  if (process.env.EXPO_PUBLIC_DB_URL) return process.env.EXPO_PUBLIC_DB_URL.replace(/\/$/, '');
  const host =
    Platform.OS === 'web'
      ? globalThis.location?.hostname
      : Constants.expoConfig?.hostUri?.split(':')[0];
  return `http://${host || 'localhost'}:${PORT}`;
}

async function call(method, path, body) {
  const res = await fetch(`${baseUrl()}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(json.error || `Database API error ${res.status}`), { status: res.status });
  return json;
}

export const getHome = () => call('GET', '/api/home');
export const getBanking = () => call('GET', '/api/banking');
export const saveTheme = (theme) => call('PUT', '/api/theme', { theme });
export const saveHomepage = (widgetIds) => call('PUT', '/api/homepage', { widgets: widgetIds });
export const signIn = (email) => call('PUT', '/api/session', { email });
export const signOut = () => call('DELETE', '/api/session');

// Actions (money automations). Account names only come back here, never balances.
export const getActions = () => call('GET', '/api/actions'); // { accounts: [{ id, name }], actions: [...] }
export const createAction = (action) => call('POST', '/api/actions', action);
export const updateAction = (id, changes) => call('PUT', `/api/actions/${id}`, changes);
export const deleteAction = (id) => call('DELETE', `/api/actions/${id}`);
export const skipAction = (id) => call('POST', `/api/actions/${id}/skip`);
export const dismissActionAlert = (id) => call('POST', `/api/actions/${id}/dismiss`);
export const runActionNow = (id) => call('POST', `/api/actions/${id}/run`);
