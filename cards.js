(() => {
const grid = document.getElementById('card-grid'), overlay = document.getElementById('show-card'),
  txt = document.getElementById('show-card-text'), colors = { stop: '#c98f86', need: '#d9b88f', ok: '#8fb8a0' };
let last = null, mine = [];
try { mine = JSON.parse(localStorage.getItem('anchor.cards')) || []; } catch {}

function open(text, tone, btn) {
  txt.textContent = text; overlay.style.background = colors[tone] || colors.need;
  overlay.dataset.open = 'true'; overlay.tabIndex = -1; overlay.focus(); last = btn;
}
function close() { overlay.dataset.open = 'false'; if (last) last.focus(); }
function addButton(text, tone) {
  const b = Object.assign(document.createElement('button'), { type: 'button', className: 'talk-card', textContent: text });
  b.dataset.tone = tone; grid.append(b);
}
mine.forEach(c => addButton(c.text, c.tone));

grid.addEventListener('click', e => { const b = e.target.closest('.talk-card'); if (b) open(b.textContent, b.dataset.tone, b); });
overlay.addEventListener('click', close);
document.addEventListener('keydown', e => {
  if (overlay.dataset.open === 'true' && (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); close(); }
});
document.getElementById('save-card').onclick = () => {
  const box = document.getElementById('custom-text'), text = box.value.trim();
  if (!text) return box.focus();
  const tone = document.getElementById('custom-tone').value;
  mine.push({ text, tone }); addButton(text, tone); box.value = '';
  try { localStorage.setItem('anchor.cards', JSON.stringify(mine)); } catch {}
};
})();
