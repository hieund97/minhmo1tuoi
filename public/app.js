(() => {
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const G = window.gsap && window.ScrollTrigger ? window.gsap : null;
if (G) G.registerPlugin(ScrollTrigger);
const PAIRS = [['#FFD6C8','#FFF0BF'],['#D5EDFA','#E6F8EF'],['#FFF0BF','#FFD6C8'],['#E6F8EF','#D5EDFA'],['#FFE1EC','#FFF0BF'],['#D5EDFA','#FFD6C8']];
// hình minh họa em bé, dùng khi ô ảnh chưa có ảnh thật
const art = i => `<div class="ph" style="--c1:${PAIRS[i % 6][0]};--c2:${PAIRS[i % 6][1]}"><svg viewBox="0 0 100 100" aria-hidden="true"><use href="#baby"/></svg></div>`;
const photo = key => `<div class="ph"><img src="/media/${key}" alt="" loading="lazy" decoding="async"></div>`;
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let tt; function toast(t) { const el = $('#toast'); el.textContent = t; el.classList.add('show'); clearTimeout(tt); tt = setTimeout(() => el.classList.remove('show'), 3200); }

/* ---------- countdown ---------- */
const born = new Date(2025, 10, 21), party = new Date(2026, 10, 21), cdB = $$('#cdTiles b');
$('#cdLine').style.setProperty('--age', Math.min(1, Math.max(0, (Date.now() - born) / (party - born))).toFixed(3));
function cdTick() {
  const ms = party - Date.now();
  if (ms <= 0) {
    $('#cdTiles').hidden = $('#cdTitle').hidden = true; $('#cdDone').hidden = false;
    $('#cdDone').textContent = ms > -864e5 ? 'Hôm nay Mỡ tròn 1 tuổi!' : 'Mỡ đã tròn 1 tuổi';
    return;
  }
  [ms / 864e5, ms / 36e5 % 24, ms / 6e4 % 60, ms / 1e3 % 60].forEach((v, i) => {
    const s = String(Math.floor(v)).padStart(2, '0'), b = cdB[i];
    if (b.textContent === s) return;
    b.textContent = s;
    if (!reduce) { b.classList.remove('flip'); void b.offsetWidth; b.classList.add('flip'); }
  });
}
cdTick(); setInterval(cdTick, 1000);

/* ---------- cake sprinkles ---------- */
[['#tierTop', 10], ['#tierBottom', 16]].forEach(([sel, n]) => {
  const t = $(sel);
  for (let i = 0; i < n; i++) {
    const s = document.createElement('i'); s.className = 'sprk';
    s.style.cssText = `left:${6 + Math.random() * 86}%;top:${38 + Math.random() * (sel === '#tierTop' ? 40 : 30)}%;transform:rotate(${Math.random() * 180}deg);background:${['#FF9F8A','#7EC4E8','#FFD45E','#9EDFC4'][i % 4]}`;
    t.appendChild(s);
  }
});

/* ---------- hero blob follows pointer ---------- */
const hero = $('.hero'), fb = $('#blobFollow');
let tx = -999, ty = -999, bx = -999, by = -999, heroOn = true;
if (!reduce) {
  hero.addEventListener('pointermove', e => { const r = hero.getBoundingClientRect(); tx = e.clientX - r.left - 110; ty = e.clientY - r.top - 110; if (bx < -900) { bx = tx; by = ty; } });
  new IntersectionObserver(([en]) => heroOn = en.isIntersecting).observe(hero);
  (function loop() { if (heroOn && bx > -900) { bx += (tx - bx) * .06; by += (ty - by) * .06; fb.style.transform = `translate(${bx}px,${by}px)`; } requestAnimationFrame(loop); })();
}

/* ---------- blow candle ---------- */
const stage = $('#stage'), btn = $('#blowBtn'), candle = $('#candle');
let prog = 0, holding = false, out = false, running = false;
const setBlow = v => stage.style.setProperty('--blow', v.toFixed(3));

// âm thanh thổi nến: tiếng gió từ white noise qua bộ lọc, tổng hợp bằng Web Audio nên không cần file mp3
let ac = null, noiseBuf = null, wind = null;
function audio() {
  try {
    ac = ac || new (window.AudioContext || window.webkitAudioContext)();
    if (ac.state === 'suspended') ac.resume();
    if (!noiseBuf) {
      noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
      const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    return ac;
  } catch { return null; }
}
function noise(type, freq) {
  const src = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
  src.buffer = noiseBuf; src.loop = true; f.type = type; f.frequency.value = freq; f.Q.value = .7; g.gain.value = 0;
  src.connect(f).connect(g).connect(ac.destination); src.start();
  return { src, f, g };
}
function windOn() { if (!audio() || wind) return; wind = noise('bandpass', 700); wind.g.gain.setTargetAtTime(.25, ac.currentTime, .08); }
function windOff() { if (!wind) return; const w = wind; wind = null; w.g.gain.setTargetAtTime(0, ac.currentTime, .06); w.src.stop(ac.currentTime + .5); }
function windLevel(p) {
  if (!wind) return; const t = ac.currentTime, wob = Math.sin(t * 9) * .05;
  wind.g.gain.setTargetAtTime(.2 + p * .4 + wob, t, .05); wind.f.frequency.setTargetAtTime(650 + p * 1100, t, .05);
}
function puffAndChime() {
  if (!audio()) return; const t = ac.currentTime;
  const p = noise('lowpass', 1400); p.g.gain.setValueAtTime(.55, t); p.g.gain.exponentialRampToValueAtTime(.001, t + .45); p.src.stop(t + .5);
  [[1046.5, .35], [1318.5, .5], [1568, .65]].forEach(([hz, at]) => {
    const o = ac.createOscillator(), g = ac.createGain(); o.type = 'triangle'; o.frequency.value = hz;
    g.gain.setValueAtTime(0, t + at); g.gain.linearRampToValueAtTime(.18, t + at + .02); g.gain.exponentialRampToValueAtTime(.001, t + at + .9);
    o.connect(g).connect(ac.destination); o.start(t + at); o.stop(t + at + 1);
  });
}
function tick() {
  prog = holding ? Math.min(1, prog + .022) : Math.max(0, prog - .04);
  setBlow(prog); windLevel(prog);
  stage.style.setProperty('--gust', ((Math.random() - .5) * prog).toFixed(3));
  if (prog >= 1) { running = false; return blowOut(); }
  if (holding || prog > 0) requestAnimationFrame(tick); else running = false;
}
function start(e) { if (e) e.preventDefault(); if (out) return relight(); holding = true; windOn(); stage.classList.add('blowing'); if (!running) { running = true; requestAnimationFrame(tick); } }
function stop() { holding = false; windOff(); stage.classList.remove('blowing'); }
function blowOut() {
  windOff(); puffAndChime(); stage.classList.remove('blowing'); stage.style.setProperty('--gust', 0);
  out = true; holding = false; prog = 0; setBlow(0); stage.classList.add('out');
  $('#blowLabel').textContent = 'Thắp lại nến';
  $('#blowHint').textContent = 'Phù! Nến đã tắt';
  $('#wishMsg').textContent = 'Ước gì cũng thành sự thật nha Mỡ!';
  const r = candle.getBoundingClientRect();
  const o = { x: (r.left + r.width / 2) / innerWidth, y: r.top / innerHeight };
  if (window.confetti && !reduce) {
    const colors = ['#FF9F8A','#7EC4E8','#FFD45E','#9EDFC4','#ffffff'];
    confetti({ particleCount: 140, spread: 100, startVelocity: 42, origin: o, colors, scalar: 1.1 });
    setTimeout(() => { confetti({ particleCount: 70, angle: 60, spread: 70, origin: { x: 0, y: .7 }, colors }); confetti({ particleCount: 70, angle: 120, spread: 70, origin: { x: 1, y: .7 }, colors }); }, 250);
  }
  if (G && !reduce) G.fromTo('.mo-letter', { y: 0 }, { y: -46, duration: .32, ease: 'power2.out', yoyo: true, repeat: 3, stagger: .1 });
  countBlow();
}

/* ---------- số người đã thổi nến ---------- */
// shortcut: mỗi trình duyệt chỉ tính 1 lần nhờ localStorage, xóa dữ liệu trình duyệt thì đếm thêm; cần chặt hơn thì giới hạn theo IP ở server
function showBlows(n, bump) {
  const el = $('#blowCount'), t = $('#blowCountText');
  t.innerHTML = n > 0 ? `Đã có <b>${n}</b> người thổi nến chúc mừng Mỡ 1 tuổi` : 'Hãy là người đầu tiên thổi nến cho Mỡ nhé';
  el.hidden = false;
  if (bump && !reduce) t.querySelector('b')?.classList.add('bump');
}
async function countBlow() {
  let done = false;
  try { done = localStorage.getItem('mo-blown') === '1'; } catch {}
  if (done) return;
  try {
    const r = await fetch('/api/blow', { method: 'POST' });
    if (!r.ok) return;
    try { localStorage.setItem('mo-blown', '1'); } catch {}
    showBlows((await r.json()).blows, true);
  } catch {}
}
function relight() { out = false; prog = 0; setBlow(0); stage.classList.remove('out'); $('#blowLabel').textContent = 'Giữ để thổi nến'; $('#blowHint').textContent = 'Giữ nút hoặc ngọn nến khoảng 1 giây'; $('#wishMsg').textContent = ''; }
// thắp lại khi nhấn lần sau (không dùng click: click sinh ra lúc nhả tay sau khi vừa thổi tắt sẽ thắp lại liền)
btn.addEventListener('pointerdown', start);
candle.addEventListener('pointerdown', start);
['pointerup','pointerleave','pointercancel'].forEach(t => { btn.addEventListener(t, stop); candle.addEventListener(t, stop); });
btn.addEventListener('keydown', e => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) start(e); });
btn.addEventListener('keyup', stop);
btn.addEventListener('contextmenu', e => e.preventDefault());

/* ---------- stats count-up ---------- */
if (G && !reduce) $$('[data-count]').forEach(el => {
  const n = +el.dataset.count, o = { v: 0 };
  ScrollTrigger.create({ trigger: el, start: 'top 90%', once: true, onEnter: () => G.fromTo(o, { v: 0 }, { v: n, duration: 1.4, ease: 'power3.out', onUpdate: () => el.textContent = Math.round(o.v) }) });
});

/* ---------- lightbox with view transitions ---------- */
const lb = $('#lb'), lbMedia = $('#lbMedia');
let lastSrc = null;
function vt(fn) { if (document.startViewTransition && !reduce) return document.startViewTransition(fn); fn(); return null; }
function openLB(src, html, cls = '') {
  lastSrc = src;
  if (src) src.style.viewTransitionName = 'media';
  vt(() => {
    if (src) src.style.viewTransitionName = '';
    lbMedia.className = 'lb-media ' + cls; lbMedia.innerHTML = html; lb.className = 'lb ' + (cls === 'is-wish' ? 'wish-pop' : '');
    lbMedia.style.viewTransitionName = src ? 'media' : '';
    lb.hidden = false; $('#lbClose').focus();
  });
}
function closeLB() {
  if (lb.hidden) return;
  const src = lastSrc;
  vt(() => { lb.hidden = true; lbMedia.style.viewTransitionName = ''; if (src) src.style.viewTransitionName = 'media'; });
  setTimeout(() => { if (src) { src.style.viewTransitionName = ''; src.focus?.(); } }, 600);
}
$('#lbClose').addEventListener('click', closeLB);
lb.addEventListener('click', e => { if (e.target === lb) closeLB(); });
addEventListener('keydown', e => { if (e.key === 'Escape') closeLB(); });
const openPhoto = (el, cap) => { const ph = el.querySelector('.ph'); openLB(ph, ph.outerHTML.replace(' loading="lazy"', '') + `<p class="lb-cap">${esc(cap)}</p>`); };

/* ---------- 12 months ---------- */
const track = $('#mTrack'), crawl = $('#crawl');
track.innerHTML = Array.from({ length: 12 }, (_, i) => `
  <article class="m-panel">
    <div class="m-top"><span class="m-num">${String(i + 1).padStart(2, '0')}</span><div><h3 class="m-name">Tháng thứ ${i + 1}</h3><p class="m-cap"></p></div></div>
    <div class="m-photos"></div>
  </article>`).join('');
function renderMonths(caps, photos) {
  $$('.m-panel').forEach((panel, i) => {
    const m = i + 1;
    panel.querySelector('.m-cap').textContent = caps[m] || '';
    panel.querySelector('.m-photos').innerHTML = [1, 2, 3].map(s => {
      const p = photos.find(x => x.month === m && x.slot === s), cap = p?.caption || `Tháng ${m}`;
      return `<figure class="pol" style="margin:0" tabindex="0" role="button" aria-label="Xem ảnh ${s} tháng ${m}">${p ? photo(p.key) : art(i + s)}<figcaption>${esc(cap)}</figcaption></figure>`;
    }).join('');
  });
}
renderMonths({}, []);
const mProg = () => track.scrollLeft / Math.max(1, track.scrollWidth - track.clientWidth);
track.addEventListener('scroll', () => crawl.style.setProperty('--p', mProg().toFixed(4)), { passive: true });
const mIO = new IntersectionObserver(es => es.forEach(en => en.target.classList.toggle('is-open', en.isIntersecting)), { root: track, threshold: .6 });
$$('.m-panel').forEach(p => mIO.observe(p));
const panelStep = () => $('.m-panel').offsetWidth + 28;
$('#mPrev').addEventListener('click', () => track.scrollBy({ left: -panelStep(), behavior: reduce ? 'auto' : 'smooth' }));
$('#mNext').addEventListener('click', () => track.scrollBy({ left: panelStep(), behavior: reduce ? 'auto' : 'smooth' }));
// kéo bằng chuột trên máy tính (cảm ứng thì trình duyệt tự cuộn)
let mDrag = null, mDragged = false;
track.addEventListener('pointerdown', e => {
  if (e.pointerType !== 'mouse' || e.button !== 0) return;
  mDrag = { x: e.clientX, left: track.scrollLeft, id: e.pointerId }; mDragged = false; e.preventDefault();
});
track.addEventListener('pointermove', e => {
  if (!mDrag) return; const dx = e.clientX - mDrag.x;
  if (!mDragged && Math.abs(dx) > 6) { mDragged = true; track.setPointerCapture(mDrag.id); track.classList.add('dragging'); }
  if (mDragged) track.scrollLeft = mDrag.left - dx;
});
const mEnd = () => {
  if (!mDrag) return; mDrag = null; track.classList.remove('dragging');
  if (mDragged) track.scrollTo({ left: Math.round(track.scrollLeft / panelStep()) * panelStep(), behavior: reduce ? 'auto' : 'smooth' });
  setTimeout(() => mDragged = false, 0); // để cú click ngay sau khi thả chuột không mở ảnh
};
track.addEventListener('pointerup', mEnd); track.addEventListener('pointercancel', mEnd);
const openPol = pol => openPhoto(pol, pol.querySelector('figcaption').textContent);
track.addEventListener('click', e => { const p = e.target.closest('.pol'); if (p && !mDragged) openPol(p); });
track.addEventListener('keydown', e => { const p = e.target.closest('.pol'); if (p && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openPol(p); } });

/* ---------- video slider ---------- */
const vs = $('#vs'), vsStage = $('#vsStage'), vsDots = $('#vsDots');
const SPK = '<path d="M3 9h4l5-4v14l-5-4H3z" fill="#4A3428"/>';
const ICON_MUTED = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#4A3428" stroke-width="2" stroke-linecap="round" aria-hidden="true">${SPK}<path d="M16 9l5 6M21 9l-5 6"/></svg>`;
const ICON_SOUND = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#4A3428" stroke-width="2" stroke-linecap="round" aria-hidden="true">${SPK}<path d="M16 8.5a5 5 0 010 7M18.5 6a8.5 8.5 0 010 12"/></svg>`;
let vids = [], act = 0, vsOn = false, drag = null;
function buildSlides() {
  vsStage.innerHTML = ''; vsDots.innerHTML = '';
  vids.forEach((v, i) => {
    const s = document.createElement('div'); s.className = 'vs-slide';
    s.innerHTML = `<video src="/media/${v.key}#t=0.1" muted loop playsinline preload="metadata"></video><button class="vs-sound" type="button" aria-label="Bật tiếng">${ICON_MUTED}</button>`;
    s.querySelector('.vs-sound').addEventListener('click', e => {
      e.stopPropagation(); const vid = s.querySelector('video'), b = e.currentTarget;
      vid.muted = !vid.muted; b.innerHTML = vid.muted ? ICON_MUTED : ICON_SOUND; b.setAttribute('aria-label', vid.muted ? 'Bật tiếng' : 'Tắt tiếng');
      if (!vid.muted) vid.play().catch(() => {});
    });
    v.el = s; vsStage.appendChild(s);
    const d = document.createElement('button'); d.type = 'button'; d.setAttribute('aria-label', 'Video ' + (i + 1));
    d.addEventListener('click', () => go(i)); vsDots.appendChild(d);
  });
  go(act);
}
// shift: độ lệch (tính bằng số slide) khi đang kéo tay, để slide chạy theo ngón tay
function render(shift = 0) {
  vids.forEach((v, k) => {
    const o = k - act + shift, a = Math.abs(o), s = v.el;
    s.style.transform = `translateX(${o * 62}%) translateZ(${-a * 150}px) rotateY(${-Math.max(-1, Math.min(1, o)) * 32}deg)`;
    s.style.zIndex = 50 - Math.round(a); s.style.opacity = a > 2.5 ? 0 : Math.max(0, 1 - a * .2); s.style.visibility = a > 2.5 ? 'hidden' : '';
  });
}
function go(i) {
  act = Math.max(0, Math.min(vids.length - 1, i));
  render();
  vids.forEach((v, k) => {
    const o = k - act, s = v.el, vid = s.querySelector('video');
    s.classList.toggle('active', !o);
    if (!o && vsOn) vid.play().catch(() => {});
    else if (o) { vid.pause(); vid.muted = true; s.querySelector('.vs-sound').innerHTML = ICON_MUTED; }
  });
  [...vsDots.children].forEach((d, k) => d.classList.toggle('on', k === act));
  const v = vids[act];
  $('#vsTitle').textContent = v.title || 'Video của Mỡ';
  $('#vsSub').textContent = `${act + 1}/${vids.length}` + (v.duration ? ' · ' + v.duration : '');
  $('#vsPrev').disabled = act === 0; $('#vsNext').disabled = act === vids.length - 1;
}
$('#vsPrev').addEventListener('click', () => go(act - 1));
$('#vsNext').addEventListener('click', () => go(act + 1));
vs.addEventListener('keydown', e => { if (e.key === 'ArrowLeft') go(act - 1); if (e.key === 'ArrowRight') go(act + 1); });
// vuốt trái/phải: slide chạy theo tay, thả ra thì bắt vào slide gần nhất; vuốt nhanh thì chuyển luôn
vs.addEventListener('pointerdown', e => {
  if (!vids.length || e.target.closest('button') || (e.pointerType === 'mouse' && e.button !== 0)) return;
  drag = { x: e.clientX, y: e.clientY, t: performance.now(), dx: 0, id: e.pointerId, slide: e.target.closest('.vs-slide'), on: false };
  if (e.pointerType === 'mouse') e.preventDefault();
});
vs.addEventListener('pointermove', e => {
  if (!drag || e.pointerId !== drag.id) return;
  drag.dx = e.clientX - drag.x;
  if (!drag.on) {
    if (Math.abs(drag.dx) < 8 || Math.abs(drag.dx) < Math.abs(e.clientY - drag.y)) return; // vuốt dọc thì để trang cuộn
    drag.on = true; vs.setPointerCapture(e.pointerId); vs.classList.add('dragging');
  }
  let shift = drag.dx / (vids[act].el.offsetWidth * .62);
  if ((act === 0 && shift > 0) || (act === vids.length - 1 && shift < 0)) shift *= .3;
  render(shift);
});
function endDrag(e) {
  if (!drag || e.pointerId !== drag.id) return;
  const d = drag; drag = null; vs.classList.remove('dragging');
  if (!d.on) {
    if (e.type === 'pointerup' && d.slide) { const i = vids.findIndex(v => v.el === d.slide); if (i !== act) go(i); }
    return;
  }
  const w = vids[act].el.offsetWidth * .62, speed = Math.abs(d.dx) / Math.max(1, performance.now() - d.t);
  const steps = Math.round(-d.dx / w) || (Math.abs(d.dx) > 30 || speed > .4 ? (d.dx < 0 ? 1 : -1) : 0);
  go(act + steps);
}
vs.addEventListener('pointerup', endDrag);
vs.addEventListener('pointercancel', endDrag);
let wAcc = 0, wLock = 0;
vs.addEventListener('wheel', e => {
  if (!vids.length || Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
  e.preventDefault();
  if (performance.now() < wLock) return;
  wAcc += e.deltaX;
  if (Math.abs(wAcc) > 50) { go(act + Math.sign(wAcc)); wAcc = 0; wLock = performance.now() + 450; }
}, { passive: false });
new IntersectionObserver(([en]) => {
  vsOn = en.isIntersecting; const vid = vids[act]?.el.querySelector('video');
  if (vid) vsOn ? vid.play().catch(() => {}) : vid.pause();
}, { threshold: .4 }).observe(vs);

/* ---------- photo table ---------- */
const table = $('#table');
let z = 10, cards = [];
const place = (c, lift) => c.style.transform = `translate(${c._x}px,${c._y}px) rotate(${c._r}deg) scale(${lift ? 1.07 : 1})`;
const bounds = c => ({ w: table.clientWidth - c.offsetWidth, h: table.clientHeight - c.offsetHeight });
function layout() { cards.forEach(c => { const b = bounds(c); c._x = c._fx * b.w; c._y = c._fy * b.h; place(c); }); }
addEventListener('resize', layout);
function bindCard(c) {
  let sx, sy, ox, oy, moved, vx = 0, vy = 0, lx, ly, lt;
  const open = () => openPhoto(c, c.querySelector('figcaption').textContent);
  c.addEventListener('pointerdown', e => {
    c.setPointerCapture(e.pointerId); cancelAnimationFrame(c._raf); c.style.zIndex = ++z; c.classList.add('lift');
    sx = lx = e.clientX; sy = ly = e.clientY; ox = c._x; oy = c._y; moved = false; vx = vy = 0; lt = performance.now(); place(c, true);
    $('#tableHint').hidden = true;
  });
  c.addEventListener('pointermove', e => {
    if (!c.hasPointerCapture(e.pointerId)) return;
    const dx = e.clientX - sx, dy = e.clientY - sy; if (Math.hypot(dx, dy) > 5) moved = true;
    const now = performance.now(), dt = Math.max(1, now - lt);
    vx = (e.clientX - lx) / dt * 16; vy = (e.clientY - ly) / dt * 16; lx = e.clientX; ly = e.clientY; lt = now;
    c._x = ox + dx; c._y = oy + dy; place(c, true);
  });
  c.addEventListener('pointerup', () => {
    c.classList.remove('lift');
    if (!moved) { place(c); return open(); }
    const spin = vx * .4;
    (function glide() {
      const b = bounds(c); c._x += vx; c._y += vy; c._r += spin * .05; vx *= .93; vy *= .93;
      if (c._x < 0 || c._x > b.w) { c._x = Math.min(b.w, Math.max(0, c._x)); vx *= -.6; }
      if (c._y < 0 || c._y > b.h) { c._y = Math.min(b.h, Math.max(0, c._y)); vy *= -.6; }
      place(c); if (Math.hypot(vx, vy) > .3 && !reduce) c._raf = requestAnimationFrame(glide);
      else { c._fx = c._x / Math.max(1, b.w); c._fy = c._y / Math.max(1, b.h); }
    })();
  });
  c.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
}
function renderTable(items) {
  cards.forEach(c => c.remove());
  let seed = 7; const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
  // chưa có ảnh thật thì rải vài tấm minh họa cho bàn không trống
  const list = items.length ? items : Array.from({ length: 6 }, (_, i) => ({ art: i + 1, caption: 'Mỡ' }));
  cards = list.map(p => {
    const f = document.createElement('figure'); f.className = 'tp'; f.style.margin = 0; f.tabIndex = 0;
    f.setAttribute('role', 'button'); f.setAttribute('aria-label', 'Xem ảnh ' + (p.caption || 'của Mỡ'));
    f.innerHTML = (p.key ? photo(p.key) : art(p.art)) + `<figcaption>${esc(p.caption || '')}</figcaption>`;
    f._r = (rnd() - .5) * 26; f._fx = rnd(); f._fy = rnd(); table.appendChild(f); bindCard(f); return f;
  });
  layout();
}
renderTable([]);

/* ---------- wishes ---------- */
const COLORS = { dao: ['đào', '#FF9F8A'], xanh: ['xanh', '#7EC4E8'], vang: ['vàng', '#FFC93C'], bacha: ['bạc hà', '#7FD3B0'], hong: ['hồng', '#FF9EC1'] };
const col = c => (COLORS[c] || COLORS.dao)[1];
const sky = $('#sky'), wCards = $('#wCards');
let wseed = 3; const wr = () => (wseed = (wseed * 9301 + 49297) % 233280) / 233280;
function balloon(w, i, rise = false) {
  const b = document.createElement('button'); b.type = 'button'; b.className = 'balloon' + (rise ? ' rise' : '');
  b.style.cssText = `--x:${rise ? 30 + wr() * 40 : 4 + (i * 19 + wr() * 8) % 86}%;--bc:${col(w.color)};--w:${62 + wr() * 26}px;--d:${6 + wr() * 3}s;--dl:${-wr() * 6}s;bottom:${wr() * 60}px`;
  b.setAttribute('aria-label', 'Đọc lời chúc của ' + w.name);
  b.innerHTML = `<span class="bb">${esc((w.name.trim().split(' ').pop() || '?')[0].toUpperCase())}</span><svg viewBox="0 0 20 110" aria-hidden="true"><path d="M10 0q-8 20 0 38t0 38q-6 18 0 34" fill="none" stroke="#86695A" stroke-width="1.5"/></svg>`;
  b.addEventListener('click', () => openLB(b.querySelector('.bb'), `<p>${esc(w.message)}</p><footer><b>${esc(w.name)}</b></footer>`, 'is-wish'));
  sky.appendChild(b);
}
function renderWishes(list) {
  sky.innerHTML = ''; $$('.w-card', wCards).forEach(c => c.remove());
  $('#wEmpty').hidden = list.length > 0;
  list.slice(0, 14).forEach(balloon); // bầu trời chỉ chứa ~14 quả bóng, thẻ bên dưới hiện đủ
  list.forEach(w => wCards.appendChild(wishCard(w)));
}
function wishCard(w) {
  const a = document.createElement('article'); a.className = 'w-card'; a.style.setProperty('--bc', col(w.color));
  a.innerHTML = `<p>${esc(w.message)}</p><footer><b>${esc(w.name)}</b></footer>`;
  return a;
}
// lời chúc vừa gửi: cuộn tới bầu trời rồi thả một quả bóng bay lên
function releaseBalloon(w) {
  $('#wEmpty').hidden = true;
  const card = wishCard(w); card.classList.add('new'); $('#wEmpty').after(card);
  sky.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
  setTimeout(() => {
    balloon(w, 0, true);
    if (sky.children.length > 14) sky.firstElementChild.remove();
  }, reduce ? 0 : 600);
}
$('#colorGroup').innerHTML = Object.entries(COLORS).map(([k, [label, v]], i) => `<input type="radio" name="col" id="col${i}" value="${k}" ${i === 0 ? 'checked' : ''}><label for="col${i}" style="--bc:${v}" title="Bóng màu ${label}"><span class="sr-only">Bóng màu ${label}</span></label>`).join('');
const msg = $('#wMsg'); msg.addEventListener('input', () => $('#wCount').textContent = `${msg.value.length}/500`);
let sending = false;
$('#wForm').addEventListener('submit', async e => {
  e.preventDefault();
  if (sending) return;
  const name = $('#wName').value.trim(), text = msg.value.trim(), err = $('#wErr');
  if (!name) { err.textContent = 'Bạn điền tên để bố mẹ Mỡ biết ai gửi nhé.'; return $('#wName').focus(); }
  if (text.length < 5) { err.textContent = 'Lời chúc hơi ngắn, viết thêm vài chữ nữa nha.'; return msg.focus(); }
  err.textContent = ''; sending = true; $('#sendBtn').disabled = true;
  const color = $('input[name=col]:checked').value;
  try {
    const r = await fetch('/api/wishes', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name, message: text, color, website: $('#wSite').value }) });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) { err.textContent = data.error || 'Chưa gửi được, bạn thử lại nhé.'; return; }
    $('#wForm').reset(); $('#wCount').textContent = '0/500';
    if (data.wish) releaseBalloon(data.wish);
    toast('Đã gửi! Lời chúc của bạn đã bay lên cùng Mỡ.');
  } catch { err.textContent = 'Mạng đang chập chờn, bạn thử gửi lại nhé.'; }
  finally { sending = false; $('#sendBtn').disabled = false; }
});

