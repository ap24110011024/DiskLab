/*
 * 3D Disk Learning Center. One 3D stage, eight topics. Each topic changes
 * what the stage shows and what can be done with it.
 */

import { initPage } from '../app.js';
import { createPlatter3D, armAngleForRadius, radiusForCylinder, GEOMETRY } from '../visualization/disk-platter-3d.js';
import { createCylinderView } from '../visualization/cylinder-view.js';
import { runOne } from '../simulation/engine.js';
import { createStepController } from '../simulation/step-controller.js';
import { createAnimationController } from '../simulation/animation-controller.js';
import { headPositionAt, servicedIds, movementSoFar } from '../simulation/execution-data.js';
import { withIds } from '../state.js';
import { prefersReducedMotion } from '../ui.js';
import { renderGuide } from '../learning/explanations.js';

initPage('learning');

const $ = (id) => document.getElementById(id);
const DISK = 200;
const EXAMPLE = { diskSize: DISK, initialHead: 50, direction: 'RIGHT', requests: withIds([82, 43, 170, 16]) };

const platter = createPlatter3D($('learn-platter'), {
  onSelect: ({ cylinder, band }) => {
    $('stage-info').textContent = band
      ? `Track band: cylinders ${band.first}–${band.last}. Every surface has a track at this radius.`
      : `Cylinder ${cylinder}.`;
  },
});
const cylinderView = createCylinderView($('learn-cylinder'));
const disc = document.querySelector('#learn-platter .platter-disc');
const sector = document.createElement('div');
sector.className = 'sector-highlight hidden';
disc.appendChild(sector);

let headNow = 50;

/** Labels that follow the arm: pivot, arm and head tip positions in the platter plane. */
function armLabels(cylinder) {
  const tip = armAngleForRadius(radiusForCylinder(cylinder, DISK));
  return [
    { text: 'pivot', x: GEOMETRY.pivotX - 3, y: GEOMETRY.pivotY + 6 },
    { text: 'actuator arm', x: (GEOMETRY.pivotX + tip.tipX) / 2 + 6, y: (GEOMETRY.pivotY + tip.tipY) / 2 + 4 },
    { text: `read/write head (cyl ${Math.round(cylinder)})`, x: tip.tipX, y: tip.tipY - 7 },
  ];
}
let seekFrame = null;
let demo = null;

