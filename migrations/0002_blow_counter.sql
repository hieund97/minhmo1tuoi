-- đếm số người đã thổi nến (mỗi trình duyệt tính 1 lần)
CREATE TABLE counters (
  name TEXT PRIMARY KEY,
  value INTEGER NOT NULL DEFAULT 0
);
INSERT INTO counters (name, value) VALUES ('blows', 0);
