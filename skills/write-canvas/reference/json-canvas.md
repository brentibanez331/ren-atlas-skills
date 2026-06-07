# JSON Canvas (`.canvas`) reference

What `write-canvas` must produce so the file opens natively in Obsidian. JSON Canvas is an open spec; Obsidian implements it. A `.canvas` file is plain JSON with two top-level arrays.

```json
{ "nodes": [ … ], "edges": [ … ] }
```

Both are optional, but a useful canvas has both.

## Nodes

Every node shares: `id` (string, unique), `type` (`text`|`file`|`link`|`group`), `x`, `y`, `width`, `height` (all **integers**, pixels), and optional `color` (hex `"#RRGGBB"` or preset `"1"`–`"6"`).

### `text` node
Plain text / Markdown. Used here for externals and for projects without a note yet.
```json
{ "id": "stripe", "type": "text", "x": 1200, "y": 80, "width": 200, "height": 70,
  "text": "**Stripe**\nexternal · saas", "color": "#f1f3f5" }
```

### `file` node — the important one
References a vault file; renders as a live, clickable embed/link. This is how an atlas node opens its project note.
```json
{ "id": "api-gateway", "type": "file", "x": 320, "y": 60, "width": 260, "height": 80,
  "file": "Architecture/api-gateway.md", "color": "#d0bfff" }
```
`file` is **vault-relative**. Optional `subpath` (`"#Heading"`) deep-links into the note.

### `group` node
A labeled container for a domain. Must be listed **before** the nodes it contains (array order = z-order; first = bottom).
```json
{ "id": "dom-payments", "type": "group", "x": 280, "y": 20, "width": 640, "height": 360,
  "label": "Payments", "color": "#a5d8ff" }
```

### `link` node (rarely needed)
External URL: `{ "type": "link", "url": "https://…", … }`.

## Edges

```json
{ "id": "api-gateway__accounts__grpc",
  "fromNode": "api-gateway", "toNode": "accounts",
  "fromSide": "right", "toSide": "left",
  "fromEnd": "none", "toEnd": "arrow",
  "label": "gRPC", "color": "#495057" }
```

- Required: `id`, `fromNode`, `toNode` (both must reference existing node ids).
- `fromSide`/`toSide` ∈ `top|right|bottom|left` — pick by the dominant axis between node centers.
- `fromEnd` default `none`, `toEnd` default `arrow` — keep `toEnd: "arrow"` so direction is explicit.
- `label`, `color` optional. **Canvas edges have no dashed style** — encode async with color + an ` (async)` label suffix (see design system).

## Colors

Preset strings adapt to the user's theme: `"1"` red, `"2"` orange, `"3"` yellow, `"4"` green, `"5"` cyan, `"6"` purple. Or any hex. **Pick one format per file** — prefer hex here so Canvas and Excalidraw share the exact same palette.

## Validation (a canvas that fails these won't open)

1. All node and edge `id`s unique.
2. Every edge `fromNode`/`toNode` references a node that exists.
3. All `x`/`y`/`width`/`height` are integers.
4. Color format consistent (all hex or all presets).
5. Group nodes appear before their member nodes in the array.
6. JSON is valid and strings are properly escaped.
