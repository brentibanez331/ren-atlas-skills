# Vault layout

The `projects/` subtree **mirrors the source repository's directory structure**, so browsing the vault feels like browsing the code. Keep the `Architecture/` root minimal.

```
Architecture/
├── _index.md                        # map-of-content (system Mermaid + grouped links)
├── System.canvas                    # native clickable system map
├── System.excalidraw.md             # hand-authored system canvas
├── <domain>.excalidraw.md           # optional per-domain canvases
├── projects/                        # MIRRORS THE REPO TREE (not grouped by kind)
│   └── <relPath>.md                 #   project at repo path <relPath> → projects/<relPath>.md
│                                    #   e.g. repo `services/api` → projects/services/api.md
│                                    #        repo `packages/ui/core` → projects/packages/ui/core.md
├── flows/                           # capability deep-dives (map-flow)
│   ├── _flows.md                    # flows index (stays at flows/ root)
│   └── <slug>/                      # one folder per flow
│       ├── <slug>.md
│       └── <slug>.<diagram>.excalidraw.md
└── .atlas/                          # machine artifacts (manifest, graph, diagrams, summaries, state, flows/)
```

## Placement: mirror the repo

Each project's note path is derived from where the project lives in source — **not** from its `kind`:

- **relPath** = the project's `root` relative to its scan root (the matching `roots[].path` in the manifest).
- Note → `Architecture/projects/<relPath>.md`. The **leaf directory becomes the filename**; parent dirs become folders:
  - `services/api` → `projects/services/api.md`
  - `packages/ui/core` → `projects/packages/ui/core.md`
- **Single-project repo** (project root *is* the scan root, so relPath is empty) → `projects/<root-basename>.md`.
- **Multiple separate repos** (more than one scan root) → namespace by repo so they can't collide: `projects/<root-basename>/<relPath>.md`.

`kind` still drives node **colors** (design system) and the link grouping inside `_index.md`, but it never decides the folder.

## Stable id vs filename — wikilinks keep working

The **filename is the leaf basename** (e.g. for repo path `services/api`, the file is `api.md`), but each project's stable **`atlas-id`** (e.g. `services-api`) is what `graph.json` edges, `summaries.json`, and Canvas node-ids use. To keep `[[<atlas-id>]]` wikilinks resolving even though the file is named by basename, **every note carries `aliases: [<atlas-id>]` in its frontmatter**.

- Cross-note references stay `[[<atlas-id>]]` (unique and collision-proof) and resolve via the alias.
- Same-basename notes in different folders (`projects/a/client.md`, `projects/b/client.md`) coexist fine — links go by the unique alias, not the basename.

## Wikilinks vs explicit paths

- **Wikilinks `[[<atlas-id>]]` resolve via the note alias regardless of folder** — unaffected by where a note lives or moves. Use them for all cross-note references.
- **These artifacts store explicit vault-relative paths** and MUST point at the mirrored location:
  - `summaries.json` `note` field → `Architecture/projects/<relPath>.md`
  - `System.canvas` / `<domain>.canvas` file-nodes `"file"` → `Architecture/projects/<relPath>.md`
