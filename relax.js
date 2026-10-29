(() => {
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];

/* ---------- Breathing ---------- */
const patterns = {
  '478': [['Breathe in', 4, 1], ['Hold', 7, 1], ['Breathe out', 8, .55]],
  box: [['Breathe in', 4, 1], ['Hold', 4, 1], ['Breathe out', 4, .55], ['Hold', 4, .55]],
  slow: [['Breathe in', 5, 1], ['Breathe out', 5, .55]]
};
const orb = $('#orb'), lab = $('#breath-label');
let pat = '478', run = false, bt;
lab.setAttribute('aria-live', 'polite');
orb.style.transform = 'scale(.55)';

function step(i = 0) {
  if (!run) return;
  const [name, secs, scale] = patterns[pat][i % patterns[pat].length];
  lab.textContent = name;
  orb.style.transition = `transform ${secs}s ease-in-out`;
  orb.style.transform = `scale(${scale})`;
  if ($('#vibrate').checked && navigator.vibrate && name !== 'Hold') navigator.vibrate(60);
  bt = setTimeout(() => step(i + 1), secs * 1000);
}
function stopBreath() {
  run = false; clearTimeout(bt); lab.textContent = 'Ready';
  orb.style.transition = 'transform .6s ease'; orb.style.transform = 'scale(.55)';
  if (navigator.vibrate) navigator.vibrate(0);
}
$('#breath-start').onclick = () => { if (!run) { run = true; step(0); } };
$('#breath-stop').onclick = stopBreath;
$$('[data-pattern]').forEach(b => b.onclick = () => {
  $$('[data-pattern]').forEach(x => x.setAttribute('aria-pressed', x === b));
  pat = b.dataset.pattern;
  if (run) { clearTimeout(bt); step(0); }
});

/* ---------- Sound (synthesised, no audio files needed) ---------- */
let ac, master, noise;
function audio() {
  if (!ac) {
    ac = new (window.AudioContext || window.webkitAudioContext)();
    master = ac.createGain(); master.connect(ac.destination);
    noise = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ac.state === 'suspended') ac.resume();
  master.gain.value = $('#volume').value / 100 * .6;
  return ac;
}
$('#volume').oninput = () => { if (master) master.gain.value = $('#volume').value / 100 * .6; };

function grain(kind, k) { // k = intensity 0..1
  const a = audio(), t = a.currentTime, g = a.createGain();
  g.connect(master);
  if (kind === 'tap') {
    const o = a.createOscillator();
    o.frequency.setValueAtTime(230, t); o.frequency.exponentialRampToValueAtTime(110, t + .12);
    g.gain.setValueAtTime(.5, t); g.gain.exponentialRampToValueAtTime(.001, t + .14);
    o.connect(g); o.start(t); o.stop(t + .16); return;
  }
  const P = {
    slime: ['bandpass', 500 + Math.random() * 900, 6, .09],
    putty: ['lowpass', 260 + k * 200, 1, .14],
    sand: ['highpass', 3500 + Math.random() * 2500, .7, .05]
  }[kind];
  const src = a.createBufferSource(), f = a.createBiquadFilter();
  src.buffer = noise; src.loop = true; f.type = P[0]; f.Q.value = P[2];
  f.frequency.setValueAtTime(P[1], t);
  if (kind === 'slime') f.frequency.exponentialRampToValueAtTime(Math.max(120, P[1] * (.4 + Math.random() * .5)), t + P[3]);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(Math.min(1, .15 + k) * .8, t + .01);
  g.gain.exponentialRampToValueAtTime(.001, t + P[3]);
  src.connect(f); f.connect(g); src.start(t, Math.random()); src.stop(t + P[3] + .05);
}

/* ---------- Play surface ---------- */
const cv = $('#play'), cx = cv.getContext('2d');
let W, H, mat = 'slime', pts = [], cols = 0, h, ripples = [];
const N = 72, ptr = { down: false, x: 0, y: 0, px: 0, py: 0, grab: null };

function initToy() {
  ripples = [];
  if (mat === 'sand') {
    cols = Math.floor(W / 3); h = new Float32Array(cols);
    for (let i = 0; i < cols; i++) h[i] = H * .35 + Math.sin(i / 9) * 6;
  } else if (mat !== 'tap') {
    const R = Math.min(W, H) * .3;
    pts = Array.from({ length: N }, (_, i) => {
      const a = i / N * Math.PI * 2, x = W / 2 + Math.cos(a) * R * 1.25, y = H / 2 + Math.sin(a) * R;
      return { x, y, vx: 0, vy: 0, rx: x, ry: y, ox: x, oy: y };
    });
  }
}
function size() {
  const dpr = devicePixelRatio || 1, r = cv.getBoundingClientRect();
  W = r.width; H = r.height; cv.width = W * dpr; cv.height = H * dpr; cx.setTransform(dpr, 0, 0, dpr, 0, 0);
  initToy();
}
new ResizeObserver(size).observe(cv);

const pos = e => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
cv.addEventListener('pointerdown', e => {
  cv.setPointerCapture(e.pointerId); cv.style.cursor = 'grabbing';
  [ptr.x, ptr.y] = pos(e); ptr.px = ptr.x; ptr.py = ptr.y; ptr.down = true; ptr.grab = null;
  if (mat === 'tap') { ripples.push({ x: ptr.x, y: ptr.y, r: 6, a: 1 }); grain('tap', 1); }
  else if (mat !== 'sand') {
    let best = 1e9, bi = -1;
    pts.forEach((p, i) => { const d = Math.hypot(p.x - ptr.x, p.y - ptr.y); if (d < best) { best = d; bi = i; } });
    const c = centre();
    if (Math.hypot(ptr.x - c[0], ptr.y - c[1]) < Math.min(W, H) * .4) {
      const sg = mat === 'slime' ? 8 : 5;
      ptr.grab = pts.map((p, i) => { const d = Math.min(Math.abs(i - bi), N - Math.abs(i - bi)); return { w: Math.exp(-d * d / (2 * sg * sg)), x: p.x, y: p.y }; });
      ptr.x0 = ptr.x; ptr.y0 = ptr.y;
    }
  }
});
cv.addEventListener('pointermove', e => { if (ptr.down) [ptr.x, ptr.y] = pos(e); });
const up = () => { ptr.down = false; ptr.grab = null; cv.style.cursor = 'grab'; };
cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);

