# Vault layout

The canonical structure of the atlas vault. Keep the `Architecture/` root **minimal** — only the system map and the index live there; project notes and flows are grouped into folders.

```
Architecture/
├── _index.md                     # map-of-content (system Mermaid + grouped links)
├── System.canvas                 # native clickable system map
├── System.excalidraw.md          # hand-authored system canvas
├── <domain>.excalidraw.md        # optional per-domain canvases
├── projects/                     # one note per project, grouped by kind
│   ├── apps/                     # kind: app | website | mobile
│   ├── services/                 # kind: service | function
│   ├── libs/                     # kind: lib
│   └── tools/                    # kind: tool       (kind: unknown → projects/ root)
├── flows/                        # capability deep-dives (map-flow)
│   ├── _flows.md                 # flows index (stays at flows/ root)
│   └── <slug>/                   # one folder per flow
│       ├── <slug>.md             # the trace note
│       └── <slug>.<diagram>.excalidraw.md   # its diagram canvas(es)
└── .atlas/                       # machine artifacts (manifest, graph, diagrams, summaries, state, flows/)
```

## kind → `projects/` subfolder

| `kind` | folder |
|---|---|
| `app`, `website`, `mobile` | `projects/apps/` |
| `service`, `function` | `projects/services/` |
| `lib` | `projects/libs/` |
| `tool` | `projects/tools/` |
| `unknown` | `projects/` (root) |

Note filenames stay `<id>.md` (e.g. `app-web.md`) — only the **folder** changes. The kind prefix already in an id (`app-`, `service-`, `lib-`) is independent of the folder; both can coexist.

## Wikilinks vs explicit paths

- **Wikilinks `[[<id>]]` resolve by note name**, so they are *unaffected* by which folder a note lives in. Use them freely for all cross-note references (`_index`, flow notes, "Talks to"/"Used by"). Moving a note never breaks a wikilink.
- **These artifacts store explicit vault-relative paths** and MUST point at the grouped location:
  - `summaries.json` `note` field → `Architecture/projects/<group>/<id>.md`
  - `System.canvas` / `<domain>.canvas` file-nodes `"file"` → `Architecture/projects/<group>/<id>.md`
  - a flow's note path (in `.atlas/flows/<slug>.json`, if recorded) → `flows/<slug>/<slug>.md`

When in doubt: prefer a wikilink (location-independent); use an explicit path only where the format requires one (Canvas file-nodes, JSON caches).
