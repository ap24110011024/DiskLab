/*
 * 3D disk platter built with CSS transforms (perspective, rotateX/rotateZ,
 * translateZ). The platter, its track bands, the request dots and the
 * actuator arm are ordinary <div>s placed in percentages of a square box.
 *
 * Geometry (all in % of the platter box, centre at 50,50):
 *   cylinder 0 is the OUTER track (radius 47), the last cylinder the INNER
 *   track (radius 15). The arm turns around a pivot outside the disc; its
 *   angle is found with the law of cosines so the head tip lands exactly on
 *   the radius of the current cylinder.
 */

export const GEOMETRY = { outer: 47, inner: 15, pivotX: 97, pivotY: 90, armLength: 60 };

export function radiusForCylinder(cylinder, diskSize) {
  const last = Math.max(1, diskSize - 1);
  return GEOMETRY.outer - (cylinder / last) * (GEOMETRY.outer - GEOMETRY.inner);
}

/**
 * Arm angle so that the tip is at distance r from the centre.
 * Triangle: pivot, centre, tip. Sides: d (pivot-centre), L (arm), r.
 *   cos(phi) = (d² + L² - r²) / (2·d·L)
 */
export function armAngleForRadius(r) {
  const { pivotX, pivotY, armLength: L } = GEOMETRY;
  const dx = 50 - pivotX;
  const dy = 50 - pivotY;
  const d = Math.hypot(dx, dy);
  const towardCentre = Math.atan2(dy, dx);
  const cosPhi = Math.max(-1, Math.min(1, (d * d + L * L - r * r) / (2 * d * L)));
  const angle = towardCentre + Math.acos(cosPhi);
  return {
    angleDeg: (angle * 180) / Math.PI,
    tipX: pivotX + L * Math.cos(angle),
    tipY: pivotY + L * Math.sin(angle),
  };
}

const GOLDEN_ANGLE = 137.508; // spreads request dots evenly around the platter

/** Position (in % of the platter) of the request at queue index `index`. */
export function requestPosition(index, cylinder, diskSize) {
  const r = radiusForCylinder(cylinder, diskSize);
  const angle = ((index * GOLDEN_ANGLE) * Math.PI) / 180;
  return { x: 50 + r * Math.cos(angle), y: 50 + r * Math.sin(angle) };
}

