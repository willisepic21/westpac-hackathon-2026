// Turns the signed-in user's accounts and transactions from the database (GET /api/banking) into the
// same shapes as mockData.js, so the widgets don't care where their numbers come from.
// Only accounts and transactions are in the database; bills, goal targets, budgets, contacts and
// transfers have no tables yet, so those still come from mockData.js.
// Pure JS so it can be tested in Node (see tests/personalise.test.mjs).

import * as MOCK from './mockData.js';

// Which pinnable kind (question 3) a Westpac product is, from its name.
export function accountKind(type) {
  if (/card|altitude/i.test(type)) return 'credit';
  if (/loan/i.test(type)) return 'loan';
  if (/life|saver|term deposit/i.test(type)) return 'savings';
  return 'everyday';
}

// "31/10/2026" (what app.db holds) or "2026-10-31" -> Date at local midnight.
export function parseDate(s) {
  const dmy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  if (dmy) return new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]));
  const ymd = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (ymd) return new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]));
  return new Date(NaN);
}

const DAY = 24 * 60 * 60 * 1000;
const sameDay = (a, b) => a.getTime() === b.getTime();
const shortDate = (d) => d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });

// Moving money between your own accounts isn't spending.
const isOwnTransfer = (name) => /^payment (to|from) westpac /i.test(name ?? '');

/**
 * { accounts: [{ account_ID, account_type, balance }], transactions: [{ transaction_ID, account_ID, amount,
 * date, name, negative }] } -> { ACCOUNTS, TRANSACTIONS, WEEKLY, GOALS, NET_WORTH, ... } like mockData.js.
 *
 * "Today" is the latest transaction date, so the spending widgets still have something to show if the demo
 * runs after the fake data ends. Pass `today` to use a real date instead.
 */
export function fromDatabase({ accounts, transactions }, { today } = {}) {
  const byId = new Map(accounts.map((a) => [a.account_ID, a]));

  const txns = transactions
    .map((t) => ({
      id: `t${t.transaction_ID}`,
      date: parseDate(t.date),
      name: t.name ?? 'Transaction',
      account: byId.get(t.account_ID)?.account_type ?? '',
      amount: t.negative ? -t.amount : t.amount,
      raw: t,
    }))
    .filter((t) => !Number.isNaN(t.date.getTime()))
    .sort((a, b) => b.date - a.date || b.raw.transaction_ID - a.raw.transaction_ID);

  const anchor = today ?? txns[0]?.date ?? new Date();
  const weekStart = new Date(anchor.getTime() - ((anchor.getDay() + 6) % 7) * DAY); // Monday
  const spending = txns.filter((t) => t.amount < 0 && !isOwnTransfer(t.name) && t.date <= anchor);
  const spent = (list) => Math.round(list.reduce((sum, t) => sum - t.amount, 0) * 100) / 100;

  const thisWeek = spending.filter((t) => t.date >= weekStart);
  const thisMonth = spending.filter(
    (t) => t.date.getMonth() === anchor.getMonth() && t.date.getFullYear() === anchor.getFullYear(),
  );

  // Biggest places this week stand in for categories (the database has none).
  const places = new Map();
  thisWeek.forEach((t) => {
    const p = places.get(t.name) ?? { name: t.name, amount: 0, count: 0 };
    p.amount -= t.amount;
    p.count += 1;
    places.set(t.name, p);
  });
  const topPlaces = [...places.values()]
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 2)
    .map((p) => ({ name: p.name, amount: p.amount, note: `${p.count} payment${p.count > 1 ? 's' : ''} this week` }));

  // ACCOUNTS is keyed by kind (everyday / savings / credit) like the mock, using the user's first account of
  // each kind. The database has no joint accounts, so pinning "joint" shows nothing.
  const ACCOUNTS = {};
  accounts.forEach((a) => {
    const kind = accountKind(a.account_type);
    if (ACCOUNTS[kind]) return;
    ACCOUNTS[kind] = { id: kind, name: a.account_type, balance: a.balance };
  });

  // A loan's balance is what is owed; any other negative balance is debt too.
  let assets = 0;
  let debt = 0;
  accounts.forEach((a) => {
    if (accountKind(a.account_type) === 'loan') debt += Math.abs(a.balance);
    else if (a.balance >= 0) assets += a.balance;
    else debt -= a.balance;
  });
  const monthChange = txns
    .filter((t) => t.date.getMonth() === anchor.getMonth() && t.date.getFullYear() === anchor.getFullYear())
    .reduce((sum, t) => sum + t.amount, 0);

  const when = (d) => {
    if (sameDay(d, anchor)) return 'Today';
    if (sameDay(d, new Date(anchor.getTime() - DAY))) return 'Yesterday';
    return shortDate(d);
  };

  return {
    ...MOCK,
    ACCOUNTS,
    TOTAL_AVAILABLE: accounts
      .filter((a) => accountKind(a.account_type) !== 'loan' && a.balance > 0)
      .reduce((sum, a) => sum + a.balance, 0),
    TRANSACTIONS: txns.map(({ id, name, account, amount, date }) => ({ id, name, amount, when: when(date), category: account })),
    WEEKLY: { ...MOCK.WEEKLY, spent: spent(thisWeek), categories: topPlaces },
    GOALS: {
      ...MOCK.GOALS,
      spending: {
        ...MOCK.GOALS.spending,
        spentToday: spent(spending.filter((t) => sameDay(t.date, anchor))),
        spentMonth: spent(thisMonth),
      },
    },
    NET_WORTH: { assets, debt, changeThisMonth: Math.round(monthChange * 100) / 100 },
    fromDatabase: true,
  };
}

// Mock data in the same shape, used until the database answers (or if it can't be reached).
export const MOCK_DATA = {
  ...MOCK,
  TOTAL_AVAILABLE: Object.values(MOCK.ACCOUNTS)
    .filter((a) => a.balance > 0)
    .reduce((sum, a) => sum + a.balance, 0),
  fromDatabase: false,
};
