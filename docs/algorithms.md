# Algorithms

Code: `js/algorithms/`. Each algorithm takes

```js
{ diskSize, initialHead, direction: 'LEFT' | 'RIGHT', requests: [{ id, cylinder }] }
```

Cylinders are `0 … diskSize − 1`. Every request has a unique id, so duplicates (two requests for the same
cylinder) are separate and are each serviced once. Plain numbers are also accepted; they get ids `r1, r2, …`.

## SSTF: Shortest Seek Time First
At every step: distance = |current head − request cylinder| for each pending request; choose the smallest;
move; remove that one request; repeat.
**Ties:** lower cylinder first; for equal cylinders, the request that came first in the original queue.
SSTF ignores the direction. It often moves little on a fixed queue but is **not** guaranteed optimal, and with
continuously arriving requests far requests can starve. A finite static queue cannot demonstrate starvation, so
DiskLab only explains it.

## SCAN (elevator)
1. Service requests in the initial direction, in the order the head reaches them.
2. If requests remain on the other side, continue to the physical boundary (0 or diskSize − 1) and reverse.
3. Service the rest.

The boundary trip counts as movement but is **not** a serviced request. If a request is on the boundary,
it is serviced there and no extra trip is added. There is no boundary trip or reversal once every request
is done.

## LOOK
Like SCAN, but the head reverses at the **last pending request** in its direction. No boundary trip is ever
made. If nothing lies in the initial direction, it starts by servicing the other side.
LOOK's path is SCAN's path without the boundary trip, so LOOK never moves more than SCAN on the same input
(checked on 400 random workloads).

## Execution result (used by every page, chart, export and history record)

| Field | Meaning |
|---|---|
| `algorithm, diskSize, initialHead, direction, requests` | the input |
| `serviceSequence` | `[{ id, cylinder }]` in service order |
| `serviceOrder` | cylinders in service order |
| `path` | every head position, including boundary visits |
| `distances` | distance of each movement |
| `steps` | one record per movement: `number, type (SERVICE/BOUNDARY), from, to, distance, cumulative, direction, sweep, request, pendingBefore, pendingAfter, candidates, title, reason, reverseAfter` |
| `totalMovement` | Σ distances (cylinders) |
| `averageMovement` | total ÷ number of requests, 2 decimals, 0 for an empty queue |
| `servicedCount, directionChanges, finalHead` | |
| `boundaryEvents` | `[{ step, cylinder }]` |
| `reversalEvents` | `[{ step, cylinder, from, to }]` (step 0 = turned before moving) |

**Direction changes** count reversals between movements that actually move the head (zero-distance moves
are ignored). Values are cylinders, never milliseconds.

## Worked example (disk 0–199, head 50, requests 82, 43, 170, 16, RIGHT)

- SSTF: 50 → 43 (7) → 16 (27) → 82 (66) → 170 (88) = **188**
- SCAN: 50 → 82 (32) → 170 (88) → 199 (29, boundary) → 43 (156) → 16 (27) = **332**
- LOOK: 50 → 82 (32) → 170 (88) → 43 (127) → 16 (27) = **274**

## How the animation stays honest
The algorithm writes each step's `reason` while it runs. The animation (`simulation/`) only replays
`steps`: it never decides anything. Each movement is shown in three phases: *decide* (first 40%: the choice is
shown; SSTF draws a distance arc to every candidate, then fades all but the nearest), *move* (eased travel),
*settle* (request turns sage green with a short pop, boundary glow or reversal badge). SSTF steps get extra time in
the decide phase so the arcs can be read. SCAN/LOOK turning-point requests are marked with a dashed dark
ring before the head reaches them. Playback speed changes time only, never the result.
