import { Chart } from 'chart.js/auto';

export const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

/** Colours the charts need, read from the CSS tokens so light/dark stay in sync. */
export function chartColors() {
  return {
    ink: cssVar('--color-text'),
    bg: cssVar('--color-bg'),
    muted: cssVar('--color-muted'),
    line: cssVar('--color-line'),
    surface: cssVar('--color-surface'),
    accent: cssVar('--color-accent'),
  };
}

export function applyChartDefaults() {
  const c = chartColors();
  Chart.defaults.font.family = cssVar('--font-mono') || 'monospace';
  Chart.defaults.font.size = 12;
  Chart.defaults.color = c.muted;
  Chart.defaults.borderColor = c.line;
  const tt = Chart.defaults.plugins.tooltip;
  tt.backgroundColor = c.ink;
  tt.titleColor = c.bg;
  tt.bodyColor = c.bg;
  tt.titleFont = { family: cssVar('--font-body'), size: 15, weight: '500' };
  tt.bodyFont = { family: cssVar('--font-mono'), size: 12 };
  tt.padding = 12;
  tt.cornerRadius = 2;
  tt.caretSize = 4;
  tt.displayColors = false;
}

export { Chart };
