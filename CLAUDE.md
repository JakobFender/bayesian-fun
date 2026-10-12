# Probably

A playful Bayesian belief-updating web app. Static site (Vite + vanilla JS, no framework, no backend),
deployed to GitHub Pages. Tone is deadpan and mock-scientific; keep new copy in that voice.

## Commands

- `npm run dev`: Vite dev server
- `npm test`: unit tests (`node --test`, no test framework dependency)
- `npm run build`: production build into `dist/`
- `npm run preview`: serve the built `dist/`

## Structure

```
index.html              All markup: masthead, tabs, lab panel (sections 1–5), coin panel
vite.config.js          base: './' so the build works under /<repo>/ on GitHub Pages
src/
  main.js               Entry: shared state object, mode tabs, URL-hash persistence, share button, toast
  lab.js                Hypothesis lab: presets, prior slider, Cromwell warning, evidence cards,
                        verdict + "BEYOND REASONABLE DOUBT" stamp, trajectory chart, Bayes box
  coin.js               Coin bench: Beta prior choices, heads/tails + mystery coin, Beta density chart
  bayes.js              Pure math (no DOM): update, Bayes factor, strength labels, decibans,
                        trajectory, Beta pdf/lnGamma/credible interval
  share.js              State <-> URL hash (`#s=<base64url JSON>`), with sanitising decode
  format.js             Probability/number formatting (handles values hugging 0 and 1), escapeHtml
  presets.js            The five absurd scenarios, coin priors, DEFAULT_STATE
  theme.js              Chart.js import + defaults that read colours from CSS custom properties
  style.css             All styles; design tokens on :root, dark mode via prefers-color-scheme
tests/bayes.test.js     Tests for bayes.js, share.js, format.js, presets
.github/workflows/deploy.yml   Test, build and deploy to Pages on push to main
```

## State model

One mutable `state` object, created in `main.js` and passed to `initLab` / `initCoin`:

```js
{ mode: 'lab' | 'coin', hypothesis, prior /* 0..1 */,
  evidence: [{ text, pEH, pEnH /* 0..1 */, on /* admitted? */ }],
  coin: { a0, b0, flips /* 'HTTH…' */ } }
```

Modules mutate it, then call `persist()` (debounced `history.replaceState` of the hash).
Probabilities are stored as 0..1 and shown as percentages (`toPct` / `fromPct` in `format.js`).
The mystery coin's true bias is deliberately kept out of state so shared links don't spoil it.

## Conventions

- Keep `bayes.js`, `share.js`, `format.js` DOM-free so they stay testable under plain Node.
- Evidence cards are rebuilt only on structural changes (add/remove/preset); slider input updates
  derived output in place (`renderDerived`) so focus is not lost mid-drag.
- Colours live in CSS tokens; charts read them via `chartColors()`. Never hard-code hex in JS.
- Edge cases to keep handling: prior exactly 0/1 (Cromwell), P(E|¬H)=0 (infinite Bayes factor),
  both likelihoods 0 (NaN posterior), and garbage in the URL hash (decode must sanitise).
- Must stay usable at 360px width with no horizontal scroll.

## Design system

Styling follows the portfolio design guidelines (warm, precise, a little quirky). When adding UI:

- Tokens only: `--color-*`, `--space-*` (4, 8, 12, 16, 24, 32, 48, 64, 96, 128px), `--radius` (2px),
  `--duration` / `--ease`. Never pure white/black, no gradients, glows or shadows.
- Olive (`--color-accent`) is sparing: one italic word per headline (`<h2>… <em>word</em> …</h2>`),
  links, mono labels, a few decorative lines. Small olive text uses `--color-accent-strong`. Never a fill.
- Fonts: Fraunces 400 for h1/h2/big numbers (always `font-variation-settings: 'SOFT' 100, 'WONK' 1`),
  Onest 400/500 for body and UI, Martian Mono 400 at 12px for labels and metadata only.
  Type scale: h1 56/36px, h2 36/28px, body 17/16px, small 15px, labels 12px.
- Sections are separated by whitespace and 1px `--color-line` rules, not cards. Each section starts with
  a mono label like `03 — Verdict`. Lists (presets, evidence, coin priors, stats) are rows with top borders.
- Buttons: `.btn.primary` (at most one per view) and `.btn.secondary`. No pills or badges; tags are mono
  text joined with ` · `. Bayes factor strength is shown as marks (●●○○), not colour.
- Charts use only ink, muted, line, surface, and accent (for the 99% line and the true coin bias).
- Motion: 150–250ms ease-out, translations ≤ 8px, no bouncing; everything is off under reduced motion.

## Deployment

Pushing to `main` runs the workflow. In the repo settings, Pages → Source must be set to "GitHub Actions".
