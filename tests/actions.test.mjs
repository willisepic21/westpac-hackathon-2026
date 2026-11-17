import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';

import { createApi } from '../database/server.mjs';
import {
  addPeriod,
  describeAction,
  firstRun,
  needsAlert,
  normaliseAction,
  planRun,
  skipLabel,
} from '../src/actions/rules.js';

const ACCOUNTS = [
  { id: 1, name: 'Westpac Choice' },
  { id: 2, name: 'Westpac Life' },
  { id: 3, name: 'Westpac Altitude Rewards' },
];
const nameOf = (id) => ACCOUNTS.find((a) => a.id === id).name;
const at = (iso, hour = 12) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d, hour);
};

// ---- rules ----

test('normaliseAction accepts account names (as the AI sends them) and fills defaults', () => {
  const a = normaliseAction(
    { kind: 'sweep', from: 'choice', to: 'Westpac Life', threshold: '500' },
    ACCOUNTS,
    { now: at('2026-11-17', 12) },
  );
  assert.deepEqual(a, {
    kind: 'sweep', from: 1, to: 2, threshold: 500, amount: null, frequency: 'weekly', nextRun: '2026-11-18',
  });
  assert.equal(describeAction(a, nameOf), 'If Westpac Choice is over $500, move the extra to Westpac Life.');
});

