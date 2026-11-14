# Testing

## In the browser
Open **Testing** (`pages/testing.html`). It runs `js/testing/test-cases.js` against the real algorithms and
shows test name, algorithm, expected value, actual value and PASS/FAIL, plus 300 random workloads checked
against the general rules.

## From the terminal (optional, Node.js 18+)
```bash
node tests/run-tests.mjs     # same cases + 400 random workloads + generators + validation + 3D arm geometry
node tests/check-files.mjs   # imports/exports, links, assets, element ids used by page scripts
```

## Test cases (each run for SSTF, SCAN and LOOK where relevant)
1. Empty request queue · 2. Single request · 3. Duplicate requests · 4. Request equal to the initial head ·
5. All requests on the left · 6. All requests on the right · 7. Requests on both sides · 8. Request at cylinder 0 ·
9. Request at the maximum cylinder · 10. Equal-distance SSTF tie · 11. Small disk (5 cylinders) ·
12. Large disk (5000 cylinders) · 13. LEFT initial direction · 14. RIGHT initial direction ·
plus the specification example.

## Rules checked on every result
Every request serviced exactly once (by id) · no invalid cylinder visited · total = sum of step distances ·
final head = last path position · SSTF always takes a nearest pending request · SCAN reverses only at a
boundary · LOOK makes no boundary trip and reverses only at a request · SCAN/LOOK reverse at most once ·
LOOK never moves more than SCAN.

## Manual checklist in Chrome
Open DevTools (Console must stay free of red errors) and check:

| # | Action | Expected |
|---|---|---|
| 1 | Open every page from the sidebar | Each loads; the sidebar highlights the page |
| 2 | Input Studio: type `82, -4` and Add | Error under the field; nothing added |
| 3 | Click the track; drag the head marker | Request added at that cylinder; head follows |
| 4 | Simulation Lab: Play / Pause / Resume / Next / Previous / Reset / Replay | Controls behave as named |
| 5 | SSTF, press Next | Distance arcs appear, nearest highlighted, head moves |
| 6 | SCAN on the sample | Boundary 199 glows, "boundary" step, reversal badge |
| 7 | 3D platter: drag, zoom, 2D view, spin, reset; hover a ring; click a dot | View changes; tooltip; selection text |
| 8 | Arena: Play | Three lanes move independently; "lowest" badge at the end |
| 9 | Analytics: click a chart point | Small track jumps to that step |
| 10 | Export buttons | Clipboard text / CSV / PNG / print dialog |
| 11 | Finish a simulation, refresh History | Record is still there; Replay works |
| 12 | Keyboard: Space, ←, →, R | Works, but not while typing in a field |
| 13 | DevTools device toolbar (phone) | Menu button, single column, no sideways scrolling |
| 14 | macOS Reduce Motion on | Head jumps step by step, no decorative motion |
| 15 | Lab: click a chip in "Request queue" | Request highlighted on track, platter and cylinder view |
| 16 | LOOK on the sample | 170 has a dashed dark ring (turning point) until serviced |
| 17 | Disk Learning: topics 1, 2, 3, 5, 6 | Labels on the 3D platter; "Reset topic" restores it |
| 18 | Analytics: click a point, then "Open this step in the Simulation Lab" | Lab opens at that step |

## Results (fill in after testing on your machine)

| Check | Result | Date |
|---|---|---|
| Testing page | __ / __ passed | |
| `node tests/run-tests.mjs` | | |
| `node tests/check-files.mjs` | | |
| Manual checklist | __ / 18 | |