export function createPlatter3D(container, options = {}) {
  const { controls = true, bands: bandLimit = 10, onSelect = null } = options;
  const view = { rx: 58, rz: -18, zoom: 1, flat: false, spin: false };

  container.classList.add('platter-wrap');
  container.innerHTML = `
    <div class="platter-stage" tabindex="0" aria-label="3D disk platter. Drag to rotate.">
      <div class="platter-camera">
        <div class="platter-shadow"></div>
        <div class="platter-disc">
          <div class="platter-sectors"></div>
          <div class="platter-bands"></div>
          <div class="ring selected-ring hidden"></div>
          <div class="ring trail-ring hidden"></div>
          <div class="ring head-ring"></div>
          <div class="platter-requests"></div>
          <div class="platter-labels"></div>
          <span class="disc-label edge outer-label"></span>
          <span class="disc-label edge inner-label"></span>
          <div class="spindle"></div>
        </div>
        <div class="actuator">
          <div class="arm"><span class="arm-head"></span></div>
          <div class="arm-pivot"></div>
        </div>
      </div>
      <div class="platter-tip" hidden></div>
      <div class="platter-readout mono" aria-live="off"><span>Head</span> <b class="readout-cyl">0</b></div>
    </div>
    ${controls ? `
    <div class="platter-controls" role="group" aria-label="3D view controls">
      <button class="btn btn-small" data-view="zoom-out" aria-label="Zoom out">−</button>
      <button class="btn btn-small" data-view="zoom-in" aria-label="Zoom in">+</button>
      <button class="btn btn-small" data-view="left" aria-label="Rotate left">⟲</button>
      <button class="btn btn-small" data-view="right" aria-label="Rotate right">⟳</button>
      <button class="btn btn-small" data-view="flat" aria-pressed="false">2D view</button>
      <button class="btn btn-small" data-view="spin" aria-pressed="false">Spin platter</button>
      <button class="btn btn-small" data-view="reset">Reset view</button>
    </div>` : ''}`;

  const stage = container.querySelector('.platter-stage');
  const camera = container.querySelector('.platter-camera');
  const bandsLayer = container.querySelector('.platter-bands');
  const requestLayer = container.querySelector('.platter-requests');
  const headRing = container.querySelector('.head-ring');
  const trailRing = container.querySelector('.trail-ring');
  const selectedRing = container.querySelector('.selected-ring');
  const arm = container.querySelector('.arm');
  const tip = container.querySelector('.platter-tip');
  const readout = container.querySelector('.readout-cyl');
  const labelLayer = container.querySelector('.platter-labels');

  let diskSize = 200;
  let requests = [];
  let dots = new Map();

  function sizeRing(ring, radius) {
    ring.style.width = `${radius * 2}%`;
    ring.style.height = `${radius * 2}%`;
  }

  function applyView() {
    const rx = view.flat ? 0 : view.rx;
    const rz = view.flat ? 0 : view.rz;
    camera.style.transform = `scale(${view.zoom}) rotateX(${rx}deg) rotateZ(${rz}deg)`;
    container.classList.toggle('is-flat', view.flat);
    container.classList.toggle('is-spinning', view.spin);
  }

  function bandOf(cylinder, bandCount) {
    return Math.min(bandCount - 1, Math.floor((cylinder / diskSize) * bandCount));
  }

  function buildBands() {
    const bandCount = Math.min(diskSize, bandLimit);
    bandsLayer.innerHTML = '';
    // Outer band first: inner bands sit on top, so the pointer always hits the band it is over.
    for (let b = 0; b < bandCount; b++) {
      const first = Math.floor((b * diskSize) / bandCount);
      const last = Math.floor(((b + 1) * diskSize) / bandCount) - 1;
      const band = document.createElement('div');
      band.className = 'band';
      sizeRing(band, radiusForCylinder(first, diskSize) + 0.6);
      band.dataset.first = first;
      band.dataset.last = last;
      bandsLayer.appendChild(band);
    }
  }

  function buildRequests() {
    requestLayer.innerHTML = '';
    dots = new Map();
    requests.forEach((request, index) => {
      const position = requestPosition(index, request.cylinder, diskSize);
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.className = 'p-request pending';
      dot.style.left = `${position.x}%`;
      dot.style.top = `${position.y}%`;
      dot.dataset.id = request.id;
      dot.dataset.cylinder = request.cylinder;
      dot.setAttribute('aria-label', `Request ${request.id}, cylinder ${request.cylinder}`);
      requestLayer.appendChild(dot);
      dots.set(request.id, dot);
    });
  }

  function showTip(text, event) {
    const box = stage.getBoundingClientRect();
    tip.hidden = false;
    tip.textContent = text;
    tip.style.left = `${event.clientX - box.left + 12}px`;
    tip.style.top = `${event.clientY - box.top + 12}px`;
  }

  // hover information
  stage.addEventListener('pointermove', (event) => {
    if (dragging) return;
    const dot = event.target.closest('.p-request');
    const band = event.target.closest('.band');
    if (dot) showTip(`Request ${dot.dataset.id}: cylinder ${dot.dataset.cylinder}`, event);
    else if (band) {
      const inBand = requests.filter((r) => r.cylinder >= band.dataset.first && r.cylinder <= band.dataset.last).length;
      showTip(`Cylinders ${band.dataset.first}–${band.dataset.last} · ${inBand} request(s)`, event);
    } else tip.hidden = true;
  });
  stage.addEventListener('pointerleave', () => { tip.hidden = true; });

  // click: select a request or a band
  stage.addEventListener('click', (event) => {
    if (movedWhileDragging) return;
    const dot = event.target.closest('.p-request');
    const band = event.target.closest('.band');
    if (dot) api.selectCylinder(Number(dot.dataset.cylinder), dot.dataset.id);
    else if (band) api.selectCylinder(Math.round((Number(band.dataset.first) + Number(band.dataset.last)) / 2), null, band.dataset);
  });

  // drag to rotate
  let dragging = false;
  let movedWhileDragging = false;
  let lastPoint = null;
  stage.addEventListener('pointerdown', (event) => {
    dragging = true;
    movedWhileDragging = false;
    lastPoint = { x: event.clientX, y: event.clientY };
  });
  window.addEventListener('pointermove', (event) => {
    if (!dragging) return;
    const dx = event.clientX - lastPoint.x;
    const dy = event.clientY - lastPoint.y;
    if (Math.abs(dx) + Math.abs(dy) > 3) movedWhileDragging = true;
    if (!movedWhileDragging || view.flat) return;
    view.rz += dx * 0.4;
    view.rx = Math.max(0, Math.min(75, view.rx - dy * 0.3));
    lastPoint = { x: event.clientX, y: event.clientY };
    applyView();
  });
  window.addEventListener('pointerup', () => { dragging = false; });

  // keyboard: arrows rotate when the stage has focus
  stage.addEventListener('keydown', (event) => {
    const keys = { ArrowLeft: () => { view.rz -= 10; }, ArrowRight: () => { view.rz += 10; },
      ArrowUp: () => { view.rx = Math.max(0, view.rx - 8); }, ArrowDown: () => { view.rx = Math.min(75, view.rx + 8); } };
    if (keys[event.key]) { keys[event.key](); applyView(); event.preventDefault(); event.stopPropagation(); }
  });

  container.querySelector('.platter-controls')?.addEventListener('click', (event) => {
    const action = event.target.closest('[data-view]')?.dataset.view;
    if (!action) return;
    if (action === 'zoom-in') view.zoom = Math.min(1.6, view.zoom + 0.1);
    if (action === 'zoom-out') view.zoom = Math.max(0.6, view.zoom - 0.1);
    if (action === 'left') view.rz -= 20;
    if (action === 'right') view.rz += 20;
    if (action === 'flat') view.flat = !view.flat;
    if (action === 'spin') view.spin = !view.spin;
    if (action === 'reset') Object.assign(view, { rx: 58, rz: -18, zoom: 1, flat: false });
    container.querySelector('[data-view="flat"]').setAttribute('aria-pressed', String(view.flat));
    container.querySelector('[data-view="flat"]').textContent = view.flat ? '3D view' : '2D view';
    container.querySelector('[data-view="spin"]').setAttribute('aria-pressed', String(view.spin));
    applyView();
  });

  const api = {
    setWorkload(workload) {
      diskSize = workload.diskSize;
      requests = workload.requests;
      buildBands();
      buildRequests();
      // edge labels: cylinder 0 at the outer edge, the last cylinder near the spindle
      const outer = container.querySelector('.outer-label');
      const inner = container.querySelector('.inner-label');
      outer.textContent = 'cyl 0';
      outer.style.left = '50%'; outer.style.top = `${50 - GEOMETRY.outer - 2}%`;
      inner.textContent = `cyl ${diskSize - 1}`;
      inner.style.left = '50%'; inner.style.top = `${50 - GEOMETRY.inner + 3}%`;
      selectedRing.classList.add('hidden');
      this.update({ head: workload.initialHead, servicedIds: new Set() });
    },

    /** state = { head, previousHead, targetId, servicedIds, atBoundary } */
    update(state) {
      const r = radiusForCylinder(state.head, diskSize);
      sizeRing(headRing, r);
      readout.textContent = Math.round(state.head);
      arm.style.transform = `rotate(${armAngleForRadius(r).angleDeg}deg)`;
      if (state.previousHead !== undefined && state.previousHead !== null && Math.abs(state.previousHead - state.head) > 0.5) {
        sizeRing(trailRing, radiusForCylinder(state.previousHead, diskSize));
        trailRing.classList.remove('hidden');
      } else {
        trailRing.classList.add('hidden');
      }
      headRing.classList.toggle('at-boundary', Boolean(state.atBoundary));
      for (const [id, dot] of dots) {
        let cls = state.servicedIds?.has(id) ? 'p-request serviced' : 'p-request pending';
        if (id === state.targetId && !state.servicedIds?.has(id)) cls += ' target';
        if (dot.classList.contains('selected')) cls += ' selected';
        dot.className = cls;
      }
    },

    selectCylinder(cylinder, requestId = null, band = null) {
      sizeRing(selectedRing, radiusForCylinder(cylinder, diskSize));
      selectedRing.classList.remove('hidden');
      for (const [id, dot] of dots) dot.classList.toggle('selected', id === requestId || (!requestId && Number(dot.dataset.cylinder) === cylinder));
      if (onSelect) onSelect({ cylinder, requestId, band });
    },

    clearSelection() {
      selectedRing.classList.add('hidden');
      for (const dot of dots.values()) dot.classList.remove('selected');
    },

    setFlat(flat) { view.flat = flat; applyView(); },

    /** Teaching labels drawn in the platter plane: [{ text, x, y }] in % of the platter. */
    setLabels(labels) {
      labelLayer.innerHTML = labels.map((l) => `<span class="disc-label" style="left:${l.x}%;top:${l.y}%">${l.text}</span>`).join('');
    },
  };

  applyView();
  return api;
}
