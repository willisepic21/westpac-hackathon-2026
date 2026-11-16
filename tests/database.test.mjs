import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';

import { createApi } from '../database/server.mjs';
import { PALETTES } from '../src/personalise/themes.js';
import { WIDGETS, WIDGET_TYPES } from '../src/personalise/widgetCatalog.js';

const schema = readFileSync(new URL('../database/schema.sql', import.meta.url), 'utf8');

// A fresh database from schema.sql with two users, user 1 signed in.
function freshDb() {
  const db = new DatabaseSync(':memory:');
  db.exec(schema);
  db.exec("INSERT INTO users (ID, name) VALUES (1, 'Will'), (2, 'Sam')");
  db.exec('INSERT INTO session (ID, user_ID) VALUES (1, 1)');
  return db;
}

test('the widgets and themes tables match the app', () => {
  const db = freshDb();
  assert.deepEqual(
    db.prepare('SELECT widget_ID, name FROM widgets ORDER BY widget_ID').all().map((r) => [r.widget_ID, r.name]),
    WIDGET_TYPES.map((type) => [WIDGETS[type].id, WIDGETS[type].name]),
  );
  assert.deepEqual(
    db.prepare('SELECT name, label FROM themes').all().map((r) => [r.name, r.label]),
    Object.entries(PALETTES).map(([name, p]) => [name, p.label]),
  );
});

test('GET /api/home returns the signed-in user, catalogue and saved home', () => {
  const api = createApi(freshDb());
  const { status, json } = api('GET', '/api/home');
  assert.equal(status, 200);
  assert.equal(json.userId, 1);
  assert.equal(json.theme, null);
  assert.deepEqual(json.homepage, []);
  assert.equal(json.widgets.length, WIDGET_TYPES.length);
  assert.ok(json.themes.some((t) => t.name === 'forest'));
});

test('PUT /api/theme saves one theme per user and rejects unknown ones', () => {
  const db = freshDb();
  const api = createApi(db);
  assert.equal(api('PUT', '/api/theme', { theme: 'forest' }).status, 200);
  assert.equal(api('PUT', '/api/theme', { theme: 'ocean' }).status, 200);
  assert.deepEqual(db.prepare('SELECT user_ID, theme FROM customisation').all().map((r) => [r.user_ID, r.theme]), [[1, 'ocean']]);
  assert.equal(api('GET', '/api/home').json.theme, 'ocean');

  const bad = api('PUT', '/api/theme', { theme: 'neon' });
  assert.equal(bad.status, 400);
  assert.match(bad.json.error, /Unknown theme/);
});

test('PUT /api/homepage replaces the signed-in user\'s widgets in priority order', () => {
  const db = freshDb();
  const api = createApi(db);
  api('PUT', '/api/homepage', { widgets: [1, 5, 7] });
  api('PUT', '/api/homepage', { widgets: [7, 1] });
  assert.deepEqual(api('GET', '/api/home').json.homepage, [7, 1]);
  assert.deepEqual(
    db.prepare('SELECT user_ID, widget_ID, priority FROM homepage_widgets ORDER BY priority').all().map((r) => [r.user_ID, r.widget_ID, r.priority]),
    [[1, 7, 1], [1, 1, 2]],
  );

  // A bad ID changes nothing.
  assert.equal(api('PUT', '/api/homepage', { widgets: [1, 99] }).status, 400);
  assert.deepEqual(api('GET', '/api/home').json.homepage, [7, 1]);

  // Switching user via the session table switches whose home is read and written.
  db.exec('UPDATE session SET user_ID = 2');
  assert.deepEqual(api('GET', '/api/home').json.homepage, []);
});

test('GET /api/banking returns only the signed-in user\'s accounts and transactions', () => {
  const db = freshDb();
  db.exec(`INSERT INTO accounts (account_ID, user_ID, account_type, balance) VALUES
             (1, 1, 'Westpac Choice', 100), (2, 2, 'Westpac Life', 200)`);
  db.exec(`INSERT INTO transactions (transaction_ID, user_ID, account_ID, amount, date, name, negative) VALUES
             (1, 1, 1, 5, '16/11/2026', 'Coffee', 1), (2, 2, 2, 9, '16/11/2026', 'Not yours', 1)`);
  const api = createApi(db);
  const { accounts, transactions } = api('GET', '/api/banking').json;
  assert.deepEqual(accounts, [{ account_ID: 1, account_type: 'Westpac Choice', balance: 100 }]);
  assert.deepEqual(transactions.map((t) => t.name), ['Coffee']);

  db.exec('UPDATE session SET user_ID = 2');
  assert.deepEqual(api('GET', '/api/banking').json.transactions.map((t) => t.name), ['Not yours']);
});

test('unknown routes are 404', () => {
  assert.equal(createApi(freshDb())('DELETE', '/api/home').status, 404);
});
