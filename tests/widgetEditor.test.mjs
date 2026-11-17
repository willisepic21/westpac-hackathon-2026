import assert from 'node:assert/strict';
import { test } from 'node:test';

// ---- Manual widget editing ----

import { missingWidgets, moveSection, updateSection } from '../src/personalise/widgetCatalog.js';

test('moveSection swaps neighbours and ignores moves off the ends', () => {
  const list = [{ type: 'goal' }, { type: 'recent' }, { type: 'bills' }];
  assert.deepEqual(moveSection(list, 2, -1).map((s) => s.type), ['goal', 'bills', 'recent']);
  assert.deepEqual(moveSection(list, 0, 1).map((s) => s.type), ['recent', 'goal', 'bills']);
  assert.equal(moveSection(list, 0, -1), list);
  assert.equal(moveSection(list, 2, 1), list);
  assert.deepEqual(list.map((s) => s.type), ['goal', 'recent', 'bills'], 'input not mutated');
});

test('updateSection only accepts settings the widget supports', () => {
  const list = [{ type: 'goal', variant: 'hero' }, { type: 'recent', count: 3 }];
  assert.equal(updateSection(list, 0, { variant: 'mini' })[0].variant, 'mini');
  assert.equal(updateSection(list, 0, { variant: 'slider' })[0].variant, 'hero');
  assert.equal(updateSection(list, 1, { count: 5 })[1].count, 5);
  assert.equal(updateSection(list, 1, { count: 50 })[1].count, 3);
  assert.equal(updateSection(list, 0, { count: 5 })[0].count, undefined);
});

test('missingWidgets lists what can still be added', () => {
  const missing = missingWidgets([{ type: 'goal' }, { type: 'recent' }]);
  assert.ok(!missing.includes('goal') && !missing.includes('recent'));
  assert.equal(missing.length, 7);
});

// ---- Widget styles are saved to the database ----

import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

import { createApi, migrate } from '../database/server.mjs';

const schema = readFileSync(new URL('../database/schema.sql', import.meta.url), 'utf8');

function freshApi() {
  const db = new DatabaseSync(':memory:');
  db.exec(schema);
  db.exec("INSERT INTO users (ID, name) VALUES (1, 'Will')");
  db.exec('INSERT INTO session (ID, user_ID) VALUES (1, 1)');
  return createApi(db);
}

test('PUT /api/homepage keeps each widget style; plain IDs still work', () => {
  const api = freshApi();
  const res = api('PUT', '/api/homepage', { widgets: [{ id: 1, variant: 'mini' }, { id: 5, count: 8 }, 7] });
  assert.equal(res.status, 200, res.json.error);
  const home = api('GET', '/api/home').json;
  assert.deepEqual(home.homepage, [1, 5, 7]);
  assert.deepEqual(home.homepageSettings, [
    { id: 1, variant: 'mini', count: null },
    { id: 5, variant: null, count: 8 },
    { id: 7, variant: null, count: null },
  ]);
  assert.equal(api('PUT', '/api/homepage', { widgets: [{ id: 5, count: 999 }] }).status, 400);
});

test('migrate adds the style columns to an older app.db', () => {
  const db = new DatabaseSync(':memory:');
  db.exec('CREATE TABLE homepage_widgets (user_ID INTEGER, widget_ID INTEGER, priority INTEGER)');
  migrate(db);
  migrate(db); // safe to run every start
  const cols = db.prepare('PRAGMA table_info(homepage_widgets)').all().map((c) => c.name);
  assert.deepEqual(cols, ['user_ID', 'widget_ID', 'priority', 'variant', 'count']);
});
