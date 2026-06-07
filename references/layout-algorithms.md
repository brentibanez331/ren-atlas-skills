# Atlas layout

How to position nodes so an architecture reads clearly. The **default for architecture is a layered left-to-right flow** by dependency depth — it matches how people reason about systems (users on the left, data stores on the right). Everything here is **deterministic**: no randomness, no timestamps, so a refresh moves only what actually changed.

## Spacing constants

```
COL_GAP = 360   # x distance between ranks (columns) — must exceed the longest edge label width
ROW_GAP = 200   # y distance between node CENTERS within a rank (was too tight at 140 — labels crowded)
MARGIN  = 80    # padding around the whole drawing
NODE    = 180x70 (min)   # Canvas file-nodes: 260x80
LABEL_PAD = 12  # clear space required around every edge/node label
```

**Size the column gap to the labels, not just the nodes.** A horizontal edge carries its label at the midpoint; if `COL_GAP` is only as wide as the gap between boxes, a label like `HTTP svc-token` collides with both. Set `COL_GAP = max(360, longest_label_width + 2*LABEL_PAD + 80)`. Likewise raise `ROW_GAP` if any node label wraps to two lines.

## 1. Layered flow — the architecture default

Best when edges mostly point one direction (callers → callees → stores).

1. **Rank nodes by depth.** Sources = nodes with no incoming `sync` edge (typically user-facing apps) → rank 0. For every other node, `rank = 1 + max(rank of its sync predecessors)`. Push pure sinks (databases, caches — externals with only incoming edges) to the right-most rank so storage lines up on the right.
2. **Break cycles** by ignoring back-edges: when ranking, skip any edge whose target already has a rank ≤ the source's. Record which edges were treated as back-edges (they still draw, just don't affect ranking).
3. **Order within each rank to cut crossings** (barycenter heuristic): a node's vertical order = the average position of its neighbors in the adjacent rank. Run ~4 passes alternating left→right and right→left. Cheap, and removes most crossings.
4. **Place**: `x = MARGIN + rank * COL_GAP`, `y = MARGIN + orderIndex * ROW_GAP`. Vertically center shorter ranks so the diagram isn't top-heavy.
5. **Spread hub fan-out.** A node with many outgoing edges (e.g. a shared lib or gateway with 5+ targets) must have those targets *distributed across the full height of the next rank*, not clustered near the hub's own `y`. Otherwise the edges bundle into one corridor and their labels stack. For a hub of out-degree `d`, allocate it at least `d * ROW_GAP` of vertical span in the downstream rank and place its targets evenly across that span. If a rank can't hold the span, widen `ROW_GAP` for that rank.

## 2. Radial — per-project neighbor views

Best for the 1-hop "this project + who it talks to" canvases.

- Focus node at center. Place its `N` direct neighbors on a circle, radius `R = 360` (grow to 480 if `N > 10`): `angle = i * 2π/N`, `x = cx + R·cos(angle) - w/2`, `y = cy + R·sin(angle) - h/2`.
- Optionally split: callees on the right hemisphere, callers on the left, so direction stays readable.

## 3. Grid — catalog / index views

When there's no meaningful topology (e.g. an index of every project): `cols = ceil(sqrt(n))`, fill row-major, each cell `COL_GAP × (ROW_GAP+NODE.h)`, center each node in its cell.

## 4. Force-directed — dense-graph fallback only

Only when layered still produces a hairball. Sketch: repulsion between all node pairs (`k_rep / d²`), spring attraction along edges (`k_spring · (d − restLen)`), ~100 iterations, then **snap final coordinates to a 20px grid** so the result is stable across refreshes (a raw force layout is non-deterministic and will churn diffs).

## Collision guard (label-aware — this is the step that was missing)

Overlap isn't just node-vs-node. Treat **four kinds of rectangle as occupied space**: node boxes, node labels, edge labels, and (loosely) the arrows themselves. Build an axis-aligned bounding box (AABB) for each and ensure none intersect (with `LABEL_PAD` slack). Most messy diagrams come from skipping the label AABBs.

1. **Node vs node**: no two node boxes closer than `min_dx = (w1+w2)/2 + COL_GAP` horizontally or `min_dy = (h1+h2)/2 + ROW_GAP` vertically. If they collide, nudge the later-ordered node along the axis of least overlap and re-check.
2. **Edge label vs node**: compute each edge label's AABB at its placed position (see label pass below). If it intersects any node box, the edge is too short or the label too long — lengthen the edge (push the target a rank further / increase `COL_GAP`), shorten the label, or apply the perpendicular offset below. An edge label must **never** sit on a node box.
3. **Label vs label**: two labels whose AABBs overlap → offset the lower-priority one. 
4. Re-run until clean or a fixed iteration cap (e.g. 20); if still colliding, drop the lowest-confidence edge's label (not the edge) and note it.

### Edge-label placement pass

Run after nodes are placed, for every edge:

1. Start at the edge midpoint.
2. Build the label AABB (`width ≈ chars * fontSize * 0.55`, `height ≈ fontSize * 1.25`, plus `LABEL_PAD`).
3. If it overlaps any node box or another label, **offset perpendicular to the edge** by `ROW_GAP/3` increments (alternating sides) until clear.
4. For **Excalidraw**, prefer a *bound* label (text with `containerId` = the arrow id) — Excalidraw auto-centers it on the line, which already avoids most node overlaps; use this pass mainly to detect when an edge is simply too short and the nodes need more spacing.
5. For **Mermaid**, you don't place labels manually — but the same crowding signal means: split into a per-project view rather than forcing every labeled edge into the system view.

Keep one short label per edge. A long label (`HTTP svc-token`) is itself a smell — abbreviate (`svc-token`) or move the detail to the edge's evidence, not the diagram.

## Edge attachment sides (Canvas)

Canvas edges look best when bound to the correct side. Pick by dominant axis between node centers: if `|dx| > |dy|` use `right`→`left` (or reverse by sign), else `bottom`→`top`. (`layout-algorithms` § "Edge sides" is also referenced by `write-canvas`.)

## Determinism rule (this is what makes refresh cheap)

- Emit nodes and edges **sorted by id**.
- Never call a random or time function to set positions, seeds, or ids.
- On **refresh, preserve existing node positions** — only compute coordinates for *new* nodes, and leave anything the user manually moved where it is. Recomputing the whole layout on every refresh would erase the user's spatial edits and explode the diff.
