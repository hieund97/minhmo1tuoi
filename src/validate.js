export const COLORS = ['dao', 'xanh', 'vang', 'bacha', 'hong'];

const clean = (v, max) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');

// Trả về { wish } nếu hợp lệ, hoặc { error } để hiện cho người gửi
export function validateWish(body) {
  if (!body || typeof body !== 'object') return { error: 'Dữ liệu không hợp lệ.' };
  if (body.website) return { error: 'spam' }; // ô ẩn, người thật không điền
  const name = clean(body.name, 40);
  const message = typeof body.message === 'string' ? body.message.trim().slice(0, 500) : '';
  const color = COLORS.includes(body.color) ? body.color : COLORS[0];
  if (!name) return { error: 'Bạn điền tên để bố mẹ Mỡ biết ai gửi nhé.' };
  if (message.length < 5) return { error: 'Lời chúc hơi ngắn, viết thêm vài chữ nữa nha.' };
  return { wish: { name, message, color } };
}

export const cleanText = clean;

export const validMonthSlot = (m, s) => Number.isInteger(m) && m >= 1 && m <= 12 && Number.isInteger(s) && s >= 1 && s <= 3;

// key do server sinh ra: p/<uuid>.<ext> hoặc v/<uuid>.<ext>
export const validKey = k => typeof k === 'string' && /^[pv]\/[0-9a-f-]{36}\.[a-z0-9]{2,5}$/.test(k);

// "bytes=a-b" | "bytes=a-" | "bytes=-n" → tham số range của R2; header lạ/nhiều khoảng → null (trả cả file)
export function parseRange(h) {
  const m = /^bytes=(\d*)-(\d*)$/.exec(h || '');
  if (!m || (m[1] === '' && m[2] === '')) return null;
  if (m[1] === '') return +m[2] > 0 ? { suffix: +m[2] } : null;
  const offset = +m[1];
  if (m[2] === '') return { offset };
  const length = +m[2] - offset + 1;
  return length > 0 ? { offset, length } : null;
}

// Từ bậy thường gặp, so khớp nguyên từ và GIỮ dấu (bỏ dấu thì "lớn" trùng "lồn")
const BAD = new Set(['lồn', 'buồi', 'cặc', 'địt', 'đụ', 'đéo', 'đĩ', 'cứt', 'đm', 'đmm', 'dm', 'dmm', 'đcm', 'dcm', 'đkm', 'dkm', 'đmcs', 'dmcs',
  'vcl', 'vkl', 'vl', 'clm', 'cmm', 'cc', 'loz', 'fuck', 'fucking', 'shit', 'bitch', 'dick', 'pussy']);
export const hasBadWords = text => String(text).normalize('NFC').toLowerCase().split(/[^\p{L}\p{N}]+/u).some(w => BAD.has(w));

// ngày dạng YYYY-MM-DD có thật, sai thì trả chuỗi rỗng
export function validDate(v) {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return '';
  const d = new Date(v + 'T00:00:00Z');
  return !isNaN(d) && d.toISOString().slice(0, 10) === v ? v : '';
}
