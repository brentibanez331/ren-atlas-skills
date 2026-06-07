---
name: write-excalidraw
description: Writes the architecture atlas into an Obsidian vault. Creates an Architecture/ folder, generates one Markdown note per project (frontmatter, wikilinks to neighbors, embedded Mermaid neighbor diagram), a system map-of-content index, and sets up editable Excalidraw canvases via the Obsidian-Excalidraw plugin's built-in Mermaid-to-Excalidraw conversion (no hand-placed coordinates). Use after generate-mermaid-architecture, or when the user wants their architecture written into Obsidian / as Excalidraw canvases. Emits generated-region markers and a summaries.json for the rest of the pipeline.
---

# write-excalidraw

Persist the atlas into an Obsidian vault as linked notes with embedded Mermaid, and set up editable Excalidraw canvases by converting that Mermaid with the plugin. Stage 4 of the pipeline. **Mermaid is the source of truth; the Excalidraw canvas is a conversion of it** — we never hand-place Excalidraw coordinates.

## Inputs

- `manifest.json`, `graph.json`, and `diagrams/*.mmd` under `.atlas/`.
- **Vault path** — `ATLAS_VAULT` or an argument. Required here (this is where everything lands). If artifacts are currently in a cwd `./.atlas/`, move them to `<vault>/Architecture/.atlas/`.

## Read this first

- [`reference/excalidraw-format.md`](reference/excalidraw-format.md) — **the conversion method**: how the Obsidian plugin turns our Mermaid into a laid-out, properly-bound Excalidraw drawing. (Layout, bindings, and styling are the converter's job now, not ours — so `layout-algorithms.md` and the hand-authoring schema are no longer part of this skill's normal path.)

## What to write

```
<vault>/Architecture/
├── _index.md                    # MOC: system Mermaid + links to every project + legend
├── <project-id>.md              # one per project
├── System.excalidraw.md         # created by the plugin when the user converts the system Mermaid (see below)
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

## The Excalidraw canvases — via Mermaid-to-Excalidraw conversion

**We do not write `.excalidraw.md` scene JSON.** The Obsidian-Excalidraw plugin bundles Excalidraw's `mermaid-to-excalidraw` converter, which runs dagre layout and produces correctly-positioned, properly-bound elements. That eliminates the overlap / labels-on-boxes / arrows-don't-follow-drag problems that hand-placed coordinates caused. See [`reference/excalidraw-format.md`](reference/excalidraw-format.md) for the full rationale.

Your job is to make conversion frictionless, not to draw:

1. **Ensure the Mermaid exists.** Confirm `diagrams/system.mmd`, `diagrams/domain.<tag>.mmd`, and the per-project `diagrams/project.<id>.mmd` are present (from `generate-mermaid-architecture`). These already carry the design-system colors via `classDef`.
2. **Embed it where it's convertible.** The per-project note embeds its neighbor Mermaid; `_index.md` embeds the system Mermaid (you already do both). That rendered Mermaid is the paste source.
3. **Document the one-time conversion.** In `_index.md`, inside the generated markers, add a short "Make this editable" note:
   > In Obsidian: *Excalidraw: Create new drawing* → **Mermaid to Excalidraw** → paste the block above (or `diagrams/system.mmd`) → save as `System.excalidraw.md`. Pasting Mermaid into any Excalidraw drawing also auto-converts.
4. **Do not fabricate a `.excalidraw.md`.** The plugin writes it on conversion, with the current envelope and valid bindings. If the user wants you to pre-create the drawing without the plugin, that's the hand-authoring appendix in the format reference — discouraged.

## Done criteria & handoff

Report the notes and `_index.md` written, the per-project/system/domain `.mmd` confirmed present, and the conversion steps for any view the user wants as an editable canvas. Mention that `load-session-context` can now load this vault and `refresh-vault` will keep the Mermaid current (re-converting a canvas is a manual re-paste, since the converted drawing becomes the user's to edit).
