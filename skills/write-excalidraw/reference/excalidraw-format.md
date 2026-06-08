# Hand-authoring `.excalidraw.md` — the strict spec

All atlas Excalidraw diagrams are **hand-authored** to strict, deterministic specs. There is no converter. You place every element yourself, following:

- **Positioning** → [`../../../references/layout-algorithms.md`](../../../references/layout-algorithms.md) — exact constants and formulas per diagram type (graph/flowchart, sequence, class, mindmap, radial, grid).
- **Colors, sizes, typography, spacing** → [`../../../references/design-system.md`](../../../references/design-system.md).

Hand-authoring is what lets the pack render *any* diagram type (flowchart, sequenceDiagram, classDiagram, mindmap, …) with full control over layout and style. The cost is rigor: follow the rules below exactly, and run the collision check before writing.

## File envelope

```
---
excalidraw-plugin: parsed
tags: [excalidraw]
---
==⚠  Switch to EXCALIDRAW VIEW in the MORE OPTIONS menu of this document. ⚠==

# Excalidraw Data

## Text Elements
<rawText> ^<elementId>      ← one line per text element (search index; id must match)

%%
## Drawing
```json
{ …scene… }
```
%%
```

Use plain ` ```json ` (not `compressed-json`). See `blank.excalidraw.md` for the exact envelope to copy.

## Scene JSON

```json
{ "type": "excalidraw", "version": 2,
  "source": "https://github.com/zsviczian/obsidian-excalidraw-plugin",
  "elements": [ … ], "appState": { "gridSize": null, "viewBackgroundColor": "#ffffff" }, "files": {} }
```

Every element shares these fields: `id`, `type`, `x`, `y`, `width`, `height`, `angle:0`, `strokeColor`, `backgroundColor`, `fillStyle:"solid"`, `strokeWidth:1`, `strokeStyle`, `roughness:1`, `opacity:100`, `groupIds:[]`, `frameId:null`, `roundness`, `seed`, `version:1`, `versionNonce`, `isDeleted:false`, `boundElements:[]`, `updated:1`, `link:null`, `locked:false`. Use small fixed integers for `seed`/`versionNonce`/`updated` (never random/time — the plugin rewrites them on save).

### rectangle (node / class box / participant header)
`"type":"rectangle"`, `"roundness":{"type":3}`, `backgroundColor` = the design-system fill for its role. `boundElements` lists its label text **and every arrow touching it** (see binding).

### text (always bound — never free-floating)
`"type":"text"` with `text`, `rawText`, `originalText` (same string), `fontSize`, `fontFamily:2` (legible; `1`/`5` only for a deliberately hand-drawn look), `textAlign:"center"`, `verticalAlign:"middle"`, `lineHeight:1.25`, and a `containerId` pointing at the rectangle (node label) or arrow (edge label) it belongs to. Multi-line text (class compartments) uses `\n` in `text` and `textAlign:"left"`.

### arrow (edge / message / relation)
`"type":"arrow"`, `points` is a polyline relative to the arrow's `x,y` (`[[0,0],…,[dx,dy]]`), `endArrowhead` set, `startArrowhead` usually null. `strokeStyle:"dashed"` + async color for async. **Binding is reciprocal** (below). `boundElements` holds the arrow's one label text.

Arrowheads (for class relations especially): `"arrow"` (default), `"triangle"` (inheritance/realization, point at parent), `"diamond"` (composition/aggregation, at the whole), `"dot"`, `"bar"`, or `null`.

### line (lifeline / divider / mindmap branch)
`"type":"line"`, `points` polyline, no arrowheads. Used for sequence lifelines (vertical dashed) and class-box compartment dividers.

### ellipse / diamond (shape variety)
`"type":"ellipse"` (mindmap nodes, start/end), `"type":"diamond"` (decisions). Same shared fields; bind a label the same way.

## The strict rules (all mandatory)

1. **Reciprocal binding = arrows follow dragged nodes.** Every arrow has `startBinding`/`endBinding` → `{elementId, focus:0, gap:4}` pointing at its endpoint shapes, **and** each of those shapes lists the arrow in its own `boundElements` (`{id, type:"arrow"}`). Missing the shape side leaves arrows behind on drag. (Sequence message arrows are the one exception — they attach to a time axis, not shapes, so they stay unbound; lifelines + headers are grouped instead.)
2. **One bound label per node, one per edge.** A node has exactly one `text` (its title) bound via `containerId`. An edge label is a `text` bound to the arrow. **Never** place a second text at a node, and **never** a free-floating midpoint label — those are the doubled-title and label-on-box bugs.
3. **Stable ids** so refresh updates in place: `rect-<id>`, `text-<id>`, `arrow-<from>-<to>`, `label-<from>-<to>`; for sequence `life-<id>`, `msg-<j>`; for class `class-<name>`.
4. **Deterministic positions** — compute every `x`/`y` from the layout formulas; never randomize. On refresh, keep existing positions for unchanged elements.
5. **Run the collision check before writing** (layout-algorithms § collision): no node box, node label, or edge label may overlap another. If they do, widen spacing or shorten labels and recompute.
6. **Group multi-element units** with a shared `groupIds` entry (a sequence participant's header+label+lifeline; a class box's rectangle+compartment text) so they move together.

## Per-diagram layout

Each diagram type has exact constants and a placement formula in `layout-algorithms.md`:

- **graph / flowchart** → layered (sources left → sinks right), barycenter ordering, routed edges.
- **sequenceDiagram** → participant columns + dashed lifelines + timed message rows + self-loops.
- **classDiagram** → class boxes (title / attributes / methods compartments) laid out layered, relation arrows with semantic arrowheads.
- **mindmap** → central root + radial branches, recursing outward.

Read the matching section, apply the design-system colors/sizes, then encode with the element schemas above.

## Overwrite policy

When a skill is **invoked to write a canvas**, writing it is the intent — create if absent, **rebuild in place** if present (and note in the report if a rebuild may have replaced manual edits). **Never delete a file** — overwrite in place only; that's the one hard guard. The conservative, edit-preserving path is `refresh-vault`, which flags a hand-edited canvas as stale rather than rebuilding it.

> Prefer not to hand-author a particular diagram? The Obsidian-Excalidraw plugin can also convert a pasted Mermaid block (*Create new drawing → Mermaid to Excalidraw*) — a manual escape hatch, not the pack's method.
