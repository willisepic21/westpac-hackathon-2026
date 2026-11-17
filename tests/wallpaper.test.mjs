import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';

import { createApi, migrate } from '../database/server.mjs';

const schema = readFileSync(new URL('../database/schema.sql', import.meta.url), 'utf8');

function setup() {
  const db = new DatabaseSync(':memory:');
  db.exec(schema);
  db.exec("INSERT INTO users (ID, name) VALUES (1, 'Will')");
  db.exec('INSERT INTO session (ID, user_ID) VALUES (1, 1)');
  return { db, api: createApi(db) };
}

test('every original wallpaper has an app-sized copy and a thumbnail', () => {
  const originals = readdirSync(new URL('../wallpapers/', import.meta.url)).filter((f) => /^\d+\.jpg$/.test(f));
  assert.ok(originals.length >= 23);
  for (const f of originals) {
    for (const size of ['full', 'thumb']) {
      assert.ok(existsSync(new URL(`../assets/wallpapers/${size}/${f}`, import.meta.url)), `${size}/${f} missing: run python scripts/resize_wallpapers.py`);
    }
  }
  const list = readFileSync(new URL('../src/personalise/wallpapers.js', import.meta.url), 'utf8');
  assert.equal((list.match(/\{ id: \d+/g) ?? []).length, originals.length, 'wallpapers.js is out of date');
});

test('wallpaper defaults to 0 and is saved per user', () => {
  const { db, api } = setup();
  assert.equal(api('GET', '/api/home').json.wallpaper, 0);

  // No customisation row yet: one is created with the Westpac theme.
  assert.equal(api('PUT', '/api/wallpaper', { wallpaper: 7 }).status, 200);
  assert.deepEqual({ ...db.prepare('SELECT * FROM customisation').get() }, { user_ID: 1, theme: 'westpac', wallpaper: 7 });
  assert.equal(api('GET', '/api/home').json.wallpaper, 7);

  // Changing the theme keeps the wallpaper, and back to none works.
  api('PUT', '/api/theme', { theme: 'forest' });
  assert.equal(api('GET', '/api/home').json.wallpaper, 7);
  api('PUT', '/api/wallpaper', { wallpaper: 0 });
  assert.equal(api('GET', '/api/home').json.wallpaper, 0);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM customisation').get().n, 1);
});

test('unknown wallpapers are rejected', () => {
  const { api } = setup();
  for (const wallpaper of [999, -1, 2.5, '3', null]) {
    const res = api('PUT', '/api/wallpaper', { wallpaper });
    assert.equal(res.status, 400, `accepted ${JSON.stringify(wallpaper)}`);
    assert.match(res.json.error, /Unknown wallpaper/);
  }
});

test('migrate adds the wallpaper column to an older app.db', () => {
  const db = new DatabaseSync(':memory:');
  db.exec('CREATE TABLE customisation (user_ID INTEGER NOT NULL, theme TEXT NOT NULL)');
  db.exec('CREATE TABLE homepage_widgets (user_ID INTEGER, widget_ID INTEGER, priority INTEGER)');
  db.exec("INSERT INTO customisation VALUES (1, 'ocean')");
  migrate(db);
  migrate(db);
  assert.deepEqual({ ...db.prepare('SELECT * FROM customisation').get() }, { user_ID: 1, theme: 'ocean', wallpaper: 0 });
});
