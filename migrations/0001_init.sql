CREATE TABLE wishes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  message TEXT NOT NULL,
  color TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | approved | rejected
  ip_hash TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX wishes_status ON wishes (status, id);
CREATE INDEX wishes_ip ON wishes (ip_hash, created_at);

-- place = 'month': ảnh của tháng `month` (1-12), ô `slot` (1-3); place = 'table': ảnh trên bàn ảnh
CREATE TABLE photos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT NOT NULL,
  caption TEXT NOT NULL DEFAULT '',
  place TEXT NOT NULL,
  month INTEGER,
  slot INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX photos_month_slot ON photos (month, slot) WHERE place = 'month';

CREATE TABLE videos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  duration TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE months (
  month INTEGER PRIMARY KEY,
  caption TEXT NOT NULL DEFAULT ''
);
