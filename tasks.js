(() => {
const $ = id => document.getElementById(id);
const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
};

/* ---------- Steps ---------- */
let steps = store.get('anchor.steps', []);
const list = $('step-list'), input = $('new-step'), say = t => $('task-status').textContent = t;

function render() {
  list.replaceChildren();
  if (!steps.length) {
    const li = document.createElement('li');
    li.textContent = 'No steps yet. Add one above.';
    list.append(li);
  }
  steps.forEach((s, i) => {
    const li = document.createElement('li');
    const cb = Object.assign(document.createElement('input'), { type: 'checkbox', id: 'step' + i, checked: s.done });
    const lb = Object.assign(document.createElement('label'), { htmlFor: cb.id, textContent: s.text });
    lb.style.cssText = 'flex:1;margin:0;font-weight:400' + (s.done ? ';text-decoration:line-through;opacity:.6' : '');
    const rm = Object.assign(document.createElement('button'), { type: 'button', textContent: '✕' });
    rm.setAttribute('aria-label', 'Remove step: ' + s.text);
    cb.onchange = () => { s.done = cb.checked; save(); };
    rm.onclick = () => { steps.splice(i, 1); save(); say('Step removed.'); };
    li.append(cb, lb, rm);
    list.append(li);
  });
}
function save() { store.set('anchor.steps', steps); render(); }
function add(text) { text = text.trim(); if (text) steps.push({ text, done: false }); }

$('add-step').onclick = () => { add(input.value); input.value = ''; save(); input.focus(); };
input.addEventListener('keydown', e => { if (e.key === 'Enter') $('add-step').click(); });
$('split-task').onclick = () => {
  const t = input.value.trim();
  if (!t) return say('Type the big task in the box first, then press this button.');
  let parts = t.split(/\s*(?:,|;|\bthen\b|\band\b)\s*/i).filter(Boolean);
  if (parts.length < 2) parts = [`Gather what you need for: ${t}`, 'Do just the first 5 minutes', 'Take a short break', 'Keep going with the next part', 'Check it over and stop'];
  parts.forEach(add); input.value = ''; save(); say(`Added ${parts.length} steps.`);
};

/* ---------- Timer ---------- */
const mins = $('minutes'), ring = $('timer-ring'), grow = $('grow-circle'),
  topClip = $('glass-top-clip'), botClip = $('glass-bot-clip'), stream = $('glass-stream');
let total, remaining, endAt, tid = null, phase = 'step';

function draw() {
  const p = total ? 1 - remaining / total : 0;
  ring.style.strokeDashoffset = 565 * (1 - p);
  grow.style.transform = `scale(${0.02 + 0.98 * p})`;
  topClip.setAttribute('y', 10 + 60 * p); topClip.setAttribute('height', 60 * (1 - p));
  botClip.setAttribute('y', 130 - 60 * p); botClip.setAttribute('height', 60 * p);
  stream.setAttribute('opacity', tid && p > 0 && p < 1 ? 1 : 0);
  const s = Math.ceil(remaining);
  $('timer-readout').textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
function setPhase(t) { $('timer-phase').textContent = t; }
function stop() { clearInterval(tid); tid = null; }
function tick() {
  remaining = Math.max(0, (endAt - Date.now()) / 1000);
  draw();
  if (remaining > 0) return;
  stop(); draw();
  if (navigator.vibrate) navigator.vibrate(200);
  if (phase === 'step' && $('buffer-on').checked) {
    phase = 'buffer'; total = remaining = 300; setPhase('Step done. Buffer time: rest or get ready for the next step.'); start();
  } else { phase = 'step'; setPhase('Time is up. Well done.'); }
}
function start() {
  if (tid) return;
  if (remaining <= 0) reset();
  endAt = Date.now() + remaining * 1000;
  tid = setInterval(tick, 200);
  if (phase === 'step') setPhase('Working on this step.');
  tick();
}
function reset() {
  stop(); phase = 'step';
  total = remaining = Math.max(1, Math.min(120, +mins.value || 10)) * 60;
  setPhase(''); draw();
}
$('timer-start').onclick = start;
$('timer-pause').onclick = () => { if (tid) { stop(); setPhase('Paused.'); draw(); } };
$('timer-reset').onclick = reset;
mins.onchange = () => { if (!tid) reset(); };

document.querySelectorAll('input[name=tstyle]').forEach(r => r.onchange = () => showStyle(r.value));
function showStyle(v) {
  document.querySelectorAll('[data-visual]').forEach(el => el.hidden = el.dataset.visual !== v);
  store.set('anchor.tstyle', v);
}
const saved = store.get('anchor.tstyle', 'ring');
const radio = document.querySelector(`input[name=tstyle][value=${saved}]`);
if (radio) radio.checked = true;
showStyle(saved);

render(); reset();
})();
