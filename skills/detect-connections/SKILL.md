---
name: detect-connections
description: Given an atlas manifest.json, analyzes how projects connect — HTTP/gRPC/GraphQL/WebSocket calls, message-queue publish/subscribe, shared-package imports, database connections, and environment variables that reference other services. Resolves connections across project and repo boundaries by identity, not filesystem layout. Use after map-project, or whenever the user asks how services talk to each other / wants a dependency or connection graph. Outputs graph.json (directed edges with protocol, direction, sync/async, evidence).
---

# detect-connections

Turn a `manifest.json` into a directed connection `graph.json`. Stage 2 of the atlas pipeline. Output conforms to [`graph.schema.json`](../../schemas/graph.schema.json).

## Inputs

- `manifest.json` (from map-project). Resolve the vault per [vault-resolution](../../references/vault-resolution.md) (explicit arg > `ATLAS_VAULT` > recorded in memory > ask), then read `<vault>/Architecture/.atlas/manifest.json`; also check `./.atlas/manifest.json`. Ask if neither exists.

## Build a resolution index first

Before scanning, build an in-memory index from the manifest so you can map a raw reference to a target project. For every project collect resolvable keys → project `id`:

- `packageName` → id (resolves imports)
- each `alias`, the `name`, the `id` → id (resolves service-name / host references)
- each `port` → id (resolves `localhost:PORT` / `:PORT`)
- common env-var tokens derived from name/aliases: `FOO_URL`, `FOO_API_URL`, `FOO_SERVICE_URL`, `NEXT_PUBLIC_FOO_URL`, `FOO_HOST`, `FOO_ENDPOINT` → id

A reference that matches nothing becomes an **external** node (`external:<slug>`), classified by `externalKind` (stripe/twilio → saas, postgres/mysql/mongo → database, redis → cache, kafka/nats/rabbitmq/sqs → broker, s3/gcs → storage, auth0/clerk/firebase-auth → auth).

## What to scan for, per protocol

For each project, scan its source (use `Grep` with targeted patterns; `Read` to confirm and grab evidence). Each confirmed connection becomes one edge with `evidence` (file + line + snippet) and a `confidence`.

| Signal | `protocol` | `sync` | Direction & notes |
|---|---|---|---|
| `import`/`require`/`from` of another project's `packageName` | `import` | sync | importer → imported. Skip third-party/stdlib. High confidence. |
| `fetch`/`axios`/`got`/`ky`/`HttpClient`/OpenAPI client with a URL or `*_URL` env | `http` | sync | caller → callee. Resolve target via URL host/port or env token. `channel` = route path if visible. |
| Generated gRPC stub / `.proto` service client / `grpc.Dial` | `grpc` | sync | caller → callee. `channel` = `Service/Method`. |
| GraphQL client (`apollo`, `urql`, `graphql-request`) endpoint | `graphql` | sync | caller → callee. |
| `WebSocket`/`socket.io-client`/`ws` connect | `websocket` | sync | initiator → server. |
| Queue/broker **publish**: `.publish(`, `.send(`, `producer.send`, `nats.publish`, `sqs.sendMessage`, `kafka ... produce` | `queue` | async | producer → (subject) → consumer. `channel` = subject/topic. |
| Queue/broker **subscribe**: `.subscribe(`, `consumer`, `nats.subscribe`, `@EventPattern`, queue handler | `queue` | async | used to find the **consumer** end of a subject; pair with publishers. |
| Webhook registration / inbound webhook route to an external | `webhook` | async | external → receiver (or receiver → external on register). |
| DB driver / ORM connection string (`postgres://`, `DATABASE_URL`, Prisma datasource) | `db` | sync | project → `external:<db>`. `channel` = db/table if known. |
| Env var naming another service (`*_URL`/`*_HOST`/`*_ENDPOINT`) in `.env*`, compose, k8s, `wrangler.toml` | `env` | sync | referencing project → referenced. Use only when no stronger signal already created the edge (env corroborates, don't double-count). |

### Resolving async (queue) edges

Publishers and subscribers are found in *different* projects. Match them by `channel` (subject/topic):
- producer P publishes subject `S`, consumer C subscribes `S` ⇒ edge `from: P, to: C, protocol: queue, sync: async, channel: S`.
- If a subject has a publisher but no discoverable subscriber (or vice versa), still record the edge to an `external:<broker>` node so the message path isn't lost, at `confidence: low`.

## Quality rules

- **De-duplicate**: collapse many call sites between the same pair+protocol+channel into one edge; keep the strongest evidence and note the count in the snippet if useful.
- **Confidence**: `high` when the target resolves unambiguously (import of a known package, URL host == known alias/port). `medium` when resolved via an env-var token convention. `low` when the target is guessed or only one half of an async pair was found.
- **Direction matters**: `from` is always the initiator (caller/producer). Get this right — the diagrams and "talks to" lists depend on it.
- Don't invent edges to satisfy symmetry. Missing is better than wrong; the human will audit via `evidence`.

## Output

Write `nodes` (every manifest project as a `project` node + each discovered external) and `edges` to:

- `<vault>/Architecture/.atlas/graph.json` (alongside the manifest), or `./.atlas/graph.json`.

Set `manifestRef` to the relative path of the manifest, and `generatedAt` to a real timestamp.

## Done criteria & handoff

Summarize: edge count by protocol, number of external systems, and any `low`-confidence edges worth the user's eye. Next step is **generate-mermaid-architecture**.
