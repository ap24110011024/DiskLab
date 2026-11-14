/*
 * The main 2D view: a horizontal SVG track from cylinder 0 to diskSize - 1.
 * Shows request markers (stacked when duplicated), the read/write head with
 * its cylinder number and direction, the trail of the current movement, SSTF
 * distance arcs while it decides, boundary glow (SCAN) and reversal badges.
 *
 * In "input" mode (Input Studio) the head can be dragged and clicking the
 * track adds a request. In simulation mode render(step, progress) draws one
 * moment of an execution result.
 */

import { phaseOf, headPositionAt, servicedIds, activeStep, directionAt, PHASES } from '../simulation/execution-data.js';

const NS = 'http://www.w3.org/2000/svg';
const PAD = 34;

/**
 * The drawing is as wide (in SVG units) as its container is in pixels, so
 * text and markers are drawn at their real size on every screen. The mapping
 * from cylinder to x stays linear between the two boundary caps.
 */
function measureWidth(container) {
  return Math.max(320, Math.round(container.clientWidth || 1000));
}

function el(tag, attrs = {}, text) {
  const node = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (text !== undefined) node.textContent = text;
  return node;
}

function tickStep(range) {
  const rough = range / 10;
  const power = 10 ** Math.floor(Math.log10(Math.max(1, rough)));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * power >= rough) return m * power;
  return 10 * power;
}

