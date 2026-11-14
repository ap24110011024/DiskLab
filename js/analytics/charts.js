/*
 * Chart.js helpers. Chart.js is loaded as a normal script from
 * assets/vendor/chart.umd.min.js (bundled so the site works offline).
 */

let defaultsSet = false;

export function chartsAvailable() {
  return typeof window.Chart !== 'undefined';
}

function setDefaults() {
  if (defaultsSet) return;
  const { defaults } = window.Chart;
  // Palette from the design brief: ticks #59636B, titles/legends #252C32, grid #DCD7CC, highlight #C29B55
  defaults.color = '#59636B';
  defaults.borderColor = '#DCD7CC';
  defaults.scale.grid.color = '#DCD7CC';
  defaults.scale.title.color = '#252C32';
  defaults.plugins.legend.labels.color = '#252C32';
  defaults.plugins.title.color = '#252C32';
  defaults.font.family = "'Inter', system-ui, sans-serif";
  defaults.maintainAspectRatio = false;
  defaults.plugins.tooltip.backgroundColor = '#252C32';
  defaults.plugins.tooltip.titleColor = '#F5F2EA';
  defaults.plugins.tooltip.bodyColor = '#F5F2EA';
  defaults.plugins.tooltip.borderColor = '#252C32';
  defaults.plugins.tooltip.borderWidth = 0;
  defaults.plugins.tooltip.cornerRadius = 6;
  defaults.plugins.legend.labels.boxWidth = 14;
  defaults.elements.bar.borderRadius = 3;
  defaults.elements.line.borderWidth = 2.5;
  defaults.elements.point.borderColor = '#FFFFFF';
  defaults.elements.point.borderWidth = 1.5;
  defaults.elements.point.hoverRadius = 7;
  defaults.elements.point.hoverBackgroundColor = '#C29B55';
  defaults.elements.point.hoverBorderColor = '#252C32';
  defaults.elements.bar.hoverBorderColor = '#C29B55';
  defaults.elements.bar.hoverBorderWidth = 2;
  defaults.animation.duration = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 500;
  defaultsSet = true;
}

/** Creates a chart, replacing any previous chart on the same canvas. */
export function renderChart(canvas, config) {
  if (!canvas) return null;
  if (!chartsAvailable()) {
    canvas.parentElement.innerHTML = '<p class="notice warning">Charts could not load (assets/vendor/chart.umd.min.js is missing).</p>';
    return null;
  }
  setDefaults();
  const old = window.Chart.getChart(canvas);
  if (old) old.destroy();
  return new window.Chart(canvas, config);
}
