---
name: load-session-context
description: Loads a compact, scope-aware architecture summary from an Obsidian atlas vault at the start of a Claude Code session, so the model knows how the current project connects without reading the whole codebase. Returns structured text like "Project: web-frontend. Talks to: api-gateway (HTTP), notification-service (WebSocket). Owns: auth UI, dashboard." Respects scope — given a working directory it loads just that project plus its direct neighbors, saving tokens. Use at session start, when the user asks "what does this service talk to / give me the architecture context", or to prime context before a task.
---

# load-session-context

Emit a token-thrifty architecture briefing from an existing atlas vault. Stage 5 — the read side of the pipeline. This skill **reads only**; it never writes the vault.

## Inputs

- **Vault** — resolve per [vault-resolution](../../references/vault-resolution.md) (explicit arg > `ATLAS_VAULT` > recorded in memory > ask). Read `<vault>/Architecture/.atlas/summaries.json` (produced by `write-excalidraw`/`refresh-vault`). If it's missing, fall back to reading the per-project notes' frontmatter + "Talks to"/"Used by" sections (notes live under `Architecture/projects/<group>/<id>.md` per [vault-layout](../../references/vault-layout.md)); if there's no vault at all, tell the user to run the build pipeline first.
- **Scope** (optional but encouraged) — a working directory or a project id. Default scope is the current working directory.

## Scoping (the whole point — don't dump everything)

1. **Resolve the focus project**: match the scope path against each project's `root` in `summaries.json` (longest-prefix match — the deepest root that contains the cwd wins). If scope is a project id, use it directly. If nothing matches, fall back to whole-system mode but say so.
2. **Load a 1-hop neighborhood**, not the full graph:
   - the focus project (full summary), plus
   - every project in its `talksTo` and `usedBy` (name + one-line `owns` + the protocol linking them).
3. Only widen to 2-hop or whole-system if the user explicitly asks ("load the full architecture") or there's no focus project.

This keeps the briefing to a handful of projects even in a 50-project atlas.

## Output format

Plain structured text to stdout — compact, scannable, cheap in tokens. Lead with the focus project, then its neighbors. Example:

```
Project: web-frontend  (app · next/typescript · ~/code/web)
Owns: auth UI, dashboard, billing screens
Talks to:
  → api-gateway          HTTP (sync)
  → notification-service WebSocket (sync)
  → segment              external/saas
Used by: (none)

Neighbors:
- api-gateway (service): fronts auth + billing; talks to → accounts-svc (gRPC), → postgres (db)
- notification-service (service): push/email fan-out; consumes ← events.user.* (queue)
```

Rules:
- One focus project, fully described; neighbors get a single line each.
- Include protocol + sync/async on every edge — that's the high-value signal.
- Mark externals as `external/<kind>`; don't expand them.
- Keep `owns` to the short phrase from the summary; don't re-derive it from code.
- If you fell back (no summaries.json, or no scope match), state that in one line so the user knows the briefing may be stale or broad.

## Notes

- Prefer `summaries.json` — it exists precisely so this skill stays cheap. Reading notes directly is the fallback, not the default.
- This skill is safe to invoke automatically at session start; it has no side effects.
- It does **not** refresh anything. If the user suspects the atlas is stale, point them at `refresh-vault`.
