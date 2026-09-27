CREATE TABLE IF NOT EXISTS users (
  username TEXT PRIMARY KEY,
  nickname TEXT NOT NULL,
  color TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  together_since TEXT,
  next_date TEXT
);

ALTER TABLE notes ADD COLUMN reactions TEXT NOT NULL DEFAULT '[]';
