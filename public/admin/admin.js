(() => {
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const kb = n => n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.round(n / 1024) + ' KB';
let tt; function toast(t) { const el = $('#toast'); el.textContent = t; el.classList.add('show'); clearTimeout(tt); tt = setTimeout(() => el.classList.remove('show'), 3200); }
const COLORS = { dao: '#FF9F8A', xanh: '#7EC4E8', vang: '#FFC93C', bacha: '#7FD3B0', hong: '#FF9EC1' };
const art = () => '<div class="ph" style="--c1:#FFD6C8;--c2:#FFF0BF"><svg viewBox="0 0 100 100" aria-hidden="true"><use href="#baby"/></svg></div>';
const debounce = (fn, ms = 600) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

/* ---------- auth ---------- */
let pw = '';
try { pw = sessionStorage.getItem('pw') || ''; } catch {}
async function api(path, opts = {}) {
  const headers = { authorization: 'Bearer ' + pw, ...(opts.json ? { 'content-type': 'application/json' } : {}), ...opts.headers };
  const r = await fetch(path, { ...opts, headers, body: opts.json ? JSON.stringify(opts.json) : opts.body });
  const data = await r.json().catch(() => ({}));
  if (r.status === 401) { showLogin('Phiên đăng nhập hết hạn, nhập lại mật khẩu nhé.'); throw new Error('401'); }
  if (!r.ok) throw new Error(data.error || 'Có lỗi xảy ra');
  return data;
}
function showLogin(msg = '') { $('#app').hidden = true; $('#login').hidden = false; $('#loginErr').textContent = msg; $('#pw').focus(); }
$('#login').addEventListener('submit', async e => {
  e.preventDefault(); pw = $('#pw').value;
  try { await api('/api/admin/check'); } catch (err) { if (err.message !== '401') $('#loginErr').textContent = err.message; else $('#loginErr').textContent = 'Sai mật khẩu.'; return; }
  try { sessionStorage.setItem('pw', pw); } catch {}
  start();
});

/* ---------- tabs ---------- */
$$('.ad-tabs button').forEach(b => b.addEventListener('click', () => {
  $$('.ad-tabs button').forEach(x => x.setAttribute('aria-selected', x === b));
  $$('.ad-panel').forEach(p => p.hidden = p.dataset.panel !== b.dataset.tab);
}));

/* ---------- image / video upload helpers ---------- */
async function shrink(file) {
  // thu về cạnh dài 2000px rồi mã hoá lại: ảnh nhẹ hơn nhiều và tự mất EXIF (gồm vị trí GPS)
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, 2000 / Math.max(bmp.width, bmp.height));
  const cv = document.createElement('canvas'); cv.width = Math.round(bmp.width * k); cv.height = Math.round(bmp.height * k);
  cv.getContext('2d').drawImage(bmp, 0, 0, cv.width, cv.height); bmp.close?.();
  let blob = await new Promise(r => cv.toBlob(r, 'image/webp', .82));
  if (!blob || blob.type !== 'image/webp') blob = await new Promise(r => cv.toBlob(r, 'image/jpeg', .85));
  return blob;
}
async function putPhoto(file) {
  let blob;
  try { blob = await shrink(file); } catch { throw new Error(`Trình duyệt không đọc được "${file.name}", thử JPG hoặc PNG.`); }
  const { key } = await api('/api/admin/upload/put', { method: 'PUT', headers: { 'x-type': blob.type }, body: blob });
  return { key, info: `${kb(file.size)} → ${kb(blob.size)}` };
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
  const pend = wishes.filter(w => w.status === 'pending'), ok = wishes.filter(w => w.status === 'approved');
  $('#pCount').textContent = pend.length;
  const row = (w, btns) => `<div class="p-item" style="--bc:${COLORS[w.color] || COLORS.dao}"><div><p>${esc(w.message)}</p><small><b>${esc(w.name)}</b> · ${esc(w.created_at)} UTC</small></div><div class="p-act">${btns(w)}</div></div>`;
  $('#wPending').innerHTML = pend.length ? pend.map(w => row(w, w => `<button class="ok" type="button" data-id="${w.id}" data-s="approved">Duyệt</button><button class="no" type="button" data-id="${w.id}" data-s="rejected">Từ chối</button>`)).join('') : '<p class="empty">Không có lời chúc nào chờ duyệt.</p>';
  $('#wApproved').innerHTML = ok.length ? ok.map(w => row(w, w => `<button class="no" type="button" data-id="${w.id}" data-s="rejected">Ẩn khỏi trang</button>`)).join('') : '<p class="empty">Chưa duyệt lời chúc nào.</p>';
}
$('[data-panel="wishes"]').addEventListener('click', async e => {
  const b = e.target.closest('button[data-id]'); if (!b) return;
  b.disabled = true;
  try {
    await api('/api/admin/wishes/' + b.dataset.id, { method: 'PATCH', json: { status: b.dataset.s } });
    const w = wishes.find(x => x.id === +b.dataset.id); w.status = b.dataset.s;
    if (w.status === 'rejected') wishes = wishes.filter(x => x !== w);
    renderWishes(); toast(b.dataset.s === 'approved' ? `Đã duyệt lời chúc của ${w.name}` : `Đã ẩn lời chúc của ${w.name}`);
  } catch (err) { b.disabled = false; if (err.message !== '401') toast(err.message); }
});

/* ---------- content (months, table, videos) ---------- */
let C = { months: [], monthPhotos: [], table: [], videos: [] };
async function loadContent() { C = await (await fetch('/api/content', { cache: 'no-store' })).json(); meShow(meSel); renderTable(); renderVideos(); }

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
    slot.classList.add('busy');
    try { await api('/api/admin/photos/' + p.id, { method: 'DELETE' }); toast(`Đã gỡ ảnh khỏi tháng ${m}`); } catch (err) { if (err.message !== '401') toast(err.message); }
    return loadContent();
  }
  const [f] = await pick('image/*'); if (!f) return;
  slot.classList.add('busy');
  try {
    const { key, info } = await putPhoto(f);
    await api('/api/admin/photos', { method: 'POST', json: { key, place: 'month', month: m, slot: s, caption: p?.caption || '' } });
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
    <div class="up-info"><span class="st">${esc(info)}</span></div></div>
    <div class="up-act"><button class="up-swap" type="button" title="Đổi ảnh khác" aria-label="Đổi ảnh khác">${swapIcon}</button><button class="up-del" type="button" aria-label="Xóa ảnh">×</button></div>`;
  li.querySelector('input').addEventListener('input', e => saveCaption(p.id, e.target.value.trim()));
  li.querySelector('.up-swap').addEventListener('click', async () => {
    const [f] = await pick('image/*'); if (!f) return;
    li.classList.add('busy');
    try { const { key, info } = await putPhoto(f); await api('/api/admin/photos/' + p.id, { method: 'PATCH', json: { key } }); p.key = key; li.querySelector('img').src = '/media/' + key; li.querySelector('.st').textContent = info; toast('Đã đổi ảnh'); }
    catch (e) { if (e.message !== '401') toast(e.message); }
    li.classList.remove('busy');
  });
  li.querySelector('.up-del').addEventListener('click', async () => {
    if (!confirm('Xóa ảnh này khỏi bàn ảnh?')) return;
    li.classList.add('busy');
    try { await api('/api/admin/photos/' + p.id, { method: 'DELETE' }); li.remove(); C.table = C.table.filter(x => x !== p); toast('Đã xóa ảnh'); }
    catch (e) { li.classList.remove('busy'); if (e.message !== '401') toast(e.message); }
  });
  return li;
}
function renderTable() { const ul = $('#pList'); ul.innerHTML = ''; [...C.table].reverse().forEach(p => ul.appendChild(tableItem(p))); }
dropzone($('#pDrop'), $('#pFile'), async files => {
  for (const f of files) {
    if (!f.type.startsWith('image/')) { toast(`"${f.name}" không phải file ảnh.`); continue; }
    try {
      const { key, info } = await putPhoto(f);
      const p = await api('/api/admin/photos', { method: 'POST', json: { key, place: 'table', caption: '' } });
      C.table.push(p); $('#pList').prepend(tableItem(p, info));
    } catch (e) { if (e.message !== '401') toast(e.message); }
  }
});

/* videos */
const fmt = s => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;
const duration = file => new Promise(res => {
  const v = document.createElement('video'), u = URL.createObjectURL(file); v.preload = 'metadata';
  v.onloadedmetadata = () => { res(isFinite(v.duration) ? fmt(v.duration) : ''); URL.revokeObjectURL(u); };
  v.onerror = () => { res(''); URL.revokeObjectURL(u); }; v.src = u;
});
function videoItem(v) {
  const li = document.createElement('li'); li.className = 'up-item';
  li.innerHTML = `<video src="/media/${v.key}#t=0.1" muted playsinline preload="metadata"></video>
    <div><label class="sr-only" for="vt${v.id}">Tên video</label><input class="input" id="vt${v.id}" value="${esc(v.title)}" maxlength="60" placeholder="Tên video">
    <div class="up-info"><span>${esc(v.duration)}</span></div></div>
    <div class="up-act"><button class="up-del" type="button" aria-label="Xóa video">×</button></div>`;
  const saveTitle = debounce(async t => { try { await api('/api/admin/videos/' + v.id, { method: 'PATCH', json: { title: t } }); toast('Đã lưu tên video'); } catch (e) { if (e.message !== '401') toast(e.message); } });
  li.querySelector('input').addEventListener('input', e => saveTitle(e.target.value.trim()));
  li.querySelector('.up-del').addEventListener('click', async () => {
    if (!confirm('Xóa video này?')) return;
    li.classList.add('busy');
    try { await api('/api/admin/videos/' + v.id, { method: 'DELETE' }); li.remove(); toast('Đã xóa video'); }
    catch (e) { li.classList.remove('busy'); if (e.message !== '401') toast(e.message); }
  });
  return li;
}
function renderVideos() { const ul = $('#vList'); ul.innerHTML = ''; C.videos.forEach(v => ul.appendChild(videoItem(v))); }
dropzone($('#vDrop'), $('#vFile'), async files => {
  for (const f of files) {
    if (!/^video\//.test(videoType(f))) { toast(`"${f.name}" không phải file video.`); continue; }
    const li = document.createElement('li'); li.className = 'up-item';
    li.innerHTML = `<div class="ph" style="width:56px;height:72px;border-radius:10px">${''}</div><div><b>${esc(f.name)}</b><div class="up-bar"><i></i></div><div class="up-info"><span class="st">Đang tải lên… 0%</span><span>${kb(f.size)}</span></div></div><span></span>`;
    $('#vList').appendChild(li);
    const bar = li.querySelector('.up-bar i'), st = li.querySelector('.st');
    bar.style.transition = 'width .3s';
    try {
      const dur = await duration(f);
      const key = await putVideo(f, p => { bar.style.width = (p * 100).toFixed(0) + '%'; st.textContent = `Đang tải lên… ${(p * 100).toFixed(0)}%`; });
      const v = await api('/api/admin/videos', { method: 'POST', json: { key, title: f.name.replace(/\.[^.]+$/, ''), duration: dur } });
      C.videos.push(v); li.replaceWith(videoItem(v)); toast('Đã tải video lên');
    } catch (e) { st.textContent = 'Lỗi: ' + e.message; }
  }
});

/* ---------- start ---------- */
async function start() {
  $('#login').hidden = true; $('#app').hidden = false;
  try { await Promise.all([loadWishes(), loadContent()]); } catch (e) { if (e.message !== '401') toast(e.message); }
}
if (pw) api('/api/admin/check').then(start).catch(() => {}); else showLogin();
})();
