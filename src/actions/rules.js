// Actions = money automations, e.g. "if Westpac Choice is over $500, move the extra to Westpac Life weekly".
// Pure JS shared by the database server (which runs them), the app and the tests.
//
// An action: { id, kind, from, to, threshold, amount, frequency, nextRun, createdBy, alertDismissedFor }
//   kind:      'sweep'    if `from` is over `threshold`, move the extra to `to`
//              'top_up'   if `to` is under `threshold`, top it up from `from`
//              'transfer' move a fixed `amount` from `from` to `to`
//   from / to: account IDs (always the user's own accounts)
//   nextRun:   ISO date (yyyy-mm-dd); actions run at RUN_HOUR on that day

import { accountKind } from '../personalise/bankData.js';

export const KINDS = {
  sweep: { label: 'Move the extra', needs: 'threshold' },
  top_up: { label: 'Top up', needs: 'threshold' },
  transfer: { label: 'Regular transfer', needs: 'amount' },
};
export const FREQUENCIES = ['daily', 'weekly', 'monthly'];
export const RUN_HOUR = 9; // 9am local time
// How long before a run the user gets the "about to run" alert.
export const ALERT_WINDOW_MS = 24 * 60 * 60 * 1000;

const pad = (n) => String(n).padStart(2, '0');

export const isoDate = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

export function parseIso(iso) {
  const [y, m, d] = String(iso).split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** When an action due on `iso` actually runs (RUN_HOUR local time). */
export const runTime = (iso) => {
  const d = parseIso(iso);
  d.setHours(RUN_HOUR, 0, 0, 0);
  return d;
};

/** The next run after `iso` for a frequency. Monthly keeps the day, clamped to the month's length. */
export function addPeriod(iso, frequency) {
  const d = parseIso(iso);
  if (frequency === 'daily') d.setDate(d.getDate() + 1);
  else if (frequency === 'weekly') d.setDate(d.getDate() + 7);
  else {
    const day = d.getDate();
    d.setDate(1);
    d.setMonth(d.getMonth() + 1);
    d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
  }
  return isoDate(d);
}

/** The first run for a new action: today if it is still before RUN_HOUR, otherwise tomorrow. */
export function firstRun(now = new Date()) {
  const d = new Date(now);
  if (d.getHours() >= RUN_HOUR) d.setDate(d.getDate() + 1);
  return isoDate(d);
}

export const money = (n) =>
  `$${Number(n).toLocaleString('en-AU', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;

const round = (n) => Math.round(n * 100) / 100;

/**
 * Checks an action (from a form or the AI) against the user's accounts and returns a clean copy.
 * `from` / `to` may be account IDs or names ("Westpac Life", "life"). Throws a readable Error if invalid.
 * accounts: [{ id, name }]
 */
export function normaliseAction(input, accounts, { now = new Date() } = {}) {
  const kind = input.kind;
  if (!KINDS[kind]) throw new Error(`Unknown action type "${kind}". Use sweep, top_up or transfer.`);

  const findAccount = (ref, role) => {
    if (ref == null || ref === '') throw new Error(`Choose the account to move money ${role}.`);
    const byId = accounts.find((a) => String(a.id) === String(ref));
    if (byId) return byId.id;
    const strip = (s) => s.toLowerCase().replace(/^westpac\b/, '').replace(/\b(account|acc)\b/g, '').trim();
    const q = strip(String(ref)).replace(/^my\s+/, '');
    let matches = accounts.filter((a) => strip(a.name).includes(q));
    // "savings", "everyday", "credit card": match on the kind of account.
    if (!matches.length) {
      const kind = /sav/.test(q) ? 'savings' : /every|spend|transaction/.test(q) ? 'everyday' : /credit|card/.test(q) ? 'credit' : null;
      if (kind) matches = accounts.filter((a) => accountKind(a.name) === kind);
    }
    if (matches.length === 1) return matches[0].id;
    const names = accounts.map((a) => a.name).join(', ');
    throw new Error(
      matches.length
        ? `"${ref}" matches more than one account (${matches.map((a) => a.name).join(', ')}).`
        : `"${ref}" isn't one of your accounts. Your accounts are: ${names}.`,
    );
  };

  const from = findAccount(input.from, 'from');
  const to = findAccount(input.to, 'to');
  if (from === to) throw new Error('The from and to accounts must be different.');

  const frequency = input.frequency ?? 'weekly';
  if (!FREQUENCIES.includes(frequency)) throw new Error('How often must be daily, weekly or monthly.');

  const positive = (value, label) => {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) throw new Error(`${label} must be more than $0.`);
    if (n > 1_000_000) throw new Error(`${label} must be $1,000,000 or less.`);
    return round(n);
  };

  const needsAmount = KINDS[kind].needs === 'amount';
  const nextRun = input.nextRun ?? firstRun(now);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(nextRun) || Number.isNaN(parseIso(nextRun).getTime())) {
    throw new Error('The next run must be a date like 2026-11-20.');
  }

  return {
    kind,
    from,
    to,
    threshold: needsAmount ? null : positive(input.threshold, kind === 'sweep' ? 'The balance to keep' : 'The minimum balance'),
    amount: needsAmount ? positive(input.amount, 'The amount') : null,
    frequency,
    nextRun,
  };
}

