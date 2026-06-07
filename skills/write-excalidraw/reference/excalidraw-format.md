# Excalidraw from Mermaid — the conversion method

**Don't hand-author Excalidraw scenes.** The [Obsidian-Excalidraw plugin](https://github.com/zsviczian/obsidian-excalidraw-plugin) bundles Excalidraw's own [`mermaid-to-excalidraw`](https://github.com/excalidraw/mermaid-to-excalidraw) converter, which runs Mermaid's dagre layout engine and emits correctly-positioned elements **with proper reciprocal bindings**. That solves — at the source — every layout, overlap, label, and "arrows don't follow the node" problem that hand-placing coordinates created.

Since `generate-mermaid-architecture` already produces clean Mermaid, the Excalidraw view is just that Mermaid, converted. **Mermaid is the source of truth; Excalidraw is a rendering of it.**

## Workflow (zero dependencies — the plugin does the work)

1. Ensure the view's Mermaid exists at `<vault>/Architecture/.atlas/diagrams/*.mmd` (system, per-project, per-domain) — produced by `generate-mermaid-architecture`.
2. In Obsidian, create a new Excalidraw drawing (command palette → *Excalidraw: Create new drawing*), open **Mermaid to Excalidraw**, and **paste the `.mmd` contents**. The plugin lays it out and writes the `.excalidraw.md` for you. (Pasting Mermaid directly into an Excalidraw drawing also auto-converts.)
3. Save it as `Architecture/System.excalidraw.md` (or `<domain>.excalidraw.md`). It's now a fully editable, properly-bound drawing.

Because the plugin authors the file, you get the current envelope and valid bindings automatically — no version-drift worries, no hand-placed `x`/`y`.

## What `write-excalidraw` actually does for the Excalidraw view

- It does **not** write `.excalidraw.md` scene JSON.
- It makes the conversion frictionless: confirm the `.mmd` files exist, embed the relevant Mermaid in the notes (the per-project note already embeds its neighbor view; `_index.md` embeds the system view), and tell the user the one-time conversion steps above for any view they want editable.
- The Mermaid carries the design-system colors via `classDef`; the converter maps most of them. Bespoke styling (exact fonts, hand-drawn roughness) is applied *after* conversion, in Excalidraw, if wanted.

## Fidelity notes

- Converter is strongest on **flowcharts** — what our views are. Unsupported shapes (subroutine/hexagon/cylinder) fall back to rectangle; that's fine for architecture.
- Mermaid **subgraphs** (domains) convert with varying fidelity across plugin versions — check domain groupings after converting.
- After conversion the file is the **user's** to edit. `refresh-vault` regenerates the source `.mmd` and flags the canvas as stale rather than overwriting their edited drawing.

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
