CREATE TABLE IF NOT EXISTS time_capsules (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  title TEXT,
  body TEXT NOT NULL,
  reveal_date TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS milestones (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  milestone_date TEXT NOT NULL,
  note TEXT,
  image_key TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  event_date TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL
);
