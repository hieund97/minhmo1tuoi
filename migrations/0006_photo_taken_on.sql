-- ngày chụp ảnh (YYYY-MM-DD), đọc EXIF lúc upload; admin sửa được
ALTER TABLE photos ADD COLUMN taken_on TEXT NOT NULL DEFAULT '';
