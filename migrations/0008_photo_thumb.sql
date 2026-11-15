-- ảnh thu nhỏ (cạnh dài 640px) để hiển thị trên trang chủ; bấm xem lớn mới dùng ảnh gốc
ALTER TABLE photos ADD COLUMN thumb TEXT NOT NULL DEFAULT '';