const centre = () => [pts.reduce((s, p) => s + p.x, 0) / N, pts.reduce((s, p) => s + p.y, 0) / N];
let lastSnd = 0;
function sound(active) {
  const sp = Math.hypot(ptr.x - ptr.px, ptr.y - ptr.py), now = performance.now();
  if (active && sp > 1.5 && now - lastSnd > (mat === 'sand' ? 35 : 70)) { grain(mat, Math.min(1, sp / 30)); lastSnd = now; }
  ptr.px = ptr.x; ptr.py = ptr.y;
}

function blobStep() {
  const slime = mat === 'slime', k = slime ? .035 : .008, damp = slime ? .88 : .6, sm = slime ? .1 : .2;
  if (ptr.grab) {
    pts.forEach((p, i) => {
      const g = ptr.grab[i];
      if (g.w > .03) { p.x = g.x + g.w * (ptr.x - ptr.x0); p.y = g.y + g.w * (ptr.y - ptr.y0); p.vx = p.vy = 0; }
    });
  }
  pts.forEach((p, i) => {
    if (ptr.grab && ptr.grab[i].w > .03) return;
    const a = pts[(i + N - 1) % N], b = pts[(i + 1) % N];
    p.vx = (p.vx + (p.rx - p.x) * k + ((a.x + b.x) / 2 - p.x) * sm) * damp;
    p.vy = (p.vy + (p.ry - p.y) * k + ((a.y + b.y) / 2 - p.y) * sm) * damp;
    p.x += p.vx; p.y += p.vy;
    if (!slime && !ptr.grab) { p.rx += (p.x - p.rx) * .02 + (p.ox - p.rx) * .004; p.ry += (p.y - p.ry) * .02 + (p.oy - p.ry) * .004; }
  });
  sound(!!ptr.grab);
  const m = i => [(pts[i % N].x + pts[(i + 1) % N].x) / 2, (pts[i % N].y + pts[(i + 1) % N].y) / 2];
  const [c0, c1] = centre(), R = Math.min(W, H) * .3;
  cx.beginPath(); cx.moveTo(...m(N - 1));
  pts.forEach((p, i) => cx.quadraticCurveTo(p.x, p.y, ...m(i)));
  cx.closePath();
  const gr = cx.createRadialGradient(c0 - R * .3, c1 - R * .4, R * .1, c0, c1, R * 1.4);
  if (slime) { gr.addColorStop(0, 'rgba(170,215,190,.92)'); gr.addColorStop(1, 'rgba(80,140,120,.78)'); }
  else { gr.addColorStop(0, '#d9a79e'); gr.addColorStop(1, '#a87068'); }
  cx.fillStyle = gr; cx.fill();
  if (slime) { cx.strokeStyle = 'rgba(255,255,255,.35)'; cx.lineWidth = 3; cx.stroke();
    cx.fillStyle = 'rgba(255,255,255,.28)'; cx.beginPath(); cx.ellipse(c0 - R * .45, c1 - R * .4, R * .22, R * .1, -.6, 0, 7); cx.fill(); }
}