const TOPICS = [
  {
    key: 'platter', title: '1. Disk platter',
    text: `A hard disk stores data on round <b>platters</b> coated with magnetic material. They are fixed to a central
      <b>spindle</b> and spin at a constant speed (for example 7200 revolutions per minute). Drag the platter to look at it
      from different angles; use <b>Spin platter</b> to see the rotation.`,
    setup() { platter.setWorkload({ diskSize: DISK, requests: [], initialHead: 50 }); platter.setLabels([{ text: 'platter', x: 24, y: 24 }, { text: 'spindle', x: 50, y: 60 }]); },
  },
  {
    key: 'tracks', title: '2. Tracks',
    text: `Each surface is divided into concentric circles called <b>tracks</b>. Hover over the rings: each ring here groups
      a range of cylinder numbers. Track 0 is on the outer edge and the numbers grow towards the spindle.`,
    setup() { platter.setWorkload({ diskSize: DISK, requests: [], initialHead: 50 }); document.body.classList.add('emphasize-bands');
      platter.setLabels([{ text: 'track 0 (outer)', x: 50, y: 7 }, { text: 'inner tracks', x: 50, y: 39 }]); },
  },
  {
    key: 'sectors', title: '3. Sectors',
    text: `A track is split into <b>sectors</b>, the smallest unit the drive reads or writes (commonly 512 bytes or 4 KB).
      The highlighted wedge shows one sector position on every track. After the head reaches a track it must wait for the
      right sector to rotate underneath: that wait is <b>rotational latency</b>.`,
    setup() { platter.setWorkload({ diskSize: DISK, requests: [], initialHead: 50 }); sector.classList.remove('hidden');
      platter.setLabels([{ text: 'one sector', x: 74, y: 13 }, { text: 'track', x: 26, y: 50 }]); },
  },
  {
    key: 'cylinders', title: '4. Cylinders',
    text: `A drive has several surfaces, one head for each, all on the same arm. The tracks at the same radius on every surface
      form a <b>cylinder</b>. Move the slider: the mustard ring moves on all surfaces together, because the heads move together.
      That is why disk scheduling talks about cylinder numbers.`,
    showCylinder: true,
    slider: { label: 'Cylinder', onInput: (value) => cylinderView.update({ head: value, servicedIds: new Set(), selected: null }) },
    setup() { cylinderView.setWorkload({ diskSize: DISK, requests: [], initialHead: 50 }); },
  },
  {
    key: 'head', title: '5. Read/write head',
    text: `The <b>read/write head</b> sits at the tip of the <b>actuator arm</b>. The arm turns around its pivot to place the head
      over any track; the mustard ring shows the track under the head. Use the slider to move the arm.`,
    slider: { label: 'Head cylinder', onInput: (value) => { headNow = value; platter.update({ head: value, servicedIds: new Set() }); platter.setLabels(armLabels(value)); } },
    setup() { platter.setWorkload({ diskSize: DISK, requests: [], initialHead: headNow }); },
  },
  {
    key: 'seek', title: '6. Seek operation',
    text: `Moving the head from one cylinder to another is a <b>seek</b>. Its length is the <b>seek distance</b>,
      |current − target| cylinders. Seeks are slow compared with electronics, so the order of requests matters.
      Click a button to seek and watch the distance.`,
    buttons: [20, 90, 140, 199].map((target) => ({ label: `Seek to ${target}`, run: () => seekTo(target) })),
    setup() { platter.setWorkload({ diskSize: DISK, requests: [], initialHead: headNow }); },
  },
  {
    key: 'scheduling', title: '7. Disk scheduling',
    labels: [{ text: 'pending requests (dark dots)', x: 22, y: 12 }],
    text: `Many processes send requests at once, so the OS keeps a <b>request queue</b>. Disk scheduling chooses which pending
      request to serve next. With the head at 50 and requests 82, 43, 170, 16, serving them in arrival order moves the head
      <b>${[50, 82, 43, 170, 16].reduce((t, c, i, a) => (i ? t + Math.abs(c - a[i - 1]) : 0), 0)}</b> cylinders, while SSTF needs
      <b>${runOne('SSTF', EXAMPLE).totalMovement}</b>. Same requests, very different arm travel.`,
    setup() { platter.setWorkload(EXAMPLE); },
  },
  {
    key: 'algorithms', title: '8. SSTF, SCAN and LOOK',
    text: `<b>SSTF</b> always moves to the nearest request. <b>SCAN</b> sweeps to the disk edge and back, like a lift.
      <b>LOOK</b> sweeps like SCAN but turns at the last request. Run each one on the example below.`,
    buttons: ['SSTF', 'SCAN', 'LOOK'].map((name) => ({ label: `Run ${name}`, run: () => runDemo(name) })),
    setup() { platter.setWorkload(EXAMPLE); },
  },
];

function stopAnimations() {
  if (seekFrame) cancelAnimationFrame(seekFrame);
  seekFrame = null;
  if (demo) demo.destroy();
  demo = null;
}

function seekTo(target) {
  stopAnimations();
  const from = headNow;
  const start = performance.now();
  const duration = prefersReducedMotion() ? 0 : 400 + 1200 * (Math.abs(target - from) / (DISK - 1));
  function frame(now) {
    const t = duration === 0 ? 1 : Math.min(1, (now - start) / duration);
    const eased = t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2;
    headNow = from + (target - from) * eased;
    platter.update({ head: headNow, previousHead: t < 1 ? from : null, servicedIds: new Set() });
    platter.setLabels(armLabels(headNow));
    $('stage-info').textContent = `Seek ${from} → ${target}: distance |${from} − ${target}| = ${Math.abs(target - from)} cylinders`;
    if (t < 1) seekFrame = requestAnimationFrame(frame);
    else headNow = target;
  }
  seekFrame = requestAnimationFrame(frame);
}

