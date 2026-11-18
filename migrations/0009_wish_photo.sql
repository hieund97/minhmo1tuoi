-- ảnh khách gửi kèm lời chúc (key R2 dạng w/<uuid>.webp), rỗng nếu không có
ALTER TABLE wishes ADD COLUMN photo TEXT NOT NULL DEFAULT '';
