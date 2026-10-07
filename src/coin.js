import { COIN_PRIORS } from './presets.js';
import { betaCurve, betaSummary } from './bayes.js';
import { fmtNum, escapeHtml } from './format.js';
import { Chart, chartColors, applyChartDefaults } from './theme.js';

const $ = (id) => document.getElementById(id);
const pct = (x) => (x * 100).toFixed(1) + '%';

export function initCoin(state, { persist }) {
  const coin = () => state.coin;
  let chart = null;
  // The mystery coin's bias lives only in memory, so shared links can't spoil it.
  let mystery = Math.random();
  let revealed = false;

  const els = {
    priors: $('coin-priors'),
    a: $('coin-a'),
    b: $('coin-b'),
    log: $('flip-log'),
    stats: $('coin-stats'),
    verdict: $('coin-verdict'),
    face: $('coin-face'),
    visual: $('coin-visual'),
    note: $('mystery-note'),
  };

  els.priors.innerHTML = COIN_PRIORS.map(
    (p) => `<button role="radio" class="prior-choice" data-prior="${p.id}">
      <b>${escapeHtml(p.label)}</b><span>${escapeHtml(p.note)}</span></button>`,
  ).join('');
  els.priors.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-prior]');
    if (!btn) return;
    const p = COIN_PRIORS.find((x) => x.id === btn.dataset.prior);
    coin().a0 = p.a0;
    coin().b0 = p.b0;
    syncInputs();
    render();
    persist();
  });

  for (const [el, key] of [[els.a, 'a0'], [els.b, 'b0']]) {
    el.addEventListener('input', () => {
      const v = Number(el.value);
      if (!Number.isFinite(v) || v < 0.1 || v > 1000) return;
      coin()[key] = v;
      render();
      persist();
    });
    el.addEventListener('change', () => (el.value = coin()[key]));
  }

  function flip(side) {
    coin().flips += side;
    els.face.textContent = side;
    els.visual.classList.remove('spin');
    void els.visual.offsetWidth;
    els.visual.classList.add('spin');
    render();
    persist();
  }

  const flipMystery = (n) => {
    let s = '';
    for (let i = 0; i < n; i++) s += Math.random() < mystery ? 'H' : 'T';
    coin().flips += s.slice(0, -1);
    flip(s.slice(-1));
  };

  $('btn-heads').addEventListener('click', () => flip('H'));
  $('btn-tails').addEventListener('click', () => flip('T'));
  els.visual.addEventListener('click', () => flipMystery(1));
  $('btn-mystery1').addEventListener('click', () => flipMystery(1));
  $('btn-mystery10').addEventListener('click', () => flipMystery(10));
  $('btn-undo').addEventListener('click', () => {
    coin().flips = coin().flips.slice(0, -1);
    render();
    persist();
  });
  $('btn-coin-reset').addEventListener('click', () => {
    coin().flips = '';
    mystery = Math.random();
    revealed = false;
    els.face.textContent = '?';
    render();
    persist();
  });
  $('btn-reveal').addEventListener('click', () => {
    revealed = !revealed;
    render();
  });

  function syncInputs() {
    els.a.value = coin().a0;
    els.b.value = coin().b0;
  }

  function render() {
    const { a0, b0, flips } = coin();
    const heads = [...flips].filter((f) => f === 'H').length;
    const tails = flips.length - heads;
    const a = a0 + heads;
    const b = b0 + tails;
    const sum = betaSummary(a, b);

    for (const btn of els.priors.querySelectorAll('[data-prior]')) {
      const p = COIN_PRIORS.find((x) => x.id === btn.dataset.prior);
      btn.setAttribute('aria-checked', String(p.a0 === a0 && p.b0 === b0));
    }

    const recent = flips.slice(-120);
    els.log.innerHTML =
      (flips.length > recent.length ? `<span class="more">…${flips.length - recent.length} earlier</span>` : '') +
      [...recent].map((f) => `<span class="chip ${f === 'H' ? 'h' : 't'}">${f}</span>`).join('');

    $('btn-reveal').textContent = revealed ? 'Hide mystery bias' : 'Reveal mystery bias';
    els.note.textContent = revealed
      ? `The mystery coin's true bias is θ = ${mystery.toFixed(3)}. (Only mystery flips use it; your manual Heads/Tails are taken on faith.)`
      : 'A mystery coin with an unknown bias is on the bench. Flip it and see how quickly the posterior closes in.';

    els.stats.innerHTML = `
      <div><dt>Flips</dt><dd>${flips.length} <small>(${heads}H / ${tails}T)</small></dd></div>
      <div><dt>Posterior</dt><dd>Beta(${fmtNum(a)}, ${fmtNum(b)})</dd></div>
      <div><dt>Mean θ</dt><dd>${pct(sum.mean)}</dd></div>
      <div><dt>95% credible</dt><dd>${pct(sum.lo)} – ${pct(sum.hi)}</dd></div>
      <div><dt>P(θ &gt; ½)</dt><dd>${pct(sum.pAboveHalf)}</dd></div>
      <div><dt>Next flip heads</dt><dd>${pct(sum.mean)}</dd></div>`;

    els.verdict.textContent = coinVerdict(flips.length, sum);
    renderChart(a0, b0, a, b, sum);
  }

  function coinVerdict(n, s) {
    const width = s.hi - s.lo;
    if (n === 0) return 'No flips yet. The coin awaits interrogation.';
    if (s.lo > 0.5) return `Biased towards heads${width < 0.05 ? ', with tedious precision' : ''}. Confiscate it.`;
    if (s.hi < 0.5) return `Biased towards tails${width < 0.05 ? ', with tedious precision' : ''}. Report it to the Mint.`;
    if (width < 0.05) return 'Fair, as far as anyone can reasonably tell. You may stop flipping now. Please stop flipping now.';
    if (n < 10) return 'Too early to say. Ten flips prove nothing except that you have a coin.';
    return 'Fairness cannot be ruled out. Neither can mild mischief.';
  }

  function renderChart(a0, b0, a, b, sum) {
    const c = chartColors();
    const n = 400;
    const post = betaCurve(a, b, n);
    const prior = betaCurve(a0, b0, n);
    const band = post.map((pt) => ({ x: pt.x, y: pt.x >= sum.lo && pt.x <= sum.hi ? pt.y : null }));
    const peak = Math.max(...post.map((p) => p.y), ...prior.map((p) => p.y));
    const datasets = [
      { label: '95% credible interval', data: band, borderWidth: 0, backgroundColor: c.seriesFill, fill: 'origin', pointRadius: 0, spanGaps: false },
      { label: 'Posterior', data: post, borderColor: c.series, borderWidth: 2, pointRadius: 0, fill: false },
      { label: 'Prior', data: prior, borderColor: c.prior, borderWidth: 1.5, borderDash: [5, 5], pointRadius: 0, fill: false },
    ];
    if (revealed) {
      datasets.push({
        label: 'True bias',
        data: [{ x: mystery, y: 0 }, { x: mystery, y: peak * 1.05 }],
        borderColor: c.truth,
        borderWidth: 2,
        pointRadius: 0,
        fill: false,
      });
    }
    const options = {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 200 },
      parsing: false,
      interaction: { mode: 'nearest', axis: 'x', intersect: false },
      plugins: {
        legend: {
          position: 'bottom',
          labels: { usePointStyle: true, pointStyle: 'line', boxWidth: 24 },
        },
        tooltip: {
          filter: (item) => item.dataset.label === 'Posterior' || item.dataset.label === 'Prior',
          callbacks: {
            title: (items) => `θ = ${items[0].parsed.x.toFixed(3)}`,
            label: (item) => `${item.dataset.label} density: ${item.parsed.y.toFixed(2)}`,
          },
        },
      },
      scales: {
        x: { type: 'linear', min: 0, max: 1, title: { display: true, text: 'θ = P(heads)' }, ticks: { callback: (v) => v } },
        y: { min: 0, title: { display: true, text: 'density' }, grid: { color: c.grid } },
      },
    };
    if (!chart) {
      chart = new Chart($('beta-chart'), { type: 'line', data: { datasets }, options });
    } else {
      chart.data.datasets = datasets;
      chart.options = options;
      chart.update();
    }
  }

  function load() {
    mystery = Math.random();
    revealed = false;
    els.face.textContent = coin().flips.slice(-1) || '?';
    syncInputs();
    render();
  }

  load();

  return {
    load,
    render: () => {
      chart?.resize();
      render();
    },
    retheme: () => {
      applyChartDefaults();
      chart?.destroy();
      chart = null;
      render();
    },
  };
}
