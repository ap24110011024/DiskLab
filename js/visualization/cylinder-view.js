/*
 * 3D cylinder view: three platter surfaces stacked with CSS 3D transforms.
 * On every surface the same track radius is drawn, which is exactly what a
 * cylinder is: the set of tracks at one arm position on every surface.
 *   mustard ring = current head cylinder, dark ring = pending, sage = serviced,
 *   dashed dark ring = selected cylinder.
 */

import { radiusForCylinder } from './disk-platter-3d.js';

const LAYERS = 3;

export function createCylinderView(container) {
  container.classList.add('cylinder-wrap');
  container.innerHTML = `
    <div class="cv-stage" aria-label="Cylinder view: three stacked platter surfaces">
      <div class="cv-stack">
        ${Array.from({ length: LAYERS }, (_, i) => `<div class="cv-layer" style="--layer:${i}"><div class="cv-rings"></div><div class="cv-spindle"></div></div>`).join('')}
      </div>
    </div>
    <div class="cv-legend">
      <span><i class="dot head"></i>head cylinder</span><span><i class="dot pending"></i>pending</span>
      <span><i class="dot serviced"></i>serviced</span><span><i class="dot selected"></i>selected</span>
    </div>
    <p class="cv-readout mono" aria-live="off"></p>
    <p class="cv-caption">Outer edge = cylinder 0, inner edge = last cylinder. The mustard head ring appears on every surface: together these tracks form one cylinder.</p>`;

  const ringLayers = [...container.querySelectorAll('.cv-rings')];
  const readout = container.querySelector('.cv-readout');
  let diskSize = 200;
  let requests = [];

  function ring(cylinder, cls) {
    const r = radiusForCylinder(cylinder, diskSize);
    return `<span class="cv-ring ${cls}" style="width:${r * 2}%;height:${r * 2}%"></span>`;
  }

  return {
    setWorkload(workload) {
      diskSize = workload.diskSize;
      requests = workload.requests;
      this.update({ head: workload.initialHead, servicedIds: new Set(), selected: null });
    },
    update({ head, servicedIds = new Set(), selected = null }) {
      const seen = new Set();
      let html = '';
      for (const request of requests) {
        if (seen.has(request.cylinder)) continue;
        seen.add(request.cylinder);
        const allDone = requests.filter((r) => r.cylinder === request.cylinder).every((r) => servicedIds.has(r.id));
        html += ring(request.cylinder, allDone ? 'serviced' : 'pending');
      }
      if (selected !== null) html += ring(selected, 'selected');
      html += ring(head, 'head');
      ringLayers.forEach((layer, i) => {
        layer.innerHTML = html + `<span class="cv-surface-label">surface ${i + 1}</span>`;
      });
      const pending = [...new Set(requests.filter((r) => !servicedIds.has(r.id)).map((r) => r.cylinder))].sort((a, b) => a - b);
      readout.innerHTML = `head cylinder <b>${head}</b>${selected !== null ? ` · selected <b>${selected}</b>` : ''}`
        + ` · pending ${pending.length ? pending.join(', ') : 'none'} · range 0 (outer) to ${diskSize - 1} (inner)`;
    },
  };
}
