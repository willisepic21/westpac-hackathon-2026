// Actions state for the app: the user's actions (from the database API), refreshed every minute, plus the
// AI's pending proposal waiting for the user's approval.
//
//   const { accounts, actions, error } = useActions();
//   await createAction({ kind: 'sweep', from: 1, to: 2, threshold: 500, frequency: 'weekly' });
//   const proposal = usePendingProposal();   // shown as an approval card in the assistant

import { useSyncExternalStore } from 'react';

import * as db from '../db/client';
import { describeAction, describeSchedule, normaliseAction } from './rules';

let state = { accounts: [], actions: [], loaded: false, error: null };
// { action, description, schedule, editId?, resolve } while the AI waits for the user to approve.
let pending = null;
const listeners = new Set();

const subscribe = (l) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const emit = () => listeners.forEach((l) => l());

export async function refreshActions() {
  try {
    const { accounts, actions } = await db.getActions();
    state = { accounts, actions, loaded: true, error: null };
  } catch (e) {
    state = { ...state, loaded: true, error: `Couldn't reach the database (is \`npm run db\` running?): ${e.message}` };
  }
  emit();
  return state;
}

// Every change goes to the database, then the list is reloaded so it matches exactly.
const change = async (promise) => {
  try {
    return await promise;
  } finally {
    await refreshActions();
  }
};

export const createAction = (action) => change(db.createAction(action));
export const updateAction = (id, changes) => change(db.updateAction(id, changes));
export const deleteAction = (id) => change(db.deleteAction(id));
export const skipAction = (id) => change(db.skipAction(id));
export const dismissActionAlert = (id) => change(db.dismissActionAlert(id));
export const runActionNow = (id) => change(db.runActionNow(id));

let polling = null;
/** Called once from App.js: loads actions now and every minute (so the "about to run" alert appears on time). */
export function startActionPolling() {
  if (polling) return;
  refreshActions();
  polling = setInterval(refreshActions, 60_000);
}

export const getActionsState = () => state;
export const useActions = () => useSyncExternalStore(subscribe, () => state, () => state);

export const nameOf = (accounts, id) => accounts.find((a) => a.id === id)?.name ?? 'a closed account';

// ---- AI proposals: the AI never saves an action itself; the user approves it on a card first ----

/**
 * Shows the AI's action on an approval card and resolves with { approved, message } once the user decides.
 * `input` may use account names. Throws (back to the AI) if the action isn't valid.
 */
export async function proposeAction(input, { editId } = {}) {
  const { accounts, actions } = await refreshActions();
  if (state.error) throw new Error(state.error);
  const existing = editId != null ? actions.find((a) => a.id === Number(editId)) : null;
  if (editId != null && !existing) throw new Error(`There is no action ${editId}.`);
  const action = normaliseAction({ ...existing, ...input, nextRun: input.nextRun ?? existing?.nextRun }, accounts);

  pending?.resolve({ approved: false, message: 'Replaced by a newer suggestion.' });
  return new Promise((resolve) => {
    pending = {
      action,
      editId: existing?.id,
      description: describeAction(action, (id) => nameOf(accounts, id)),
      schedule: describeSchedule(action),
      resolve: (result) => {
        pending = null;
        emit();
        resolve(result);
      },
    };
    emit();
  });
}

export async function approveProposal() {
  if (!pending) return;
  const { action, editId, resolve } = pending;
  try {
    if (editId != null) await updateAction(editId, action);
    else await createAction({ ...action, createdBy: 'ai' });
    resolve({ approved: true, message: editId != null ? 'Action updated.' : 'Action set up.' });
  } catch (e) {
    resolve({ approved: false, message: `Saving failed: ${e.message}` });
  }
}

export function declineProposal() {
  pending?.resolve({ approved: false, message: 'The user declined.' });
}

export const usePendingProposal = () => useSyncExternalStore(subscribe, () => pending, () => pending);
