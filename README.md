# Mỡ tròn 1 tuổi

Website sinh nhật 1 tuổi của bé Mỡ (Nguyễn Phúc Đăng Minh) — https://minhmo1tuoi.online

- Trang chính: thổi nến, đếm ngược, 12 tháng (mỗi tháng 3 ảnh), video, bàn ảnh, lời chúc
- `/admin`: duyệt lời chúc, sửa ảnh 12 tháng, bàn ảnh, video (đăng nhập bằng mật khẩu `ADMIN_PASSWORD`)

## Stack

| Lớp | Dùng |
|---|---|
| Trang | HTML/CSS/JS thuần trong `public/`, phục vụ bằng Workers Static Assets |
| API | `src/worker.js` (route `/api/*`, `/media/*`) |
| Dữ liệu | D1 `minhmo1tuoi-db` (lời chúc, ảnh, video, chú thích tháng) |
| Ảnh/video | R2 `minhmo1tuoi-media` |

## Lệnh

```bash
npm install
echo 'ADMIN_PASSWORD=localtest' > .dev.vars
npm run db:local && npm run dev   # chạy local
npm test                          # test validate
npm run deploy                    # apply migration remote + deploy
npx wrangler secret put ADMIN_PASSWORD   # đổi mật khẩu admin
```
