CREATE TABLE IF NOT EXISTS notes (
  id TEXT PRIMARY KEY,
  image_key TEXT NOT NULL,
  stickers TEXT NOT NULL DEFAULT '[]',
  notes TEXT NOT NULL DEFAULT '[]',
  author TEXT NOT NULL,
  author_color TEXT NOT NULL,
  created_at TEXT NOT NULL,
  month TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_notes_month ON notes(month);
CREATE INDEX IF NOT EXISTS idx_notes_created_at ON notes(created_at);

CREATE TABLE IF NOT EXISTS doodle (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  date TEXT NOT NULL,
  items TEXT NOT NULL DEFAULT '[]'
);
