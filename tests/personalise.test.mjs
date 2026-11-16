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
  });
  const tool = (name) => tools.find((t) => t.name === name);

  assert.match(context(), /standard home/);
  assert.match(context(), /netWorth: Net worth/, 'catalogue is in the context');
  assert.doesNotMatch(context(), /\$/, 'no balances are shown to the AI');

  const result = tool('add_widget').run({ type: 'netWorth', position: 1 });
  assert.match(result, /Added Net worth at position 1/);
  assert.equal(state.sections[0].type, 'netWorth');
  assert.match(context(), /right now, top to bottom:\n1\. netWorth/);

  tool('remove_widget').run({ type: 'netWorth' });
  assert.ok(!state.sections.some((s) => s.type === 'netWorth'));
  assert.throws(() => tool('remove_widget').run({ type: 'netWorth' }), /not on the home/);
});
