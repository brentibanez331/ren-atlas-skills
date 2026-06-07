# Obsidian-Excalidraw `.excalidraw.md` format reference

What `write-excalidraw` must produce so files open in the [Obsidian-Excalidraw plugin](https://github.com/zsviczian/obsidian-excalidraw-plugin) with **no conversion step**.

## File envelope

An `.excalidraw.md` file has these parts, in order:

1. **YAML frontmatter** — must contain `excalidraw-plugin: parsed`. Convention also adds `tags: [excalidraw]`. (`parsed` means the JSON in the file is the human-readable source of truth; the alternative `raw` stores compressed-only.)
2. **A banner line** telling the reader to switch to Excalidraw view (cosmetic but expected).
3. **`# Excalidraw Data`** heading.
4. **`## Text Elements`** — one line per text element: `<rawText> ^<elementId>`. The plugin uses this for search/indexing; the `^id` block-ref must equal the text element's `id` in the JSON.
5. **`## Drawing`** — a fenced code block holding the scene JSON. The plugin reads either:
   - ` ```json ` — plain, human-readable (use this; the plugin re-compresses on next save), **or**
   - ` ```compressed-json ` — Base64+deflate, chunked into 256-char lines.
   Use **plain `json`**. It opens fine and is debuggable/diffable.

The Drawing block is wrapped in Obsidian comment markers `%%` so the large JSON doesn't render in Reading view. See `blank.excalidraw.md` for exact placement.

> **Version drift:** the wrapper has changed across plugin versions. The safest production path is to clone a real blank file created by the user's installed plugin and only replace the scene JSON. `blank.excalidraw.md` is a known-good fallback.

## Scene JSON

The object inside `## Drawing`:

```json
{
  "type": "excalidraw",
  "version": 2,
  "source": "https://github.com/zsviczian/obsidian-excalidraw-plugin",
  "elements": [],
  "appState": { "gridSize": null, "viewBackgroundColor": "#ffffff" },
  "files": {}
}
```

`elements`, `appState`, and `files` are the required fields. `files` is `{}` unless you embed images.

### Element: rectangle (a node box)

```json
{
  "type": "rectangle",
  "id": "rect-web-frontend",
  "x": 100, "y": 100, "width": 180, "height": 60,
  "angle": 0,
  "strokeColor": "#1e1e1e", "backgroundColor": "#e8f0fe",
  "fillStyle": "solid", "strokeWidth": 1, "strokeStyle": "solid",
  "roughness": 1, "opacity": 100,
  "roundness": { "type": 3 },
  "seed": 1, "version": 1, "versionNonce": 1, "isDeleted": false,
  "groupIds": [], "frameId": null, "boundElements": [
    { "id": "text-web-frontend", "type": "text" },
    { "id": "arrow-web-to-gateway", "type": "arrow" }
  ],
  "updated": 1, "link": null, "locked": false
}
```

> **Binding is reciprocal — this is what makes arrows follow a dragged node.** The rectangle's `boundElements` MUST list its text label **and every arrow** that starts or ends on it (`{id: <arrowId>, type: "arrow"}`), in addition to the arrow's own `startBinding`/`endBinding` pointing back at the rectangle. If you set the arrow's bindings but forget to add the arrow to the box's `boundElements`, the box doesn't know about the arrow and **dragging the box leaves the arrow behind.** Every connected arrow appears in both endpoints' `boundElements`.

### Element: text (a node label, bound to its rectangle)

```json
{
  "type": "text",
  "id": "text-web-frontend",
  "x": 110, "y": 120, "width": 160, "height": 25, "angle": 0,
  "strokeColor": "#1e1e1e", "backgroundColor": "transparent",
  "fillStyle": "solid", "strokeWidth": 1, "strokeStyle": "solid",
  "roughness": 1, "opacity": 100, "roundness": null,
  "seed": 2, "version": 1, "versionNonce": 2, "isDeleted": false,
  "groupIds": [], "frameId": null, "boundElements": [],
  "updated": 1, "link": null, "locked": false,
  "text": "web-frontend", "rawText": "web-frontend",
  "fontSize": 16, "fontFamily": 1,
  "textAlign": "center", "verticalAlign": "middle",
  "containerId": "rect-web-frontend",
  "originalText": "web-frontend", "lineHeight": 1.25
}
```

A label bound to a box uses the box's `id` as `containerId`, and the box lists the text in its `boundElements`.

### Element: arrow (an edge, bound to two boxes)

```json
{
  "type": "arrow",
  "id": "arrow-web-to-gateway",
  "x": 280, "y": 130, "width": 120, "height": 0, "angle": 0,
  "strokeColor": "#1e1e1e", "backgroundColor": "transparent",
  "fillStyle": "solid", "strokeWidth": 1,
  "strokeStyle": "solid",
  "roughness": 1, "opacity": 100, "roundness": { "type": 2 },
  "seed": 3, "version": 1, "versionNonce": 3, "isDeleted": false,
  "groupIds": [], "frameId": null, "boundElements": [],
  "updated": 1, "link": null, "locked": false,
  "points": [ [0, 0], [120, 0] ],
  "lastCommittedPoint": null,
  "startBinding": { "elementId": "rect-web-frontend", "focus": 0, "gap": 4 },
  "endBinding": { "elementId": "rect-api-gateway", "focus": 0, "gap": 4 },
  "startArrowhead": null, "endArrowhead": "arrow"
}
```

For an **async** edge set `"strokeStyle": "dashed"`. `points` are relative to the arrow's `x`/`y`; bindings keep it attached when boxes move — **but only if both endpoint rectangles also list this arrow in their `boundElements`** (see the reciprocal-binding note above). The arrow's own `boundElements` is for its label, not its endpoints.

**Routing around nodes.** `points` is a polyline (`[[0,0],[dx1,dy1],…,[dxN,dyN]]`), not just two endpoints. For an edge that spans more than one rank and would otherwise cut straight through an intermediate node, add one or two interior bend points so it routes through the gap *between* node rows (offset vertically into the `ROW_GAP` lane). Bound arrows re-route on drag, so interior points only need to clear the nodes at initial layout.

### Element: arrow label (BOUND to the arrow — never free-floating)

This is the fix for labels landing on top of boxes. **Do not create a standalone text element for an edge label.** Instead bind a text element to the arrow via `containerId = <arrow id>`, and list it in the arrow's `boundElements`. Excalidraw then renders the label centered on the line and keeps it there when nodes move.

Add to the arrow:
```json
"boundElements": [ { "id": "label-web-to-gateway", "type": "text" } ]
```

And the label text element:
```json
{
  "type": "text",
  "id": "label-web-to-gateway",
  "x": 330, "y": 122, "width": 40, "height": 20, "angle": 0,
  "strokeColor": "#495057", "backgroundColor": "transparent",
  "fillStyle": "solid", "strokeWidth": 1, "strokeStyle": "solid",
  "roughness": 1, "opacity": 100, "roundness": null,
  "seed": 4, "version": 1, "versionNonce": 4, "isDeleted": false,
  "groupIds": [], "frameId": null, "boundElements": [],
  "updated": 1, "link": null, "locked": false,
  "text": "HTTP", "rawText": "HTTP", "fontSize": 14, "fontFamily": 2,
  "textAlign": "center", "verticalAlign": "middle",
  "containerId": "arrow-web-to-gateway",
  "originalText": "HTTP", "lineHeight": 1.25
}
```

Rules for labels:
- **Exactly one bound label per arrow.** A text element bound to an arrow (`containerId` = arrow id) is auto-placed by Excalidraw at the line midpoint — that is the only correct way to label an edge.
- **Exactly one bound label per node** (`containerId` = rectangle id). Never emit a second title/text element at a node's position — that is what produces the doubled `service` / `api` overlaps.
- Keep edge labels to one short token (`HTTP`, `gRPC`, `auth`, `KMS`). A bound label longer than the arrow gets clipped; abbreviate instead.
- If two edges run between the same pair, give them distinct short labels or merge them into one edge — don't stack two labels on one line.

## Rules for `write-excalidraw`

- Stable `id`s: `rect-<projectId>`, `text-<projectId>` (node label, bound to the rect), `arrow-<from>-<to>`, `label-<from>-<to>` (edge label, bound to the arrow) — lets `refresh-vault` update elements in place instead of duplicating.
- Every `text` whose label you want indexed must also appear under `## Text Elements` as `<rawText> ^<id>`.
- Deterministic layout (grid/layered) following [`../../../references/layout-algorithms.md`](../../../references/layout-algorithms.md), including its **label-aware collision pass** — verify no node box, node label, or edge label overlaps another before emitting. Never randomize positions — it explodes diffs on refresh.
- `seed`/`versionNonce`/`updated` can be small fixed integers; the plugin rewrites them on first save. Do not call a random function to set them (and note: random/time APIs are unavailable in workflow scripts anyway).