/** One-sentence description, e.g. "If Westpac Choice is over $500, move the extra to Westpac Life." */
export function describeAction(action, nameOf) {
  const from = nameOf(action.from);
  const to = nameOf(action.to);
  if (action.kind === 'sweep') return `If ${from} is over ${money(action.threshold)}, move the extra to ${to}.`;
  if (action.kind === 'top_up') return `If ${to} drops below ${money(action.threshold)}, top it up from ${from}.`;
  return `Move ${money(action.amount)} from ${from} to ${to}.`;
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatDay(iso, now = new Date()) {
  const d = parseIso(iso);
  if (iso === isoDate(now)) return 'today';
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (iso === isoDate(tomorrow)) return 'tomorrow';
  return `${DAY_NAMES[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** e.g. "Every week · next tomorrow at 9am" */
export function describeSchedule(action, now = new Date()) {
  const every = { daily: 'Every day', weekly: 'Every week', monthly: 'Every month' }[action.frequency];
  return `${every} · next ${formatDay(action.nextRun, now)} at ${RUN_HOUR}am`;
}

/** Label for the "skip" button, e.g. "Skip this week". */
export const skipLabel = (frequency) =>
  ({ daily: 'Skip today', weekly: 'Skip this week', monthly: 'Skip this month' })[frequency] ?? 'Skip this time';

/**
 * Works out what a run would do with the current balances (Map or object: account id -> balance).
 * Returns { status: 'moved' | 'nothing' | 'failed', amount, note }. Never overdraws the from account.
 */
export function planRun(action, balances) {
  const bal = (id) => Number(balances instanceof Map ? balances.get(id) : balances[id]);
  const fromBalance = bal(action.from);
  const toBalance = bal(action.to);
  if (!Number.isFinite(fromBalance) || !Number.isFinite(toBalance)) {
    return { status: 'failed', amount: 0, note: 'One of the accounts no longer exists.' };
  }

  let want;
  if (action.kind === 'sweep') want = fromBalance - action.threshold;
  else if (action.kind === 'top_up') want = action.threshold - toBalance;
  else want = action.amount;
  want = round(want);

  if (want <= 0) {
    const note =
      action.kind === 'sweep'
        ? `Balance was ${money(fromBalance)}, not over ${money(action.threshold)}.`
        : `Balance was ${money(toBalance)}, already at least ${money(action.threshold)}.`;
    return { status: 'nothing', amount: 0, note };
  }
  if (action.kind === 'transfer' && fromBalance < want) {
    return { status: 'failed', amount: 0, note: `Not enough money: ${money(fromBalance)} available.` };
  }
  const amount = round(Math.min(want, Math.max(fromBalance, 0)));
  if (amount <= 0) return { status: 'failed', amount: 0, note: 'Nothing available to move.' };
  return { status: 'moved', amount, note: amount < want ? `Moved what was available (wanted ${money(want)}).` : null };
}

/** True when the action runs within ALERT_WINDOW_MS and the user hasn't dismissed this run's alert. */
export function needsAlert(action, now = new Date()) {
  const ms = runTime(action.nextRun) - now;
  return ms > 0 && ms <= ALERT_WINDOW_MS && action.alertDismissedFor !== action.nextRun;
}
