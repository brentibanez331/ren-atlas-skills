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
    { "id": "text-web-frontend", "type": "text" }
  ],
  "updated": 1, "link": null, "locked": false
}
```

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

For an **async** edge set `"strokeStyle": "dashed"`. `points` are relative to the arrow's `x`/`y`; bindings keep it attached when boxes move, so exact points only need to be roughly right.

## Rules for `write-excalidraw`

- Stable `id`s: `rect-<projectId>`, `text-<projectId>`, `arrow-<from>-<to>` — lets `refresh-vault` update elements in place instead of duplicating.
- Every `text` whose label you want indexed must also appear under `## Text Elements` as `<rawText> ^<id>`.
- Deterministic layout (grid/layered). Never randomize positions — it explodes diffs on refresh.
- `seed`/`versionNonce`/`updated` can be small fixed integers; the plugin rewrites them on first save. Do not call a random function to set them (and note: random/time APIs are unavailable in workflow scripts anyway).