function runDemo(name) {
  stopAnimations();
  const result = runOne(name, EXAMPLE);
  platter.setWorkload(EXAMPLE);
  const controller = createStepController(result.steps.length, (step, progress) => {
    const current = progress > 0 ? result.steps[step] : null;
    platter.update({ head: headPositionAt(result, step, progress), targetId: current?.request?.id ?? null, servicedIds: servicedIds(result, step, progress) });
    $('stage-info').textContent = `${name}: path ${result.path.slice(0, step + 1).join(' → ')} · moved ${Math.round(movementSoFar(result, step, progress))} of ${result.totalMovement}`;
  });
  renderGuide($('topic-guide'), name, result);
  demo = createAnimationController(controller, { result, onStateChange: () => {}, reducedMotion: prefersReducedMotion() });
  demo.play();
}

function showTopic(index) {
  stopAnimations();
  const topic = TOPICS[index];
  document.body.classList.remove('emphasize-bands');
  sector.classList.add('hidden');
  platter.clearSelection();
  platter.setLabels(topic.labels || []);
  $('stage-info').textContent = 'Hover or click the platter for details.';

  document.querySelectorAll('#topic-list button').forEach((b, i) => b.setAttribute('aria-selected', String(i === index)));
  $('topic-title').textContent = topic.title;
  $('topic-text').innerHTML = topic.text;
  $('learn-platter').hidden = Boolean(topic.showCylinder);
  $('learn-cylinder').hidden = !topic.showCylinder;

  $('topic-guide').innerHTML = '';
  const controls = $('topic-controls');
  controls.innerHTML = '';
  if (topic.slider) {
    controls.innerHTML = `<label class="slider-field grow"><span>${topic.slider.label}</span>
      <input class="range" type="range" min="0" max="${DISK - 1}" value="${Math.round(headNow)}" id="topic-slider">
      <output class="mono" id="topic-slider-out">${Math.round(headNow)}</output></label>`;
    $('topic-slider').addEventListener('input', (e) => {
      $('topic-slider-out').textContent = e.target.value;
      topic.slider.onInput(Number(e.target.value));
    });
  }
  if (topic.buttons) {
    const row = document.createElement('div');
    row.className = 'button-row';
    topic.buttons.forEach((b) => {
      const button = document.createElement('button');
      button.className = 'btn btn-small';
      button.textContent = b.label;
      button.addEventListener('click', b.run);
      row.appendChild(button);
    });
    controls.appendChild(row);
  }
  topic.setup();
  if (topic.key === 'seek') platter.setLabels(armLabels(headNow));
  if (topic.slider) topic.slider.onInput(Math.round(headNow));
}

$('topic-list').innerHTML = TOPICS.map((t, i) => `<li><button type="button" role="tab" data-index="${i}">${t.title}</button></li>`).join('');
$('topic-list').addEventListener('click', (e) => { const b = e.target.closest('[data-index]'); if (b) showTopic(Number(b.dataset.index)); });
$('topic-reset').addEventListener('click', () => { headNow = 50; showTopic(currentIndex()); });
$('topic-prev').addEventListener('click', () => showTopic(Math.max(0, currentIndex() - 1)));
$('topic-next').addEventListener('click', () => showTopic(Math.min(TOPICS.length - 1, currentIndex() + 1)));
function currentIndex() { return [...document.querySelectorAll('#topic-list button')].findIndex((b) => b.getAttribute('aria-selected') === 'true'); }

showTopic(0);
