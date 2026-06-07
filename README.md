# ren-atlas-skills

A portable pack of seven [Claude Code](https://docs.claude.com/en/docs/claude-code) skills that turn one-or-many codebases into a **living, Obsidian-based architecture atlas**.

Point it at a single monorepo (Nx, Turborepo, pnpm workspaces, Lerna, Bazel) **or** a handful of separate repos. It discovers the projects, works out how they talk to each other, draws the system at multiple zoom levels, writes everything into an Obsidian vault as linked notes + Excalidraw canvases, and keeps it up to date as the code changes — while feeding compact, scope-aware context back into future Claude sessions.

```
                                                       ┌─▶ write-excalidraw  (hand-drawn canvas)
map-project ─▶ detect-connections ─▶ generate-mermaid ─┤
  (discover)       (relate)            (visualize)      └─▶ write-canvas      (native, file-linked)
                                                                  │ (persist)
                                    load-session-context ◀── refresh-vault ◀─┘
                                         (recall)             (maintain)
```

Each skill is useful on its own, but they chain through two shared JSON contracts (`manifest.json` and `graph.json`) so the whole pipeline composes cleanly. The two persistence skills are alternatives (or run both): `write-canvas` for a clickable native map, `write-excalidraw` for a free-form hand-drawn one.

## The seven skills

| Skill | Stage | Reads | Writes |
|-------|-------|-------|--------|
| [`map-project`](skills/map-project) | Discover | a root path *or* explicit paths | `manifest.json` |
| [`detect-connections`](skills/detect-connections) | Relate | `manifest.json` | `graph.json` |
| [`generate-mermaid-architecture`](skills/generate-mermaid-architecture) | Visualize | `graph.json` + `manifest.json` | `diagrams/*.mmd` |
| [`write-excalidraw`](skills/write-excalidraw) | Persist | manifest + graph + diagrams | vault notes + `.excalidraw.md` + `summaries.json` |
| [`write-canvas`](skills/write-canvas) | Persist | manifest + graph (+ notes) | `.canvas` files with file-linked nodes |
| [`load-session-context`](skills/load-session-context) | Recall | vault `summaries.json` | structured context text (stdout) |
| [`refresh-vault`](skills/refresh-vault) | Maintain | vault + repos (git/mtime) | updated notes/diagrams/canvases + `state.json` |

## Layout-agnostic by design

Connections are resolved by **project identity** (package name, service name, port, URL host, queue subject), not by filesystem proximity. So a `fetch(process.env.API_GATEWAY_URL)` in `~/code/web` resolves to the `api-gateway` service living in a completely separate repo at `~/work/backend`. One monorepo or ten loose repos — same graph.

## Where artifacts live

Everything the pipeline produces is stored under a single `.atlas/` directory inside your chosen Obsidian vault:

```
<vault>/
└── Architecture/
    ├── _index.md                 # map-of-content: system diagram + links to every project
    ├── <project>.md              # one generated note per project
    ├── System.canvas             # native Obsidian Canvas: clickable, file-linked system map
    ├── System.excalidraw.md      # editable Excalidraw canvas of the whole system
    ├── <domain>.excalidraw.md    # optional per-domain canvases
    └── .atlas/                   # machine artifacts (the pipeline's working state)
        ├── manifest.json         # output of map-project
        ├── graph.json            # output of detect-connections
        ├── diagrams/*.mmd        # output of generate-mermaid-architecture
        ├── summaries.json        # compact per-project context for load-session-context
        └── state.json            # last-generation commit/mtime for refresh-vault
```

The vault path is supplied per-run (argument) or via the `ATLAS_VAULT` environment variable. If you run `map-project`/`detect-connections` before choosing a vault, they fall back to a `.atlas/` directory in the current working directory, and `write-excalidraw` relocates it into the vault.

## Preserving your edits

Generated regions inside every note are wrapped in markers:

```markdown
<!-- atlas:generated:start -->
...regenerated content...
<!-- atlas:generated:end -->
```

`refresh-vault` only ever rewrites content **between** these markers. Anything you write outside them (notes, decisions, TODOs) is preserved across refreshes. This is what turns the pack from a one-shot generator into a living knowledge base.

## Install

These are standard Claude Code skills (a folder with a `SKILL.md`). Install however your setup expects — e.g. symlink or copy the `skills/*` directories into your agent's skills directory, or point a marketplace/config at this repo. Each skill folder is self-contained.

## Schemas & shared references

The two shared contracts are formally defined in [`schemas/`](schemas):

- [`manifest.schema.json`](schemas/manifest.schema.json) — discovered projects
- [`graph.schema.json`](schemas/graph.schema.json) — the connection graph

Cross-skill design guidance lives in [`references/`](references) (referenced by the visualize/persist skills the same way they reference the schemas):

- [`design-system.md`](references/design-system.md) — one visual language (color by role, edge conventions, contrast/typography floors) across Mermaid, Excalidraw, and Canvas
- [`layout-algorithms.md`](references/layout-algorithms.md) — deterministic layouts; layered-by-dependency-depth is the architecture default
- [`mermaid-syntax.md`](references/mermaid-syntax.md) — error-prevention rules so generated Mermaid always renders

## License

MIT — see [LICENSE](LICENSE).
