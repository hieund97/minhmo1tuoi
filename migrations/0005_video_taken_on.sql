-- ngày quay video (YYYY-MM-DD), hiện dưới video ở trang chủ
ALTER TABLE videos ADD COLUMN taken_on TEXT NOT NULL DEFAULT '';