/* ---------- star trail ---------- */
if (!reduce && matchMedia('(pointer:fine)').matches) {
  let last = 0; const cols = ['#FFD45E', '#FF9F8A', '#7EC4E8'];
  addEventListener('pointermove', e => {
    const now = performance.now(); if (now - last < 45) return; last = now;
    const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('viewBox', '0 0 20 20'); s.classList.add('star');
    s.innerHTML = '<use href="#spark"/>'; s.style.fill = cols[Math.floor(now / 45) % 3];
    s.style.left = e.clientX - 7 + 'px'; s.style.top = e.clientY - 7 + 'px'; document.body.appendChild(s);
    setTimeout(() => s.remove(), 900);
  }, { passive: true });
}

/* ---------- load content ---------- */
fetch('/api/content').then(r => r.ok ? r.json() : Promise.reject(r.status)).then(d => {
  showBlows(d.blows);
  renderMonths(Object.fromEntries(d.months.map(m => [m.month, m.caption])), d.monthPhotos);
  renderTable(d.table);
  renderWishes(d.wishes);
  if (d.videos.length) { vids = d.videos; $('#video').hidden = $('#navVideo').hidden = false; buildSlides(); }
  if (G) ScrollTrigger.refresh();
}).catch(() => toast('Chưa tải được ảnh và lời chúc, bạn tải lại trang nhé.'));
addEventListener('load', () => G && ScrollTrigger.refresh());
})();
