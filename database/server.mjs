// Small local API between the app and database/app.db (run with `npm run db`, next to `npm start`).
// The app (and so the AI) only gets these fixed endpoints, never SQL (see ai_perms.md).
// Everything applies to the signed-in user from the `session` table; the app never sends a user ID.
//
//   GET /api/home       -> { userId, theme, themes: [{ name, label }], widgets: [{ id, name }], homepage: [widget ids, top first] }
//   GET /api/banking    -> { accounts: [...], transactions: [...] } for the home widgets (never sent to the AI)
//   PUT /api/theme      { theme: 'forest' }   saves customisation.theme
//   PUT /api/homepage   { widgets: [1, 5, 7] } replaces homepage_widgets (priority 1 = top)
//
// Uses Node's built-in node:sqlite, so there is nothing to install.

import { createServer } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

const RATE_LIMIT = 120; // requests per minute per client

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/** Route handler for one database. Returns (method, path, body) -> { status, json }. Exported for tests. */
export function createApi(db) {
  db.exec('PRAGMA foreign_keys = ON');

  const currentUser = () => {
    const row = db.prepare('SELECT user_ID FROM session WHERE ID = 1').get();
    if (!row) throw new HttpError(500, 'Nobody is signed in (the session table is empty).');
    return row.user_ID;
  };

  const getHome = () => {
    const userId = currentUser();
    return {
      userId,
      theme: db.prepare('SELECT theme FROM customisation WHERE user_ID = ? LIMIT 1').get(userId)?.theme ?? null,
      themes: db.prepare('SELECT name, label FROM themes ORDER BY rowid').all().map((r) => ({ ...r })),
      widgets: db.prepare('SELECT widget_ID AS id, name FROM widgets ORDER BY widget_ID').all().map((r) => ({ ...r })),
      homepage: db
        .prepare('SELECT widget_ID FROM homepage_widgets WHERE user_ID = ? ORDER BY priority')
        .all(userId)
        .map((r) => r.widget_ID),
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

  const setHomepage = ({ widgets } = {}) => {
    if (!Array.isArray(widgets)) throw new HttpError(400, '"widgets" must be a list of widget IDs.');
    const known = db.prepare('SELECT 1 FROM widgets WHERE widget_ID = ?');
    widgets.forEach((id) => {
      if (!known.get(id)) throw new HttpError(400, `Unknown widget ID ${id}.`);
    });
    const userId = currentUser();
    const insert = db.prepare('INSERT INTO homepage_widgets (user_ID, widget_ID, priority) VALUES (?, ?, ?)');
    db.exec('BEGIN');
    try {
      db.prepare('DELETE FROM homepage_widgets WHERE user_ID = ?').run(userId);
      widgets.forEach((id, i) => insert.run(userId, id, i + 1));
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
    return { widgets };
  };

  const routes = {
    'GET /api/home': getHome,
    'GET /api/banking': getBanking,
    'PUT /api/theme': setTheme,
    'PUT /api/homepage': setHomepage,
  };

  return (method, path, body) => {
    const route = routes[`${method} ${path}`];
    if (!route) return { status: 404, json: { error: `No route ${method} ${path}` } };
    try {
      return { status: 200, json: route(body) };
    } catch (e) {
      return { status: e.status ?? 500, json: { error: e.message } };
    }
  };
}

function startServer({ file, port }) {
  const api = createApi(new DatabaseSync(file));
  const hits = new Map(); // client -> { start, count }

  const send = (res, status, json) => {
    res.writeHead(status, {
      'Content-Type': 'application/json',
      // The Expo web app runs on another port, so allow cross-origin calls.
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
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
    if (req.method === 'PUT') {
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
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  startServer({
    file: fileURLToPath(new URL('./app.db', import.meta.url)),
    port: Number(process.env.DB_PORT) || 3001,
  });
}
