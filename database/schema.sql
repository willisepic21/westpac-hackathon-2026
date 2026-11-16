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
    primary_colour    TEXT,
    secondary_colour  TEXT
);
