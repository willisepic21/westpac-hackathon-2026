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
    priority   INTEGER NOT NULL,
    variant    TEXT,      -- widget style, e.g. 'hero' / 'carousel' (null = the widget's default)
    count      INTEGER    -- Recent transactions only: how many to show
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

-- Actions: money automations the user (or the AI, with the user's approval) sets up, e.g.
-- "if Westpac Choice is over $500, move the extra to Westpac Life every week".
-- Run by database/server.mjs at 9am on next_run. Rules live in src/actions/rules.js.
--   kind = 'sweep'    : if from_account is over `threshold`, move the extra to to_account
--          'top_up'   : if to_account is under `threshold`, top it up from from_account
--          'transfer' : move a fixed `amount` from from_account to to_account
CREATE TABLE IF NOT EXISTS actions (
    action_ID            INTEGER PRIMARY KEY,
    user_ID              INTEGER NOT NULL REFERENCES users(ID),
    kind                 TEXT    NOT NULL CHECK (kind IN ('sweep', 'top_up', 'transfer')),
    from_account_ID      INTEGER NOT NULL REFERENCES accounts(account_ID),
    to_account_ID        INTEGER NOT NULL REFERENCES accounts(account_ID),
    threshold            REAL,                                  -- sweep / top_up
    amount               REAL,                                  -- transfer
    frequency            TEXT    NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly')),
    next_run             TEXT    NOT NULL,                      -- ISO date, e.g. 2026-11-18
    created_by           TEXT    NOT NULL DEFAULT 'user' CHECK (created_by IN ('user', 'ai')),
    alert_dismissed_for  TEXT                                   -- next_run the user already saw the alert for
);

-- History of every time an action ran, was skipped, or had nothing to move.
CREATE TABLE IF NOT EXISTS action_runs (
    run_ID     INTEGER PRIMARY KEY,
    action_ID  INTEGER NOT NULL REFERENCES actions(action_ID) ON DELETE CASCADE,
    date       TEXT    NOT NULL,                                -- ISO date
    status     TEXT    NOT NULL CHECK (status IN ('moved', 'nothing', 'skipped', 'failed')),
    amount     REAL    NOT NULL DEFAULT 0,
    note       TEXT
);