export function createDiskTrack(container, options = {}) {
  const { compact = false, mode = 'sim', onTrackClick = null, onHeadDrag = null } = options;
  const height = compact ? 132 : 178;
  const trackY = compact ? 82 : 112;
  let WIDTH = measureWidth(container);

  const svg = el('svg', { viewBox: `0 0 ${WIDTH} ${height}`, class: `disk-track${compact ? ' compact' : ''}`, role: 'img' });
  container.innerHTML = '';
  container.appendChild(svg);

  let diskSize = 200;
  let requests = [];
  let result = null;
  let selectedId = null;
  let turnIds = new Set();
  let layers = {};

  const x = (cylinder) => PAD + (cylinder / Math.max(1, diskSize - 1)) * (WIDTH - 2 * PAD);

  function cylinderFromClientX(clientX) {
    const box = svg.getBoundingClientRect();
    const viewX = ((clientX - box.left) / box.width) * WIDTH;
    const fraction = (viewX - PAD) / (WIDTH - 2 * PAD);
    return Math.max(0, Math.min(diskSize - 1, Math.round(fraction * (diskSize - 1))));
  }

  /** Draws everything that does not change during the animation. */
  function buildStatic() {
    WIDTH = measureWidth(container);
    svg.setAttribute('viewBox', `0 0 ${WIDTH} ${height}`);
    svg.innerHTML = '';
    const defs = el('defs');
    defs.innerHTML = `
      <filter id="softGlow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3"/></filter>`;
    svg.appendChild(defs);

    // ticks and labels
    const ticks = el('g', { class: 'tr-ticks' });
    const stepSize = tickStep(diskSize - 1);
    const minGap = 34; // px between tick labels
    for (let c = 0; c <= diskSize - 1; c += stepSize) {
      if (c > 0 && x(c) - x(c - stepSize) < minGap && (c / stepSize) % 2 === 1) continue;
      ticks.appendChild(el('line', { x1: x(c), y1: trackY + 10, x2: x(c), y2: trackY + 16 }));
      if (x(diskSize - 1) - x(c) > 30 || c === 0) ticks.appendChild(el('text', { x: x(c), y: trackY + 30, 'text-anchor': 'middle' }, String(c)));
    }
    ticks.appendChild(el('text', { x: x(diskSize - 1), y: trackY + 30, 'text-anchor': 'middle' }, String(diskSize - 1)));
    svg.appendChild(ticks);

    // track body and boundary caps
    svg.appendChild(el('rect', { x: PAD, y: trackY - 4, width: WIDTH - 2 * PAD, height: 8, rx: 4, class: 'tr-body' }));
    const leftCap = el('rect', { x: PAD - 8, y: trackY - 14, width: 6, height: 28, rx: 2, class: 'tr-boundary' });
    const rightCap = el('rect', { x: WIDTH - PAD + 2, y: trackY - 14, width: 6, height: 28, rx: 2, class: 'tr-boundary' });
    svg.append(leftCap, rightCap);

    const boundaryLabel = el('text', { class: 'tr-boundary-label', y: trackY + 46, 'text-anchor': 'middle' }, '');
    const arcs = el('g', { class: 'tr-arcs' });
    const trail = el('line', { class: 'tr-trail hidden', y1: trackY, y2: trackY }); // shown only while the head moves
    const start = el('line', { class: 'tr-start', y1: trackY - 18, y2: trackY + 18 });
    const markers = el('g', { class: 'tr-markers' });

    // request markers; duplicates stack upwards
    const seen = new Map();
    const markerById = new Map();
    for (const request of requests) {
      const level = seen.get(request.cylinder) || 0;
      seen.set(request.cylinder, level + 1);
      const group = el('g', { class: 'tr-request pending', 'data-id': request.id });
      const cy = trackY - level * 13;
      group.appendChild(el('circle', { cx: x(request.cylinder), cy, r: 6 }));
      group.appendChild(el('title', {}, `Request ${request.id}: cylinder ${request.cylinder}`));
      markers.appendChild(group);
      markerById.set(request.id, group);
    }
    // one label per cylinder, skipping labels that would overlap
    let lastLabelX = -Infinity;
    for (const [cylinder, count] of [...seen.entries()].sort((a, b) => a[0] - b[0])) {
      if (x(cylinder) - lastLabelX < 26) continue;
      lastLabelX = x(cylinder);
      markers.appendChild(el('text', { x: x(cylinder), y: trackY - (count - 1) * 13 - 14, class: 'tr-request-label', 'text-anchor': 'middle' },
        count > 1 ? `${cylinder}×${count}` : String(cylinder)));
    }

    // read/write head
    const head = el('g', { class: 'tr-head' });
    head.appendChild(el('rect', { x: -26, y: 4, width: 52, height: 22, rx: 5, class: 'tr-head-tag' }));
    const headText = el('text', { x: 0, y: 19.5, 'text-anchor': 'middle', class: 'tr-head-text' }, '');
    head.appendChild(headText);
    head.appendChild(el('path', { d: `M -9 ${trackY - 26} L 9 ${trackY - 26} L 0 ${trackY - 9} Z`, class: 'tr-head-arrow' }));
    head.appendChild(el('line', { x1: 0, y1: 26, x2: 0, y2: trackY - 26, class: 'tr-head-stem' }));
    const directionText = el('text', { x: 34, y: 19.5, class: 'tr-direction' }, '');
    head.appendChild(directionText);
    const badge = el('text', { x: 0, y: trackY + 48, 'text-anchor': 'middle', class: 'tr-badge' }, '');
    head.appendChild(badge);

    svg.append(start, arcs, trail, markers, boundaryLabel, head);
    layers = { leftCap, rightCap, boundaryLabel, arcs, trail, start, markerById, head, headText, directionText, badge };
  }

  function placeHead(position, direction) {
    layers.head.setAttribute('transform', `translate(${x(position)}, 0)`);
    layers.headText.textContent = String(Math.round(position));
    layers.directionText.textContent = direction === 'RIGHT' ? '▶' : direction === 'LEFT' ? '◀' : '';
    layers.directionText.setAttribute('x', direction === 'LEFT' ? -44 : 32);
  }

  /**
   * candidateIds: requests the algorithm is considering right now.
   * dimOthers: true once the choice is made, so every request except the
   * chosen one fades out (SSTF "selects the nearest, de-emphasises the rest").
   */
  function setMarkerClasses(serviced, targetId, candidateIds, dimOthers, turnIds = new Set()) {
    for (const [id, group] of layers.markerById) {
      let cls = serviced.has(id) ? 'tr-request serviced' : 'tr-request pending';
      if (id === targetId && !serviced.has(id)) cls += ' target';
      if (candidateIds.has(id) && !(dimOthers && id !== targetId)) cls += ' candidate';
      else if (dimOthers && id !== targetId && !serviced.has(id)) cls += ' dimmed';
      if (turnIds.has(id) && !serviced.has(id)) cls += ' turn';
      if (id === selectedId) cls += ' selected';
      group.setAttribute('class', cls);
    }
  }

  /** SSTF: curved arcs from the head to each candidate with the distance. */
  function drawDistanceArcs(step) {
    const shown = step.candidates.slice(0, 8);
    const seenCylinders = new Set();
    for (const candidate of shown) {
      if (seenCylinders.has(candidate.cylinder)) continue;
      seenCylinders.add(candidate.cylinder);
      const chosen = candidate.id === step.request.id;
      const x1 = x(step.from);
      const x2 = x(candidate.cylinder);
      const lift = 18 + Math.min(1, candidate.distance / Math.max(1, diskSize - 1)) * (compact ? 26 : 50);
      const top = trackY - 10 - lift;
      layers.arcs.appendChild(el('path', { d: `M ${x1} ${trackY - 10} Q ${(x1 + x2) / 2} ${top - lift * 0.4} ${x2} ${trackY - 10}`, class: chosen ? 'arc chosen' : 'arc' }));
      layers.arcs.appendChild(el('text', { x: (x1 + x2) / 2, y: top - 2, 'text-anchor': 'middle', class: chosen ? 'arc-label chosen' : 'arc-label' }, String(candidate.distance)));
    }
  }

  let lastWorkload = null;
  let lastFrame = null;
  let resizeTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (!lastWorkload || measureWidth(container) === WIDTH) return;
      api.setWorkload(lastWorkload);
      if (lastFrame) api.render(lastFrame.step, lastFrame.progress);
    }, 150);
  });

  const api = {
    setWorkload(workload) {
      lastWorkload = workload;
      diskSize = workload.diskSize;
      requests = workload.requests;
      buildStatic();
      layers.start.setAttribute('x1', x(workload.initialHead));
      layers.start.setAttribute('x2', x(workload.initialHead));
      placeHead(workload.initialHead, null);
      setMarkerClasses(new Set(), null, new Set(), false);
    },

    setResult(newResult) {
      result = newResult;
      // Requests where SCAN/LOOK will turn around, marked before the head gets there.
      turnIds = new Set(result.algorithm === 'SSTF' ? [] : result.reversalEvents
        .filter((event) => event.step > 0 && result.steps[event.step - 1].request)
        .map((event) => result.steps[event.step - 1].request.id));
      this.setWorkload({ diskSize: result.diskSize, requests: result.requests, initialHead: result.initialHead });
    },

    /** Input mode: just place the head. */
    showHead(cylinder) {
      placeHead(cylinder, null);
      layers.start.setAttribute('x1', x(cylinder));
      layers.start.setAttribute('x2', x(cylinder));
    },

    highlight(id) {
      selectedId = id;
      if (!result) setMarkerClasses(new Set(), null, new Set(), false);
    },

    /** Draws the execution at (step, progress). */
    render(step, progress) {
      if (!result) return;
      lastFrame = { step, progress };
      const current = progress > 0 ? result.steps[step] : null;
      const phase = phaseOf(progress).name;
      const position = headPositionAt(result, step, progress);
      placeHead(position, directionAt(result, step, progress));

      // candidates during the decide phase
      const candidateIds = new Set();
      let dim = false;
      layers.arcs.innerHTML = '';
      if (current && phase === 'decide' && current.type === 'SERVICE') {
        current.candidates.forEach((c) => candidateIds.add(c.id));
        if (result.algorithm === 'SSTF') {
          drawDistanceArcs(current);
          dim = progress > PHASES.decideEnd / 2; // first show all distances, then fade the losers
        }
      }
      setMarkerClasses(servicedIds(result, step, progress), current?.request?.id ?? null, candidateIds, dim, turnIds);

      // trail of the current movement
      const shown = activeStep(result, step, progress);
      if (shown && shown.distance > 0 && (phase === 'move' || phase === 'settle')) {
        layers.trail.setAttribute('x1', x(shown.from));
        layers.trail.setAttribute('x2', x(position));
        layers.trail.setAttribute('class', `tr-trail ${shown.direction === 'LEFT' ? 'to-left' : 'to-right'}`);
      } else {
        layers.trail.setAttribute('class', 'tr-trail hidden');
      }

      // boundary glow (SCAN) and reversal badge
      const atBoundary = current && current.type === 'BOUNDARY' && phase === 'settle';
      layers.leftCap.classList.toggle('glow', Boolean(atBoundary && current.to === 0));
      layers.rightCap.classList.toggle('glow', Boolean(atBoundary && current.to !== 0));
      layers.boundaryLabel.textContent = atBoundary ? `boundary ${current.to}: no request here` : '';
      layers.boundaryLabel.setAttribute('x', atBoundary ? x(current.to) - (current.to === 0 ? -60 : 60) : 0);
      layers.badge.textContent = current && current.reverseAfter && phase === 'settle' ? '↺ reverse' : '';
    },

    cylinderFromClientX,
    get svg() { return svg; },
    x,
  };
  return api;
}

/** Enables click-to-add and head dragging for the Input Studio. */
export function makeTrackInteractive(track, { onAdd, onHeadDrag }) {
  const svg = track.svg;
  let dragging = false;

  svg.addEventListener('pointerdown', (event) => {
    if (event.target.closest('.tr-head')) {
      dragging = true;
      svg.setPointerCapture(event.pointerId);
      event.preventDefault();
    }
  });
  svg.addEventListener('pointermove', (event) => {
    if (dragging) onHeadDrag(track.cylinderFromClientX(event.clientX));
  });
  svg.addEventListener('pointerup', (event) => {
    if (dragging) { dragging = false; return; }
    if (!event.target.closest('.tr-head')) onAdd(track.cylinderFromClientX(event.clientX));
  });
}
