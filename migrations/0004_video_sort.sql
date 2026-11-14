-- thứ tự hiển thị video, admin kéo thả để đổi
ALTER TABLE videos ADD COLUMN sort INTEGER NOT NULL DEFAULT 0;
UPDATE videos SET sort = id;
