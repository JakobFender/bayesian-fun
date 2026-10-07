import { test } from 'node:test';
import assert from 'node:assert/strict';
import { update, bayesFactor, trajectory, strength, betaSummary, betaPdf, lnGamma, probToDecibans } from '../src/bayes.js';
import { encodeState, decodeState } from '../src/share.js';
import { fmtPct } from '../src/format.js';
import { PRESETS } from '../src/presets.js';

const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);

test('textbook update: rare disease, good test', () => {
  // 1% prevalence, 90% sensitivity, 5% false positive rate.
  close(update(0.01, 0.9, 0.05), 0.009 / (0.009 + 0.0495));
});

test("Cromwell's rule: 0 and 1 are absorbing", () => {
  assert.equal(update(0, 0.99, 0.0001), 0);
  assert.equal(update(1, 0.0001, 0.99), 1);
  assert.ok(Number.isNaN(update(0, 0.5, 0)));
});

test('bayes factor edge cases', () => {
  assert.equal(bayesFactor(0.5, 0), Infinity);
  assert.ok(Number.isNaN(bayesFactor(0, 0)));
  assert.equal(strength(1).tier, 'none');
  assert.equal(strength(5).tier, 'substantial');
  assert.equal(strength(1 / 50).tier, 'strong');
  assert.equal(strength(1 / 50).dir, -1);
  assert.equal(strength(Infinity).tier, 'proof');
});

test('trajectory is order independent and skips struck items', () => {
  const ev = PRESETS.find((p) => p.id === 'plant').evidence;
  const a = trajectory(0.1, ev).posterior;
  const b = trajectory(0.1, [...ev].reverse()).posterior;
  close(a, b);
  const struck = ev.map((e, i) => ({ ...e, on: i !== 0 }));
  close(trajectory(0.1, struck).posterior, trajectory(0.1, ev.slice(1)).posterior);
});

test('posterior odds = prior odds × product of BFs', () => {
  const ev = PRESETS[0].evidence;
  const p = trajectory(PRESETS[0].prior, ev).posterior;
  const odds = (PRESETS[0].prior / (1 - PRESETS[0].prior)) * ev.reduce((acc, e) => acc * (e.pEH / e.pEnH), 1);
  close(p / (1 - p), odds, 1e-6);
});

test('beta distribution sanity', () => {
  close(lnGamma(5), Math.log(24), 1e-10);
  close(betaPdf(0.5, 1, 1), 1);
  const s = betaSummary(1, 1);
  close(s.lo, 0.025, 1e-3);
  close(s.hi, 0.975, 1e-3);
  close(s.pAboveHalf, 0.5, 1e-3);
  const t = betaSummary(61, 41);
  assert.ok(t.lo > 0.5 && t.pAboveHalf > 0.97);
});

test('state round-trips through the URL hash, unicode included', () => {
  const state = {
    mode: 'coin',
    hypothesis: 'Le chat ✨ complote',
    prior: 0.123456,
    evidence: [{ text: 'Ünïcødé 🐈', pEH: 0.9, pEnH: 0.001, on: false }],
    coin: { a0: 0.5, b0: 0.5, flips: 'HTTH' },
  };
  const back = decodeState('#' + encodeState(state));
  assert.equal(back.mode, 'coin');
  assert.equal(back.hypothesis, state.hypothesis);
  close(back.prior, 0.1235, 1e-9);
  assert.deepEqual(back.evidence, [{ text: 'Ünïcødé 🐈', pEH: 0.9, pEnH: 0.001, on: false }]);
  assert.deepEqual(back.coin, state.coin);
});

test('garbage hashes are rejected or sanitised', () => {
  assert.equal(decodeState('#nope'), null);
  assert.equal(decodeState('#s=!!!'), null);
  const evil = decodeState('#s=' + Buffer.from(JSON.stringify({ p: 7, e: [['x', -1, 'a']], c: [0, 9999, 'HXT'] })).toString('base64url'));
  assert.equal(evil.prior, 1);
  assert.deepEqual(evil.evidence[0], { text: 'x', pEH: 0, pEnH: 0.5, on: true });
  assert.deepEqual(evil.coin, { a0: 0.1, b0: 1000, flips: 'HT' });
});

test('percent formatting near the edges', () => {
  assert.equal(fmtPct(0.573), '57.3%');
  assert.equal(fmtPct(0.9997), '99.97%');
  assert.equal(fmtPct(0.0003), '0.03%');
  assert.equal(fmtPct(1 - 1e-12), '>99.9999%');
  assert.equal(fmtPct(0), '0%');
  close(probToDecibans(0.5), 0);
});
