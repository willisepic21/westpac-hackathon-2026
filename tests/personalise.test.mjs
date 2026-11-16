import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildHome, prioritise, rankTemplates } from '../src/personalise/buildHome.js';
import { TEMPLATES } from '../src/personalise/templates.js';
import { QUESTIONS, DEFAULT_ANSWERS } from '../src/personalise/questions.js';

const answers = (overrides) => ({ ...DEFAULT_ANSWERS, ...overrides });
const types = (home) => home.sections.map((s) => s.type);

test('every goal + frequency combination has its own template', () => {
  for (const goal of ['house', 'debt', 'spending']) {
    for (const frequency of ['daily', 'weekly', 'monthly']) {
      const t = rankTemplates(answers({ goal, frequency }))[0];
      assert.equal(t.goal, goal, `${goal}/${frequency} picked ${t.id}`);
      assert.equal(t.frequency, frequency, `${goal}/${frequency} picked ${t.id}`);
    }
  }
});

test('Figma mockups are picked for their answers', () => {
  assert.equal(buildHome(answers({ goal: 'spending', frequency: 'daily' })).template.id, 'daily-checkin');
  assert.equal(buildHome(answers({ goal: 'house', frequency: 'weekly' })).template.id, 'room-for-home');
  assert.equal(buildHome(answers({ goal: 'debt', frequency: 'daily' })).template.id, 'debt-freedom');
});

test('template ids are unique and there are 10', () => {
  assert.equal(TEMPLATES.length, 10);
  assert.equal(new Set(TEMPLATES.map((t) => t.id)).size, 10);
});

test('daily puts recent transactions before bills / net worth; monthly the reverse', () => {
  const sections = [{ type: 'goal' }, { type: 'bills' }, { type: 'pinned' }, { type: 'recent' }, { type: 'netWorth' }];
  assert.deepEqual(prioritise(sections, 'daily').map((s) => s.type), ['goal', 'recent', 'pinned', 'netWorth', 'bills']);
  assert.deepEqual(prioritise(sections, 'monthly').map((s) => s.type), ['goal', 'netWorth', 'pinned', 'bills', 'recent']);

  for (const t of TEMPLATES) {
    const daily = types(buildHome(answers({ goal: t.goal === 'any' ? 'debt' : t.goal }), { templateId: t.id }));
    const r = daily.indexOf('recent');
    const others = ['netWorth', 'bills'].map((x) => daily.indexOf(x)).filter((i) => i >= 0);
    if (r >= 0) others.forEach((i) => assert.ok(r < i, `${t.id}: recent should come first for daily`));
  }
});

test('weekly tracker answer adds or removes the weekly gauge', () => {
  assert.ok(types(buildHome(answers({ goal: 'house', frequency: 'weekly', weeklyTracker: 'yes' }))).includes('weekly'));
  assert.ok(!types(buildHome(answers({ goal: 'house', frequency: 'weekly', weeklyTracker: 'no' }))).includes('weekly'));
});

test('transfers answer controls contacts / slider, and "rarely" hides move money', () => {
  const others = buildHome(answers({ transfers: 'others' }));
  assert.equal(others.showContacts, true);
  assert.equal(others.showTransfer, false);
  const both = buildHome(answers({ transfers: 'both' }));
  assert.equal(both.showContacts && both.showTransfer, true);
  assert.ok(!types(buildHome(answers({ transfers: 'rarely' }))).includes('move'));
});

test('colour and density answers override the template', () => {
  const home = buildHome(answers({ goal: 'house', frequency: 'weekly', palette: 'midnight', density: 'compact' }));
  assert.equal(home.template.id, 'room-for-home');
  assert.equal(home.theme.dark, true);
  assert.equal(home.density, 'compact');
  assert.equal(buildHome(answers({ goal: 'house', frequency: 'weekly' })).theme.label, 'Lavender + violet');
});

test('pinned accounts come from Q3, joint accounts favour the shared-money template', () => {
  assert.deepEqual(buildHome(answers({ accounts: ['joint', 'savings'] })).pinned, ['joint', 'savings']);
  const t = rankTemplates(answers({ goal: 'spending', frequency: 'monthly', accounts: ['joint'], density: 'spacious' }));
  assert.ok(['month-in-focus', 'bigger-picture'].includes(t[0].id));
});

test('every question has options and every answer combination builds', () => {
  for (const q of QUESTIONS) assert.ok(q.options.length >= 2, q.id);
  for (const goal of ['house', 'debt', 'spending'])
    for (const frequency of ['daily', 'weekly', 'monthly'])
      for (const transfers of ['others', 'self', 'both', 'rarely'])
        for (const palette of QUESTIONS.at(-1).options.map((o) => o.value)) {
          const home = buildHome(answers({ goal, frequency, transfers, palette }));
          assert.ok(home.theme && home.d && home.sections.length > 0);
        }
});

// ---------- AI widget editing ----------