test('normaliseAction rejects bad input with readable errors', () => {
  const bad = (input, re) => assert.throws(() => normaliseAction(input, ACCOUNTS), re);
  bad({ kind: 'sweep', from: 'Choice', to: 'Choice', threshold: 5 }, /must be different/);
  bad({ kind: 'sweep', from: 'Netflix', to: 'Life', threshold: 5 }, /isn't one of your accounts/);
  bad({ kind: 'sweep', from: 'Westpac', to: 'Life', threshold: 5 }, /more than one account/);
  assert.equal(normaliseAction({ kind: 'sweep', from: 'my everyday account', to: 'savings', threshold: 5 }, ACCOUNTS).to, 2);
  bad({ kind: 'transfer', from: 'Choice', to: 'Life', amount: -5 }, /more than \$0/);
  bad({ kind: 'sweep', from: 'Choice', to: 'Life', threshold: 5, frequency: 'hourly' }, /daily, weekly or monthly/);
  bad({ kind: 'steal', from: 'Choice', to: 'Life' }, /Unknown action type/);
});

test('dates: first run, periods and month ends', () => {
  assert.equal(firstRun(at('2026-11-17', 8)), '2026-11-17'); // before 9am: today
  assert.equal(firstRun(at('2026-11-17', 9)), '2026-11-18');
  assert.equal(addPeriod('2026-11-17', 'daily'), '2026-11-18');
  assert.equal(addPeriod('2026-11-17', 'weekly'), '2026-11-24');
  assert.equal(addPeriod('2026-01-31', 'monthly'), '2026-02-28');
  assert.equal(addPeriod('2026-12-15', 'monthly'), '2027-01-15');
  assert.equal(skipLabel('weekly'), 'Skip this week');
});

test('planRun works out the money to move and never overdraws', () => {
  const sweep = { kind: 'sweep', from: 1, to: 2, threshold: 500 };
  assert.deepEqual(planRun(sweep, { 1: 1874.82, 2: 110 }), { status: 'moved', amount: 1374.82, note: null });
  assert.equal(planRun(sweep, { 1: 400, 2: 110 }).status, 'nothing');

  const topUp = { kind: 'top_up', from: 1, to: 2, threshold: 1000 };
  assert.equal(planRun(topUp, { 1: 5000, 2: 110 }).amount, 890);
  const partial = planRun(topUp, { 1: 300, 2: 110 });
  assert.equal(partial.amount, 300);
  assert.match(partial.note, /wanted \$890/);

  const transfer = { kind: 'transfer', from: 1, to: 2, amount: 50 };
  assert.equal(planRun(transfer, { 1: 60, 2: 0 }).amount, 50);
  assert.equal(planRun(transfer, { 1: 20, 2: 0 }).status, 'failed');
});

test('needsAlert: within 24 hours of the 9am run, until dismissed', () => {
  const a = { nextRun: '2026-11-18', alertDismissedFor: null };
  assert.equal(needsAlert(a, at('2026-11-17', 12)), true);
  assert.equal(needsAlert(a, at('2026-11-17', 8)), false); // more than 24h before
  assert.equal(needsAlert(a, at('2026-11-18', 10)), false); // already ran
  assert.equal(needsAlert({ ...a, alertDismissedFor: '2026-11-18' }, at('2026-11-17', 12)), false);
});

// ---- API ----

const schema = readFileSync(new URL('../database/schema.sql', import.meta.url), 'utf8');

function setup(nowIso = '2026-11-17', hour = 12) {
  const db = new DatabaseSync(':memory:');
  db.exec(schema);
  db.exec("INSERT INTO users (ID, name) VALUES (1, 'Will'), (2, 'Sam')");
  db.exec('INSERT INTO session (ID, user_ID) VALUES (1, 1)');
  db.exec(`INSERT INTO accounts (account_ID, user_ID, account_type, balance) VALUES
    (1, 1, 'Westpac Choice', 1874.82), (2, 1, 'Westpac Life', 110), (3, 2, 'Westpac eSaver', 50)`);
  const clock = { now: at(nowIso, hour) };
  const api = createApi(db, { now: () => clock.now });
  return { db, api, clock };
}

const sweep = { kind: 'sweep', from: 'Choice', to: 'Life', threshold: 500, frequency: 'weekly' };

test('create, list, edit and delete an action', () => {
  const { api } = setup();
  const created = api('POST', '/api/actions', { ...sweep, createdBy: 'ai' });
  assert.equal(created.status, 200, created.json.error);
  const id = created.json.action.id;
  assert.equal(created.json.action.nextRun, '2026-11-18');
  assert.equal(created.json.action.createdBy, 'ai');

  const list = api('GET', '/api/actions').json;
  assert.deepEqual(list.accounts, [{ id: 1, name: 'Westpac Choice' }, { id: 2, name: 'Westpac Life' }]);
  assert.ok(!('balance' in list.accounts[0]), 'no balances in the actions API');
  assert.equal(list.actions[0].description, 'If Westpac Choice is over $500, move the extra to Westpac Life.');

  const edited = api('PUT', `/api/actions/${id}`, { threshold: 800, frequency: 'monthly' });
  assert.equal(edited.json.action.threshold, 800);
  assert.equal(edited.json.action.frequency, 'monthly');
  assert.equal(edited.json.action.kind, 'sweep');

  assert.equal(api('DELETE', `/api/actions/${id}`).status, 200);
  assert.deepEqual(api('GET', '/api/actions').json.actions, []);
  assert.equal(api('DELETE', `/api/actions/${id}`).status, 404);
});

test("actions can't use another user's accounts or be changed by them", () => {
  const { db, api } = setup();
  const res = api('POST', '/api/actions', { ...sweep, to: 3 });
  assert.equal(res.status, 400);
  assert.match(res.json.error, /isn't one of your accounts/);

  const id = api('POST', '/api/actions', sweep).json.action.id;
  db.exec('UPDATE session SET user_ID = 2');
  assert.equal(api('DELETE', `/api/actions/${id}`).status, 404);
  assert.deepEqual(api('GET', '/api/actions').json.actions, []);
});

test('skip moves the next run on a week and logs it; dismiss hides the alert', () => {
  const { api } = setup();
  const id = api('POST', '/api/actions', sweep).json.action.id;
  assert.equal(api('POST', `/api/actions/${id}/dismiss`).json.action.alertDismissedFor, '2026-11-18');

  const skipped = api('POST', `/api/actions/${id}/skip`).json.action;
  assert.equal(skipped.nextRun, '2026-11-25');
  assert.equal(skipped.alertDismissedFor, null);
  assert.equal(api('GET', '/api/actions').json.actions[0].lastRun.status, 'skipped');
});

test('runDue moves the extra at 9am, records transactions, and schedules the next run', () => {
  const { db, api, clock } = setup();
  api('POST', '/api/actions', sweep);

  assert.deepEqual(api.runDue(), [], 'nothing is due before 9am on the 18th');
  clock.now = at('2026-11-18', 9);
  const [run] = api.runDue();
  assert.equal(run.status, 'moved');
  assert.equal(run.amount, 1374.82);
  assert.equal(run.nextRun, '2026-11-25');

  const bal = (id) => db.prepare('SELECT balance FROM accounts WHERE account_ID = ?').get(id).balance;
  assert.equal(bal(1), 500);
  assert.equal(bal(2), 1484.82);
  const txns = db.prepare('SELECT account_ID, amount, date, name, negative FROM transactions ORDER BY transaction_ID').all();
  assert.deepEqual(txns.map((t) => [t.account_ID, t.amount, t.date, t.name, t.negative]), [
    [1, 1374.82, '18/11/2026', 'Payment to Westpac Life', 1],
    [2, 1374.82, '18/11/2026', 'Payment from Westpac Choice', 0],
  ]);

  assert.deepEqual(api.runDue(), [], "doesn't run twice");
  clock.now = at('2026-11-25', 10);
  assert.equal(api.runDue()[0].status, 'nothing', 'balance is now exactly $500');
});

test('run now works without changing the schedule', () => {
  const { api } = setup();
  const id = api('POST', '/api/actions', { kind: 'transfer', from: 'Choice', to: 'Life', amount: 25 }).json.action.id;
  const { result, action } = api('POST', `/api/actions/${id}/run`).json;
  assert.deepEqual(result, { status: 'moved', amount: 25, note: null });
  assert.equal(action.nextRun, '2026-11-18');
});

// ---- AI tools ----

import { createActionTools } from '../src/actions/actionTools.js';

test('AI tools: context shows account names and rules only; create waits for the user', async () => {
  const proposals = [];
  let decision = { approved: true, message: 'Action set up.' };
  const { tools, context } = createActionTools({
    getActions: async () => ({
      accounts: ACCOUNTS,
      actions: [{ id: 7, description: 'Move $50 from Westpac Choice to Westpac Life.', frequency: 'weekly', nextRun: '2026-11-18' }],
    }),
    propose: async (input, opts) => {
      proposals.push({ input, opts });
      return decision;
    },
    remove: async () => {},
  });

  const ctx = await context();
  assert.match(ctx, /Westpac Choice, Westpac Life/);
  assert.match(ctx, /id 7: Move \$50/);
  assert.doesNotMatch(ctx, /balance:|\$1,874/i);

  const create = tools.find((t) => t.name === 'create_action');
  const args = { kind: 'sweep', from: 'Choice', to: 'savings', threshold: 500, frequency: 'weekly' };
  assert.match(await create.run(args), /approved/);
  assert.deepEqual(proposals[0], { input: args, opts: {} });

  decision = { approved: false, message: 'The user declined.' };
  assert.match(await create.run(args), /Not saved.*declined.*don't claim/);

  const edit = tools.find((t) => t.name === 'edit_action');
  await edit.run({ id: 7, threshold: 800, amount: null, frequency: null });
  assert.deepEqual(proposals[2], { input: { threshold: 800 }, opts: { editId: 7 } });
});

test('AI tools: create_action asks for missing accounts, amount and time frame instead of assuming them', async () => {
  const proposals = [];
  const { tools, context } = createActionTools({
    getActions: async () => ({ accounts: ACCOUNTS, actions: [] }),
    propose: async (input) => {
      proposals.push(input);
      return { approved: true, message: 'Action set up.' };
    },
    remove: async () => {},
  });
  const create = tools.find((t) => t.name === 'create_action');

  const noFrequency = await create.run({ kind: 'transfer', from: 'Choice', to: 'Life', amount: 50, frequency: null });
  assert.match(noFrequency, /Not set up.*how often.*Don't guess/);
  const nothing = await create.run({ kind: 'sweep' });
  assert.match(nothing, /comes from.*goes to.*balance to keep.*how often/);
  assert.equal(proposals.length, 0, 'nothing is proposed until every detail is given');

  await create.run({ kind: 'transfer', from: 'Choice', to: 'Life', amount: 50, frequency: 'monthly' });
  assert.equal(proposals[0].frequency, 'monthly');
  assert.match(await context(), /Never assume any of them, including weekly/);
});
