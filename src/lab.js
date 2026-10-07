import { PRESETS } from './presets.js';
import { trajectory, strength, decibans, probToDecibans, bayesFactor, update } from './bayes.js';
import { fmtPct, fmtNum, fmtDb, toPct, fromPct, escapeHtml } from './format.js';
import { Chart, chartColors, applyChartDefaults } from './theme.js';

const $ = (id) => document.getElementById(id);
const DB_CLIP = 40; // log-odds chart clips at ±40 dB (10,000 : 1)

function verdictFor(p) {
  if (Number.isNaN(p)) return 'Undefined. You observed something your prior declared impossible. Please consult a philosopher.';
  if (p === 1) return 'Certain, dogmatically. No evidence will ever change this. Is that what you want?';
  if (p === 0) return 'Impossible, dogmatically. You have chosen not to learn. Bold.';
  if (p >= 0.99) return 'Beyond reasonable doubt. Inform the relevant authorities.';
  if (p >= 0.9) return 'Very probably. You may say "I knew it", softly.';
  if (p >= 0.7) return 'Probably. Act accordingly, but keep receipts.';
  if (p >= 0.55) return 'Leaning yes, in the manner of a tall tree in light wind.';
  if (p > 0.45) return 'A coin toss. The evidence has achieved nothing, perfectly.';
  if (p > 0.3) return 'Leaning no. Polite scepticism is advised.';
  if (p > 0.1) return 'Probably not. Do not mention it at dinner.';
  if (p > 0.01) return 'Very probably not. Mention it at dinner only as a joke.';
  return 'Vanishingly unlikely. The hypothesis has been escorted from the building.';
}

