# Constellation

Hackathon project (Hoobit Hacks 2026, online/Devpost). Read this whole file before making changes — it captures decisions and context that aren't visible from the code alone.

## Concept

A spatial interface for AI: instead of a chatbot transcript, AI work exists as objects in 3D space. The user types a product idea; a real Claude-powered pipeline generates software design artifacts (requirements, architecture, database, wireframes, planning) as stars in a constellation. Diving into a star reveals its artifacts as glass frames floating in space. Target user: software engineers in the ideation/design phase.

**Status: working product with live AI generation.** The old "experience prototype, no AI" philosophy is retired — the backend exists and works. The one deliberately unbuilt half: *conversation*. Generation is one-shot (prompt → pipeline → boards); there is no in-node follow-up dialogue yet. That's the honest "what's next."

## Design direction

Inspiration: JARVIS, Interstellar, Apple, constellation metaphors. Feeling: "an intelligent system is waking up." Avoid: cyberpunk, neon gamer UI, complex HUDs, generic chatbot looks.

Core visual principles (settled):
- **Stars from far, UI up close.** Distance = celestial objects; hover = ring + summary panel; dive = full artifacts.
- **Monochrome blue-white, one accent.** `rgba(150, 190, 255)` means exactly one thing: "the AI is working on this" (building arc, milestone diamonds, pk markers, acceptance checks). No per-type colors.
- **Edges whisper** (~0.28 opacity, 0.5 on hover).
- One signature element per screen. Everything moves damped; nothing snaps.

## Decisions log — do not relitigate without user direction

- **Orb retired.** No AI avatar. Presence = motion design (birth ignitions, blue building arcs).
- **Node interiors are canvas boards**, not recursive star systems. Artifacts render at full fidelity in space.
- **Topology = generation pipeline.** origin → requirements → {architecture, database, wireframes} → planning (multi-parent convergence, `parents: []` arrays). Stars ignite in dependency order as real generations complete.
- **Streaks are intro-only.** Enter/exit node travel uses scripted flight + veil flash + starfield re-seed ("new galaxy"), never streaks.
- **Camera feel:** grab-the-sky pan, cursor-anchored dolly zoom, damped target-following, idle drift (held during hover/dive). Zoom is also navigation: zoom into a star = enter it, zoom out inside = leave.
- **Renderers decide pixels, the model decides content.** Artifacts arrive as schema-forced JSON; React/SVG renderers draw them in house style. Never render raw model HTML.
- **Acceptance criteria live inside story cards** (no separate artifact). Database = ERD entities + relations + DDL (no GRD).

## Current build status

**Everything works end-to-end:** landing → prompt recede + warp → constellation births as the pipeline generates (blue arc = building, ignition = ready, dim embryo = waiting/error) → hover (ring, brightened label, glass summary panel) → click or zoom-in to dive (flight + veil + sparse interior sky) → boards with real rendered artifacts → ESC or zoom-out to return. Prompt text becomes the origin star's label and its panel text.

**Tomorrow (final session):** 1) drag-to-arrange board frames — design agreed: frames get pointer events; camera's `onDown` ignores drags starting inside `.board-frame` (extend the existing `closest('button, input')` check); deltas bank in refs, inner-div `translate` written directly (promptRef pattern, no re-renders); same `worldPerPixel` conversion as pan; offsets in a module-level map keyed by node+frame (survives re-entry, resets on reload); slight lift on grab. 2) Devpost submission: write-up + demo video.

