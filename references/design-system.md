# Atlas design system

One visual language shared by every atlas output — Mermaid, Excalidraw, and Obsidian Canvas — so a project looks the same whichever way you view it. **Readability is the only goal that outranks consistency.** A correct diagram nobody can read has failed.

## Semantic roles → color

Color encodes the project's **role**, not decoration. Use the same mapping in all three formats (Canvas takes a preset number *or* a hex; the others take hex).

| Role (`kind`) | Fill hex | Canvas preset | Reads as |
|---|---|---|---|
| `app` / `website` / `mobile` | `#a5d8ff` (blue) | `"5"` | user-facing entry point |
| `service` / `function` | `#d0bfff` (purple) | `"6"` | backend compute |
| `lib` | `#e9ecef` (gray) | — (hex) | shared code, no runtime of its own |
| `tool` | `#fff3bf` (yellow) | `"3"` | CLI / script |
| `external` (any kind) | `#f1f3f5` (muted) | — (hex) | not ours — third party / infra |

Externals are always the **most muted** thing on the canvas; your own services should be what the eye lands on.

### Edge color/style by synchronicity

| `sync` | Excalidraw / Mermaid | Canvas (no dashed support) |
|---|---|---|
| `sync` | solid arrow, stroke `#495057` | solid edge, default color, label = protocol |
| `async` | **dashed** arrow, stroke `#e8590c` | edge color `"2"` (orange) + label suffix ` (async)` |

Canvas edges can't be dashed, so async is carried by **color + an "(async)" label** instead. Keep that convention everywhere so the two formats stay legible side by side.

## Contrast floors (non-negotiable)

- No text lighter than `#757575` on a white background — below that it disappears at normal zoom.
- On a colored fill, use a **darker variant** of that hue for text, not the fill color itself (e.g. text `#15803d` on a `#b2f2bb` fill, never `#22c55e`).
- Never use light-gray label text (`#b0b0b0`, `#999`) on white.

## Typography

- **Titles** 20–28px · **node labels / body** 16–18px · **secondary notes** 14px · **never below 14px.**
- `lineHeight: 1.25` everywhere.
- Excalidraw `fontFamily`: prefer `2` (normal/Helvetica) for architecture legibility; `1`/`5` (hand-drawn) only if the user wants the sketchy aesthetic. Architecture diagrams are read, not admired — default to legible.

## Node sizing & spacing

- Minimum box with a label: **160×60px** (Canvas file-nodes: 260×80 to fit a note title).
- Keep ≥ 20–30px between any two elements; never let boxes touch.
- Leave 50–80px padding around the whole drawing — don't crowd the edges.

## Labels & direction

- **Every edge carries a label** = its protocol (optionally `+ channel`), e.g. `HTTP`, `gRPC Accounts/Get`, `queue events.user.* (async)`. An unlabeled arrow is a guess.
- Arrow points **from caller/producer → callee/consumer**. This is the highest-value signal in the whole diagram; getting it backwards is worse than omitting the edge.

## Common mistakes to avoid

- **Overlap** — boxes stacked because y-coords were too close. Honor the spacing constants in `layout-algorithms.md`.
- **Everything in one diagram** — the system view is not the place for every edge. Push detail to per-project views.
- **Unlabeled or wrong-direction edges** — see above; both destroy trust in the diagram.
- **Externals that don't recede** — if a third-party box is as loud as your services, the muting failed.
- **Tiny / low-contrast text** — the two fastest ways to make a diagram useless.
- **Random positions** — kills refresh diffs (see the determinism rule in `layout-algorithms.md`).
- **Canvas: group node not behind its members** — group must come first in the `nodes` array or it renders on top and hides content.
