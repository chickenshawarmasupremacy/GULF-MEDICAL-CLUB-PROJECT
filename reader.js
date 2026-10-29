(() => {
const $ = id => document.getElementById(id), say = t => $('status').textContent = t;
let file = null;

function setFile(f) {
  if (!f || !f.type.startsWith('image/')) return;
  file = f; $('image-preview').src = URL.createObjectURL(f); $('image-preview').hidden = false;
  say('Image added. Press "Read the text".');
}
$('image-input').onchange = e => setFile(e.target.files[0]);
document.addEventListener('paste', e => setFile([...e.clipboardData.files].find(f => f.type.startsWith('image/'))));

function loadOCR() {
  if (window.Tesseract) return Promise.resolve();
  return new Promise((ok, no) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
    s.onload = ok; s.onerror = no; document.head.append(s);
  });
}
function show(text) {
  const paras = text.replace(/\r/g, '').split(/\n\s*\n/).map(p => p.replace(/\s*\n\s*/g, ' ').trim()).filter(Boolean);
  const out = $('reader-out');
  if (!paras.length) { out.replaceChildren(Object.assign(document.createElement('p'), { textContent: 'No text found. Try a sharper, well-lit photo.' })); return; }
  out.replaceChildren(...paras.map(p => Object.assign(document.createElement('p'), { textContent: p })));
}
$('extract-btn').onclick = async () => {
  if (!file) return say('Add an image first.');
  say('Loading the reader…');
  try {
    await loadOCR();
    const r = await Tesseract.recognize(file, $('lang-sel').value, {
      logger: m => { if (m.status === 'recognizing text') say(`Reading… ${Math.round(m.progress * 100)}%`); }
    });
    show(r.data.text); say('Done. Your text is below.');
  } catch { say('Could not read this image. Check your connection or try a clearer photo.'); }
};

/* Appearance */
const tints = { Cream: ['#f3ecd9', '#22201b'], 'Pale blue': ['#e3eef7', '#1c2630'], 'Soft grey': ['#e6e6e3', '#222'], Dark: ['#1d2429', '#ebe6dd'] };
function style() {
  const o = $('reader-out'), f = $('font-sel').value, [bg, fg] = tints[$('tint-sel').value];
  if (f === 'OpenDyslexic' && !document.getElementById('od-font'))
    document.head.append(Object.assign(document.createElement('link'), { id: 'od-font', rel: 'stylesheet', href: 'https://cdn.jsdelivr.net/npm/@fontsource/opendyslexic/400.css' }));
  Object.assign(o.style, {
    fontFamily: `"${f}", sans-serif`, fontSize: $('size-rng').value + 'px',
    letterSpacing: $('space-rng').value / 100 + 'em', lineHeight: $('line-rng').value / 10, background: bg, color: fg
  });
}
['font-sel', 'size-rng', 'space-rng', 'line-rng', 'tint-sel'].forEach(id => $(id).addEventListener('input', style));
style();

/* Read aloud and copy */
$('read-aloud').onclick = () => {
  const s = speechSynthesis;
  if (s.speaking) return s.cancel();
  const u = new SpeechSynthesisUtterance($('reader-out').innerText);
  u.lang = $('lang-sel').value === 'ara' ? 'ar' : 'en'; u.rate = 0.9; s.speak(u);
};
$('copy-text').onclick = async () => {
  try { await navigator.clipboard.writeText($('reader-out').innerText); say('Text copied.'); } catch { say('Could not copy. Select the text and copy it yourself.'); }
};
})();