export function initLab(state, { persist, toast, fresh }) {
  applyChartDefaults();

  const els = {
    hyp: $('hypothesis'),
    prior: $('prior'),
    priorOut: $('prior-out'),
    cromwell: $('cromwell'),
    list: $('evidence-list'),
    empty: $('evidence-empty'),
    posterior: $('posterior-out'),
    stamp: $('stamp'),
    verdict: $('verdict-text'),
    verdictHyp: $('verdict-hyp'),
    meterFill: $('meter-fill'),
    meterPrior: $('meter-prior'),
    stats: $('stats'),
    box: $('bayes-box'),
    boxLabel: $('box-label'),
    boxEq: $('box-eq'),
    trajHint: $('traj-hint'),
  };

  let scale = 'prob';
  let boxIndex = -1; // -1 = follow the latest evidence
  let chart = null;
  let lastPosterior = null;

  /* ---------- presets ---------- */
  const row = $('preset-row');
  row.innerHTML = PRESETS.map(
    (p) => `<button class="preset" data-preset="${p.id}">
      <span class="preset-emoji" aria-hidden="true">${p.emoji}</span>
      <span class="preset-title">${escapeHtml(p.title)}</span>
      <span class="preset-lesson">${escapeHtml(p.lesson)}</span>
    </button>`,
  ).join('');
  row.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-preset]');
    if (!btn) return;
    loadPreset(PRESETS.find((p) => p.id === btn.dataset.preset));
    toast(`Case file opened: ${btn.querySelector('.preset-title').textContent}`);
  });

  function loadPreset(p) {
    state.hypothesis = p.hypothesis;
    state.prior = p.prior;
    state.evidence = p.evidence.map((e) => ({ ...e }));
    boxIndex = -1;
    load();
    persist();
  }

  /* ---------- hypothesis & prior ---------- */
  els.hyp.addEventListener('input', () => {
    state.hypothesis = els.hyp.value;
    renderDerived();
    persist();
  });
  els.prior.addEventListener('input', () => {
    state.prior = fromPct(els.prior.value);
    renderDerived();
    persist();
  });
  els.cromwell.addEventListener('click', (e) => {
    if (!e.target.closest('[data-sliver]')) return;
    state.prior = state.prior >= 1 ? 0.995 : 0.005;
    els.prior.value = toPct(state.prior);
    renderDerived();
    persist();
  });

  /* ---------- evidence list ---------- */
  $('add-evidence').addEventListener('click', () => {
    state.evidence.push({ text: '', pEH: 0.5, pEnH: 0.5, on: true });
    boxIndex = -1;
    renderList();
    renderDerived();
    persist();
    els.list.lastElementChild?.querySelector('.ev-text')?.focus();
  });

  function likelihoodField(i, key, label, sub) {
    const v = toPct(state.evidence[i][key]);
    return `<div class="lk lk-${key}">
      <div class="lk-head">
        <label for="ev-${i}-${key}">${label} <span class="muted">${sub}</span></label>
        <span class="lk-num"><input type="number" inputmode="decimal" min="0" max="100" step="any"
          id="ev-${i}-${key}-n" data-key="${key}" data-kind="num" value="${v}" aria-label="${label} percent" />%</span>
      </div>
      <input type="range" min="0" max="100" step="0.5" id="ev-${i}-${key}" data-key="${key}" data-kind="range" value="${v}" />
    </div>`;
  }

  function renderList() {
    els.list.innerHTML = state.evidence
      .map(
        (e, i) => `<li class="ev-card" data-i="${i}">
        <div class="ev-head">
          <button class="ev-idx" data-focus title="Inspect this update below">E${i + 1}</button>
          <label class="sr-only" for="ev-${i}-text">Evidence ${i + 1}</label>
          <input class="ev-text" id="ev-${i}-text" maxlength="200" placeholder="What did you observe?" value="${escapeHtml(e.text)}" />
          <button class="ev-del" data-del aria-label="Remove evidence ${i + 1}">×</button>
        </div>
        <div class="ev-sliders">
          ${likelihoodField(i, 'pEH', 'If true', 'P(E | H)')}
          ${likelihoodField(i, 'pEnH', 'If false', 'P(E | ¬H)')}
        </div>
        <div class="ev-foot">
          <span class="bf-badge" data-bf></span>
          <span class="ev-shift" data-shift></span>
          <label class="admit"><input type="checkbox" data-on ${e.on !== false ? 'checked' : ''} /> admitted</label>
        </div>
        <p class="quip" data-quip></p>
      </li>`,
      )
      .join('');
    els.empty.hidden = state.evidence.length > 0;
  }

  els.list.addEventListener('input', (e) => {
    const card = e.target.closest('.ev-card');
    if (!card) return;
    const i = Number(card.dataset.i);
    const item = state.evidence[i];
    const t = e.target;
    if (t.classList.contains('ev-text')) {
      item.text = t.value;
    } else if (t.dataset.key) {
      if (t.value === '') return; // mid-typing
      item[t.dataset.key] = fromPct(t.value);
      // Mirror the sibling control without clobbering what the user is typing.
      const other = card.querySelector(`[data-key="${t.dataset.key}"][data-kind="${t.dataset.kind === 'num' ? 'range' : 'num'}"]`);
      other.value = toPct(item[t.dataset.key]);
      boxIndex = i;
    } else if (t.matches('[data-on]')) {
      item.on = t.checked;
    } else return;
    renderDerived();
    persist();
  });
  els.list.addEventListener('change', (e) => {
    // Normalise out-of-range typed numbers once the user leaves the field.
    if (e.target.dataset.kind === 'num') {
      const i = Number(e.target.closest('.ev-card').dataset.i);
      e.target.value = toPct(state.evidence[i][e.target.dataset.key]);
    }
  });
  els.list.addEventListener('click', (e) => {
    const card = e.target.closest('.ev-card');
    if (!card) return;
    const i = Number(card.dataset.i);
    if (e.target.closest('[data-del]')) {
      state.evidence.splice(i, 1);
      boxIndex = -1;
      renderList();
      renderDerived();
      persist();
    } else if (e.target.closest('[data-focus]')) {
      boxIndex = i;
      renderBox(trajectory(state.prior, state.evidence));
      $('box-h').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });

  /* ---------- derived output ---------- */
  function renderDerived() {
    const { steps, posterior } = trajectory(state.prior, state.evidence);
    els.priorOut.textContent = fmtPct(state.prior);
    renderCromwell();
    renderCards(steps);
    renderVerdict(steps, posterior);
    renderChart(steps);
    renderBox({ steps });
  }

  function renderCromwell() {
    const p = state.prior;
    if (p > 0 && p < 1) {
      els.cromwell.hidden = true;
      return;
    }
    els.cromwell.hidden = false;
    const word = p === 0 ? '0%' : '100%';
    els.cromwell.innerHTML = `<strong>⚠ Cromwell's rule violated.</strong>
      With a prior of exactly ${word}, no evidence, however overwhelming, can ever move you.
      Multiplying by zero is very stable.
      <blockquote>“I beseech you, in the bowels of Christ, think it possible you may be mistaken.”<cite>Oliver Cromwell, 1650</cite></blockquote>
      <button class="btn small" data-sliver>Allow a sliver of doubt (${p === 0 ? '0.5%' : '99.5%'})</button>`;
  }

  function renderCards(steps) {
    els.list.querySelectorAll('.ev-card').forEach((card, i) => {
      const s = steps[i];
      const st = strength(s.bf);
      const badge = card.querySelector('[data-bf]');
      badge.className = `bf-badge tier-${st.tier} dir-${st.dir > 0 ? 'for' : st.dir < 0 ? 'against' : 'none'}`;
      badge.innerHTML = `<b>BF ${fmtNum(s.bf)}</b> · ${st.label} <span class="db">${fmtDb(decibans(s.bf))}</span>`;
      card.querySelector('[data-shift]').textContent = s.active
        ? `${fmtPct(s.before)} → ${fmtPct(s.after)}`
        : 'struck from the record';
      card.querySelector('[data-quip]').textContent = st.quip;
      card.classList.toggle('struck', !s.active);
      card.classList.toggle('selected', i === currentBoxIndex(steps));
    });
  }

  function renderVerdict(steps, posterior) {
    els.verdictHyp.textContent = state.hypothesis ? `“${state.hypothesis}”` : 'Hypothesis: unstated (bold strategy).';
    els.posterior.textContent = fmtPct(posterior);
    els.verdict.textContent = verdictFor(posterior);

    const beyond = posterior > 0.99;
    if (beyond && !(lastPosterior > 0.99)) {
      // Restart the slam animation each time we cross the threshold.
      els.stamp.classList.remove('on');
      void els.stamp.offsetWidth;
    }
    els.stamp.classList.toggle('on', beyond);
    lastPosterior = posterior;

    const pct = Number.isNaN(posterior) ? 0 : posterior * 100;
    els.meterFill.style.width = pct + '%';
    els.meterPrior.style.left = state.prior * 100 + '%';

    const active = steps.filter((s) => s.active);
    const totalBf = active.reduce((acc, s) => acc * s.bf, 1);
    const totalDb = active.reduce((acc, s) => acc + decibans(s.bf), 0);
    const delta = (posterior - state.prior) * 100;
    els.stats.innerHTML = `
      <div><dt>Prior</dt><dd>${fmtPct(state.prior)}</dd></div>
      <div><dt>Change</dt><dd>${Number.isNaN(delta) ? '—' : (delta >= 0 ? '+' : '−') + Math.abs(delta).toFixed(1) + ' pts'}</dd></div>
      <div><dt>Combined BF</dt><dd>${fmtNum(totalBf)}</dd></div>
      <div><dt>Weight of evidence</dt><dd>${fmtDb(totalDb)}</dd></div>`;
  }

  /* ---------- trajectory chart ---------- */
  function seriesValue(p) {
    if (Number.isNaN(p)) return null;
    if (scale === 'prob') return p * 100;
    return Math.max(-DB_CLIP, Math.min(DB_CLIP, probToDecibans(p)));
  }

  function renderChart(steps) {
    const c = chartColors();
    const labels = ['Prior', ...steps.map((_, i) => `E${i + 1}`)];
    const values = [state.prior, ...steps.map((s) => s.after)];
    const data = values.map(seriesValue);
    const threshold = scale === 'prob' ? 99 : probToDecibans(0.99);
    const pointColors = [c.prior, ...steps.map((s) => (s.active ? c.series : c.grid))];

    els.trajHint.textContent =
      scale === 'prob'
        ? 'Each point is your belief after admitting that piece of evidence. The red dashed line marks 99%: reasonable doubt ends here.'
        : 'Log-odds in decibans: 0 dB is 50/50, +10 dB is 10:1 odds, +20 dB is 100:1. On this scale every piece of evidence is a fixed-size step: its Bayes factor in dB. Clipped at ±40 dB.';

    const datasets = [
      {
        label: 'Belief',
        data,
        borderColor: c.series,
        backgroundColor: c.seriesFill,
        pointBackgroundColor: pointColors,
        pointBorderColor: c.surface,
        pointBorderWidth: 2,
        pointRadius: 6,
        pointHoverRadius: 8,
        borderWidth: 2,
        tension: 0,
        fill: scale === 'prob' ? 'origin' : false,
      },
      {
        label: 'Reasonable doubt threshold',
        data: labels.map(() => threshold),
        borderColor: c.stamp,
        borderDash: [6, 5],
        borderWidth: 1.5,
        pointRadius: 0,
        pointHitRadius: 0,
        fill: false,
      },
    ];

    const options = {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 250 },
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          filter: (item) => item.datasetIndex === 0,
          callbacks: {
            title: (items) => {
              const i = items[0].dataIndex;
              if (i === 0) return 'Prior';
              const t = state.evidence[i - 1]?.text || '(unlabelled evidence)';
              return `E${i}: ${t.length > 48 ? t.slice(0, 47) + '…' : t}`;
            },
            label: (item) => {
              const p = values[item.dataIndex];
              const parts = [`Belief: ${fmtPct(p)}`];
              if (scale === 'db') parts.push(`Log-odds: ${fmtDb(probToDecibans(p))}`);
              const s = steps[item.dataIndex - 1];
              if (s) parts.push(s.active ? `BF ${fmtNum(s.bf)} (${fmtDb(decibans(s.bf))})` : 'Struck from the record');
              return parts;
            },
          },
        },
      },
      scales: {
        x: { grid: { display: false } },
        y:
          scale === 'prob'
            ? { min: 0, max: 100, ticks: { stepSize: 25, callback: (v) => v + '%' } }
            : { suggestedMin: -20, suggestedMax: 20, ticks: { callback: (v) => (v > 0 ? '+' : '') + v + ' dB' } },
      },
    };

    if (!chart) {
      chart = new Chart($('traj-chart'), { type: 'line', data: { labels, datasets }, options });
    } else {
      chart.data.labels = labels;
      chart.data.datasets = datasets;
      chart.options = options;
      chart.update();
    }
  }

  document.querySelectorAll('[data-scale]').forEach((btn) =>
    btn.addEventListener('click', () => {
      scale = btn.dataset.scale;
      document.querySelectorAll('[data-scale]').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
      renderChart(trajectory(state.prior, state.evidence).steps);
    }),
  );

  /* ---------- Bayes box: one update, drawn as areas ---------- */
  function currentBoxIndex(steps) {
    if (!steps.length) return -1;
    return boxIndex < 0 || boxIndex >= steps.length ? steps.length - 1 : boxIndex;
  }

  $('box-prev').addEventListener('click', () => step(-1));
  $('box-next').addEventListener('click', () => step(1));
  function step(d) {
    const { steps } = trajectory(state.prior, state.evidence);
    if (!steps.length) return;
    boxIndex = (currentBoxIndex(steps) + d + steps.length) % steps.length;
    renderBox({ steps });
    renderCards(steps);
  }

  function renderBox({ steps }) {
    const i = currentBoxIndex(steps);
    if (i < 0) {
      els.boxLabel.textContent = '—';
      els.box.innerHTML = '<p class="empty">Admit some evidence to see the machinery.</p>';
      els.boxEq.textContent = '';
      return;
    }
    const e = state.evidence[i];
    const s = steps[i];
    const before = Number.isNaN(s.before) ? 0 : s.before;
    const post = update(before, e.pEH, e.pEnH);
    const bf = bayesFactor(e.pEH, e.pEnH);
    els.boxLabel.textContent = `E${i + 1} of ${steps.length}`;

    const wH = before * 100;
    const wN = 100 - wH;
    const total = s.joint + s.jointNot;
    const shareH = total > 0 ? (s.joint / total) * 100 : 0;
    els.box.innerHTML = `
      <p class="box-title">${escapeHtml(e.text || '(unlabelled evidence)')}${s.active ? '' : ' <span class="muted">(struck: shown hypothetically)</span>'}</p>
      <div class="box-cols" role="img" aria-label="Prior split ${fmtPct(before)} versus ${fmtPct(1 - before)}; evidence likelihood ${fmtPct(e.pEH)} versus ${fmtPct(e.pEnH)}">
        <div class="box-col col-h" style="flex-basis:${wH}%">
          <div class="box-fill" style="height:${e.pEH * 100}%"></div>
        </div>
        <div class="box-col col-n" style="flex-basis:${wN}%">
          <div class="box-fill" style="height:${e.pEnH * 100}%"></div>
        </div>
      </div>
      <div class="box-legend">
        <div><span class="sw sw-h"></span><b>H true</b>: ${fmtPct(before)} wide × ${fmtPct(e.pEH)} shaded = <b>${fmtPct(s.joint)}</b></div>
        <div><span class="sw sw-n"></span><b>H false</b>: ${fmtPct(1 - before)} wide × ${fmtPct(e.pEnH)} shaded = <b>${fmtPct(s.jointNot)}</b></div>
      </div>
      <div class="box-after">
        <span class="muted small">After seeing E, only the shaded area remains:</span>
        <div class="split-bar" aria-hidden="true">
          <div class="split-h" style="width:${shareH}%"></div>
          <div class="split-n" style="width:${100 - shareH}%"></div>
        </div>
      </div>`;
    const priorOdds = before / (1 - before);
    els.boxEq.innerHTML = Number.isNaN(post)
      ? 'Posterior = 0 ÷ 0. The evidence was impossible under every belief you held. The math declines to comment.'
      : `posterior odds = prior odds × Bayes factor<br/>
         <b>${fmtNum(priorOdds)}</b> × <b>${fmtNum(bf)}</b> = <b>${fmtNum(post / (1 - post))}</b>
         &nbsp;→&nbsp; P(H | E) = <b>${fmtPct(post)}</b>`;
  }

  /* ---------- lifecycle ---------- */
  function load() {
    els.hyp.value = state.hypothesis;
    els.prior.value = toPct(state.prior);
    renderList();
    renderDerived();
  }

  if (fresh) {
    const first = PRESETS[0];
    state.hypothesis = first.hypothesis;
    state.prior = first.prior;
    state.evidence = first.evidence.map((e) => ({ ...e }));
  }
  load();

  return {
    load,
    render: () => {
      chart?.resize();
      renderDerived();
    },
    retheme: () => {
      applyChartDefaults();
      chart?.destroy();
      chart = null;
      renderDerived();
    },
  };
}
