PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
    ID     INTEGER PRIMARY KEY,
    name   TEXT    NOT NULL,
    age    INTEGER,
    email  TEXT
);

CREATE TABLE IF NOT EXISTS accounts (
    account_ID    INTEGER PRIMARY KEY,
    user_ID       INTEGER NOT NULL REFERENCES users(ID),
    account_type  TEXT    NOT NULL,
    balance       REAL    NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS transactions (
    transaction_ID  INTEGER PRIMARY KEY,
    user_ID         INTEGER NOT NULL REFERENCES users(ID),
    account_ID      INTEGER NOT NULL REFERENCES accounts(account_ID),
    amount          REAL    NOT NULL,
    date            TEXT    NOT NULL,                             -- ISO 8601, e.g. 2026-11-16
    name            TEXT,
    negative        INTEGER NOT NULL CHECK (negative IN (0, 1))   -- boolean
);

-- No primary key, as requested.
CREATE TABLE IF NOT EXISTS customisation (
    user_ID           INTEGER NOT NULL REFERENCES users(ID),
    theme             TEXT    NOT NULL
);

-- Every widget the home page can show (keep in sync with WIDGETS in src/personalise/widgetCatalog.js).
CREATE TABLE IF NOT EXISTS widgets (
    widget_ID  INTEGER PRIMARY KEY,
    name       TEXT    NOT NULL
);

-- Which widgets each user has on Home, in priority order (1 = top). No primary key, as requested.
CREATE TABLE IF NOT EXISTS homepage_widgets (
    user_ID    INTEGER NOT NULL REFERENCES users(ID),
    widget_ID  INTEGER NOT NULL REFERENCES widgets(widget_ID),
    priority   INTEGER NOT NULL
);

INSERT OR IGNORE INTO widgets (widget_ID, name) VALUES
    (1, 'Money goal'),
    (2, 'Weekly spend gauge'),
    (3, 'Pinned accounts'),
    (4, 'Quick tiles'),
    (5, 'Recent transactions'),
    (6, 'Net worth'),
    (7, 'Upcoming bills'),
    (8, 'Move money'),
    (9, 'Total available');

-- Who is currently signed into the app. Always exactly one row (ID is locked to 1);
-- switch user with: UPDATE session SET user_ID = 2;
CREATE TABLE IF NOT EXISTS session (
    ID       INTEGER PRIMARY KEY CHECK (ID = 1),
    user_ID  INTEGER NOT NULL DEFAULT 1 REFERENCES users(ID)
);

-- Sign in as user 1 by default (skipped on an empty database with no users yet).
INSERT OR IGNORE INTO session (ID, user_ID) SELECT 1, 1 WHERE EXISTS (SELECT 1 FROM users WHERE ID = 1);

-- Every colour theme the app can use (keep in sync with PALETTES in src/personalise/themes.js).
-- `name` is what customisation.theme stores; `label` is the readable name shown to the AI.
CREATE TABLE IF NOT EXISTS themes (
    name   TEXT PRIMARY KEY,
    label  TEXT NOT NULL
);

INSERT OR IGNORE INTO themes (name, label) VALUES
    ('westpac',  'Westpac red + navy'),
    ('forest',   'Forest + mint'),
    ('lavender', 'Lavender + violet'),
    ('sand',     'Sand + rust'),
    ('midnight', 'Midnight + coral'),
    ('ocean',    'Ocean + sky'),
    ('plum',     'Plum + gold'),
    ('slate',    'Slate + amber'),
    ('charcoal', 'Charcoal + lime'),
    ('sage',     'Sage + terracotta');
