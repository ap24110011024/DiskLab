# Project documentation

## Problem
Disk scheduling is usually taught with static diagrams, which hide *why* each algorithm picks the next
request. DiskLab shows the head moving step by step on several synchronized views and explains every
decision, so the behaviour of SSTF, SCAN and LOOK can be seen and compared.

## Objectives
1. Correct SSTF, SCAN and LOOK implementations, including edge cases.
2. An animation driven entirely by the algorithms' real output.
3. 2D and 3D views that help explain disk structure, not just decoration.
4. Fair comparison on identical input, without claiming a universal winner.
5. Learning tools: step explorer, prediction challenge, disk learning center.
6. Tests that run the real code.

## Architecture
```
input (Input Studio / Workload Studio) → state.js (LocalStorage)
      → simulation/engine.js → algorithms/*.js → execution result
      → step-controller (where we are) + animation-controller (time)
      → visualization/* (track, seek graph, 3D platter, cylinder view)
      → learning/explanations, analytics/charts, export, storage (history)
```
Algorithm code never touches the page; visualization code never decides the schedule.

## 3D implementation
The platter is a set of `<div>`s inside a container with `perspective`; the camera element uses
`rotateX`, `rotateZ` and `scale`, with `transform-style: preserve-3d`. Layers are separated with
`translateZ`. Cylinder 0 is the outer edge. The actuator arm rotates around a pivot; its angle comes from
the law of cosines so the head tip lands exactly on the radius of the current cylinder (verified by a test).
The cylinder view stacks three platter surfaces and draws the same track radius on each, which is what a
cylinder is.

## Design
Warm, minimal engineering-lab design. The palette is one `:root` block in `css/variables.css`
(exact values, unchanged variable names); non-colour tokens (fonts, spacing, radii, shadows, motion) live
in a second `:root` block.

| Role | Variable | Value |
|---|---|---|
| Page background / secondary / cards / raised cards | `--bg` / `--bg-2` / `--card` / `--card-raised` | #F5F2EA / #E8E3D8 / #FFFFFF / #F9F7F2 |
| Borders / strong borders | `--line` / `--line-strong` | #DCD7CC / #C8C1B4 |
| Text / secondary / muted (placeholders, disabled) | `--text` / `--text-2` / `--text-3` | #252C32 / #59636B / #818781 |
| Primary accent (buttons, focus, active nav) | `--cyan` | #557C78 |
| Secondary accent / warm highlight | `--blue` / `--orange` | #718096 / #B86F52 |
| Success / error | `--green` / `--red` | #52745D / #B94E4E |
| Selection, turning point | `--violet` | #9A7768 |
| Read/write head, current target, boundary | `--head` | #C29B55 (always with a dark outline) |
| Algorithms | `--sstf` / `--scan` / `--look` | #557C78 / #B86F52 / #718096 |

Contrast rules used everywhere: body and secondary text use `--text` / `--text-2` (AA on every
surface). Palette hues are used for fills, borders, underlines and markers rather than small text; green and
red text only appear on white. `--text-3` is used for placeholders and disabled controls. Sidebar section labels use `--text-2`, because
#818781 on the #E8E3D8 sidebar is only 2.87:1 while #59636B is 4.80:1 (WCAG AA). Every state is shown with a shape cue as well as a colour (fill, dashed ring, underline,
✓/✕), so colour is never the only signal.

The 3D platter is brushed aluminium with a fixed light reflection, steel arm and spindle and soft shadows;
no glow. SVG views are drawn at the container's real pixel width so labels stay readable on phones.

## Limitations
- Static request queue: requests do not arrive during a run, so SSTF starvation is explained, not simulated.
- Only seek distance (cylinders) is modelled; rotational latency and transfer time are explained in the
  learning center but not simulated.
- The 3D platter is a teaching model: track bands group cylinder ranges, and dot angles only spread requests out.
- History and saved workloads live in this browser's LocalStorage (cleared if site data is cleared).
- Up to 60 requests per workload, to keep the visualisation readable.

## Possible extensions
C-SCAN and C-LOOK; dynamic arrivals to demonstrate starvation; an explicitly labelled seek-time model.
