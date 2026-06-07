---
name: map-flow
description: Deep-maps how a specific capability or feature flows across files and projects — e.g. "how does Checkout KYC work between libs/ng and api/onboarding". Traces entry points → calls → cross-project hops → external SDKs/DBs at file/function granularity, and writes a deep-dive note with one or more Mermaid diagrams (sequenceDiagram, flowchart, and/or classDiagram — the model chooses what fits, and may emit several) plus file:line evidence. Writes to Architecture/flows/, links back to project notes via wikilinks, and never touches the system canvas. Records .atlas/flows/<slug>.json so refresh-vault can flag the flow stale when its traced files change. Use for feature/flow deep dives and "how does X work across A and B" questions — distinct from map-project (project topology). Can run standalone.
---

# map-flow

Trace one capability end-to-end across files and project boundaries, and persist it as a self-contained deep-dive note. This is a **different granularity** from the rest of the atlas: the topology skills treat each project as a single node; `map-flow` goes *inside* projects to follow a feature's call sequence.

**It never bloats the system view.** A flow is always its own file under `Architecture/flows/`, linked back to the project notes — never an addition to `System.excalidraw.md` / `System.canvas` / `_index.md`'s generated region.

## Read first

- [`../../references/design-system.md`](../../references/design-system.md) — colors, short labels, readability.
- [`../../references/mermaid-syntax.md`](../../references/mermaid-syntax.md) — so every diagram renders (id sanitization, quoting, the pre-emit checklist).

## Inputs

- **A capability/feature** — e.g. "Checkout KYC", "magic-link login", "payout settlement".
- **Spans** (optional) — the projects/dirs it crosses (`libs/ng/.../kyc`, `services/api/service/external/onboarding`). If omitted, discover them by grepping the capability keywords across the manifest's project roots.
- **Vault** — `ATLAS_VAULT` or argument.
- **manifest.json / graph.json** (optional, under `.atlas/`) — if present, use them to map participants to project `id`s (for correct `[[wikilinks]]`) and to anchor known edges. `map-flow` works without them by inferring from paths.

## Procedure

### 1. Resolve the trace scope

- Grep the capability's keywords (e.g. `checkout|checkout|kyc`) across the named spans — or across all project roots if spans weren't given — to find the participating files.
- Identify the **participants** (these become diagram lifelines / nodes): the UI/facade, the service layer, any SDK, the HTTP/gateway hop, the target project's handler/endpoint, and external systems (the third-party SDK, DB, queue). Map each participant to a project `id` via the manifest where possible, so you can wikilink it.

### 2. Trace the interaction

Walk the actual call path and record an ordered list of steps:

- Start at the **entry point** (UI action or facade method).
- Follow calls within the project to the **cross-project hop**. For HTTP: find the client call (e.g. `http.service` + route) and resolve the route to the target project's endpoint via its `api-spec.yaml` / controller / router. For SDKs: find the SDK launch + result handling. For queues: producer subject → consumer.
- Continue into the **target project's handler**, then out to **externals** (SDK verify, DB read/write).
- For **each step** capture: `from → to`, mechanism (method call / HTTP route / SDK call / DB op), payload or purpose, sync/async, and **`file:line` evidence**. Note branches, error paths, and meaningful return values.

Stay scoped to this capability — do not expand into a whole-project map.

### 3. Choose the diagram(s) — your call, and you may emit several

Pick the form(s) that explain *this* flow best. **You are not capped to one diagram.** Use the heuristic, then decide:

- **`sequenceDiagram`** — default for request/response call traces. Lifelines = participants; ordered messages + returns. Best for "how does X work".
- **`flowchart`** — for branchy / multi-stage / state-machine flows (decisions, parallel paths, retries).
- **`classDiagram`** — for the *data shapes* exchanged (DTOs, entities, the SDK result payload) when the contract is the point.

