---
name: refresh-vault
description: Detects when tracked project code has changed since the atlas vault was last generated and updates only the affected notes and diagrams, preserving manual edits. Uses git status/diff or file mtimes as the change signal, re-runs map/detect/diagram only for changed projects and their neighbors, and rewrites only the content between atlas:generated markers. Use to update/refresh/sync an existing architecture vault, or on a schedule, to keep the atlas a living knowledge base instead of a one-shot dump.
---

# refresh-vault

Incrementally update an existing atlas vault from current code. Stage 6 — what makes the pack a *living* knowledge base. Does the minimum work and never clobbers human edits.

## Inputs

- **Vault** — `ATLAS_VAULT` or argument. Must already contain `Architecture/.atlas/` with `manifest.json`, `graph.json`, and `state.json` (if `state.json` is absent, treat this as a first run: do a full generate and create it).
- The repos/roots the manifest covers (their `root` paths are in the manifest).

## State file — `<vault>/Architecture/.atlas/state.json`

```json
{ "version": "1",
  "lastRun": "<ISO timestamp>",
  "roots": [ { "path": "/abs/root", "vcs": "git", "commit": "<sha>" } ],
  "projectFingerprints": { "<projectId>": "<sha-or-mtime-hash>" } }
```

## Procedure

### 1. Compute the change set (cheap signal first)

For each root:
- **git roots**: `git -C <root> diff --name-only <state.commit> HEAD` plus `git -C <root> status --porcelain` for uncommitted changes. Map changed file paths → owning project via the manifest `root` prefixes.
- **non-git roots**: compare current file mtimes (or a content hash of manifest + source dirs) against `projectFingerprints`.

Result: a set of **changed projects**. Also flag **structural changes** — a new/removed/renamed project directory, or a changed project manifest (`package.json`/`go.mod`/etc.) — these are higher impact.

If nothing changed, report "vault up to date" and stop.

### 2. Decide what to regenerate (changed + blast radius)

Connections are cross-project, so a change can affect a neighbor's edges:

- **Changed project P** → re-run `detect-connections` *for P* (re-scan P's outgoing edges) and re-derive incoming edges to P from P's neighbors.
- **The neighbors of P** → their neighbor diagrams and "Talks to/Used by" lists may shift, so mark them for note/diagram regeneration too (1-hop).
- **Structural change** (added/removed/renamed project) → re-run `map-project` to refresh the manifest (at least for the affected root), then treat the added/removed node's neighbors as changed. A removed project's note is marked stale, not silently deleted — leave it and append a `> [!warning] Project no longer found` line inside the generated region, unless the user asked to prune.
- Unchanged projects far from the change are **left untouched**.

Update `graph.json` and `manifest.json` in place for the affected slice only.

### 3. Regenerate affected outputs — between markers only

For each affected note, rewrite **only** the text between:

```
<!-- atlas:generated:start -->  …  <!-- atlas:generated:end -->
```

Everything outside those markers (the user's `## Notes`, decisions, anything they added) is preserved verbatim. If a note is missing the markers (hand-created, or pre-dates the pack), do **not** overwrite it — skip it and report it so the user can decide.

Regenerate affected `diagrams/*.mmd` (changed project's neighbor view, the system view if topology changed, affected domain views) by re-invoking the `generate-mermaid-architecture` logic for just those, then re-embed them via the `write-excalidraw` logic.

For `.excalidraw.md` canvases: a generated/converted canvas is **owned and edited by the user** — do not rewrite it by default. Refresh regenerates the source `graph.json`/`diagrams/*.mmd` (and the Mermaid embedded in the notes); if a project's diagram changed, **flag the matching `.excalidraw.md` as stale** in the report rather than clobbering it. Only when the user explicitly asks to regenerate a canvas, re-run `write-excalidraw`'s `scripts/convert.mjs --force` for that file (warning that manual edits to it are lost). Never delete a canvas.

For `.canvas` files (from `write-canvas`): same idea via stable node/edge ids (node id = project id, edge id = `<from>__<to>__<protocol>`). Update labels/colors and add/remove nodes for changed edges, but **preserve the position of any node that already exists** (the user may have arranged it) and never touch nodes/edges whose ids aren't graph-derived (hand-added). Canvas JSON can't hold `atlas:generated` markers, so stable-id + position-respect *is* the preservation contract — see `write-canvas`.

For **flows** (from `map-flow`): for each `.atlas/flows/<slug>.json`, recompute the `fingerprint` of its `sourceFiles`. If any changed, **flag that flow as stale** in the report (name the flow and which traced files moved) — do **not** auto-rewrite it; a flow trace is curated, and re-tracing is `map-flow`'s job when the user asks. Never edit or delete a flow note. A flow whose `sourceFiles` are unchanged is left untouched.

### 4. Refresh the caches and state

- Rebuild affected entries in `summaries.json` (so `load-session-context` reflects reality).
- Update `state.json`: new `lastRun`, new per-root `commit`, new `projectFingerprints` for regenerated projects.

## Done criteria & report

Report concisely: changed projects, blast-radius projects pulled in, notes/diagrams/canvases updated, **stale flows** (whose traced files changed), and anything **skipped or flagged** (missing markers, removed projects, canvases that needed full regeneration). Surfacing skips is mandatory — silent omission would read as "everything's current" when it isn't.

## Notes

- The marker contract is shared with `write-excalidraw` — both must use the exact `atlas:generated:start/end` strings.
- Prefer git signal over mtimes when a root is a git repo; mtimes are the fallback for non-git or vendored trees.
- Idempotent: running it twice with no code change must produce no writes.
