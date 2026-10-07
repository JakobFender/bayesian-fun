import './style.css';
import { DEFAULT_STATE } from './presets.js';
import { encodeState, decodeState } from './share.js';
import { initLab } from './lab.js';
import { initCoin } from './coin.js';

const clone = (o) => JSON.parse(JSON.stringify(o));

const state = clone(DEFAULT_STATE);
let lastWrittenHash = '';
let saveTimer = 0;

function applyHash() {
  const decoded = decodeState(location.hash);
  if (!decoded) return false;
  Object.assign(state, decoded);
  return true;
}

/** Debounced write of the current state into the URL hash. */
function persist() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const hash = '#' + encodeState(state);
    lastWrittenHash = hash;
    history.replaceState(null, '', hash);
  }, 250);
}

const toastEl = document.getElementById('toast');
let toastTimer = 0;
export function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2400);
}

const hasHash = applyHash();
const lab = initLab(state, { persist, toast, fresh: !hasHash });
const coin = initCoin(state, { persist });

function setMode(mode) {
  state.mode = mode;
  for (const btn of document.querySelectorAll('[role="tab"]')) {
    const on = btn.dataset.mode === mode;
    btn.setAttribute('aria-selected', String(on));
    btn.tabIndex = on ? 0 : -1;
  }
  document.getElementById('panel-lab').hidden = mode !== 'lab';
  document.getElementById('panel-coin').hidden = mode !== 'coin';
  // Charts created while hidden need a nudge once visible.
  (mode === 'lab' ? lab : coin).render();
  persist();
}

for (const btn of document.querySelectorAll('[role="tab"]')) {
  btn.addEventListener('click', () => setMode(btn.dataset.mode));
  btn.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const next = state.mode === 'lab' ? 'coin' : 'lab';
    setMode(next);
    document.querySelector(`[data-mode="${next}"]`).focus();
  });
}

for (const btn of document.querySelectorAll('[data-share]')) {
  btn.addEventListener('click', async () => {
    clearTimeout(saveTimer);
    const url = location.href.split('#')[0] + '#' + encodeState(state);
    history.replaceState(null, '', url);
    lastWrittenHash = location.hash;
    try {
      if (navigator.share && matchMedia('(pointer: coarse)').matches) {
        await navigator.share({ title: 'Probably', text: state.hypothesis || 'A Bayesian case file', url });
      } else {
        await navigator.clipboard.writeText(url);
        toast('Link copied. Evidence is now admissible in group chats.');
      }
    } catch (err) {
      if (err?.name !== 'AbortError') toast('Could not copy. The link is in your address bar.');
    }
  });
}

// A pasted / edited link should load the new case without a reload.
window.addEventListener('hashchange', () => {
  if (location.hash === lastWrittenHash) return;
  if (!applyHash()) return;
  lab.load();
  coin.load();
  setMode(state.mode);
});

// Re-theme charts when the OS colour scheme flips.
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  lab.retheme();
  coin.retheme();
});

setMode(state.mode);
