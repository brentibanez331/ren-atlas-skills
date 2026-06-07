# Atlas layout

How to position nodes so an architecture reads clearly. The **default for architecture is a layered left-to-right flow** by dependency depth — it matches how people reason about systems (users on the left, data stores on the right). Everything here is **deterministic**: no randomness, no timestamps, so a refresh moves only what actually changed.

## Spacing constants

```
COL_GAP = 320   # x distance between ranks (columns)
ROW_GAP = 140   # y distance between nodes within a rank
MARGIN  = 60    # padding around the whole drawing
NODE    = 160x60 (min)   # Canvas file-nodes: 260x80
```

## 1. Layered flow — the architecture default

Best when edges mostly point one direction (callers → callees → stores).

1. **Rank nodes by depth.** Sources = nodes with no incoming `sync` edge (typically user-facing apps) → rank 0. For every other node, `rank = 1 + max(rank of its sync predecessors)`. Push pure sinks (databases, caches — externals with only incoming edges) to the right-most rank so storage lines up on the right.
2. **Break cycles** by ignoring back-edges: when ranking, skip any edge whose target already has a rank ≤ the source's. Record which edges were treated as back-edges (they still draw, just don't affect ranking).
3. **Order within each rank to cut crossings** (barycenter heuristic): a node's vertical order = the average position of its neighbors in the adjacent rank. Run ~4 passes alternating left→right and right→left. Cheap, and removes most crossings.
4. **Place**: `x = MARGIN + rank * COL_GAP`, `y = MARGIN + orderIndex * ROW_GAP`. Vertically center shorter ranks so the diagram isn't top-heavy.

## 2. Radial — per-project neighbor views

Best for the 1-hop "this project + who it talks to" canvases.

- Focus node at center. Place its `N` direct neighbors on a circle, radius `R = 360` (grow to 480 if `N > 10`): `angle = i * 2π/N`, `x = cx + R·cos(angle) - w/2`, `y = cy + R·sin(angle) - h/2`.
- Optionally split: callees on the right hemisphere, callers on the left, so direction stays readable.

## 3. Grid — catalog / index views

When there's no meaningful topology (e.g. an index of every project): `cols = ceil(sqrt(n))`, fill row-major, each cell `COL_GAP × (ROW_GAP+NODE.h)`, center each node in its cell.

## 4. Force-directed — dense-graph fallback only

Only when layered still produces a hairball. Sketch: repulsion between all node pairs (`k_rep / d²`), spring attraction along edges (`k_spring · (d − restLen)`), ~100 iterations, then **snap final coordinates to a 20px grid** so the result is stable across refreshes (a raw force layout is non-deterministic and will churn diffs).

## Collision guard

Before finalizing, verify no two nodes are closer than:
`min_dx = (w1+w2)/2 + COL_GAP` horizontally, `min_dy = (h1+h2)/2 + ROW_GAP` vertically.
If two collide, nudge the later-ordered node along the axis of least overlap and re-check.

## Edge attachment sides (Canvas)

Canvas edges look best when bound to the correct side. Pick by dominant axis between node centers: if `|dx| > |dy|` use `right`→`left` (or reverse by sign), else `bottom`→`top`. (`layout-algorithms` § "Edge sides" is also referenced by `write-canvas`.)

## Determinism rule (this is what makes refresh cheap)

- Emit nodes and edges **sorted by id**.
- Never call a random or time function to set positions, seeds, or ids.
- On **refresh, preserve existing node positions** — only compute coordinates for *new* nodes, and leave anything the user manually moved where it is. Recomputing the whole layout on every refresh would erase the user's spatial edits and explode the diff.
