import { Chart } from 'chart.js/auto';

export const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

/** Colours the charts need, read from the CSS tokens so light/dark stay in sync. */
export function chartColors() {
  return {
    ink: cssVar('--ink'),
    muted: cssVar('--ink-muted'),
    grid: cssVar('--grid'),
    surface: cssVar('--surface'),
    series: cssVar('--series-1'),
    seriesFill: cssVar('--series-1-fill'),
    prior: cssVar('--series-prior'),
    stamp: cssVar('--stamp'),
    truth: cssVar('--series-truth'),
  };
}

export function applyChartDefaults() {
  const c = chartColors();
  Chart.defaults.font.family = cssVar('--font-mono') || 'monospace';
  Chart.defaults.font.size = 11;
  Chart.defaults.color = c.muted;
  Chart.defaults.borderColor = c.grid;
  Chart.defaults.plugins.tooltip.backgroundColor = c.ink;
  Chart.defaults.plugins.tooltip.titleColor = c.surface;
  Chart.defaults.plugins.tooltip.bodyColor = c.surface;
  Chart.defaults.plugins.tooltip.padding = 10;
  Chart.defaults.plugins.tooltip.cornerRadius = 6;
  Chart.defaults.plugins.tooltip.displayColors = false;
}

export { Chart };
