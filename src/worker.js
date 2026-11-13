import { validateWish, cleanText, validMonthSlot, validKey, parseRange } from './validate.js';

const json = (data, status = 200, headers = {}) => Response.json(data, { status, headers: { 'cache-control': 'no-store', ...headers } });
const bad = (msg, status = 400) => json({ error: msg }, status);

async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

// so sánh qua hash để thời gian so sánh không lộ độ dài/ký tự đúng của mật khẩu
async function isAdmin(req, env) {
  const h = req.headers.get('authorization') || '';
  if (!env.ADMIN_PASSWORD || !h.startsWith('Bearer ')) return false;
  const [a, b] = await Promise.all([sha256(h.slice(7)), sha256(env.ADMIN_PASSWORD)]);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const readJson = req => req.json().catch(() => null);

const EXT = { 'image/webp': 'webp', 'image/jpeg': 'jpg', 'image/png': 'png', 'video/mp4': 'mp4', 'video/quicktime': 'mov', 'video/webm': 'webm' };
const newKey = type => `${type.startsWith('video/') ? 'v' : 'p'}/${crypto.randomUUID()}.${EXT[type]}`;

async function serveMedia(req, env, key) {
  if (!validKey(key)) return new Response('Not found', { status: 404 });
  let range = parseRange(req.headers.get('range')), obj;
  try { obj = await env.BUCKET.get(key, { range: range ?? undefined, onlyIf: req.headers }); }
  catch { range = null; obj = await env.BUCKET.get(key); } // range vượt quá file thì trả cả file
  if (!obj) return new Response('Not found', { status: 404 });
  const h = new Headers();
  obj.writeHttpMetadata(h);
  h.set('etag', obj.httpEtag);
  h.set('cache-control', 'public, max-age=31536000, immutable'); // key là uuid, đổi ảnh thì đổi key
  h.set('accept-ranges', 'bytes');
  if (!('body' in obj)) return new Response(null, { status: 304, headers: h });
  if (range && obj.range) {
    const off = range.suffix != null ? Math.max(0, obj.size - range.suffix) : range.offset;
    const len = Math.min(range.suffix ?? range.length ?? obj.size - off, obj.size - off);
    h.set('content-range', `bytes ${off}-${off + len - 1}/${obj.size}`);
    h.set('content-length', String(len));
    return new Response(obj.body, { status: 206, headers: h });
  }
  h.set('content-length', String(obj.size));
  return new Response(obj.body, { headers: h });
}

async function content(env) {
  const [months, photos, videos, wishes, blows] = await env.DB.batch([
    env.DB.prepare('SELECT month, caption FROM months'),
    env.DB.prepare('SELECT id, key, caption, place, month, slot FROM photos ORDER BY id'),
    env.DB.prepare('SELECT id, key, title, duration FROM videos ORDER BY id'),
    env.DB.prepare("SELECT id, name, message, color FROM wishes WHERE status = 'approved' ORDER BY id DESC"),
    env.DB.prepare("SELECT value FROM counters WHERE name = 'blows'"),
  ]);
  return {
    blows: blows.results[0]?.value ?? 0,
    months: months.results,
    monthPhotos: photos.results.filter(p => p.place === 'month'),
    table: photos.results.filter(p => p.place === 'table'),
    videos: videos.results,
    wishes: wishes.results,
  };
}

async function api(req, env, url) {
  const p = url.pathname, m = req.method;

  if (p === '/api/content' && m === 'GET') return json(await content(env), 200, { 'cache-control': 'public, max-age=20' });

  if (p === '/api/blow' && m === 'POST') {
    const value = await env.DB.prepare("UPDATE counters SET value = value + 1 WHERE name = 'blows' RETURNING value").first('value');
    return json({ blows: value });
  }

  if (p === '/api/wishes' && m === 'POST') {
    const { wish, error } = validateWish(await readJson(req));
    if (error === 'spam') return json({ ok: true }); // không cho bot biết bị chặn
    if (error) return bad(error);
    const ip = await sha256((req.headers.get('cf-connecting-ip') || '') + (env.ADMIN_PASSWORD || ''));
    const recent = await env.DB.prepare("SELECT COUNT(*) AS n FROM wishes WHERE ip_hash = ? AND created_at > datetime('now', '-1 hour')").bind(ip).first('n');
    if (recent >= 5) return bad('Bạn gửi nhiều lời chúc quá, thử lại sau một lúc nhé.', 429);
    // lời chúc hiện ngay; bố mẹ ẩn bớt trong /admin nếu không muốn hiển thị
    const row = await env.DB.prepare("INSERT INTO wishes (name, message, color, ip_hash, status) VALUES (?, ?, ?, ?, 'approved') RETURNING id, name, message, color")
      .bind(wish.name, wish.message, wish.color, ip).first();
    return json({ ok: true, wish: row }, 201);
  }

  if (!p.startsWith('/api/admin/')) return bad('Not found', 404);
  if (!(await isAdmin(req, env))) return bad('Sai mật khẩu.', 401);
  const a = p.slice('/api/admin/'.length).split('/'); // ví dụ ['photos', '12']
  const id = Number(a[1]);

  if (a[0] === 'check') return json({ ok: true });

  if (a[0] === 'wishes') {
    if (m === 'GET') return json((await env.DB.prepare('SELECT id, name, message, color, status, created_at FROM wishes ORDER BY id DESC').all()).results);
    if (m === 'PATCH') {
      const b = await readJson(req);
      if (!['approved', 'rejected', 'pending'].includes(b?.status)) return bad('Trạng thái không hợp lệ.');
      await env.DB.prepare('UPDATE wishes SET status = ? WHERE id = ?').bind(b.status, id).run();
      return json({ ok: true });
    }
    if (m === 'DELETE') {
      await env.DB.prepare('DELETE FROM wishes WHERE id = ?').bind(id).run();
      return json({ ok: true });
    }
  }

  // upload: ảnh (đã nén ở trình duyệt) gửi một lần; video gửi từng phần qua multipart vì Worker giới hạn 100 MB mỗi request
  if (a[0] === 'upload') {
    const type = req.headers.get('x-type') || '';
    if (a[1] === 'put' && m === 'PUT') {
      if (!EXT[type] || type.startsWith('video/')) return bad('Chỉ nhận ảnh WebP, JPG, PNG.');
      const key = newKey(type);
      await env.BUCKET.put(key, req.body, { httpMetadata: { contentType: type } });
      return json({ key });
    }
    if (a[1] === 'start' && m === 'POST') {
      if (!EXT[type]) return bad('Định dạng không hỗ trợ.');
      const key = newKey(type);
      const up = await env.BUCKET.createMultipartUpload(key, { httpMetadata: { contentType: type } });
      return json({ key, uploadId: up.uploadId });
    }
    const key = url.searchParams.get('key'), uploadId = url.searchParams.get('uploadId');
    if (!validKey(key) || !uploadId) return bad('Thiếu key.');
    const up = env.BUCKET.resumeMultipartUpload(key, uploadId);
    if (a[1] === 'part' && m === 'PUT') {
      const n = Number(url.searchParams.get('n'));
      if (!Number.isInteger(n) || n < 1 || n > 10000) return bad('Số phần không hợp lệ.');
      return json(await up.uploadPart(n, req.body));
    }
    if (a[1] === 'complete' && m === 'POST') { await up.complete((await readJson(req))?.parts || []); return json({ key }); }
    if (a[1] === 'abort' && m === 'POST') { await up.abort(); return json({ ok: true }); }
  }

  if (a[0] === 'photos') {
    if (m === 'POST') {
      const b = await readJson(req);
      if (!validKey(b?.key)) return bad('Thiếu ảnh.');
      const caption = cleanText(b.caption, 40);
      if (b.place === 'table') {
        const r = await env.DB.prepare("INSERT INTO photos (key, caption, place) VALUES (?, ?, 'table') RETURNING id, key, caption").bind(b.key, caption).first();
        return json(r, 201);
      }
      if (b.place === 'month' && validMonthSlot(b.month, b.slot)) {
        const old = await env.DB.prepare("SELECT key FROM photos WHERE place = 'month' AND month = ? AND slot = ?").bind(b.month, b.slot).first('key');
        await env.DB.batch([
          env.DB.prepare("DELETE FROM photos WHERE place = 'month' AND month = ? AND slot = ?").bind(b.month, b.slot),
          env.DB.prepare("INSERT INTO photos (key, caption, place, month, slot) VALUES (?, ?, 'month', ?, ?)").bind(b.key, caption, b.month, b.slot),
        ]);
        if (old) await env.BUCKET.delete(old);
        return json({ ok: true }, 201);
      }
      return bad('Vị trí ảnh không hợp lệ.');
    }
    const row = await env.DB.prepare('SELECT key FROM photos WHERE id = ?').bind(id).first();
    if (!row) return bad('Không tìm thấy ảnh.', 404);
    if (m === 'PATCH') {
      const b = await readJson(req);
      if (b?.key !== undefined) {
        if (!validKey(b.key)) return bad('Ảnh không hợp lệ.');
        await env.DB.prepare('UPDATE photos SET key = ? WHERE id = ?').bind(b.key, id).run();
        await env.BUCKET.delete(row.key);
      }
      if (b?.caption !== undefined) await env.DB.prepare('UPDATE photos SET caption = ? WHERE id = ?').bind(cleanText(b.caption, 40), id).run();
      return json({ ok: true });
    }
    if (m === 'DELETE') {
      await env.DB.prepare('DELETE FROM photos WHERE id = ?').bind(id).run();
      await env.BUCKET.delete(row.key);
      return json({ ok: true });
    }
  }

  if (a[0] === 'months' && m === 'PUT') {
    const b = await readJson(req);
    if (!validMonthSlot(id, 1)) return bad('Tháng không hợp lệ.');
    await env.DB.prepare('INSERT INTO months (month, caption) VALUES (?, ?) ON CONFLICT(month) DO UPDATE SET caption = excluded.caption').bind(id, cleanText(b?.caption, 40)).run();
    return json({ ok: true });
  }

  if (a[0] === 'videos') {
    if (m === 'POST') {
      const b = await readJson(req);
      if (!validKey(b?.key)) return bad('Thiếu video.');
      const r = await env.DB.prepare('INSERT INTO videos (key, title, duration) VALUES (?, ?, ?) RETURNING id, key, title, duration')
        .bind(b.key, cleanText(b.title, 60), cleanText(b.duration, 10)).first();
      return json(r, 201);
    }
    const row = await env.DB.prepare('SELECT key FROM videos WHERE id = ?').bind(id).first();
    if (!row) return bad('Không tìm thấy video.', 404);
    if (m === 'PATCH') {
      const b = await readJson(req);
      await env.DB.prepare('UPDATE videos SET title = ? WHERE id = ?').bind(cleanText(b?.title, 60), id).run();
      return json({ ok: true });
    }
    if (m === 'DELETE') {
      await env.DB.prepare('DELETE FROM videos WHERE id = ?').bind(id).run();
      await env.BUCKET.delete(row.key);
      return json({ ok: true });
    }
  }

  return bad('Not found', 404);
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname.startsWith('/media/')) return serveMedia(req, env, decodeURIComponent(url.pathname.slice(7)));
    if (url.pathname.startsWith('/api/')) {
      try { return await api(req, env, url); }
      catch (e) { console.error(e); return bad('Có lỗi xảy ra, thử lại sau nhé.', 500); }
    }
    return env.ASSETS.fetch(req);
  },
};
