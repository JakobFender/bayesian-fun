// Pure probability math. No DOM in here — this module is unit tested.

const clamp01 = (x) => Math.min(1, Math.max(0, x));

/**
 * One application of Bayes' rule.
 * Returns NaN when the evidence is impossible under both hypotheses
 * (or under the only hypothesis you allow yourself to believe).
 */
export function update(prior, pEH, pEnH) {
  const joint = clamp01(prior) * pEH;
  const jointNot = (1 - clamp01(prior)) * pEnH;
  const total = joint + jointNot;
  if (total === 0) return NaN;
  return joint / total;
}

/** Bayes factor (likelihood ratio) P(E|H) / P(E|¬H). */
export function bayesFactor(pEH, pEnH) {
  if (pEnH === 0) return pEH === 0 ? NaN : Infinity;
  return pEH / pEnH;
}

/** Evidence weight in decibans (Turing & Good): 10·log10(BF). */
export function decibans(bf) {
  if (Number.isNaN(bf)) return NaN;
  if (bf === Infinity) return Infinity;
  if (bf === 0) return -Infinity;
  return 10 * Math.log10(bf);
}

/** Belief expressed as log-odds in decibans. */
export function probToDecibans(p) {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  return 10 * Math.log10(p / (1 - p));
}

/**
 * Walk the evidence list and return one step per item.
 * Items with `on === false` are skipped (struck from the record) but still
 * produce a step so indices line up with the UI.
 */
export function trajectory(prior, evidence) {
  const steps = [];
  let p = clamp01(prior);
  for (const e of evidence) {
    const before = p;
    const bf = bayesFactor(e.pEH, e.pEnH);
    if (e.on !== false && !Number.isNaN(before)) p = update(before, e.pEH, e.pEnH);
    steps.push({
      before,
      after: p,
      bf,
      joint: before * e.pEH,
      jointNot: (1 - before) * e.pEnH,
      active: e.on !== false,
    });
  }
  return { steps, posterior: p };
}

/**
 * Verbal strength of a Bayes factor, after Kass & Raftery (1995),
 * with commentary the original authors were too polite to include.
 */
export function strength(bf) {
  if (Number.isNaN(bf)) {
    return { tier: 'void', dir: 0, label: 'Impossible either way', quip: 'This evidence cannot occur. Recalibrate your instruments.' };
  }
  if (bf === 1) {
    return { tier: 'none', dir: 0, label: 'Irrelevant', quip: 'Equally likely either way. Why was this entered into evidence?' };
  }
  const dir = bf > 1 ? 1 : -1;
  const k = dir > 0 ? bf : 1 / bf;
  const side = dir > 0 ? 'for' : 'against';
  if (!Number.isFinite(k)) {
    return { tier: 'proof', dir, label: `Proof ${side}`, quip: 'Infinite Bayes factor. Logicians rejoice; statisticians grow suspicious.' };
  }
  if (k < 3.2) return { tier: 'weak', dir, label: `Barely worth mentioning ${side}`, quip: 'A shrug, quantified.' };
  if (k < 10) return { tier: 'substantial', dir, label: `Substantial ${side}`, quip: 'Eyebrows have been raised.' };
  if (k < 100) return { tier: 'strong', dir, label: `Strong ${side}`, quip: 'A committee would be convened.' };
  return { tier: 'decisive', dir, label: `Decisive ${side}`, quip: 'Case closed, pending peer review.' };
}

/* ---------- Beta distribution (coin bench) ---------- */

// Lanczos approximation, g = 7.
const LANCZOS = [
  0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
  -176.61502916214059, 12.507343278686905, -0.13857109526572012,
  9.9843695780195716e-6, 1.5056327351493116e-7,
];

export function lnGamma(z) {
  if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - lnGamma(1 - z);
  z -= 1;
  let x = LANCZOS[0];
  for (let i = 1; i < 9; i++) x += LANCZOS[i] / (z + i);
  const t = z + 7.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}

export function lnBeta(a, b) {
  return lnGamma(a) + lnGamma(b) - lnGamma(a + b);
}

export function betaPdf(x, a, b) {
  if (x < 0 || x > 1) return 0;
  if (x === 0) return a < 1 ? Infinity : a === 1 ? b : 0;
  if (x === 1) return b < 1 ? Infinity : b === 1 ? a : 0;
  return Math.exp((a - 1) * Math.log(x) + (b - 1) * Math.log(1 - x) - lnBeta(a, b));
}

export function betaMean(a, b) {
  return a / (a + b);
}

/** Mode, or null when the density has no interior maximum. */
export function betaMode(a, b) {
  if (a > 1 && b > 1) return (a - 1) / (a + b - 2);
  return null;
}

/**
 * Numeric CDF summaries on a midpoint grid. Good to ~1e-3, which is
 * more precision than anyone flipping a coin in a browser deserves.
 */
export function betaSummary(a, b, n = 4000) {
  const dx = 1 / n;
  const cdf = new Float64Array(n + 1);
  let acc = 0;
  for (let i = 0; i < n; i++) {
    acc += betaPdf((i + 0.5) * dx, a, b) * dx;
    cdf[i + 1] = acc;
  }
  // Normalise away integration error.
  for (let i = 0; i <= n; i++) cdf[i] /= acc;
  const quantile = (q) => {
    let lo = 0;
    let hi = n;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (cdf[mid] < q) lo = mid;
      else hi = mid;
    }
    const span = cdf[hi] - cdf[lo] || 1;
    return (lo + (q - cdf[lo]) / span) * dx;
  };
  return {
    mean: betaMean(a, b),
    mode: betaMode(a, b),
    lo: quantile(0.025),
    hi: quantile(0.975),
    pAboveHalf: 1 - cdf[n / 2],
  };
}

/** Sample points for plotting, clipping the infinite edges of U-shaped priors. */
export function betaCurve(a, b, n = 200) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const x = i / n;
    const xe = Math.min(1 - 1e-3, Math.max(1e-3, x));
    pts.push({ x, y: betaPdf(xe, a, b) });
  }
  return pts;
}