**Parked (won't ship):** exit-flight frame recede (frames vanish at veil midpoint instead of receding like the landing prompt); rogue star streak micro-jitter during drift; DDL frame truncates long SQL (max-height); ERD has no drawn relationship lines (entities grid + relations list instead); in-node conversation (v2 idea: prompt bar inside a board → one call → new frame ignites).

## Tech stack & running it

Frontend: React + Vite, plain CSS, React Three Fiber + three + drei (`Html` projects labels/panels/frames — do not remove).
Backend: Node + Express (`server/`), `@anthropic-ai/sdk`, model `claude-sonnet-5` (override via `MODEL` in `server/.env`).

Two terminals: `npm run dev` (Vite, :5173, proxies `/api`→:3001) + `npm run server` (live; needs `ANTHROPIC_API_KEY` in `server/.env`, git-ignored) or `npm run server:mock` (fixtures with fake latency — offline demo insurance; the `--mock` flag exists because `MOCK=1` doesn't work in PowerShell).

## File structure

```
src/
  App.jsx                — phases, prompt UI, audio, pipeline orchestrator (runPipeline,
                           nodeStates waiting|building|ready|error, boards state)
  App.css                — 2D UI styling (prompt, labels, panels, interior, veil, board frames)
  Scene.jsx              — R3F Canvas, CameraRig (dolly → free cam → enter/exit flights),
                           FREE_CAM / FLIGHT / INTERIOR_CAM tuning, veil driving, bounds swap
  HyperspaceStars.jsx    — starfield; `warp` gates streaks to intro; `variant` galaxy|interior re-seeds the sky
  ConstellationNodes.jsx — stars, edges, hover system, summary panel, building arcs,
                           state-driven ignition (birthAt), click detection
  NodeInterior.jsx       — board renderers (stories, scope, diagrams w/ auto-layout, ERD,
                           DDL, wireframes as app skeletons, gantt, risks) — single default
                           export; all styling inline (Fast Refresh + no CSS sprawl)
  constellationData.js   — NODES (parents arrays), EDGES derivation, static BOARDS placeholders
  index.css              — reset, font, page background (MUST keep background-color: black — see gotchas)
server/
  index.js               — POST /api/generate {kind, prompt, context}; forced tool-use JSON;
                           unwrap heuristic; retry; MOCK mode; diagnostics on failure
  schemas.js             — five artifact JSON schemas + per-kind system prompts (caps, label
                           limits, wireframe no-overlap rules live HERE — tune prompts here)
  fixtures/*.json        — mock artifacts (recipe app), double as schema documentation
BACKEND_PLAN.md          — pipeline design doc
```

## Architecture notes

**Camera rig (Scene.jsx).** One `CameraRig`, modes: scripted intro dolly → free camera → scripted enter/exit flights. Mode switches: `free` ref null→object at dolly handoff; `flight` ref owns the camera outright while set. Iron rule: **input handlers and effects never move the camera or mutate `free.current`** — handlers bank pixel deltas / effects record intent into command refs (`diveCmd`); `useFrame` drains and mutates. Follow damps a stored *base*; camera = base + drift (drift added after damp; held during hover/dive via `hoverHoldRef`). Hover detection subtracts the published drift offset (`driftOffsetRef`) so camera wander can't flap hover (that feedback loop shipped once — see gotchas). Flights: easeInOutCubic, veil opacity = sin(πt)^3 written per-frame to a DOM ref, world swaps at t=0.5 behind the flash (`onDiveMidpoint` → App's `inWorld`), bounds swap at t=1 (constellation bounds ↔ node-local INTERIOR_CAM box). Zoom grinding the floor near a star auto-enters; zooming past the interior ceiling exits.

**Pipeline (App.jsx + server).** `runPipeline` on Enter: requirements → parallel {architecture, database, wireframes} (each gets requirements as context) → planning (gets requirements + components + screens). Per-node try/catch → `error` state (dim embryo). Server forces one tool per kind (`tool_choice` + `disable_parallel_tool_use`), schema = contract; response validation checks required keys; **unwrap heuristic** handles the observed model quirk of nesting the whole artifact under one stray key. Failure path logs stop_reason/model/tokens/keys + raw content.

**Nodes (ConstellationNodes.jsx).** Data-driven from constellationData. Ignition is state-driven: `nodeStates` prop → `birthAt[i]` stamped on ready (+EDGE_LEAD so edges draw first); waiting/building = dim embryo (+ orbiting blue arc when building); no backend running = everything defaults ready. Hover = screen-space distance test (no raycast), gated to born stars + `interactive` + `visible`; one singleton summary panel (state picks which node, hover weight drives opacity via ref — invalid states unrepresentable). Component stays mounted while hidden inside a node (group.visible) so births never replay.

**Renderers (NodeInterior.jsx).** `buildFrames(nodeId, board)` maps artifact JSON → frames in SLOTS around the breathing central glow. Diagram auto-layout: BFS layering capped at 3 columns (deeper chains fold column-major, canvas grows taller — overlap impossible); labels wrap to 2 lines; edge labels staggered at t=0.34/0.5/0.66 with dark paint-order backing. Wireframes render as app skeletons (lists = avatar rows, forms = field slots, tabbar = icon dots) on a 12×18 grid inside device frames. Missing/weird data falls back to raw-JSON frames.

## Known gotchas — hard-won lessons

1. **Linter purity pattern.** Empty `<group ref>` in JSX; scene graph built in mount effect; all mutable state in one ref object; mutations only in useEffect/useFrame; props mirrored into refs for useFrame.
2. **React Compiler freeze semantics** (three separate incidents): (a) mutating `free.current` fields inside a `useEffect` froze the ref for every other mutation site — effects must record intent into command refs, useFrame mutates; (b) functions passed as component props get frozen along with everything they capture — keep prop callbacks pure (setState only); (c) declare refs *before* any closure that captures them — a ref captured above its `useRef` line loses its mutation exemption and the error appears at some unrelated later line. The error always points at the victim, not the culprit.
3. **CSS animations beat inline styles** (cascade). Never add a CSS animation to any element whose style is written per-frame (prompt wrapper, node labels, panel, veil). `fill-mode: forwards` and infinite loops both hold their properties forever.
4. **Transparent root backgrounds leak the browser's white backdrop.** `index.css` must keep `background-color: black` under the gradient. The phantom "orb" was this.
5. **blur + animation don't mix.** `backdrop-filter` on anything that animates = repaint jank; `will-change` on drei Html content = permanently soft text (composited at fractional pixels). Board frames use solid fills, no layer promotion.
6. **One change at a time in HyperspaceStars.jsx.**
7. **Glow/ring centering uses negative margins, not transform** (keyframes own transform).
8. **Feedback loops:** if a "fix" makes A depend on B while B depends on A, you built an oscillator (hover↔drift shipped that way once). Break loops at the data source (hover tests against the drift-free base camera).
9. **Debugging rule that kept paying:** print the actual payload before theorizing. Also: PowerShell's `Invoke-RestMethod` display collapses nested JSON (`@{...}`, `System.Object[]`) — pipe to `ConvertTo-Json -Depth 10`; that's formatting, not missing data.
10. **Tooling quirks:** OneDrive serves stale/truncated file copies to non-editor readers right after edits (Claude's sandbox hit this; syntax-check before trusting a copy). Vite Fast Refresh requires component-only exports (shared data lives in constellationData.js). node servers need manual restart — no hot reload.
11. **Merge conflicts:** accept-both is only for independent additions; if one side references identifiers that no longer exist at the top of the file, it's the fossil.

## Tuning knobs

- `Scene.jsx` → `DOLLY` (intro), `FLIGHT` (duration 1.7 / standoff 95 / veil exponent in useFrame), `FREE_CAM` (damp, zoom, bounds, drift), `INTERIOR_CAM` (board camera box), `AUTO_ENTER_RADIUS`.
- `ConstellationNodes.jsx` → `BIRTH_DURATION`, `EDGE_LEAD/OPACITY`, `CORE_SIZE`, hover consts, `ARC_*` (building arc), `SEED_*` (embryos).
- `NodeInterior.jsx` → `SLOTS`, `FRAME_DISTANCE_FACTOR` (250), per-frame widths in `buildFrames`.
- `server/schemas.js` → all content quality/caps/layout rules (prompt tuning happens here); `server/index.js` → `max_tokens` (8000), mock latency.
- `App.jsx` → `AMBIENT_VOLUME` (0.16), `DISSOLVE_DURATION`; tick volume in ConstellationNodes mount (0.3-ish).

## Conventions

- Respect `prefers-reduced-motion` in CSS and JS-driven motion.
- The user works by pasting reviewed snippets for *their* files; Claude edits server/, NodeInterior, and docs directly. When giving snippets, name the exact function/component a prop list belongs to (Scene vs CameraRig both exist in Scene.jsx).
- Verify visually via the dev server; browser rendering suspends when the Chrome window is occluded — screenshots of hidden windows are stale frames.
- Restart `npm run server` after any server/ edit.