> Heuristic: mostly calls → sequence; mostly branches/stages → flowchart; the question is about data shapes/contracts → class. A flow is often clearest as **two**: e.g. a `sequenceDiagram` for the KYC call flow **plus** a `classDiagram` for the Checkout result payload. Emit as many as genuinely add clarity, each under its own heading; drop any that would be redundant. Record which you chose (and why) in the note and the `.json`.

Apply the design-system colors and the mermaid-syntax pre-emit checklist to each.

### 4. Write the flow note — `Architecture/flows/<slug>.md`

`<slug>` = kebab-case of the capability (`checkout`).

Frontmatter:
```yaml
---
type: flow
capability: <capability>
spans: [<project ids…>]
relates: ["[[ui-lib]]", "[[service-api]]"]
generatedAt: <ISO timestamp>
---
```

Body, inside `<!-- atlas:generated:start -->` / `<!-- atlas:generated:end -->` markers (same contract as the other skills):
- `# <Capability> flow`
- One-paragraph summary of what the flow does end-to-end.
- **Participants** — wikilinks to project notes (`[[ui-lib]]`, `[[service-api]]`) + externals as plain text.
- The **diagram(s)**, each under its own heading in a ```mermaid block.
- **Trace** — the ordered steps with `file:line` evidence.
- Optional "Make editable" line: convert a diagram via the in-plugin **Mermaid to Excalidraw** (works for sequence/class too).

After the closing marker, leave a `## Notes` heading for the human. Also wikilink `[[_index]]` so the flow is reachable from the map-of-content (Obsidian backlinks then surface this flow on every participant note automatically — no need to edit those notes).

### 5. Index + persistence

- **`Architecture/flows/_flows.md`** — a map-of-content listing every `[[<slug>]]` with its capability + spans. Maintain idempotently (inside generated markers).
- **`<vault>/Architecture/.atlas/flows/<slug>.json`**:
  ```json
  { "version": "1", "slug": "checkout", "capability": "Checkout KYC",
    "spans": ["ui-lib", "service-api"], "participants": ["ui-lib","gateway","service-api","Checkout"],
    "diagrams": ["sequenceDiagram", "classDiagram"],
    "sourceFiles": ["/abs/kyc.facade.ts", "/abs/application/service.go", "..."],
    "fingerprint": "<hash of sourceFiles' content/mtime>", "generatedAt": "<ISO>" }
  ```
  `refresh-vault` reads this: if any `sourceFile` changed, it flags the flow **stale** (it does not auto-rewrite — flows are curated).
- Optionally link `_index.md` → `[[flows/_flows]]` inside a **separate** `<!-- atlas:flows:start --> … <!-- atlas:flows:end -->` block (idempotent). Do **not** touch the `atlas:generated` region that `write-excalidraw` owns.

## Canvas (optional)

The embedded Mermaid renders natively in Obsidian (read mode). For an *editable* Excalidraw of a flow, use the in-plugin **Mermaid to Excalidraw** conversion (it handles sequence and class diagrams). Do **not** use `write-excalidraw`'s `convert.mjs` — that's dagre/flowchart over `graph.json` and has no concept of a flow trace.

## Guardrails

- **Never** write or modify `System.excalidraw.md`, `System.canvas`, or `_index.md`'s `atlas:generated` region.
- **Never overwrite an existing flow note unless the user explicitly asks** to regenerate/update that flow (same policy as canvases). The `.atlas/flows/<slug>.json` is machine state and may be rewritten. Never delete a note.
- **Evidence is mandatory** — every step cites `file:line`, so the trace is auditable and `refresh-vault` can re-anchor it.
- Keep each diagram within readable bounds; if a flow is huge, split it (e.g. a high-level sequence + a focused sub-flow) rather than one wall of arrows.

## Done & handoff

Report: the flow note path, the diagram type(s) chosen and why, the participants, the number of traced steps, and the `.atlas/flows/<slug>.json` written. Note that backlinks now surface this flow on the participant project notes, and `refresh-vault` will flag it stale if its `sourceFiles` change.
