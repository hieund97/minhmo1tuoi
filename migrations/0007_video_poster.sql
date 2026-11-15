-- ảnh bìa video (key ảnh trên R2), trang chủ hiện ảnh này thay vì tải sẵn mọi video
ALTER TABLE videos ADD COLUMN poster TEXT NOT NULL DEFAULT '';
