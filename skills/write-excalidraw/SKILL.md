---
name: write-excalidraw
description: Writes the architecture atlas into an Obsidian vault. Creates an Architecture/ folder, generates one Markdown note per project (frontmatter, wikilinks to neighbors, embedded Mermaid neighbor diagram), a system map-of-content index, and editable .excalidraw.md canvases in the Obsidian-Excalidraw plugin's native format so they open without conversion. Use after generate-mermaid-architecture, or when the user wants their architecture written into Obsidian / as Excalidraw canvases. Emits generated-region markers and a summaries.json for the rest of the pipeline.
---

# write-excalidraw

Persist the atlas into an Obsidian vault as linked notes + native Excalidraw canvases. Stage 4 of the pipeline.

## Inputs

- `manifest.json`, `graph.json`, and `diagrams/*.mmd` under `.atlas/`.
- **Vault path** — `ATLAS_VAULT` or an argument. Required here (this is where everything lands). If artifacts are currently in a cwd `./.atlas/`, move them to `<vault>/Architecture/.atlas/`.

## Read these first

- [`../../references/design-system.md`](../../references/design-system.md) — colors by role, contrast/typography floors, sync→dashed convention. Apply these to every box, label, and arrow.
- [`../../references/layout-algorithms.md`](../../references/layout-algorithms.md) — the layered layout used to position the scene deterministically.
- [`reference/excalidraw-format.md`](reference/excalidraw-format.md) — the `.excalidraw.md` envelope and element schema (read before writing any canvas).

## What to write

```
<vault>/Architecture/
├── _index.md                    # MOC: system Mermaid + links to every project + legend
├── <project-id>.md              # one per project
├── System.excalidraw.md         # editable canvas of the whole system
├── <domain>.excalidraw.md       # one per domain tag, if any
└── .atlas/
    ├── ... (manifest, graph, diagrams)
    └── summaries.json           # compact context cache for load-session-context
```

### Generated-region markers (critical)

Every note this skill writes wraps its machine-generated body between:

```markdown
<!-- atlas:generated:start -->
…regenerated content…
<!-- atlas:generated:end -->
```

`refresh-vault` only rewrites *between* these markers. Put anything the user might hand-edit (a free "Notes" heading) **outside** them. Never emit a note without these markers — they are the contract that keeps the vault editable.

### Per-project note — `<project-id>.md`

Frontmatter:
```yaml
---
atlas-id: <project id>
type: project
kind: <kind>
language: [<languages>]
framework: [<frameworks>]
tags: [architecture, <domain tags…>]
root: <absolute root path>
---
```

Body (inside the generated markers):
- `# <name>`
- **Talks to** — bullet list of outgoing edges as wikilinks with protocol: `- [[api-gateway]] — HTTP (sync)`. Resolve each `to` to a project note via `[[<id>]]`; externals render as plain text (e.g. `Stripe (saas)`), not links.
- **Used by** — incoming edges, same style.
- **Owns / responsibility** — one line if inferable from kind + entry points; otherwise omit (don't pad).
- An embedded neighbor diagram from stage 3:
  ````markdown
  ```mermaid
  <contents of diagrams/project.<id>.mmd>
  ```
  ````
- A collapsed **Evidence** detail (optional) listing a few edge evidence snippets.

After the closing marker, add a `## Notes` heading left empty for the human.

### Index — `_index.md`

Generated-marked body with: the system Mermaid (`diagrams/system.mmd`) embedded, a legend for the styling conventions, and a grouped list of `[[<id>]]` links (by domain tag if present, else by `kind`).

### summaries.json

Write a compact array consumed by `load-session-context`, one entry per project:
```json
{ "version": "1",
  "projects": [
    { "id": "web-frontend", "name": "web-frontend", "root": "/abs/path",
      "kind": "app", "talksTo": [{"id":"api-gateway","protocol":"http","sync":"sync"}],
      "usedBy": [], "owns": "auth UI, dashboard", "note": "<vault-rel path to note>" }
  ] }
```
Keep `owns` short — it's a token-thrifty summary, not the whole note.

## The Excalidraw canvases

This is the format-correctness part. Read [`reference/excalidraw-format.md`](reference/excalidraw-format.md) before writing any `.excalidraw.md`, and use [`reference/blank.excalidraw.md`](reference/blank.excalidraw.md) as the envelope.

**Most reliable path (prefer this):** if the user already has the Obsidian-Excalidraw plugin installed, ask them to create one blank Excalidraw note in the vault and point you at it. Clone *that* file's exact envelope (frontmatter + banner + section structure + fence language) and only swap in your generated `elements`/`appState`/`files` JSON. This sidesteps any plugin-version drift in the wrapper.

**Otherwise:** copy `reference/blank.excalidraw.md` and replace the `## Drawing` JSON.

### Building the scene JSON

For a canvas, convert graph nodes/edges into Excalidraw elements:
- **Node → one `rectangle` + exactly one `text`** label bound to it (`containerId` = rect id; rect lists the text in `boundElements`). Stable ids `rect-<id>` / `text-<id>`. **Never add a second text at a node** — that produces doubled titles.
- **Edge → one `arrow`** with `startBinding`/`endBinding` referencing the two rectangles' ids — **and add this arrow's id to BOTH endpoint rectangles' `boundElements`** (reciprocal binding). This is mandatory: without the rectangle side, dragging a node leaves its arrows behind. So each rectangle's `boundElements` ends up listing its one text label plus every arrow touching it. Dashed `strokeStyle` for async edges. Stable id `arrow-<from>-<to>`. For an edge crossing more than one rank, add interior `points` so it bends around intermediate nodes rather than through them.
- **Edge label → a `text` bound to the arrow** (`containerId` = arrow id; arrow lists it in `boundElements`), id `label-<from>-<to>`. This is the only correct way to label an edge — a free-floating text element at the midpoint lands on top of boxes. One short label per edge. See the arrow-label section in the format reference.
- Each text element's `rawText` must also be listed under `## Text Elements` as `<rawText> ^<elementId>` (the plugin indexes text there).
- After placing everything, run the **label-aware collision pass** from the layout reference: if any edge label overlaps a node, the spacing is too tight or the label too long — widen `COL_GAP`/`ROW_GAP` or abbreviate, then re-check before writing.

**Layout:** use the layered algorithm and spacing constants from [`layout-algorithms.md`](../../references/layout-algorithms.md) (sources left → stores right, barycenter ordering within ranks). Deterministic coordinates only — do not randomize positions, and on refresh keep existing element positions.

See `reference/excalidraw-format.md` for the exact element field list and a worked minimal example.

## Done criteria & handoff

Report files written and node/edge counts per canvas. Mention that `load-session-context` can now load this vault, and `refresh-vault` will keep it current. Remind the user to open a canvas in Obsidian once to confirm it renders (and, if they used the clone path, that the envelope matched their plugin version).
