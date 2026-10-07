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
  style.css             All styles; colour tokens on :root, dark mode via prefers-color-scheme
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
- Colours live in CSS tokens; charts read them via `chartColors()`. Add a token to both the light
  and dark blocks in `style.css` rather than hard-coding hex in JS.
- Edge cases to keep handling: prior exactly 0/1 (Cromwell), P(E|¬H)=0 (infinite Bayes factor),
  both likelihoods 0 (NaN posterior), and garbage in the URL hash (decode must sanitise).
- Must stay usable at 360px width with no horizontal scroll.

## Deployment

Pushing to `main` runs the workflow. In the repo settings, Pages → Source must be set to "GitHub Actions".
