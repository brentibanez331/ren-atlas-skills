# Mermaid syntax safety

Rules that stop `generate-mermaid-architecture` from emitting diagrams that fail to render. Most Mermaid breakage comes from a handful of recurring mistakes — avoid these and output is reliable.

## Node ids

- Ids must be **alphanumeric + underscore only**. No spaces, dots, dashes, slashes, `@`, colons.
- Project ids often contain illegal chars (`@scope/ui`, `auth-service`). **Sanitize**: replace every non-word char with `_` to make the Mermaid id, and keep the real name in the label: `auth_service["auth-service"]`. Maintain a stable id→label map so refresh diffs are minimal.
- Never use the bare word `end` (lowercase) as a node id — it collides with the `subgraph … end` keyword. Capitalize or suffix it.

## Labels

- **Quote any label** containing a space, `(`, `)`, `/`, `:`, `#`, `,`, or `@`: `gw["api-gateway (v2)"]`.
- Inside a quoted label, escape a literal double-quote as `#quot;` and `#` as `#35;`.
- Keep labels short — long edge labels overflow short arrows. Abbreviate (`HTTP`, not `HTTP POST /v1/accounts`).

## Edges

- Solid: `A -->|label| B`. Dashed (async): `A -.->|label| B`. Thick: `A ==>|label| B`.
- The label goes **between the pipes**, immediately after the arrow. Don't wrap the whole edge in quotes.
- One edge statement per line. Don't chain more than two hops on a line (`A --> B --> C` is allowed but harder to diff than separate lines).

## Subgraphs (domain grouping)

- `subgraph dom_payments["Payments"]` … `end`. The subgraph id follows the same id rules (no spaces); the title is the quoted bracket label.
- Subgraph ids must be unique and must not collide with node ids.

## Styling

- One direction per diagram: `flowchart LR` (or `TD`). Don't redeclare it.
- `classDef`: `classDef svc fill:#d0bfff,stroke:#495057,color:#1e1e1e;` then apply with `node:::svc` or `class a,b,c svc;`.
- Node shapes (keep consistent with the design system): `id(["app"])` stadium, `id["service"]` rect, `id[["lib"]]` subroutine, `id{{"tool"}}` hexagon, `id[("db")]` cylinder.

## Comments & structure

- Comment lines start with `%%`. Use them to record any edges you omitted for readability — never truncate silently.
- Be consistent about trailing semicolons (optional in flowcharts; pick one style).

## Pre-emit checklist

1. Every id is sanitized (word chars only) and unique.
2. Every label with a special char is quoted.
3. No lowercase `end` node id.
4. Every node referenced in an edge is defined or appears elsewhere as an edge endpoint.
5. Each `subgraph` has a matching `end`.
6. Exactly one direction declaration.
