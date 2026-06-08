---
name: write-canvas
description: Writes the architecture atlas as native Obsidian Canvas (.canvas) files — no plugin required. Each project becomes a clickable file-node linking to its Markdown note, edges carry protocol labels and attach to the right sides, and domains become group boxes. Produces a navigable system canvas and optional per-domain canvases from the atlas manifest and connection graph. Use when the user wants an Obsidian Canvas / .canvas view of their architecture, or a clickable map where nodes open the underlying project notes. A persistence target alongside write-excalidraw; both consume the same manifest + graph.
---

# write-canvas

Persist the atlas as **native Obsidian Canvas** files. This is the most navigable output: Canvas is built into Obsidian (no plugin), and a canvas node can be a `file` node that **links to a project's note** — click it and the note opens. That makes the system canvas a real map of the codebase, not just a picture.

A sibling of `write-excalidraw`. Both read the same inputs; pick Canvas for a clickable, native, file-linked map, Excalidraw for a free-form hand-drawn aesthetic. Running both is fine.

## Inputs

- `manifest.json` and `graph.json` under `.atlas/` (from map-project / detect-connections). Ask if missing.
- **Vault path** — resolve per [vault-resolution](../../references/vault-resolution.md) (explicit arg > `ATLAS_VAULT` > recorded in memory > ask). Required.
- Project notes (`Architecture/<id>.md`) if they exist — produced by `write-excalidraw`. If present, nodes link to them; if absent, the skill degrades gracefully (see below) and still works standalone.

## Read these first

- [`reference/json-canvas.md`](reference/json-canvas.md) — the `.canvas` JSON format (nodes, edges, groups, colors, validation).
- [`../../references/design-system.md`](../../references/design-system.md) — colors by role, edge conventions (Canvas can't dash, so async = color + label suffix), sizing.
- [`../../references/layout-algorithms.md`](../../references/layout-algorithms.md) — layered layout (the architecture default) + edge-side selection.

## What to write

```
<vault>/Architecture/
├── System.canvas              # whole system, layered
├── <domain>.canvas            # one per tag, if the manifest uses domains
└── .atlas/summaries.json      # ensure it exists (write if absent) so load-session-context works
```

Optionally, per-project neighbor canvases (`<id>.neighbors.canvas`) using the radial layout — only if the user asks; the per-project Markdown note already embeds a Mermaid neighbor view.

## Building a canvas from the graph

### Nodes

For each graph node:

- **Project, note exists** → a **`file` node** pointing at the note's vault-relative path per [vault-layout](../../references/vault-layout.md): `Architecture/projects/<relPath>.md`, where `<relPath>` mirrors the project's repo path (leaf dir = filename). Size 260×80. This is the win — the node is a live link. (Canvas file-nodes need the **explicit path**, so use the mirrored path — not a bare `Architecture/<id>.md`.)
- **Project, no note yet** → a **`text` node** with the project name (Markdown `**name**`), 200×70. Warn that running `write-excalidraw` first upgrades these to clickable file-nodes.
- **External** → a muted **`text` node** (name + kind), using the external color from the design system.

Color every node by `kind` per the design system (Canvas preset number or hex — be consistent within a file; prefer hex so it matches Excalidraw exactly).

Node `id` = the graph node id (sanitize only if needed, keep stable). Stable ids are what let `refresh-vault` update in place.

### Edges

For each graph edge, one canvas edge:
- `fromNode` = `edge.from`, `toNode` = `edge.to`.
- `label` = protocol (+ channel if short), append ` (async)` for async edges.
- `toEnd: "arrow"`, `fromEnd: "none"` — direction = caller/producer → callee/consumer.
- `color`: default for sync; the async color from the design system for async edges (carries the meaning dashed would).
- `fromSide`/`toSide`: choose by dominant axis between the two nodes' centers (see layout reference).
- `id` = `<from>__<to>__<protocol>` (stable, unique).

### Groups (domains)

If the manifest uses `tags`, emit a `group` node per domain that encloses its member nodes (compute bounding box + padding), with `label` = domain name. **Group nodes must come first in the `nodes` array** or they render on top and hide their contents.

### Layout

Use the **layered** algorithm from the layout reference (sources left → stores right), barycenter ordering within ranks. Deterministic coordinates only. For domain canvases, lay out just that domain's nodes plus their cross-domain neighbors (collapsed).

## Refresh-safety (the Canvas analog of generated markers)

Canvas files are pure JSON — they can't carry `atlas:generated` comment markers. So preservation works by **stable id + position respect** instead, and `refresh-vault` follows the same contract:

- Nodes/edges whose id comes from the graph are **owned** by the pipeline — refresh may update their label/color or remove them if the edge disappears.
- A node's **position is preserved if it already exists** — refresh only computes coordinates for new nodes. Never reset x/y of an existing node; the user may have arranged it.
- Any node/edge whose id is **not** graph-derived (the user added it by hand) is left completely untouched.

Document this in your hand-off so the user knows their manual arrangement survives.

## Validation before writing

Per the canvas reference: unique ids across all nodes and edges; every edge `fromNode`/`toNode` references an existing node; all coords/sizes are integers; consistent color format; groups ordered first. A canvas that fails any of these won't open in Obsidian.

## Done criteria & hand-off

Report files written, node/edge/group counts, and how many nodes are clickable file-nodes vs text-only (and that running `write-excalidraw` upgrades the rest). Tell the user to open `System.canvas` in Obsidian to confirm, and that `refresh-vault` keeps it current while preserving their arrangement.
