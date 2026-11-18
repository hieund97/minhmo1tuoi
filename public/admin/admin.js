(() => {
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const kb = n => n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.round(n / 1024) + ' KB';
let tt; function toast(t) { const el = $('#toast'); el.textContent = t; el.classList.add('show'); clearTimeout(tt); tt = setTimeout(() => el.classList.remove('show'), 3200); }
const COLORS = { dao: '#FF9F8A', xanh: '#7EC4E8', vang: '#FFC93C', bacha: '#7FD3B0', hong: '#FF9EC1', do: '#F0524F' };
const art = () => '<div class="ph" style="--c1:#FFD6C8;--c2:#FFF0BF"><svg viewBox="0 0 100 100" aria-hidden="true"><use href="#baby"/></svg></div>';
const debounce = (fn, ms = 600) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

// lỗi bất ngờ thì hiện ra màn hình thay vì trang trắng im lặng
addEventListener('error', e => toast('Lỗi: ' + e.message));
addEventListener('unhandledrejection', e => { if (e.reason?.message !== '401') toast('Lỗi: ' + (e.reason?.message || e.reason)); });

/* ---------- auth ---------- */
let pw = '';
try { pw = sessionStorage.getItem('pw') || ''; } catch {}
async function api(path, opts = {}) {
  const headers = { authorization: 'Bearer ' + pw, ...(opts.json ? { 'content-type': 'application/json' } : {}), ...opts.headers };
  const r = await fetch(path, { ...opts, headers, body: opts.json ? JSON.stringify(opts.json) : opts.body });
  const data = await r.json().catch(() => ({}));
  if (r.status === 401) { showLogin('Phiên đăng nhập hết hạn, nhập lại mật khẩu nhé.'); const e = new Error('401'); e.text = data.error; throw e; }
  if (!r.ok) throw new Error(data.error || 'Có lỗi xảy ra');
  return data;
}
function showLogin(msg = '') { $('#app').hidden = true; $('#login').hidden = false; $('#loginErr').textContent = msg; $('#pw').focus(); }
$('#login').addEventListener('submit', async e => {
  e.preventDefault(); pw = $('#pw').value.trim(); $('#loginErr').textContent = 'Đang kiểm tra…';
  try { await api('/api/admin/check'); } catch (err) { if (err.message !== '401') $('#loginErr').textContent = err.message; else $('#loginErr').textContent = err.text || 'Sai mật khẩu.'; return; }
  try { sessionStorage.setItem('pw', pw); } catch {}
  start();
});

/* ---------- tabs ---------- */
$$('.ql-tabs button').forEach(b => b.addEventListener('click', () => {
  $$('.ql-tabs button').forEach(x => x.setAttribute('aria-selected', x === b));
  $$('.ql-panel').forEach(p => p.hidden = p.dataset.panel !== b.dataset.tab);
}));

/* ---------- image / video upload helpers ---------- */
const IMG_ACCEPT = 'image/*,.heic,.heif';
const isImage = f => f.type.startsWith('image/') || /\.hei[cf]$/i.test(f.name); // Windows hay để trống type của file HEIC
// HEIC (ảnh iPhone): Chrome/Firefox không tự đọc được nên giải mã bằng libheif (heic-to, ~3 MB, chỉ tải khi gặp ảnh HEIC)
async function decode(file) {
  try { return await createImageBitmap(file); }
  catch (e) {
    const { heicTo, isHeic } = await import('https://cdn.jsdelivr.net/npm/heic-to@1.6.7/dist/heic-to.js');
    if (!(await isHeic(file)) && !/\.hei[cf]$/i.test(file.name)) throw e;
    return heicTo({ blob: file, type: 'bitmap' });
  }
}
// thu về cạnh dài max px rồi mã hoá lại: ảnh nhẹ hơn nhiều và tự mất EXIF (gồm vị trí GPS)
async function encode(bmp, max, q) {
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const cv = document.createElement('canvas'); cv.width = Math.round(bmp.width * k); cv.height = Math.round(bmp.height * k);
  cv.getContext('2d').drawImage(bmp, 0, 0, cv.width, cv.height);
  let blob = await new Promise(r => cv.toBlob(r, 'image/webp', q));
  if (!blob || blob.type !== 'image/webp') blob = await new Promise(r => cv.toBlob(r, 'image/jpeg', q + .03));
  return blob;
}
// bản gốc 2000px (xem lớn) + bản nhỏ 640px (hiển thị trên trang chủ, vuốt nhẹ hơn)
async function shrink(file) {
  const bmp = await decode(file);
  try { return [await encode(bmp, 2000, .82), await encode(bmp, 640, .8)]; } finally { bmp.close?.(); }
}
const putBlob = async blob => (await api('/api/admin/upload/put', { method: 'PUT', headers: { 'x-type': blob.type }, body: blob })).key;
// ngày chụp: tìm chuỗi ngày EXIF "YYYY:MM:DD hh:mm:ss" ở đầu file (JPG, HEIC đều lưu dạng chữ); phải đọc trước khi nén vì nén làm mất EXIF
// shortcut: lấy chuỗi ngày đầu tiên (thường là DateTime, trùng ngày chụp với ảnh từ điện thoại), ảnh đã chỉnh sửa có thể ra ngày sửa; admin sửa tay được
async function photoDate(file) {
  const txt = new TextDecoder('latin1').decode(await file.slice(0, 262144).arrayBuffer());
  const d = txt.match(/((?:19|20)\d{2}):(\d{2}):(\d{2}) \d{2}:\d{2}:\d{2}/);
  return d ? `${d[1]}-${d[2]}-${d[3]}` : '';
}
async function putPhoto(file) {
  const taken = await photoDate(file).catch(() => '');
  let blob, small;
  try { [blob, small] = await shrink(file); } catch { throw new Error(`Trình duyệt không đọc được "${file.name}", thử JPG hoặc PNG.`); }
  const key = await putBlob(blob), thumb = await putBlob(small);
  S[key] = blob.size;
  return { key, thumb, taken, info: `${kb(file.size)} → ${kb(blob.size)}` };
}
const videoType = f => f.type || (/\.mov$/i.test(f.name) ? 'video/quicktime' : /\.webm$/i.test(f.name) ? 'video/webm' : 'video/mp4');
async function putVideo(file, onProgress) {
  const { key, uploadId } = await api('/api/admin/upload/start', { method: 'POST', headers: { 'x-type': videoType(file) } });
  const q = `key=${encodeURIComponent(key)}&uploadId=${encodeURIComponent(uploadId)}`;
  const CH = 20 * 1024 * 1024, parts = []; // mỗi phần 20 MB (R2 yêu cầu ≥ 5 MB, Worker nhận tối đa 100 MB)
  try {
    for (let i = 0, n = 1; i < file.size; i += CH, n++) {
      parts.push(await api(`/api/admin/upload/part?${q}&n=${n}`, { method: 'PUT', body: file.slice(i, i + CH) }));
      onProgress(Math.min(1, (i + CH) / file.size));
    }
    await api(`/api/admin/upload/complete?${q}`, { method: 'POST', json: { parts } });
    return key;
  } catch (e) { api(`/api/admin/upload/abort?${q}`, { method: 'POST' }).catch(() => {}); throw e; }
}
// nén video ngay trong trình duyệt (WebCodecs qua Mediabunny): cạnh dài ≤ 1280px, H.264 2,5 Mbps + AAC,
// moov đặt đầu file để điện thoại phát được ngay khi mới tải phần đầu.
// Trình duyệt không nén được, nén mất hình/tiếng, hoặc (gốc đã là MP4/H.264 mà) bản nén không nhẹ hơn rõ → trả null để up file gốc.
// src: File mới chọn, hoặc URL video đã up (đọc từng đoạn qua range, không tải cả file vào bộ nhớ)
async function compressVideo(src, origSize, onProgress) {
  const mb = await import('https://cdn.jsdelivr.net/npm/mediabunny@1.65.0/dist/bundles/mediabunny.min.mjs');
  const input = new mb.Input({ source: typeof src === 'string' ? new mb.UrlSource(src) : new mb.BlobSource(src), formats: mb.ALL_FORMATS });
  const track = await input.getPrimaryVideoTrack(); if (!track) return null;
  const w = await track.getDisplayWidth(), h = await track.getDisplayHeight();
  // HEVC (iPhone) hoặc vỏ .mov: Firefox và nhiều máy Android không phát được → luôn dùng bản H.264/MP4 dù không nhẹ hơn
  const playable = (await input.getMimeType()).startsWith('video/mp4') && (await track.getCodec()) === 'avc';
  const size = Math.max(w, h) <= 1280 ? {} : w >= h ? { width: 1280 } : { height: 1280 };
  const output = new mb.Output({ format: new mb.Mp4OutputFormat({ fastStart: 'in-memory' }), target: new mb.BufferTarget() });
  const conv = await mb.Conversion.init({ input, output, video: { ...size, codec: 'avc', bitrate: 2_500_000 }, audio: { codec: 'aac', bitrate: 128_000 } });
  // track metadata của iPhone bị bỏ là bình thường; chỉ hình hoặc tiếng bị bỏ mới coi là hỏng
  if (!conv.isValid || conv.discardedTracks.some(d => d.track.type === 'video' || d.track.type === 'audio')) return null;
  conv.onProgress = onProgress;
  await conv.execute();
  const blob = new Blob([output.target.buffer], { type: 'video/mp4' });
  return !playable || blob.size < origSize * 0.9 ? blob : null;
}
// ảnh bìa video: khung hình ở 0,1 giây, cạnh dài 540px; trang chủ hiện ảnh này thay vì tải sẵn mọi video
async function makePoster(src) {
  const v = document.createElement('video'), url = typeof src === 'string' ? src : URL.createObjectURL(src);
  v.muted = true; v.playsInline = true; v.preload = 'auto';
  try {
    v.src = url;
    await new Promise((ok, no) => { v.onloadeddata = ok; v.onerror = () => no(new Error('Không đọc được video')); setTimeout(() => no(new Error('Đọc video quá lâu')), 30000); });
    v.currentTime = Math.min(.1, v.duration || 0);
    await new Promise(ok => { v.onseeked = ok; setTimeout(ok, 3000); });
    const k = Math.min(1, 540 / Math.max(v.videoWidth, v.videoHeight));
    const cv = document.createElement('canvas'); cv.width = Math.round(v.videoWidth * k); cv.height = Math.round(v.videoHeight * k);
    cv.getContext('2d').drawImage(v, 0, 0, cv.width, cv.height);
    let blob = await new Promise(r => cv.toBlob(r, 'image/webp', .8));
    if (!blob || blob.type !== 'image/webp') blob = await new Promise(r => cv.toBlob(r, 'image/jpeg', .82));
    return (await api('/api/admin/upload/put', { method: 'PUT', headers: { 'x-type': blob.type }, body: blob })).key;
  } finally { v.removeAttribute('src'); v.load(); if (typeof src !== 'string') URL.revokeObjectURL(url); }
}
// video up trước khi có ảnh bìa: tự tạo bù khi mở trang quản lý
// ảnh up trước khi có bản nhỏ: tự tạo bù từ ảnh đã lưu khi mở trang quản lý
let thumbing = false;
async function backfillThumbs() {
  if (thumbing) return; thumbing = true; let n = 0;
  for (const p of [...C.monthPhotos, ...C.table].filter(x => !x.thumb)) {
    try {
      const bmp = await createImageBitmap(await (await fetch('/media/' + p.key)).blob());
      const thumb = await putBlob(await encode(bmp, 640, .8)); bmp.close?.();
      await api('/api/admin/photos/' + p.id, { method: 'PATCH', json: { thumb } }); p.thumb = thumb; n++;
    } catch (e) { if (e.message === '401') break; console.warn('Không tạo được ảnh nhỏ', p.key, e); }
  }
  thumbing = false; if (n) toast(`Đã tạo ảnh thu nhỏ cho ${n} ảnh`);
}
let backfilling = false;
async function backfillPosters() {
  if (backfilling) return; backfilling = true; let n = 0;
  for (const v of C.videos.filter(x => !x.poster)) {
    try { const poster = await makePoster('/media/' + v.key); await api('/api/admin/videos/' + v.id, { method: 'PATCH', json: { poster } }); v.poster = poster; n++; }
    catch (e) { if (e.message === '401') break; console.warn('Không tạo được ảnh bìa', v.key, e); }
  }
  backfilling = false; if (n) toast(`Đã tạo ảnh bìa cho ${n} video`);
}
// lớp phủ xoay + chữ trên ô đang xử lý; t rỗng thì gỡ
const busy = (el, t) => { el.classList.toggle('busy', !!t); if (t) el.dataset.busy = t; else delete el.dataset.busy; };
const pick = (accept, multiple = false) => new Promise(res => {
  const i = document.createElement('input'); i.type = 'file'; i.accept = accept; i.multiple = multiple;
  i.addEventListener('change', () => res([...i.files])); i.click();
});
function dropzone(zone, input, onFiles) {
  input.addEventListener('change', () => { onFiles([...input.files]); input.value = ''; });
  ['dragenter', 'dragover'].forEach(t => zone.addEventListener(t, e => { e.preventDefault(); zone.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(t => zone.addEventListener(t, e => { e.preventDefault(); zone.classList.remove('over'); }));
  zone.addEventListener('drop', e => onFiles([...e.dataTransfer.files]));
}

/* ---------- wishes ---------- */
let wishes = [];
async function loadWishes() { wishes = await api('/api/admin/wishes'); renderWishes(); }
function renderWishes() {
  const by = st => wishes.filter(w => w.status === st), pend = by('pending'), ok = by('approved'), hid = by('rejected');
  $('#pCount').textContent = ok.length;
  const row = (w, btns) => `<div class="p-item"><div>${w.photo ? `<a href="/media/${w.photo}" target="_blank" rel="noopener"><img class="p-photo" src="/media/${w.photo}" alt="Ảnh gửi kèm" loading="lazy"></a>` : ''}<p>${esc(w.message)}</p><small><b>${esc(w.name)}</b> · ${esc(w.created_at)} UTC</small></div><div class="p-act">${btns}</div></div>`;
  const hideBtn = w => `<button class="no" type="button" data-id="${w.id}" data-s="rejected">Ẩn khỏi trang</button>`;
  const showBtn = w => `<button class="ok" type="button" data-id="${w.id}" data-s="approved">Hiện lại</button>`;
  const delBtn = w => `<button class="del" type="button" data-id="${w.id}" data-s="delete">Xóa</button>`;
  // lời chúc cũ còn ở trạng thái chờ (trước khi chuyển sang tự duyệt) thì vẫn cho duyệt
  $('#wPendingTitle').hidden = $('#wPending').hidden = !pend.length;
  $('#wPending').innerHTML = pend.map(w => row(w, showBtn(w) + hideBtn(w) + delBtn(w))).join('');
  $('#wApproved').innerHTML = ok.length ? ok.map(w => row(w, hideBtn(w) + delBtn(w))).join('') : '<p class="empty">Chưa có lời chúc nào.</p>';
  $('#wHidden').innerHTML = hid.length ? hid.map(w => row(w, showBtn(w) + delBtn(w))).join('') : '<p class="empty">Không có lời chúc nào bị ẩn.</p>';
}
$('[data-panel="wishes"]').addEventListener('click', async e => {
  const b = e.target.closest('button[data-id]'); if (!b) return;
  const w0 = wishes.find(x => x.id === +b.dataset.id);
  if (b.dataset.s === 'delete') {
    if (!confirm(`Xóa hẳn lời chúc của ${w0.name}? Không khôi phục lại được.`)) return;
    b.disabled = true;
    try { await api('/api/admin/wishes/' + w0.id, { method: 'DELETE' }); wishes = wishes.filter(x => x !== w0); renderWishes(); toast(`Đã xóa lời chúc của ${w0.name}`); }
    catch (err) { b.disabled = false; if (err.message !== '401') toast(err.message); }
    return;
  }
  b.disabled = true;
  try {
    await api('/api/admin/wishes/' + b.dataset.id, { method: 'PATCH', json: { status: b.dataset.s } });
    const w = wishes.find(x => x.id === +b.dataset.id); w.status = b.dataset.s;
    renderWishes(); toast(b.dataset.s === 'approved' ? `Đã hiện lời chúc của ${w.name}` : `Đã ẩn lời chúc của ${w.name}`);
  } catch (err) { b.disabled = false; if (err.message !== '401') toast(err.message); }
});

/* ---------- content (months, table, videos) ---------- */
let C = { months: [], monthPhotos: [], table: [], videos: [] };
let S = {}; // dung lượng file trên R2: key → byte
async function loadContent() {
  [C, S] = await Promise.all([fetch('/api/content', { cache: 'no-store' }).then(r => r.json()), api('/api/admin/sizes').catch(() => ({}))]);
  meShow(meSel); renderTable(); renderVideos(); counts(); }
// số ảnh/video trên các tab, giống số lời chúc
function counts() { $('#mCount').textContent = C.monthPhotos.length; $('#tCount').textContent = C.table.length; $('#vCount').textContent = C.videos.length; }

/* months */
let meSel = 1;
$('#meTabs').innerHTML = Array.from({ length: 12 }, (_, i) => `<button type="button" role="tab" data-m="${i + 1}" aria-selected="${!i}">Tháng ${i + 1}</button>`).join('');
$('#meTabs').addEventListener('click', e => { const b = e.target.closest('button'); if (b) meShow(+b.dataset.m); });
const monthCap = m => C.months.find(x => x.month === m)?.caption || '';
const slotPhoto = (m, s) => C.monthPhotos.find(p => p.month === m && p.slot === s);
function meShow(m) {
  meSel = m; $$('#meTabs button').forEach(b => b.setAttribute('aria-selected', +b.dataset.m === m));
  $('#meCap').value = monthCap(m);
  $('#meSlots').innerHTML = [1, 2, 3].map(s => {
    const p = slotPhoto(m, s);
    return `<div class="me-slot" data-s="${s}">${p ? `<div class="ph"><img src="/media/${p.key}" alt=""></div>` : art()}
      <label class="sr-only" for="mec${s}">Chú thích ảnh ${s}</label><input class="input me-cap" id="mec${s}" data-s="${s}" value="${esc(p?.caption || '')}" maxlength="40" placeholder="${p ? 'Chú thích ảnh' : 'Chọn ảnh trước'}" ${p ? '' : 'disabled'}>
      <div class="me-btns"><button type="button" data-act="pick" data-s="${s}">${p ? 'Đổi ảnh' : 'Chọn ảnh'}</button>${p ? `<button type="button" data-act="del" data-s="${s}">Gỡ ảnh</button>` : ''}</div></div>`;
  }).join('');
}
const saveMonthCap = debounce(async (m, caption) => {
  try { await api('/api/admin/months/' + m, { method: 'PUT', json: { caption } }); const x = C.months.find(x => x.month === m); x ? x.caption = caption : C.months.push({ month: m, caption }); toast(`Đã lưu chú thích tháng ${m}`); }
  catch (e) { if (e.message !== '401') toast(e.message); }
});
$('#meCap').addEventListener('input', e => saveMonthCap(meSel, e.target.value.trim()));
const saveCaption = debounce(async (id, caption) => {
  try { await api('/api/admin/photos/' + id, { method: 'PATCH', json: { caption } }); toast('Đã lưu chú thích'); }
  catch (e) { if (e.message !== '401') toast(e.message); }
});
$('#meSlots').addEventListener('input', e => {
  if (!e.target.classList.contains('me-cap')) return;
  const p = slotPhoto(meSel, +e.target.dataset.s); if (!p) return;
  p.caption = e.target.value.trim(); saveCaption(p.id, p.caption);
});
$('#meSlots').addEventListener('click', async e => {
  const b = e.target.closest('button[data-act]'); if (!b) return;
  const m = meSel, s = +b.dataset.s, slot = b.closest('.me-slot'), p = slotPhoto(m, s);
  if (b.dataset.act === 'del') {
    if (!confirm(`Gỡ ảnh ${s} của tháng ${m}?`)) return;
    busy(slot, 'Đang gỡ ảnh…');
    try { await api('/api/admin/photos/' + p.id, { method: 'DELETE' }); toast(`Đã gỡ ảnh khỏi tháng ${m}`); } catch (err) { if (err.message !== '401') toast(err.message); }
    return loadContent();
  }
  const [f] = await pick(IMG_ACCEPT); if (!f) return;
  busy(slot, 'Đang tải ảnh lên…');
  try {
    const { key, thumb, info, taken } = await putPhoto(f);
    await api('/api/admin/photos', { method: 'POST', json: { key, thumb, place: 'month', month: m, slot: s, caption: p?.caption || '', taken_on: taken } });
    toast(`Đã lưu ảnh tháng ${m} (${info})`);
  } catch (err) { if (err.message !== '401') toast(err.message); }
  loadContent();
});

/* table photos */
const swapIcon = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4A3428" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 11a8 8 0 10-2.3 5.7M20 4v7h-7"/></svg>';
function tableItem(p, info = '') {
  const li = document.createElement('li'); li.className = 'up-item'; li.dataset.id = p.id;
  li.innerHTML = `<img src="/media/${p.key}" alt="">
    <div><label class="sr-only" for="tc${p.id}">Chú thích ảnh</label><input class="input" id="tc${p.id}" value="${esc(p.caption)}" maxlength="40" placeholder="Chú thích ảnh">
    <div class="up-info"><span><span class="sz">${S[p.key] ? kb(S[p.key]) : ''}</span> <span class="st">${esc(info)}</span></span>
    <label>Ngày chụp <input class="input up-date" type="date" value="${esc(p.taken_on || '')}" aria-label="Ngày chụp"></label></div></div>
    <div class="up-act"><button class="up-swap" type="button" title="Đổi ảnh khác" aria-label="Đổi ảnh khác">${swapIcon}</button><button class="up-del" type="button" aria-label="Xóa ảnh">×</button></div>`;
  li.querySelector('input').addEventListener('input', e => saveCaption(p.id, e.target.value.trim()));
  const dateIn = li.querySelector('.up-date');
  dateIn.addEventListener('change', async () => {
    try { await api('/api/admin/photos/' + p.id, { method: 'PATCH', json: { taken_on: dateIn.value } }); p.taken_on = dateIn.value; toast('Đã lưu ngày chụp'); }
    catch (e) { if (e.message !== '401') toast(e.message); }
  });
  li.querySelector('.up-swap').addEventListener('click', async () => {
    const [f] = await pick(IMG_ACCEPT); if (!f) return;
    busy(li, 'Đang tải ảnh lên…');
    try {
      const { key, thumb, info, taken } = await putPhoto(f);
      await api('/api/admin/photos/' + p.id, { method: 'PATCH', json: { key, thumb, taken_on: taken } });
      p.key = key; p.thumb = thumb; p.taken_on = taken; dateIn.value = taken;
      li.querySelector('img').src = '/media/' + key; li.querySelector('.st').textContent = info; li.querySelector('.sz').textContent = kb(S[key]);
      toast('Đã đổi ảnh');
    }
    catch (e) { if (e.message !== '401') toast(e.message); }
    busy(li, '');
  });
  li.querySelector('.up-del').addEventListener('click', async () => {
    if (!confirm('Xóa ảnh này khỏi bàn ảnh?')) return;
    busy(li, 'Đang xóa…');
    try { await api('/api/admin/photos/' + p.id, { method: 'DELETE' }); li.remove(); C.table = C.table.filter(x => x !== p); counts(); toast('Đã xóa ảnh'); }
    catch (e) { busy(li, ''); if (e.message !== '401') toast(e.message); }
  });
  return li;
}
function renderTable() { const ul = $('#pList'); ul.innerHTML = ''; [...C.table].reverse().forEach(p => ul.appendChild(tableItem(p))); }
dropzone($('#pDrop'), $('#pFile'), async files => {
  // hiện ngay một dòng chờ cho mỗi ảnh đã chọn, tải lần lượt rồi thay bằng dòng thật
  const jobs = files.filter(f => isImage(f) || (toast(`"${f.name}" không phải file ảnh.`), false)).map(f => {
    const li = document.createElement('li'), url = URL.createObjectURL(f);
    li.className = 'up-item up-wait';
    li.innerHTML = `<img src="${url}" alt="" onerror="this.style.visibility='hidden'"><div><b class="up-name">${esc(f.name)}</b><div class="up-info">${kb(f.size)}</div></div><div></div>`;
    busy(li, 'Đang chờ…'); $('#pList').prepend(li);
    return { f, li, url };
  });
  for (const { f, li, url } of jobs) {
    busy(li, 'Đang tải ảnh lên…');
    try {
      const { key, thumb, info, taken } = await putPhoto(f);
      const p = await api('/api/admin/photos', { method: 'POST', json: { key, thumb, place: 'table', caption: '', taken_on: taken } });
      C.table.push(p); counts(); li.replaceWith(tableItem(p, info));
    } catch (e) { li.remove(); if (e.message !== '401') toast(e.message); }
    URL.revokeObjectURL(url);
  }
  if (jobs.length > 1) toast(`Đã xong ${jobs.length} ảnh`);
});

/* videos */
const fmt = s => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;
const duration = file => new Promise(res => {
  const v = document.createElement('video'), u = URL.createObjectURL(file); v.preload = 'metadata';
  v.onloadedmetadata = () => { res(isFinite(v.duration) ? fmt(v.duration) : ''); URL.revokeObjectURL(u); };
  v.onerror = () => { res(''); URL.revokeObjectURL(u); }; v.src = u;
});
// ngày quay đọc từ file: ưu tiên ngày của iPhone (giờ địa phương), sau đó tới mvhd; mvhd mới trong 2 ngày thường là ngày xuất lại nên bỏ
async function takenOn(file) {
  const buf = async (a, b) => new Uint8Array(await file.slice(a, b).arrayBuffer());
  for (const u of [await buf(0, 262144), await buf(Math.max(0, file.size - 2097152), file.size)]) {
    const txt = new TextDecoder('latin1').decode(u);
    const ap = txt.match(/(\d{4}-\d{2}-\d{2})T\d{2}:\d{2}:\d{2}[+-]\d{4}/); if (ap) return ap[1];
    const i = txt.indexOf('mvhd');
    if (i > 0) {
      const dv = new DataView(u.buffer, u.byteOffset + i + 8);
      const s = u[i + 4] === 1 ? Number(dv.getBigUint64(0)) : dv.getUint32(0);
      const t = (s - 2082844800) * 1000; // giây từ 1904 sang mốc 1970
      if (s && Date.now() - t > 2 * 864e5) return new Date(t + 7 * 3600e3).toISOString().slice(0, 10);
    }
  }
  return '';
}
const vList = $('#vList'), vEdit = $('#vEdit');
const dmy = d => d ? d.split('-').reverse().join('.') : '';
function videoItem(v) {
  const li = document.createElement('li'); li.className = 'vt'; li.dataset.id = v.id; li.tabIndex = 0; li._v = v;
  li.setAttribute('aria-label', 'Video, bấm Enter để sửa, mũi tên để đổi thứ tự');
  li.innerHTML = `<video src="/media/${v.key}#t=0.1" muted playsinline preload="metadata"></video><span class="vt-n"></span>${S[v.key] ? `<span class="vt-s">${kb(S[v.key])}</span>` : ''}<span class="vt-d"></span>`;
  vtLabel(li); return li;
}
function vtLabel(li) {
  const d = li.querySelector('.vt-d'), v = li._v;
  d.textContent = dmy(v.taken_on) || 'Chưa có ngày'; d.classList.toggle('none', !v.taken_on);
}
const renumber = () => [...vList.querySelectorAll('.vt[data-id]')].forEach((li, i) => li.querySelector('.vt-n').textContent = i + 1);
function renderVideos() { vList.innerHTML = ''; C.videos.forEach(v => vList.appendChild(videoItem(v))); renumber(); }

// khung sửa một video: tên, ngày quay, xóa
let edLi = null;
const veNo = li => { const v = li._v; $('#veNo').textContent = 'Video ' + li.querySelector('.vt-n').textContent + (v.duration ? ' · ' + v.duration : '') + (S[v.key] ? ' · ' + kb(S[v.key]) : ''); };
function openEdit(li) {
  edLi = li; const v = li._v;
  $('#veVideo').src = '/media/' + v.key; $('#veTitle').value = v.title || ''; $('#veDate').value = v.taken_on || '';
  veNo(li); $('#veZip').disabled = !!li._zip; $('#veZip').textContent = li._zip || 'Nén lại';
  vEdit.showModal();
}
vEdit.addEventListener('close', () => { $('#veVideo').pause(); $('#veVideo').removeAttribute('src'); edLi?.focus(); edLi = null; });
$('#veDone').addEventListener('click', () => vEdit.close());
vEdit.addEventListener('click', e => { if (e.target === vEdit) vEdit.close(); });
const saveTitle = debounce(async (v, t) => { try { await api('/api/admin/videos/' + v.id, { method: 'PATCH', json: { title: t } }); v.title = t; toast('Đã lưu tên video'); } catch (e) { if (e.message !== '401') toast(e.message); } });
$('#veTitle').addEventListener('input', e => edLi && saveTitle(edLi._v, e.target.value.trim()));
$('#veDate').addEventListener('change', async e => {
  const li = edLi, v = li._v;
  try { await api('/api/admin/videos/' + v.id, { method: 'PATCH', json: { taken_on: e.target.value } }); v.taken_on = e.target.value; vtLabel(li); toast('Đã lưu ngày quay'); }
  catch (err) { if (err.message !== '401') toast(err.message); }
});
// nén lại video đã up: giữ nguyên tên, ngày quay, thứ tự; chỉ thay file trên R2
$('#veZip').addEventListener('click', async () => {
  const li = edLi, v = li._v, btn = $('#veZip'), old = S[v.key];
  const label = t => { li._zip = t; if (edLi === li) { btn.textContent = t || 'Nén lại'; btn.disabled = !!t; } };
  label('Đang nén 0%');
  try {
    const small = await compressVideo('/media/' + v.key, old || Infinity, p => label(`Đang nén ${Math.round(p * 100)}%`));
    if (!small) { toast('Video này đã nhẹ hoặc trình duyệt không nén được, giữ nguyên.'); return; }
    const key = await putVideo(small, p => label(`Đang tải ${Math.round(p * 100)}%`));
    await api('/api/admin/videos/' + v.id, { method: 'PATCH', json: { key } });
    v.key = key; S[key] = small.size;
    li.querySelector('video').src = `/media/${key}#t=0.1`;
    li.querySelector('.vt-s')?.remove(); li.querySelector('.vt-n').insertAdjacentHTML('afterend', `<span class="vt-s">${kb(small.size)}</span>`);
    if (edLi === li) { $('#veVideo').src = '/media/' + key; veNo(li); }
    toast(old ? `Đã nén lại ${kb(old)} → ${kb(small.size)}` : `Đã nén lại còn ${kb(small.size)}`);
  } catch (e) { if (e.message !== '401') toast('Nén lại lỗi: ' + e.message); }
  finally { label(''); }
});
$('#veDel').addEventListener('click', async () => {
  const li = edLi, v = li._v;
  if (!confirm('Xóa video này?')) return;
  try { await api('/api/admin/videos/' + v.id, { method: 'DELETE' }); vEdit.close(); li.remove(); C.videos = C.videos.filter(x => x !== v); counts(); renumber(); toast('Đã xóa video'); }
  catch (e) { if (e.message !== '401') toast(e.message); }
});

// kéo thả trong lưới: chuột kéo luôn; cảm ứng giữ ~0,35 giây rồi kéo (vuốt ngay thì vẫn cuộn trang)
async function saveVideoOrder() {
  const ids = [...vList.querySelectorAll('.vt[data-id]')].map(li => +li.dataset.id);
  try { await api('/api/admin/videos/order', { method: 'PUT', json: { ids } }); toast('Đã lưu thứ tự video'); }
  catch (e) { if (e.message !== '401') toast(e.message); }
}
let vd = null;
function placeDragged() { // đặt thẻ đang kéo dưới ngón tay, tính từ vị trí thật trong lưới
  const { li } = vd; li.style.transform = 'none'; const r = li.getBoundingClientRect();
  li.style.transform = `translate(${vd.x - vd.ox - r.left}px,${vd.y - vd.oy - r.top}px) scale(1.06)`;
}
function startDrag() {
  vd.on = true; vd.li.classList.add('dragging'); vList.classList.add('sorting'); navigator.vibrate?.(15);
  const loop = () => { // tự cuộn khi kéo sát mép màn hình
    if (!vd?.on) return;
    const edge = 70, dy = vd.y < edge ? -12 : vd.y > innerHeight - edge ? 12 : 0;
    if (dy) { scrollBy(0, dy); placeDragged(); }
    vd.raf = requestAnimationFrame(loop);
  };
  loop(); placeDragged();
}
vList.addEventListener('pointerdown', e => {
  const li = e.target.closest('.vt[data-id]'); if (!li || vd || (e.pointerType === 'mouse' && e.button !== 0)) return;
  const r = li.getBoundingClientRect();
  vd = { li, id: e.pointerId, sx: e.clientX, sy: e.clientY, x: e.clientX, y: e.clientY, ox: e.clientX - r.left, oy: e.clientY - r.top, on: false, moved: false, touch: e.pointerType !== 'mouse' };
  if (vd.touch) vd.timer = setTimeout(() => vd && !vd.on && startDrag(), 350);
  else e.preventDefault();
});
addEventListener('pointermove', e => {
  if (!vd || e.pointerId !== vd.id) return;
  vd.x = e.clientX; vd.y = e.clientY;
  if (!vd.on) {
    if (Math.hypot(vd.x - vd.sx, vd.y - vd.sy) < 8) return;
    if (vd.touch) { clearTimeout(vd.timer); vd = null; return; } // vuốt trước khi giữ đủ lâu: để trang cuộn
    startDrag();
  }
  const t = document.elementFromPoint(vd.x, vd.y)?.closest('.vt[data-id]');
  if (t && t !== vd.li && !t._busy) { // _busy: thẻ đang trượt, bỏ qua để không đổi chỗ qua lại
    const tiles = [...vList.querySelectorAll('.vt[data-id]')].filter(x => x !== vd.li);
    const before = new Map(tiles.map(x => [x, x.getBoundingClientRect()]));
    const all = [...vList.children];
    all.indexOf(vd.li) < all.indexOf(t) ? t.after(vd.li) : t.before(vd.li);
    vd.moved = true; renumber();
    tiles.forEach(x => { // FLIP: các thẻ khác trượt mềm sang chỗ mới
      const a = before.get(x), b = x.getBoundingClientRect();
      if (a.left === b.left && a.top === b.top) return;
      x._busy = true; setTimeout(() => x._busy = false, 260);
      x.style.transition = 'none'; x.style.transform = `translate(${a.left - b.left}px,${a.top - b.top}px)`;
      requestAnimationFrame(() => { x.style.transition = ''; x.style.transform = ''; });
    });
  }
  placeDragged();
});
addEventListener('touchmove', e => { if (vd?.on) e.preventDefault(); }, { passive: false });
function vEnd(e) {
  if (!vd || e.pointerId !== vd.id) return;
  const d = vd; vd = null; clearTimeout(d.timer); cancelAnimationFrame(d.raf);
  vList.classList.remove('sorting'); d.li.classList.remove('dragging'); d.li.style.transform = '';
  if (d.on) { if (d.moved) saveVideoOrder(); }
  else if (e.type === 'pointerup') openEdit(d.li);
}
addEventListener('pointerup', vEnd);
addEventListener('pointercancel', vEnd);
vList.addEventListener('contextmenu', e => { if (e.target.closest('.vt')) e.preventDefault(); });
vList.addEventListener('keydown', e => {
  const li = e.target.closest('.vt[data-id]'); if (!li) return;
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); return openEdit(li); }
  const back = e.key === 'ArrowLeft' || e.key === 'ArrowUp', fwd = e.key === 'ArrowRight' || e.key === 'ArrowDown';
  if (!back && !fwd) return;
  e.preventDefault();
  const sib = back ? li.previousElementSibling : li.nextElementSibling;
  if (!sib?.dataset.id) return;
  back ? sib.before(li) : sib.after(li); li.focus(); renumber(); saveVideoOrder();
});
dropzone($('#vDrop'), $('#vFile'), async files => {
  for (const f of files) {
    if (!/^video\//.test(videoType(f))) { toast(`"${f.name}" không phải file video.`); continue; }
    const li = document.createElement('li'); li.className = 'vt vt-up';
    li.innerHTML = `<b class="st">Đang chuẩn bị</b><div class="up-bar"><i></i></div><small>${esc(f.name)} · ${kb(f.size)}</small>`;
    vList.appendChild(li);
    const bar = li.querySelector('.up-bar i'), st = li.querySelector('.st');
    bar.style.transition = 'width .3s';
    try {
      const dur = await duration(f), taken = await takenOn(f).catch(() => '');
      const show = (label, p) => { bar.style.width = (p * 100).toFixed(0) + '%'; st.textContent = `${label} ${(p * 100).toFixed(0)}%`; };
      const small = await compressVideo(f, f.size, p => show('Đang nén', p)).catch(e => { console.warn('Không nén được video', e); return null; });
      const up = small || f;
      li.querySelector('small').textContent = `${f.name} · ${small ? `${kb(f.size)} → ${kb(small.size)}` : kb(f.size) + ' (giữ bản gốc)'}`;
      const key = await putVideo(up, p => show('Đang tải', p));
      const poster = await makePoster(up).catch(e => { console.warn('Không tạo được ảnh bìa', e); return ''; });
      const v = await api('/api/admin/videos', { method: 'POST', json: { key, title: '', duration: dur, taken_on: taken, poster } });
      S[key] = up.size;
      toast(small ? `Đã nén ${kb(f.size)} → ${kb(small.size)} và tải lên` : 'Đã tải video lên (không nén được, giữ bản gốc)');
      C.videos.push(v); counts(); li.replaceWith(videoItem(v)); renumber();
    } catch (e) { st.textContent = 'Lỗi'; li.title = e.message; li.querySelector('small').textContent = e.message; }
  }
});

/* ---------- start ---------- */
async function start() {
  $('#login').hidden = true; $('#app').hidden = false;
  try { await Promise.all([loadWishes(), loadContent()]); backfillThumbs().then(backfillPosters); } catch (e) { if (e.message !== '401') toast(e.message); }
}
if (pw) api('/api/admin/check').then(start).catch(() => {}); else showLogin();
})();
