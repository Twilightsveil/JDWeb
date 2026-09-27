ALTER TABLE notes ADD COLUMN lat REAL;
ALTER TABLE notes ADD COLUMN lng REAL;

ALTER TABLE users ADD COLUMN password_hash TEXT;
ALTER TABLE users ADD COLUMN password_salt TEXT;

ALTER TABLE settings ADD COLUMN big_event_label TEXT;
ALTER TABLE settings ADD COLUMN big_event_date TEXT;

ALTER TABLE chat_messages ADD COLUMN audio_key TEXT;
ALTER TABLE chat_messages ADD COLUMN duration REAL;

CREATE TABLE IF NOT EXISTS wishlist_items (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  text TEXT NOT NULL,
  done INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS poems (
  id TEXT PRIMARY KEY,
  title TEXT,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS typing_status (
  username TEXT PRIMARY KEY,
  until TEXT NOT NULL
);
