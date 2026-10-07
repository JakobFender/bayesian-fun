// Number formatting tuned for probabilities that hug 0 and 1.

const strip = (s) => (s.includes('.') ? s.replace(/0+$/, '').replace(/\.$/, '') : s);

export function fmtPct(p) {
  if (Number.isNaN(p)) return 'undefined';
  if (p <= 0) return '0%';
  if (p >= 1) return '100%';
  const tail = Math.min(p, 1 - p) * 100;
  const decimals = tail >= 1 ? 1 : Math.min(6, Math.ceil(-Math.log10(tail)) + 1);
  const s = strip((p * 100).toFixed(decimals));
  if (s === '100') return '>99.9999%';
  if (s === '0') return '<0.0001%';
  return s + '%';
}

export function fmtNum(x) {
  if (Number.isNaN(x)) return '—';
  if (x === Infinity) return '∞';
  if (x === 0) return '0';
  if (x >= 1e4) return new Intl.NumberFormat('en', { notation: 'compact', maximumSignificantDigits: 3 }).format(x);
  if (x < 0.01) return x.toExponential(1).replace('e', '×10^');
  return strip(x.toPrecision(x >= 100 ? 4 : 3));
}

export function fmtDb(d) {
  if (Number.isNaN(d)) return '—';
  if (d === Infinity) return '+∞ dB';
  if (d === -Infinity) return '−∞ dB';
  const s = Math.abs(d).toFixed(1);
  return (d >= 0 ? '+' : '−') + s + ' dB';
}

/** Probability as user-facing slider percent (0..100) and back. */
export const toPct = (p) => Math.round(p * 1e6) / 1e4;
export const fromPct = (v) => Math.min(1, Math.max(0, Number(v) / 100));

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}
