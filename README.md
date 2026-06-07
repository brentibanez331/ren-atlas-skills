# ren-atlas-skills

A portable pack of eight [Claude Code](https://docs.claude.com/en/docs/claude-code) skills that turn one-or-many codebases into a **living, Obsidian-based architecture atlas**.

Point it at a single monorepo (Nx, Turborepo, pnpm workspaces, Lerna, Bazel) **or** a handful of separate repos. It discovers the projects, works out how they talk to each other, draws the system at multiple zoom levels, writes everything into an Obsidian vault as linked notes + Excalidraw canvases, and keeps it up to date as the code changes — while feeding compact, scope-aware context back into future Claude sessions.

```
                                                       ┌─▶ write-excalidraw  (hand-drawn canvas)
map-project ─▶ detect-connections ─▶ generate-mermaid ─┤
  (discover)       (relate)            (visualize)      └─▶ write-canvas      (native, file-linked)
                                                                  │ (persist)
                                    load-session-context ◀── refresh-vault ◀─┘
                                         (recall)             (maintain)
```

Each skill is useful on its own, but they chain through two shared JSON contracts (`manifest.json` and `graph.json`) so the whole pipeline composes cleanly. The two persistence skills are alternatives (or run both): `write-canvas` for a clickable native map, `write-excalidraw` for a free-form hand-drawn one. `map-flow` is orthogonal — a deep dive into a single capability, off to the side of the topology pipeline.

## The eight skills

| Skill | Stage | Reads | Writes |
|-------|-------|-------|--------|
| [`map-project`](skills/map-project) | Discover | a root path *or* explicit paths | `manifest.json` |
| [`detect-connections`](skills/detect-connections) | Relate | `manifest.json` | `graph.json` |
| [`generate-mermaid-architecture`](skills/generate-mermaid-architecture) | Visualize | `graph.json` + `manifest.json` | `diagrams/*.mmd` |
| [`write-excalidraw`](skills/write-excalidraw) | Persist | manifest + graph + diagrams | vault notes + embedded Mermaid + `summaries.json` + `.excalidraw.md` (dagre-laid-out via a bundled converter; in-plugin conversion fallback) |
| [`write-canvas`](skills/write-canvas) | Persist | manifest + graph (+ notes) | `.canvas` files with file-linked nodes |
| [`map-flow`](skills/map-flow) | Deep-dive | a capability + the files/projects it spans | `flows/<slug>.md` (sequence/flow/class Mermaid + evidence) + `.atlas/flows/<slug>.json` |
| [`load-session-context`](skills/load-session-context) | Recall | vault `summaries.json` | structured context text (stdout) |
| [`refresh-vault`](skills/refresh-vault) | Maintain | vault + repos (git/mtime) | updated notes/diagrams/canvases + stale-flow flags + `state.json` |

> **Two granularities.** The topology skills treat each project as one node (system-level map). `map-flow` goes *inside* projects to trace how one capability flows across files and boundaries — a separate file under `flows/`, linked back to the project notes, never poured into the system canvas.

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
    ├── System.excalidraw.md      # editable Excalidraw, dagre-laid-out by the bundled converter
    ├── <domain>.excalidraw.md    # optional per-domain canvases (same converter)
    ├── flows/                    # map-flow deep dives (one capability each, linked back to the notes)
    │   ├── _flows.md             # index of all flows
    │   └── <slug>.md             # e.g. checkout.md — sequence/flow/class Mermaid + evidence
    └── .atlas/                   # machine artifacts (the pipeline's working state)
        ├── manifest.json         # output of map-project
        ├── graph.json            # output of detect-connections
        ├── diagrams/*.mmd        # output of generate-mermaid-architecture
        ├── summaries.json        # compact per-project context for load-session-context
        ├── flows/<slug>.json     # map-flow trace state (sourceFiles + fingerprint) for staleness
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

This repo is a [Claude Code plugin marketplace](https://code.claude.com/docs/en/plugin-marketplaces). In Claude Code:

```
/plugin marketplace add brentibanez331/ren-atlas-skills
/plugin install ren-atlas@ren-atlas-skills
```

All seven skills then load namespaced — e.g. `/ren-atlas:map-project` — and Claude can auto-invoke them by description. Pull later updates with `/plugin marketplace update`.

No `version` is pinned, so each pushed commit is published as the new version. The `schemas/` and `references/` directories ship inside the plugin, so the skills' relative links resolve after install.

> Prefer not to use the plugin system? Each `skills/<name>/` folder also works copied straight into your agent's skills directory; just keep `schemas/` and `references/` siblings of `skills/` so the `../../` links resolve.

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
