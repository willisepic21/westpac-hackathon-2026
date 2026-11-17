// Who is signed in to the app (null = show the sign-in screen).
// Signing in sets the database's `session` user (PUT /api/session), then loads that user's home and banking data.
// Demo only: the users table has no passwords, so the email alone picks the user.

import { useSyncExternalStore } from 'react';

import * as db from './db/client';
import { refreshActions } from './actions/store';
import { navigate } from './navigation';
import { clearLocal, loadFromDatabase } from './personalise/store';

let user = null; // { userId, name, email, offline? }
const listeners = new Set();

const emit = (next) => {
  user = next;
  listeners.forEach((l) => l());
};

// Resolves once signed in; throws (with the API's message) for an unknown email.
// If the database API can't be reached at all, signs in offline so the app still demos with mock data.
export async function signIn(email) {
  let next;
  try {
    next = { ...(await db.signIn(email)), email };
  } catch (e) {
    if (e.status) throw e;
    console.warn(`Could not reach the database (is \`npm run db\` running?), signing in offline: ${e.message}`);
    next = { userId: null, name: null, email, offline: true };
  }
  clearLocal();
  navigate('Home');
  emit(next);
  if (!next.offline) {
    loadFromDatabase();
    refreshActions(); // the Actions list + alert are per user
  }
  return next;
}

// Clears the signed-in user from the database's session table, then shows the sign-in page.
// Waits for the database first, so a quick sign-in afterwards can't be wiped by a late sign-out.
export async function signOut() {
  if (user && !user.offline) {
    try {
      await db.signOut();
    } catch (e) {
      console.warn(`Could not clear the session in the database: ${e.message}`);
    }
  }
  clearLocal();
  emit(null);
}

export function useUser() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => user,
    () => user,
  );
}
