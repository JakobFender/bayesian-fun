# Probably.

*An instrument for adjusting your beliefs by exactly the right amount. Results not legally binding.*

State a hypothesis, set a prior, admit evidence by saying how likely it is **if true** and **if false**,
and watch the posterior update live.

- **Hypothesis lab:** a live posterior, a Bayes factor strength label per item (Kass & Raftery, with commentary),
  a belief-over-time chart (probability or log-odds in decibans), and an "inside one update" area diagram
- **Five case files:** a scheming cat, a resentful printer, a recurring pigeon, a dimensional dryer, a dramatic houseplant
- **Cromwell's rule:** a warning when your prior is exactly 0% or 100%
- **Coin bench:** a Beta distribution that updates as you click heads/tails, plus a mystery coin to unmask
- **Shareable:** the whole scenario lives in the URL hash
- **BEYOND REASONABLE DOUBT** stamped on anything above 99%

## Development

```bash
npm install
npm run dev     # http://localhost:5173
npm test
npm run build
```

Deploys to GitHub Pages via `.github/workflows/deploy.yml` on every push to `main`
(set *Settings → Pages → Source* to **GitHub Actions** once).
