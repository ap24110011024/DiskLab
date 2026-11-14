# DiskLab: Interactive 3D Disk Scheduling Visualizer

DiskLab is an interactive website for learning the **SSTF**, **SCAN** and **LOOK** disk scheduling
algorithms. You enter a request queue, choose an algorithm and watch the read/write head travel across a
2D track, a seek graph and a CSS 3D disk platter, with every decision explained.

Built with **HTML5, CSS3, vanilla JavaScript (ES modules), SVG, CSS 3D transforms, Chart.js and
LocalStorage**. There is no backend, no framework and no build step.

## Running it on a Mac

The pages use JavaScript modules, which Chrome only loads from a web server, not from `file://`.
Use either of these:

**Option 1: Python (already on most Macs).** In Terminal:

```bash
cd path/to/DiskLab
python3 -m http.server 8000
```

Then open <http://localhost:8000> in Chrome. Stop the server with `Ctrl+C`.

**Option 2: VS Code Live Server.** Open the `DiskLab` folder in VS Code, install the *Live Server*
extension, right-click `index.html` and choose **Open with Live Server**.

Everything works offline: Chart.js and the fonts are included in `assets/`.

## Pages

| Page | What it does |
|---|---|
| Home (`index.html`) | Hero with a live 3D platter running the real SSTF result, algorithm introduction, how it works |
| Input Studio | Disk size, head (number, slider, draggable marker), LEFT/RIGHT toggle, request chips with unique ids (add, edit, remove, clear, click the track), 11 seeded presets, validation |
| Simulation Lab | One algorithm on the 2D track, seek graph, 3D platter and cylinder view, all in sync; request queue with live states; playback controls; explanation panel; service sequence; export |
| Step Explorer | Step-by-step details, jump to any step, and a "predict the next step" challenge |
| Algorithm Arena | SSTF, SCAN and LOOK animated side by side on identical input |
| SCAN vs LOOK | Both sweeps together, with SCAN's extra boundary trip shaded and measured |
| Disk Learning Center | 8 interactive 3D topics: platter, tracks, sectors, cylinders, head, seek, scheduling, algorithms |
| Workload Studio | Seeded workload types, save/load workloads, compare all types in one chart |
| Analytics | Metrics and four Chart.js charts; click a point to jump to that step |
| Testing Playground | Runs the algorithms against hand-checked cases and general rules: PASS/FAIL |
| History | LocalStorage history: view, open, replay, delete, clear (with confirmation) |

Keyboard: <kbd>Space</kbd> play/pause, <kbd>←</kbd>/<kbd>→</kbd> previous/next step, <kbd>R</kbd> reset
(ignored while typing). Reduced-motion settings are respected.

## Verified example

Disk 0–199, head 50, requests 82, 43, 170, 16, direction RIGHT:

| Algorithm | Head path | Total |
|---|---|---|
| SSTF | 50 → 43 → 16 → 82 → 170 | 188 |
| SCAN | 50 → 82 → 170 → **199** → 43 → 16 | 332 |
| LOOK | 50 → 82 → 170 → 43 → 16 | 274 |

## Tests

- **In the browser:** open the *Testing* page. It runs every case live.
- **From the terminal (optional, needs Node.js 18+):**

```bash
node tests/run-tests.mjs      # algorithm cases, 400 random workloads, generators, validation, 3D arm geometry
node tests/check-files.mjs    # broken imports, links, assets and missing element ids
```

## Folder structure

```
DiskLab/
├── index.html                 Home page
├── pages/                     the other 10 pages
├── css/                       variables, base, layout, navigation, components, animations,
│                              3d-visuals, visualization, and one file per page group, responsive
├── js/
│   ├── app.js, navigation.js, state.js, storage.js, validation.js, ui.js
│   ├── algorithms/            common.js, sstf.js, scan.js, look.js, index.js
│   ├── simulation/            engine, execution-data, step-controller, animation-controller,
│   │                          playback-bar, comparison
│   ├── visualization/         disk-track (SVG), movement-path (seek graph), disk-platter-3d, cylinder-view
│   ├── input/                 queue-editor, workload-generator
│   ├── analytics/             metrics, charts
│   ├── learning/              explanations, prediction-challenge
│   ├── testing/               test-cases, test-runner
│   ├── export/                export-results
│   └── pages/                 one entry script per HTML page
├── assets/                    icons, fonts (Inter, JetBrains Mono), vendor (Chart.js)
├── tests/                     run-tests.mjs, check-files.mjs
└── docs/                      algorithms.md, testing.md, project-documentation.md
```

Changes from the suggested structure: `head-animation.js` and `request-markers.js` are part of
`disk-track.js` (the head and markers are drawn in the same SVG), page entry scripts live in
`js/pages/`, and `playback-bar.js` / `ui.js` hold controls shared by several pages.

## Documentation

- [`docs/algorithms.md`](docs/algorithms.md): rules, tie-breaking, result format, metrics
- [`docs/testing.md`](docs/testing.md): what is tested and how
- [`docs/project-documentation.md`](docs/project-documentation.md): design, architecture, limitations

## License

MIT (see `LICENSE`). Bundled: Chart.js 4.4.1 (MIT), Inter and JetBrains Mono (SIL OFL 1.1).
