/*
 * Seek graph (the classic textbook diagram): cylinder from left to right,
 * one row per movement. The planned path is drawn faintly; the part already
 * travelled is drawn solid as the animation plays. Squares mark SCAN's
 * boundary visits and ↺ marks a reversal.
 */

import { headPositionAt, phaseOf } from '../simulation/execution-data.js';

const NS = 'http://www.w3.org/2000/svg';
const PAD_LEFT = 46;
const PAD_RIGHT = 24;

function el(tag, attrs = {}, text) {
  const node = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (text !== undefined) node.textContent = text;
  return node;
}

export function createMovementPath(container, { rowHeight = 26, color = '#557C78', onStepClick = null } = {}) {
  let result = null;
  let svg = null;
  let travelled = null;
  let dot = null;
  let nodes = [];
  let x;
  let y;

  return {
    setResult(newResult) {
      result = newResult;
      // drawn at the container's real pixel width so labels stay readable
      const WIDTH = Math.max(280, Math.round(container.clientWidth || 1000));
      const rows = Math.max(1, result.steps.length);
      const row = rows > 24 ? Math.max(9, Math.floor((rowHeight * 24) / rows)) : rowHeight;
      const height = 30 + rows * row + 16;
      const last = Math.max(1, result.diskSize - 1);
      x = (c) => PAD_LEFT + (c / last) * (WIDTH - PAD_LEFT - PAD_RIGHT);
      y = (i) => 22 + i * row;

      svg = el('svg', { viewBox: `0 0 ${WIDTH} ${height}`, class: 'seek-graph', style: `--line-c:${color}`, role: 'img',
        'aria-label': `${result.algorithm} head path ${result.path.join(' to ')}` });
      svg.appendChild(el('line', { x1: x(0), y1: 14, x2: x(0), y2: height - 8, class: 'sg-edge' }));
      svg.appendChild(el('line', { x1: x(last), y1: 14, x2: x(last), y2: height - 8, class: 'sg-edge' }));
      svg.appendChild(el('text', { x: x(0), y: 10, class: 'sg-label', 'text-anchor': 'middle' }, '0'));
      svg.appendChild(el('text', { x: x(last), y: 10, class: 'sg-label', 'text-anchor': 'middle' }, String(last)));

      const points = result.path.map((c, i) => `${x(c)},${y(i)}`).join(' ');
      svg.appendChild(el('polyline', { points, class: 'sg-planned' }));
      travelled = el('polyline', { points: '', class: 'sg-travelled' });
      svg.appendChild(travelled);

      nodes = result.path.map((cylinder, i) => {
        const step = result.steps[i - 1];
        const group = el('g', { class: 'sg-node', 'data-step': i });
        if (step && step.type === 'BOUNDARY') group.appendChild(el('rect', { x: x(cylinder) - 5, y: y(i) - 5, width: 10, height: 10, class: 'boundary' }));
        else group.appendChild(el('circle', { cx: x(cylinder), cy: y(i), r: i === 0 ? 5 : 4, class: i === 0 ? 'start' : '' }));
        if (step && step.reverseAfter) group.appendChild(el('text', { x: x(cylinder) + (cylinder > last / 2 ? -14 : 14), y: y(i) + 4, class: 'sg-reverse', 'text-anchor': 'middle' }, '↺'));
        if (row >= 18 && i > 0) group.appendChild(el('text', { x: x(cylinder) + (cylinder > last * 0.85 ? -10 : 10), y: y(i) - 6, class: 'sg-node-label', 'text-anchor': cylinder > last * 0.85 ? 'end' : 'start' }, String(cylinder)));
        group.appendChild(el('title', {}, i === 0 ? `Start at ${cylinder}` : `Step ${i}: ${step.title}`));
        svg.appendChild(group);
        return group;
      });
      dot = el('circle', { r: 6.5, class: 'sg-dot' });
      svg.appendChild(dot);

      container.innerHTML = '';
      container.appendChild(svg);
      if (onStepClick) {
        svg.addEventListener('click', (event) => {
          const node = event.target.closest('.sg-node');
          if (node) onStepClick(Number(node.dataset.step));
        });
      }
      this.render(0, 0);
    },

    render(step, progress) {
      if (!result) return;
      const position = headPositionAt(result, step, progress);
      const moveFraction = phaseOf(progress).moveFraction;
      const rowY = y(step) + (progress > 0 && step < result.steps.length ? (y(step + 1) - y(step)) * moveFraction : 0);
      const points = [];
      for (let i = 0; i <= Math.min(step, result.path.length - 1); i++) points.push(`${x(result.path[i])},${y(i)}`);
      if (progress > 0 && step < result.steps.length) points.push(`${x(position)},${rowY}`);
      travelled.setAttribute('points', points.join(' '));
      dot.setAttribute('cx', x(position));
      dot.setAttribute('cy', rowY);
      nodes.forEach((node, i) => node.classList.toggle('visited', i <= step));
    },
  };
}
