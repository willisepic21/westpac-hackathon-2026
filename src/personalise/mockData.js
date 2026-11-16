// Mock banking data for the personalised home widgets. Accounts, transactions and spending are replaced by the
// database once it loads (see bankData.js); the rest has no database tables yet.

export const ACCOUNTS = {
  everyday: { id: 'everyday', name: 'Everyday', number: '•• 4821', balance: 2840.5, available: 2840.5 },
  savings: { id: 'savings', name: 'Home savings', number: '•• 9302', balance: 8500 },
  credit: { id: 'credit', name: 'Altitude Black', number: '•• 7710', balance: -2400, available: 12600 },
  joint: {
    id: 'joint',
    name: 'Shared bills',
    number: '•• 1950',
    balance: 1500,
    joint: true,
    note: 'Enough for your $691 upcoming bills.',
  },
};

export const GOALS = {
  house: { saved: 8500, target: 25000, account: 'Home savings · •• 9302', weeklyDeposit: 250 },
  debt: { paid: 3600, total: 6000, nextPayment: 300, nextDate: '28 Nov', interestSaved: 184 },
  spending: { spentToday: 48, dailyBudget: 75, spentMonth: 1412, monthlyBudget: 2250 },
};

export const WEEKLY = {
  spent: 384,
  budget: 600,
  resetDay: 'Sunday',
  categories: [
    { name: 'Groceries', amount: 142, note: '$18 less than last week' },
    { name: 'Eating out', amount: 86, note: '$12 more than last week' },
  ],
};

export const TRANSACTIONS = [
  { id: 't1', name: 'Market Lane', when: 'Today', category: 'Coffee', amount: -6.5 },
  { id: 't2', name: 'Woolworths', when: 'Today', category: 'Groceries', amount: -41.5 },
  { id: 't3', name: 'Salary', when: 'Yesterday', category: 'Income', amount: 2450 },
  { id: 't4', name: 'Opal', when: 'Yesterday', category: 'Transport', amount: -9.2 },
  { id: 't5', name: 'Netflix', when: 'Mon', category: 'Subscriptions', amount: -18.99 },
];

export const BILLS = {
  month: 'November',
  items: [
    { id: 'b1', name: 'Rent', date: '23 Nov', amount: 520 },
    { id: 'b2', name: 'Internet', date: '24 Nov', amount: 75 },
    { id: 'b3', name: 'Electricity', date: '28 Nov', amount: 96 },
  ],
};

export const NET_WORTH = { assets: 38840.5, debt: 2400, changeThisMonth: 1240 };

export const CONTACTS = [
  { id: 'c1', name: 'Jamie', payId: 'jamie@email.com' },
  { id: 'c2', name: 'Sam', payId: '0412 345 678' },
  { id: 'c3', name: 'Priya', payId: 'priya@email.com' },
  { id: 'c4', name: 'Alex', payId: '0498 765 432' },
];

// The "usual transfer" the 1-tap slider makes, depending on the money goal.
export const TRANSFERS = {
  house: { from: 'Everyday', to: 'Home savings', amount: 250, short: 'savings' },
  debt: { from: 'Everyday', to: 'Altitude Black', amount: 300, short: 'your card' },
  spending: { from: 'Everyday', to: 'Savings', amount: 50, short: 'savings' },
};
