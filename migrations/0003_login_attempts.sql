-- đếm lần nhập sai mật khẩu admin theo IP để khóa tạm khi dò mật khẩu
CREATE TABLE login_attempts (
  ip_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX login_attempts_ip ON login_attempts (ip_hash, created_at);