test('editLayout adds, removes and moves widgets without mutating the list', async () => {
  const { editLayout } = await import('../src/personalise/widgetCatalog.js');
  const start = [{ type: 'goal', variant: 'hero' }, { type: 'recent', count: 2 }];

  const added = editLayout(start, { action: 'add', type: 'bills', position: 1 });
  assert.deepEqual(added.sections.map((s) => s.type), ['bills', 'goal', 'recent']);
  assert.equal(added.sections[0].variant, 'hero', 'defaults to the first variant');
  assert.equal(start.length, 2);

  const bottom = editLayout(start, { action: 'add', type: 'pinned', variant: 'grid' });
  assert.deepEqual(bottom.sections.at(-1), { type: 'pinned', variant: 'grid' });
  assert.equal(editLayout(start, { action: 'add', type: 'bills', variant: 'nope' }).sections[2].variant, 'hero');

  assert.deepEqual(editLayout(start, { action: 'remove', type: 'goal' }).sections.map((s) => s.type), ['recent']);
  assert.deepEqual(editLayout(start, { action: 'move', type: 'recent', position: 1 }).sections.map((s) => s.type), ['recent', 'goal']);

  assert.throws(() => editLayout(start, { action: 'add', type: 'goal' }), /already on the home/);
  assert.throws(() => editLayout(start, { action: 'remove', type: 'bills' }), /not on the home/);
  assert.throws(() => editLayout(start, { action: 'add', type: 'crypto' }), /Unknown widget/);
});

test('every catalogue widget is documented and every template only uses catalogue widgets', async () => {
  const { WIDGETS, WIDGET_TYPES } = await import('../src/personalise/widgetCatalog.js');
  for (const t of TEMPLATES) {
    for (const s of t.sections) {
      assert.ok(WIDGETS[s.type], `${t.id} uses unknown widget ${s.type}`);
      if (s.variant) assert.ok(WIDGETS[s.type].variants.includes(s.variant), `${t.id}: ${s.type}/${s.variant}`);
    }
  }
  assert.ok(WIDGET_TYPES.length >= 9);
});

test('custom sections replace the template, and adding move money shows contacts', () => {
  const sections = [{ type: 'bills', variant: 'list' }, { type: 'move', variant: 'button' }];
  const home = buildHome(answers({ transfers: 'rarely' }), { sections });
  assert.deepEqual(home.sections, sections);
  assert.equal(home.showContacts, true);
});

test('home tools let the AI see the layout and edit it, starting from the standard home', async () => {
  const { createHomeTools } = await import('../src/personalise/homeTools.js');
  let state = null;
  const { tools, context } = createHomeTools({
    getState: () => state,
    setSections: (sections) => { state = { answers: state?.answers ?? DEFAULT_ANSWERS, sections }; },
    setTheme: () => true,
    getCatalog: async () => ({
      widgets: [{ id: 5, name: 'Recent transactions' }, { id: 6, name: 'Net worth (from db)' }],
      themes: [{ name: 'forest', label: 'Forest + mint' }],
    }),
  });
  const tool = (name) => tools.find((t) => t.name === name);

  const ctx = await context();
  assert.match(ctx, /standard home/);
  assert.match(ctx, /netWorth: Net worth \(from db\)/, 'catalogue comes from the database');
  assert.doesNotMatch(ctx, /goal: Money goal\./, 'widgets missing from the database are not offered');
  assert.doesNotMatch(ctx, /\$/, 'no balances are shown to the AI');

  const result = await tool('add_widget').run({ type: 'netWorth', position: 1 });
  assert.match(result, /Added Net worth at position 1/);
  assert.equal(state.sections[0].type, 'netWorth');
  assert.match(await context(), /right now, top to bottom:\n1\. netWorth/);
  await assert.rejects(tool('add_widget').run({ type: 'total' }), /not one of the available widgets/);

  await tool('remove_widget').run({ type: 'netWorth' });
  assert.ok(!state.sections.some((s) => s.type === 'netWorth'));
  await assert.rejects(tool('remove_widget').run({ type: 'netWorth' }), /not on the home/);
});

test('set_theme only allows database themes and says when it could not be saved', async () => {
  const { createHomeTools } = await import('../src/personalise/homeTools.js');
  let theme = null;
  let online = true;
  const { tools, context } = createHomeTools({
    getState: () => (theme ? { answers: { ...DEFAULT_ANSWERS, palette: theme } } : null),
    setSections: () => {},
    setTheme: async (name) => { theme = name; return online; },
    getCatalog: async () => ({ widgets: [], themes: [{ name: 'forest', label: 'Forest + mint' }, { name: 'ocean', label: 'Ocean + sky' }] }),
  });
  const setTheme = tools.find((t) => t.name === 'set_theme');

  assert.match(await context(), /Themes available:\n- forest: Forest \+ mint\n- ocean: Ocean \+ sky/);
  assert.equal(await setTheme.run({ theme: 'forest' }), 'Theme changed to Forest + mint.');
  assert.match(await context(), /Current theme: forest/);
  await assert.rejects(setTheme.run({ theme: 'midnight' }), /Unknown theme "midnight"/);

  online = false;
  assert.match(await setTheme.run({ theme: 'ocean' }), /could not be reached/);
});

