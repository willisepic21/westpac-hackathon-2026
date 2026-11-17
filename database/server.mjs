// Small local API between the app and database/app.db (run with `npm run db`, next to `npm start`).
// The app (and so the AI) only gets these fixed endpoints, never SQL (see ai_perms.md).
// Everything applies to the signed-in user from the `session` table; the app never sends a user ID.
//
//   GET /api/home       -> { userId, theme, themes: [{ name, label }], widgets: [{ id, name }], homepage: [widget ids, top first] }
//   GET /api/banking    -> { accounts: [...], transactions: [...] } for the home widgets (never sent to the AI)
//   PUT /api/theme      { theme: 'forest' }   saves customisation.theme
//   PUT /api/wallpaper  { wallpaper: 7 }      saves customisation.wallpaper (0 = none; n = assets/wallpapers/full/n.jpg)
//   PUT /api/homepage   { widgets: [1, 5, 7] } replaces homepage_widgets (priority 1 = top); entries can also be
//                       { id, variant, count } to save each widget's style. GET /api/home returns those as
//                       homepageSettings: [{ id, variant, count }].
//   PUT /api/session    { email: 'will@example.com' } signs that user in -> { userId, name }
//   DELETE /api/session  signs out: empties the session table (other calls then fail with 401 until a sign-in)
//
// Actions (money automations, rules in src/actions/rules.js):
//   GET    /api/actions               -> { accounts: [{ id, name }], actions: [...] } (account names only, no balances)
//   POST   /api/actions               { kind, from, to, threshold | amount, frequency, nextRun?, createdBy? }
//   PUT    /api/actions/:id           same fields, replaces the action
//   DELETE /api/actions/:id
//   POST   /api/actions/:id/skip      skip the next run (moves next_run on one period)
//   POST   /api/actions/:id/dismiss   hide the "about to run" alert for the next run
//   POST   /api/actions/:id/run       run it now (for demos); the schedule doesn't change
// Due actions run automatically every minute while the server is up (api.runDue()).
//
// Uses Node's built-in node:sqlite, so there is nothing to install.

import { existsSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

import { addPeriod, describeAction, isoDate, normaliseAction, parseIso, planRun, runTime } from '../src/actions/rules.js';

const RATE_LIMIT = 120; // requests per minute per client

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// The app's wallpaper images (made by scripts/resize_wallpapers.py from wallpapers/).
const wallpaperExists = (n) => existsSync(new URL(`../assets/wallpapers/full/${n}.jpg`, import.meta.url));

// Transactions in app.db use dd/mm/yyyy dates.
const txnDate = (d) =>
  `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;

/**
 * Route handler for one database. Returns (method, path, body) -> { status, json }, with api.runDue() attached.
 * `now` can be swapped in tests. Exported for tests.
 */
export function createApi(db, { now = () => new Date() } = {}) {
  db.exec('PRAGMA foreign_keys = ON');

  const currentUser = () => {
    const row = db.prepare('SELECT user_ID FROM session WHERE ID = 1').get();
    if (!row) throw new HttpError(401, 'Nobody is signed in (the session table is empty).');
    return row.user_ID;
  };

  const homepageRows = (userId) =>
    db
      .prepare('SELECT widget_ID AS id, variant, count FROM homepage_widgets WHERE user_ID = ? ORDER BY priority')
      .all(userId)
      .map((r) => ({ ...r }));

  const getHome = () => {
    const userId = currentUser();
    return {
      userId,
      theme: db.prepare('SELECT theme FROM customisation WHERE user_ID = ? LIMIT 1').get(userId)?.theme ?? null,
      wallpaper: db.prepare('SELECT wallpaper FROM customisation WHERE user_ID = ? LIMIT 1').get(userId)?.wallpaper ?? 0,
      themes: db.prepare('SELECT name, label FROM themes ORDER BY rowid').all().map((r) => ({ ...r })),
      widgets: db.prepare('SELECT widget_ID AS id, name FROM widgets ORDER BY widget_ID').all().map((r) => ({ ...r })),
      homepage: homepageRows(userId).map((r) => r.id),
      homepageSettings: homepageRows(userId),
    };
  };

  const getBanking = () => {
    const userId = currentUser();
    const rows = (sql) => db.prepare(sql).all(userId).map((r) => ({ ...r }));
    return {
      accounts: rows('SELECT account_ID, account_type, balance FROM accounts WHERE user_ID = ? ORDER BY account_ID'),
      transactions: rows(
        'SELECT transaction_ID, account_ID, amount, date, name, negative FROM transactions WHERE user_ID = ?',
      ),
    };
  };

  const setTheme = ({ theme } = {}) => {
    if (!db.prepare('SELECT 1 FROM themes WHERE name = ?').get(theme)) {
      throw new HttpError(400, `Unknown theme "${theme}".`);
    }
    const userId = currentUser();
    // customisation has no primary key, so update the user's row or add one.
    const { changes } = db.prepare('UPDATE customisation SET theme = ? WHERE user_ID = ?').run(theme, userId);
    if (!changes) db.prepare('INSERT INTO customisation (user_ID, theme) VALUES (?, ?)').run(userId, theme);
    return { theme };
  };

  // 0 = no wallpaper, otherwise n must have an image at assets/wallpapers/full/n.jpg.
  const setWallpaper = ({ wallpaper } = {}) => {
    if (!Number.isInteger(wallpaper) || wallpaper < 0 || (wallpaper > 0 && !wallpaperExists(wallpaper))) {
      throw new HttpError(400, `Unknown wallpaper ${JSON.stringify(wallpaper)}.`);
    }
    const userId = currentUser();
    const { changes } = db.prepare('UPDATE customisation SET wallpaper = ? WHERE user_ID = ?').run(wallpaper, userId);
    // No customisation row yet: theme is required, so start with the Westpac theme.
    if (!changes) {
      db.prepare("INSERT INTO customisation (user_ID, theme, wallpaper) VALUES (?, 'westpac', ?)").run(userId, wallpaper);
    }
    return { wallpaper };
  };

  const setHomepage = ({ widgets } = {}) => {
    if (!Array.isArray(widgets)) throw new HttpError(400, '"widgets" must be a list of widget IDs.');
    // Each entry is a widget ID, or { id, variant, count } to keep the widget's style.
    const rows = widgets.map((w) => {
      const { id, variant = null, count = null } = typeof w === 'object' && w ? w : { id: w };
      if (variant !== null && (typeof variant !== 'string' || variant.length > 20)) {
        throw new HttpError(400, `Bad variant for widget ${id}.`);
      }
      if (count !== null && !(Number.isInteger(count) && count > 0 && count <= 20)) {
        throw new HttpError(400, `Bad count for widget ${id}.`);
      }
      return { id, variant, count };
    });
    const known = db.prepare('SELECT 1 FROM widgets WHERE widget_ID = ?');
    rows.forEach(({ id }) => {
      if (!known.get(id)) throw new HttpError(400, `Unknown widget ID ${id}.`);
    });
    const userId = currentUser();
    const insert = db.prepare(
      'INSERT INTO homepage_widgets (user_ID, widget_ID, priority, variant, count) VALUES (?, ?, ?, ?, ?)',
    );
    db.exec('BEGIN');
    try {
      db.prepare('DELETE FROM homepage_widgets WHERE user_ID = ?').run(userId);
      rows.forEach((r, i) => insert.run(userId, r.id, i + 1, r.variant, r.count));
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
    return { widgets };
  };

  // Demo sign-in: the users table has no passwords, so the email alone picks the user.
  const signIn = ({ email } = {}) => {
    const user = db
      .prepare('SELECT ID, name FROM users WHERE lower(email) = lower(?)')
      .get(String(email ?? '').trim());
    if (!user) throw new HttpError(401, 'No customer with that email.');
    db.prepare('INSERT INTO session (ID, user_ID) VALUES (1, ?) ON CONFLICT(ID) DO UPDATE SET user_ID = excluded.user_ID').run(user.ID);
    return { userId: user.ID, name: user.name };
  };

  // ---- Actions ----

  const userAccounts = (userId) =>
    db
      .prepare('SELECT account_ID AS id, account_type AS name FROM accounts WHERE user_ID = ? ORDER BY account_ID')
      .all(userId)
      .map((r) => ({ ...r }));

  const fromRow = (r) => ({
    id: r.action_ID,
    userId: r.user_ID,
    kind: r.kind,
    from: r.from_account_ID,
    to: r.to_account_ID,
    threshold: r.threshold,
    amount: r.amount,
    frequency: r.frequency,
    nextRun: r.next_run,
    createdBy: r.created_by,
    alertDismissedFor: r.alert_dismissed_for,
  });

  const lastRunStmt = db.prepare(
    'SELECT date, status, amount, note FROM action_runs WHERE action_ID = ? ORDER BY run_ID DESC LIMIT 1',
  );

  const listActions = () => {
    const userId = currentUser();
    const accounts = userAccounts(userId);
    const nameOf = (id) => accounts.find((a) => a.id === id)?.name ?? 'a closed account';
    const actions = db
      .prepare('SELECT * FROM actions WHERE user_ID = ? ORDER BY action_ID')
      .all(userId)
      .map((r) => {
        const a = fromRow(r);
        const last = lastRunStmt.get(a.id);
        return { ...a, description: describeAction(a, nameOf), lastRun: last ? { ...last } : null };
      });
    return { accounts, actions };
  };

  const ownAction = (id) => {
    const row = db.prepare('SELECT * FROM actions WHERE action_ID = ? AND user_ID = ?').get(Number(id), currentUser());
    if (!row) throw new HttpError(404, `No action ${id}.`);
    return fromRow(row);
  };

  const validate = (body = {}) => {
    try {
      return normaliseAction(body, userAccounts(currentUser()), { now: now() });
    } catch (e) {
      throw new HttpError(400, e.message);
    }
  };

  const createAction = (body = {}) => {
    const a = validate(body);
    const createdBy = body.createdBy === 'ai' ? 'ai' : 'user';
    const { lastInsertRowid } = db
      .prepare(
        `INSERT INTO actions (user_ID, kind, from_account_ID, to_account_ID, threshold, amount, frequency, next_run, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(currentUser(), a.kind, a.from, a.to, a.threshold, a.amount, a.frequency, a.nextRun, createdBy);
    return { action: ownAction(lastInsertRowid) };
  };

  const updateAction = ({ id }, body = {}) => {
    const old = ownAction(id);
    const a = validate({ ...old, ...body });
    db.prepare(
      `UPDATE actions SET kind = ?, from_account_ID = ?, to_account_ID = ?, threshold = ?, amount = ?, frequency = ?,
       next_run = ?, alert_dismissed_for = NULL WHERE action_ID = ?`,
    ).run(a.kind, a.from, a.to, a.threshold, a.amount, a.frequency, a.nextRun, old.id);
    return { action: ownAction(old.id) };
  };

  const deleteAction = ({ id }) => {
    const a = ownAction(id);
    db.prepare('DELETE FROM actions WHERE action_ID = ?').run(a.id);
    return { deleted: a.id };
  };

  const logRun = (actionId, status, amount, note) =>
    db
      .prepare('INSERT INTO action_runs (action_ID, date, status, amount, note) VALUES (?, ?, ?, ?, ?)')
      .run(actionId, isoDate(now()), status, amount, note ?? null);

  const skipAction = ({ id }) => {
    const a = ownAction(id);
    const nextRun = addPeriod(a.nextRun, a.frequency);
    db.prepare('UPDATE actions SET next_run = ?, alert_dismissed_for = NULL WHERE action_ID = ?').run(nextRun, a.id);
    logRun(a.id, 'skipped', 0, `Skipped the run on ${txnDate(parseIso(a.nextRun))}.`);
    return { action: ownAction(a.id) };
  };

  const dismissAlert = ({ id }) => {
    const a = ownAction(id);
    db.prepare('UPDATE actions SET alert_dismissed_for = next_run WHERE action_ID = ?').run(a.id);
    return { action: ownAction(a.id) };
  };

  // Moves the money for one action (balances + a pair of "Payment to/from" transactions) and logs the run.
  const execute = (a) => {
    const accounts = db.prepare('SELECT account_ID, account_type, balance FROM accounts WHERE user_ID = ?').all(a.userId);
    const balances = new Map(accounts.map((r) => [r.account_ID, r.balance]));
    const name = (id) => accounts.find((r) => r.account_ID === id)?.account_type;
    const result = planRun(a, balances);

    db.exec('BEGIN');
    try {
      if (result.status === 'moved') {
        const move = db.prepare('UPDATE accounts SET balance = ROUND(balance + ?, 2) WHERE account_ID = ?');
        move.run(-result.amount, a.from);
        move.run(result.amount, a.to);
        const txn = db.prepare(
          'INSERT INTO transactions (user_ID, account_ID, amount, date, name, negative) VALUES (?, ?, ?, ?, ?, ?)',
        );
        const date = txnDate(now());
        txn.run(a.userId, a.from, result.amount, date, `Payment to ${name(a.to)}`, 1);
        txn.run(a.userId, a.to, result.amount, date, `Payment from ${name(a.from)}`, 0);
      }
      logRun(a.id, result.status, result.amount, result.note);
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
    return result;
  };

  const runNow = ({ id }) => {
    const a = ownAction(id);
    return { result: execute(a), action: ownAction(a.id) };
  };

  // Runs every action (any user) whose run time has passed, once, then schedules its next run in the future.
  const runDue = () => {
    const t = now();
    const due = db
      .prepare('SELECT * FROM actions')
      .all()
      .map(fromRow)
      .filter((a) => runTime(a.nextRun) <= t);
    return due.map((a) => {
      const result = execute(a);
      let next = addPeriod(a.nextRun, a.frequency);
      while (runTime(next) <= t) next = addPeriod(next, a.frequency); // catch up if the server was off
      db.prepare('UPDATE actions SET next_run = ?, alert_dismissed_for = NULL WHERE action_ID = ?').run(next, a.id);
      return { id: a.id, ...result, nextRun: next };
    });
  };

  // [method, path (":id" = a number), handler(params, body)]
  const signOut = () => {
    db.prepare('DELETE FROM session').run();
    return { signedOut: true };
  };

  const routes = [
    ['GET', '/api/home', () => getHome()],
    ['GET', '/api/banking', () => getBanking()],
    ['PUT', '/api/theme', (_, body) => setTheme(body)],
    ['PUT', '/api/wallpaper', (_, body) => setWallpaper(body)],
    ['PUT', '/api/homepage', (_, body) => setHomepage(body)],
    ['PUT', '/api/session', (_, body) => signIn(body)],
    ['DELETE', '/api/session', () => signOut()],
    ['GET', '/api/actions', () => listActions()],
    ['POST', '/api/actions', (_, body) => createAction(body)],
    ['PUT', '/api/actions/:id', updateAction],
    ['DELETE', '/api/actions/:id', deleteAction],
    ['POST', '/api/actions/:id/skip', skipAction],
    ['POST', '/api/actions/:id/dismiss', dismissAlert],
    ['POST', '/api/actions/:id/run', runNow],
  ].map(([method, path, handler]) => ({
    method,
    regex: new RegExp(`^${path.replace(':id', '(?<id>\\d+)')}$`),
    handler,
  }));

  const api = (method, path, body) => {
    for (const route of routes) {
      const m = route.method === method && path.match(route.regex);
      if (!m) continue;
      try {
        return { status: 200, json: route.handler({ ...m.groups }, body) };
      } catch (e) {
        return { status: e.status ?? 500, json: { error: e.message } };
      }
    }
    return { status: 404, json: { error: `No route ${method} ${path}` } };
  };
  api.runDue = runDue;
  return api;
}

// Columns added to existing tables after app.db was first built (CREATE TABLE IF NOT EXISTS won't add them).
export function migrate(db) {
  const columns = (table) => db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
  // A column is missing only if its table exists without it (tables themselves come from schema.sql).
  const has = (table, column) => {
    const cols = columns(table);
    return !cols.length || cols.includes(column);
  };
  if (!has('homepage_widgets', 'variant')) db.exec('ALTER TABLE homepage_widgets ADD COLUMN variant TEXT');
  if (!has('homepage_widgets', 'count')) db.exec('ALTER TABLE homepage_widgets ADD COLUMN count INTEGER');
  if (!has('customisation', 'wallpaper')) {
    db.exec('ALTER TABLE customisation ADD COLUMN wallpaper INTEGER NOT NULL DEFAULT 0');
  }
}

function startServer({ file, port }) {
  const db = new DatabaseSync(file);
  // Bring app.db up to date with schema.sql (every statement is CREATE ... IF NOT EXISTS / INSERT OR IGNORE).
  db.exec(readFileSync(new URL('./schema.sql', import.meta.url), 'utf8'));
  migrate(db);
  const api = createApi(db);
  const hits = new Map(); // client -> { start, count }

  const send = (res, status, json) => {
    res.writeHead(status, {
      'Content-Type': 'application/json',
      // The Expo web app runs on another port, so allow cross-origin calls.
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, PUT, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end(json === undefined ? '' : JSON.stringify(json));
  };

  createServer(async (req, res) => {
    if (req.method === 'OPTIONS') return send(res, 204);

    const client = req.socket.remoteAddress;
    const now = Date.now();
    const hit = hits.get(client);
    if (!hit || now - hit.start > 60_000) hits.set(client, { start: now, count: 1 });
    else if (++hit.count > RATE_LIMIT) return send(res, 429, { error: 'Too many requests, slow down.' });

    let body;
    if (req.method === 'PUT' || req.method === 'POST') {
      let raw = '';
      for await (const chunk of req) raw += chunk;
      try {
        body = JSON.parse(raw || '{}');
      } catch {
        return send(res, 400, { error: 'Body must be JSON.' });
      }
    }
    const { status, json } = api(req.method, new URL(req.url, 'http://x').pathname, body);
    send(res, status, json);
  }).listen(port, () => console.log(`Database API on http://localhost:${port} (${file})`));

  // Run any due actions now, then every minute.
  const tick = () => {
    try {
      api.runDue().forEach((r) => console.log(`Action ${r.id}: ${r.status}${r.amount ? ` $${r.amount}` : ''}`));
    } catch (e) {
      console.error(`Running actions failed: ${e.message}`);
    }
  };
  tick();
  setInterval(tick, 60_000);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  startServer({
    file: fileURLToPath(new URL('./app.db', import.meta.url)),
    port: Number(process.env.DB_PORT) || 3001,
  });
}