function sandStep() {
  const cw = W / cols;
  if (ptr.down) {
    const i0 = Math.floor(ptr.x / cw), rad = Math.round(28 / cw), hp = H - ptr.y;
    for (let d = -rad; d <= rad; d++) {
      const i = i0 + d; if (i < 0 || i >= cols) continue;
      const w = 1 - Math.abs(d) / (rad + 1);
      if (h[i] > hp) { const cut = (h[i] - hp) * .25 * w, j = i + (d < 0 ? -rad - 2 : rad + 2); h[i] -= cut; if (j >= 0 && j < cols) h[j] += cut; }
      else h[i] = Math.min(H * .9, h[i] + 1.5 * w);
    }
    sound(true);
  }
  for (let pass = 0; pass < 2; pass++) for (let i = 0; i < cols - 1; i++) {
    const df = h[i] - h[i + 1];
    if (Math.abs(df) > 4) { const t = (Math.abs(df) - 4) * .4 * Math.sign(df); h[i] -= t; h[i + 1] += t; }
  }
  const gr = cx.createLinearGradient(0, H * .3, 0, H);
  gr.addColorStop(0, '#e6c9a0'); gr.addColorStop(1, '#a8845c');
  cx.beginPath(); cx.moveTo(0, H);
  for (let i = 0; i < cols; i++) cx.lineTo(i * cw, H - h[i]);
  cx.lineTo(W, H); cx.closePath(); cx.fillStyle = gr; cx.fill();
}

function tapStep() {
  ripples = ripples.filter(r => r.a > .02);
  ripples.forEach(r => {
    r.r += 2.2; r.a *= .96;
    cx.strokeStyle = `rgba(143,184,160,${r.a})`; cx.lineWidth = 3; cx.beginPath(); cx.arc(r.x, r.y, r.r, 0, 7); cx.stroke();
  });
}

function frame() {
  if (!document.hidden && W) {
    cx.clearRect(0, 0, W, H);
    if (mat === 'sand') sandStep(); else if (mat === 'tap') tapStep(); else blobStep();
  }
  requestAnimationFrame(frame);
}
frame();

$$('.sound').forEach(b => b.onclick = () => {
  $$('.sound').forEach(x => x.setAttribute('aria-pressed', x === b));
  mat = b.dataset.sound; initToy();
});
$('#play-reset').onclick = initToy;
$('#play-wiggle').onclick = () => { // keyboard and switch access
  grain(mat, .6);
  if (mat === 'sand') { for (let i = 0; i < 40; i++) h[Math.floor(Math.random() * cols)] += 12; }
  else if (mat === 'tap') ripples.push({ x: W * (.2 + Math.random() * .6), y: H / 2, r: 6, a: 1 });
  else pts.forEach(p => { p.vx += (Math.random() - .5) * 14; p.vy += (Math.random() - .5) * 14; });
};
})();
