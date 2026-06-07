---
name: map-project
description: Scans one or more codebase locations and produces a structured inventory (manifest.json) of every project, service, and package. Accepts a single root path (auto-detecting Nx, Turborepo, pnpm/yarn/npm workspaces, Lerna, Bazel, Go/Cargo workspaces) or an explicit list of paths to separate repos. Use when the user wants to map/inventory/catalog a codebase or monorepo, "figure out what projects exist", or to start building an architecture atlas. First skill in the atlas pipeline; its output feeds detect-connections.
---

# map-project

Build a `manifest.json` inventory of every project under one or more locations. This is stage 1 of the atlas pipeline. Output conforms to [`manifest.schema.json`](../../schemas/manifest.schema.json).

## Inputs

- **Scan target** — either:
  - a single root path (a monorepo, or a plain repo), **or**
  - an explicit list of paths, each treated as its own project root (separate repos).
- **Vault path** (optional) — `ATLAS_VAULT` env var or an argument. Determines where the manifest is written (see "Output location").

Ask for the scan target if not given. Do **not** assume the current monorepo unless the user points at it.

## Procedure

### 1. Classify each root

For every scan path, detect how to enumerate projects by probing for marker files (check in this order; a root may match more than one — prefer the most specific):

| Marker file(s) at root | `roots[].kind` | How to enumerate projects |
|---|---|---|
| `nx.json` | `nx` | Run `npx nx show projects --json` if available; else glob for `project.json` / `**/project.json` and read each. |
| `turbo.json` | `turbo` | Read workspace globs from `package.json#workspaces` (or `pnpm-workspace.yaml`); each matched dir with a `package.json` is a project. |
| `pnpm-workspace.yaml` | `pnpm` | Expand the `packages:` globs; each dir with a `package.json` is a project. |
| `package.json` with `workspaces` | `yarn`/`npm` | Expand the `workspaces` globs. |
| `lerna.json` | `lerna` | Read `packages` globs (default `packages/*`). |
| `WORKSPACE` / `WORKSPACE.bazel` / `MODULE.bazel` | `bazel` | Glob for `BUILD`/`BUILD.bazel`; group targets by package directory. |
| `go.work` | `go-workspace` | Read `use (...)` directives; each is a module. |
| `Cargo.toml` with `[workspace]` | `cargo-workspace` | Read `members` globs. |
| A single project manifest, no workspace | `single` | The root itself is one project. |
| (path came from the explicit list) | `explicit` | Treat the path as one project root; if it turns out to be a workspace, recurse and classify it instead. |

### 2. Enumerate and characterize each project

For each project directory found, gather:

- **`root`** — absolute path.
- **`id`** — stable slug. Prefer the `packageName` (slugified) or the directory name. Must stay identical across runs; downstream skills key on it.
- **`name`** — human name (package `name`, or the directory name).
- **`packageName`** — from `package.json#name`, `go.mod` module path, `pyproject`/`Cargo` name, etc. Critical for resolving shared-import edges later. `null` if none.
- **`language`** — infer from project manifest + dominant file extensions:
  - `package.json`/`tsconfig.json` → typescript/javascript
  - `go.mod` → go · `pyproject.toml`/`setup.py`/`requirements.txt` → python · `Cargo.toml` → rust · `pom.xml`/`build.gradle` → java/kotlin · `*.csproj` → c#
- **`framework`** — from declared dependencies / config files. Examples: `next` (`next` dep), `angular` (`@angular/core`), `capacitor` (`@capacitor/core`), `react`, `vue`, `svelte`, `nestjs`, `fastify`/`express`, `fastapi`/`django`/`flask`, `fx`/`gin`/`echo` (go), `axum`/`actix` (rust).
- **`kind`** — classify:
  - user-facing UI → `app` / `website` / `mobile` (mobile if Capacitor/React Native/Flutter present)
  - backend with an HTTP/gRPC server or a `main` that serves → `service` (or `function` for serverless: `wrangler.toml`, `serverless.yml`, cloud-function handlers)
  - importable package, no entrypoint server → `lib`
  - CLI/script → `tool`
  - else `unknown`
- **`entryPoints`** — project-relative: `main`/`module`/`bin` from `package.json`, Nx `targets.build.options.main`, `cmd/*/main.go`, framework conventions (`src/main.ts`, `app/page.tsx`).
- **`ports`** — if discoverable from config/compose/Dockerfile (`EXPOSE`, `--port`, `PORT=`), record them. Helps connection resolution.
- **`aliases`** — collect alternate identities now, they pay off in stage 2: container/service name (docker-compose key, k8s service), the env-var token other projects would use (e.g. `api-gateway` → `API_GATEWAY_URL`), short name.
- **`tags`** — leave empty unless the repo encodes a domain/team (Nx tags, directory grouping like `apps/payments/*`). Use those if present.

Use `Glob`/`Grep`/`Read` for all of this. Don't execute project code. Prefer reading manifests over deep file scans; sample file extensions only to break ties.

### 3. Write the manifest

Assemble the object per the schema and write it (pretty-printed JSON) to the output location. Set `generatedAt` to the current time (ask the harness/use a shell `date` if you need a real timestamp — do not invent one).

## Output location

- If a vault is known: `<vault>/Architecture/.atlas/manifest.json` (create the directory).
- Otherwise: `./.atlas/manifest.json` in the current working directory. `write-excalidraw` will relocate it once a vault is chosen.

## Done criteria & handoff

Report a short summary: number of roots, number of projects by `kind`, and anything ambiguous (projects you marked `unknown`, missing package names). Then tell the user the next step is **detect-connections**, which reads this manifest.

## Notes

- Be honest about confidence. If a directory is ambiguous, set `kind: "unknown"` rather than guessing — stage 2 and the human can refine it.
- One monorepo or ten separate repos is the same to this skill: each produces projects with absolute roots; nothing downstream assumes they share a filesystem parent.
