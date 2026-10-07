// Scenario state <-> URL hash. Base64url-encoded compact JSON so links
// survive chat apps that mangle brackets and quotes.

function toBase64Url(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(s) {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

const round = (x, d = 4) => Math.round(x * 10 ** d) / 10 ** d;
const num = (x, lo, hi, fallback) => {
  const n = Number(x);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : fallback;
};

/** state -> hash string (without the leading '#'). */
export function encodeState(state) {
  const compact = {
    m: state.mode === 'coin' ? 'c' : 'l',
    h: state.hypothesis,
    p: round(state.prior),
    e: state.evidence.map((e) => [e.text, round(e.pEH), round(e.pEnH), e.on === false ? 0 : 1]),
    c: [round(state.coin.a0, 3), round(state.coin.b0, 3), state.coin.flips],
  };
  return 's=' + toBase64Url(JSON.stringify(compact));
}

/** hash string -> partial state, or null if it is not ours / is garbage. */
export function decodeState(hash) {
  const raw = hash.replace(/^#/, '');
  if (!raw.startsWith('s=')) return null;
  let c;
  try {
    c = JSON.parse(fromBase64Url(raw.slice(2)));
  } catch {
    return null;
  }
  if (!c || typeof c !== 'object') return null;
  const coin = Array.isArray(c.c) ? c.c : [];
  return {
    mode: c.m === 'c' ? 'coin' : 'lab',
    hypothesis: typeof c.h === 'string' ? c.h.slice(0, 200) : '',
    prior: num(c.p, 0, 1, 0.5),
    evidence: (Array.isArray(c.e) ? c.e : []).slice(0, 50).map((e) => ({
      text: typeof e?.[0] === 'string' ? e[0].slice(0, 200) : '',
      pEH: num(e?.[1], 0, 1, 0.5),
      pEnH: num(e?.[2], 0, 1, 0.5),
      on: e?.[3] !== 0,
    })),
    coin: {
      a0: num(coin[0], 0.1, 1000, 1),
      b0: num(coin[1], 0.1, 1000, 1),
      flips: typeof coin[2] === 'string' ? coin[2].replace(/[^HT]/g, '').slice(0, 2000) : '',
    },
  };
}