test('without the database the AI falls back to the built-in widgets and themes', async () => {
  const { createHomeTools } = await import('../src/personalise/homeTools.js');
  const { context } = createHomeTools({
    getState: () => null,
    setSections: () => {},
    setTheme: () => {},
    getCatalog: async () => { throw new Error('offline'); },
  });
  const warn = console.warn;
  console.warn = () => {};
  try {
    const ctx = await context();
    assert.match(ctx, /goal: Money goal\./);
    assert.match(ctx, /- midnight: Midnight \+ coral/);
  } finally {
    console.warn = warn;
  }
});

test('every catalogue widget has a unique database ID and buildHome reports its palette', async () => {
  const { WIDGETS, WIDGET_TYPES, widgetType } = await import('../src/personalise/widgetCatalog.js');
  WIDGET_TYPES.forEach((type) => assert.equal(widgetType(WIDGETS[type].id), type));
  assert.equal(buildHome(answers({ palette: 'forest' })).paletteKey, 'forest');
  assert.equal(buildHome(answers({ palette: 'nope' })).paletteKey, buildHome(answers()).template.palette);
});

test('database accounts and transactions become widget data; missing tables stay mock', async () => {
  const { fromDatabase, accountKind, parseDate } = await import('../src/personalise/bankData.js');
  const MOCK = await import('../src/personalise/mockData.js');

  assert.equal(accountKind('Westpac Choice'), 'everyday');
  assert.equal(accountKind('Westpac eSaver'), 'savings');
  assert.equal(accountKind('Westpac Altitude Rewards'), 'credit');
  assert.equal(accountKind('Westpac Home Loan'), 'loan');
  assert.equal(parseDate('02/11/2026').getTime(), new Date(2026, 10, 2).getTime());

  const tx = (id, account, amount, date, name, negative) => ({
    transaction_ID: id, account_ID: account, amount, date, name, negative,
  });
  const data = fromDatabase({
    accounts: [
      { account_ID: 1, account_type: 'Westpac Choice', balance: 1000 },
      { account_ID: 2, account_type: 'Westpac Life', balance: 500 },
      { account_ID: 3, account_type: 'Westpac Altitude Rewards', balance: -200 },
      { account_ID: 4, account_type: 'Westpac Home Loan', balance: 50000 },
    ],
    transactions: [
      // Wed 11 Nov 2026 is "today" (latest); the week started Mon 9 Nov.
      tx(1, 1, 20, '11/11/2026', 'Woolworths', 1),
      tx(2, 3, 30, '11/11/2026', 'Uber Trip', 1),
      tx(3, 1, 100, '10/11/2026', 'Payment to Westpac Life', 1),
      tx(4, 2, 100, '10/11/2026', 'Payment from Westpac Choice', 0),
      tx(5, 1, 15, '09/11/2026', 'Woolworths', 1),
      tx(6, 1, 50, '08/11/2026', 'Zambrero', 1),
      tx(7, 1, 800, '02/11/2026', 'Salary', 0),
      tx(8, 1, 999, '30/10/2026', 'Last month', 1),
    ],
  });

  assert.deepEqual(Object.keys(data.ACCOUNTS), ['everyday', 'savings', 'credit', 'loan']);
  assert.equal(data.ACCOUNTS.everyday.name, 'Westpac Choice');
  assert.equal(data.TOTAL_AVAILABLE, 1500);
  assert.deepEqual(data.NET_WORTH, { assets: 1500, debt: 50200, changeThisMonth: 685 });

  assert.deepEqual(data.TRANSACTIONS.slice(0, 2).map((t) => [t.name, t.when, t.amount]), [
    ['Uber Trip', 'Today', -30],
    ['Woolworths', 'Today', -20],
  ]);
  assert.equal(data.TRANSACTIONS.find((t) => t.id === 't3').when, 'Yesterday');

  // Own transfers aren't spending; the week runs Monday to today.
  assert.equal(data.GOALS.spending.spentToday, 50);
  assert.equal(data.WEEKLY.spent, 65);
  assert.equal(data.GOALS.spending.spentMonth, 115);
  assert.deepEqual(data.WEEKLY.categories.map((c) => [c.name, c.amount]), [['Woolworths', 35], ['Uber Trip', 30]]);

  // No tables for these yet.
  assert.equal(data.BILLS, MOCK.BILLS);
  assert.equal(data.CONTACTS, MOCK.CONTACTS);
  assert.equal(data.WEEKLY.budget, MOCK.WEEKLY.budget);
  assert.equal(data.GOALS.house, MOCK.GOALS.house);
});
