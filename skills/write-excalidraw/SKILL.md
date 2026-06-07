---
name: write-excalidraw
description: Writes the architecture atlas into an Obsidian vault. Creates an Architecture/ folder, generates one Markdown note per project (frontmatter, wikilinks to neighbors, embedded Mermaid neighbor diagram), a system map-of-content index, and hand-authors editable .excalidraw.md canvases to strict positioning/color/size/spacing specs (reciprocal arrow bindings so arrows follow drags, bound labels, collision-checked layout). Never overwrites an existing canvas unless the user explicitly asks to regenerate it. Use after generate-mermaid-architecture, or when the user wants their architecture written into Obsidian / as Excalidraw canvases. Emits generated-region markers and a summaries.json for the rest of the pipeline.
---

# write-excalidraw

Persist the atlas into an Obsidian vault as linked notes with embedded Mermaid, plus hand-authored Excalidraw canvases. Stage 4 of the pipeline. **Excalidraw canvases are hand-authored** to strict specs — you place every element yourself, which gives full control and supports any diagram type.

## Inputs

- `manifest.json`, `graph.json`, and `diagrams/*.mmd` under `.atlas/`.
- **Vault path** — resolve per [vault-resolution](../../references/vault-resolution.md) (explicit arg > `ATLAS_VAULT` > recorded in memory > ask). Required here (this is where everything lands). If artifacts are currently in a cwd `./.atlas/`, move them to `<vault>/Architecture/.atlas/`.

## Read these first (the strict specs)

- [`reference/excalidraw-format.md`](reference/excalidraw-format.md) — the `.excalidraw.md` envelope + element schemas + the **mandatory binding rules** (reciprocal binding, bound labels, stable ids, collision check).
- [`../../references/layout-algorithms.md`](../../references/layout-algorithms.md) — exact positioning: the **layered** layout + spacing constants for the system/domain graphs.
- [`../../references/design-system.md`](../../references/design-system.md) — colors by role, sizes, typography, spacing, edge conventions. Apply to every element.

## What to write

```
<vault>/Architecture/
├── _index.md                    # MOC: system Mermaid + links to every project + legend
├── <project-id>.md              # one per project
├── System.excalidraw.md         # hand-authored system canvas — skipped if it already exists
├── <domain>.excalidraw.md       # likewise, per domain tag, if wanted
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

## The Excalidraw canvases — hand-authored to strict specs

Hand-author each canvas (`System.excalidraw.md`, and per-domain canvases) by placing every element yourself. Follow the three specs exactly — there is no converter; the rigor is what keeps the output clean. The system/domain canvases are **graph/flowchart** form, so use the **layered** layout.

Procedure per canvas:

1. **Lay out nodes** with the layered algorithm and spacing constants from [`layout-algorithms.md`](../../references/layout-algorithms.md) (sources left → stores right, barycenter ordering within ranks). Compute every `x`/`y`; never randomize.
2. **Encode elements** per [`reference/excalidraw-format.md`](reference/excalidraw-format.md): a `rectangle` + one bound `text` per node (filled by role from [`design-system.md`](../../references/design-system.md)); an `arrow` per edge with **reciprocal binding** (the arrow in *both* endpoint rectangles' `boundElements`, so arrows follow a dragged node) + one bound label; routed `points` so multi-rank edges bend around intermediate nodes; dashed + async color for async edges.
3. **Run the collision check** (layout-algorithms § collision) — no node box, node label, or edge label may overlap. Fix spacing/labels and recompute before writing.
4. **Stable ids** (`rect-<id>`, `arrow-<from>-<to>`, …) so `refresh-vault` can update in place.

### Overwrite policy (important)

- **Default: never overwrite or delete an existing canvas.** An `.excalidraw.md` already in the vault is the user's hand-edited drawing — leave it untouched and report it skipped. Never delete a file.
- **Only when the user explicitly asks to regenerate / update / change a specific canvas**, overwrite *that file in place*, warning that manual edits to it are lost. Never regenerate proactively or touch a canvas you weren't asked to.

## Done criteria & handoff

Report the notes and `_index.md` written, the canvases hand-authored, and any existing canvas you **skipped** because it already existed (and that you can regenerate it if they ask). Confirm you ran the collision check. Mention that `load-session-context` can now load this vault and `refresh-vault` keeps the source `.mmd`/`graph.json` current.
