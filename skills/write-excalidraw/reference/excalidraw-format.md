# How Excalidraw canvases are produced

**Don't hand-place coordinates.** Layout is done by **dagre** — the same layered graph-layout engine Mermaid's flowcharts use under the hood. It positions nodes without overlap, routes edges around nodes (real bend points), and lets us emit correct reciprocal bindings so arrows follow a dragged node. That fixes — at the source — every layout/overlap/label/drag problem hand-placing created.

`graph.json` is the source of truth; the Excalidraw canvas is a dagre rendering of it.

## Primary path: the bundled converter (`scripts/convert.mjs`)

Pure Node + [`@dagrejs/dagre`](https://github.com/dagrejs/dagre) (~2 MB, no browser/DOM). Reads `graph.json` (+ `manifest.json` for role colors) and writes a valid `.excalidraw.md`:

```
npm install --prefix <skill>/scripts          # once
node <skill>/scripts/convert.mjs \
  --graph <vault>/Architecture/.atlas/graph.json \
  --manifest <vault>/Architecture/.atlas/manifest.json \
  --out <vault>/Architecture/System.excalidraw.md
```

It produces: dagre-laid-out rectangles coloured by `kind`, one bound label per node, arrows with `startBinding`/`endBinding` **and** reciprocal `boundElements` on both rectangles (drag works), routed polyline `points`, dashed orange async edges, and one short bound label per edge — all per the design system.

**Overwrite policy:** the script **refuses if the output exists** (exit 3). Pass `--force` only when the user explicitly asks to regenerate/update that canvas — and warn that it discards manual edits to that drawing. It overwrites in place; it never deletes.

## Fallback path: in-plugin conversion (zero deps, manual)

The [Obsidian-Excalidraw plugin](https://github.com/zsviczian/obsidian-excalidraw-plugin) bundles Excalidraw's own [`mermaid-to-excalidraw`](https://github.com/excalidraw/mermaid-to-excalidraw) converter (also dagre). If the user prefers no Node dependency: in Obsidian, *Excalidraw: Create new drawing* → **Mermaid to Excalidraw** → paste the view's `.mmd` (or the Mermaid embedded in `_index.md`) → save. The plugin writes the file; you write nothing. (Running `mermaid-to-excalidraw` headless in Node is avoided on purpose — mermaid needs a real browser DOM, so it's flaky outside Obsidian; the bundled dagre converter sidesteps that.)

## Fidelity notes

- dagre layout is strongest on flowchart-style DAGs — what our views are.
- Role colors come from `manifest.kind` via the design-system palette; bespoke styling (exact fonts, hand-drawn roughness) is applied after, in Excalidraw, if wanted.
- A generated canvas becomes the **user's** to edit. `refresh-vault` regenerates the source `graph.json`/`.mmd` and flags the canvas stale rather than overwriting an edited drawing (unless the user asks to regenerate).

---

## Appendix: hand-authoring a scene (rarely needed)

You normally never need this — conversion is the path. Kept only for the rare case of patching a scene by hand or understanding the file. If you hand-author, you own layout and bindings yourself (see `layout-algorithms.md` and the reciprocal-binding rule below).

### File envelope

An `.excalidraw.md` file, in order: YAML frontmatter with `excalidraw-plugin: parsed` (+ `tags: [excalidraw]`); a banner line; `# Excalidraw Data`; `## Text Elements` (one `<rawText> ^<id>` per text element, for search indexing); `## Drawing` with a ```json fence holding the scene, wrapped in `%%` comment markers. See `blank.excalidraw.md` for exact placement. Prefer plain `json` over `compressed-json`.

### Scene JSON

```json
{ "type": "excalidraw", "version": 2,
  "source": "https://github.com/zsviczian/obsidian-excalidraw-plugin",
  "elements": [], "appState": { "gridSize": null, "viewBackgroundColor": "#ffffff" }, "files": {} }
```

`elements`, `appState`, `files` are required. Element types: `rectangle` (node box), `text` (label bound via `containerId` to a rect or arrow), `arrow` (edge with `startBinding`/`endBinding`).

**Reciprocal binding (the drag fix).** A connected arrow must appear in BOTH endpoint rectangles' `boundElements` (`{id, type:"arrow"}`) *and* have `startBinding`/`endBinding` pointing at those rectangles. Miss the rectangle side and dragging a node leaves the arrow behind. Each rectangle's `boundElements` lists its one text label plus every arrow touching it.

**Labels.** Bind an edge label to its arrow (`containerId` = arrow id; arrow lists it in `boundElements`) — never a free-floating midpoint text. Exactly one bound label per node and per edge.

**Layout.** Deterministic only; follow [`../../../references/layout-algorithms.md`](../../../references/layout-algorithms.md) including its label-aware collision pass. But really: convert from Mermaid instead.
