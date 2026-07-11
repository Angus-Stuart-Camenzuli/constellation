# Constellation

Hackathon project (Hoobit Hacks 2026). Read this whole file before making changes — it captures decisions and context that aren't visible from the code alone.

## Concept

A spatial interface for AI: instead of a chatbot with a text box and vertical transcript, AI interactions exist as objects in a 3D space. The user types what they want to build; an AI would eventually construct requirements/architecture/database/wireframes as interconnected nodes in that space. Target user: software engineers planning a project (ideation + design phase), not another AI app builder.

**This is an experience prototype, not a working product.** Philosophy: build the feeling before the functionality. Do not add AI agents, artifact generation, or AI integration without being asked. Enter currently only triggers the visual transition; the typed prompt goes nowhere.

## Design direction

Inspiration: Iron Man JARVIS interface, Interstellar, Apple product design, space/constellation metaphors. The feeling: "an intelligent system is waking up." Minimal, elegant, futuristic, calm — huge and full at once.

Avoid: cyberpunk aesthetics, neon gamer UI, complex HUDs, generic chatbot appearance.

Core visual principles (settled):
- **Stars from far, UI up close.** At map distance artifacts are celestial objects (bright specks + spaced-caps labels). Information reveals with proximity: hover = ring + label brighten, click = dive in. UI panels only appear at reading/editing depth.
- **Monochrome blue-white everywhere, one accent.** `rgba(150, 190, 255)` is reserved exclusively for "the AI is working on this" (e.g. the building-state arc). No per-artifact-type colors.
- **Edges whisper.** Connection lines are faint (~0.28 opacity), never full-white Skyrim-style beams.
- One signature element per screen; no competing effects.

## Decisions log — do not relitigate without user direction

- **The orb is retired.** The landing glow is a UI design element that recedes with the prompt and never returns. No persistent AI avatar / idle-listening-thinking states. "The AI is present" is expressed through motion design (node birth animations, building arcs), not a mascot.
- **Node interiors are canvas boards, not recursive star systems.** Diving into an artifact lands on a spatial Canva/Figma-style board where its contents (wireframe frames, user story cards, diagrams) float at full fidelity — draggable, zoomable, side by side. A recursive "satellites orbiting a sun" model was designed and explicitly rejected in favor of this.
- **Tree topology:** prompt → requirements → {architecture, database, wireframes}. Requirements drive the design phase, so the edges mean something. Laid out as a diagonal flow (idea enters lower-left, work cascades up-right) with irregular angles and per-node z-depth — a constellation, not an org chart. Future artifacts extend the flow rightward.
- **Hyperspace warp is intro-only.** The streak effect fires during the Enter→constellation dolly and never again; the free camera must not trigger it (gated by the `warp` prop). The subtle/calm dolly mode was removed long ago — don't reintroduce either behavior.
- **Camera feel:** grab-the-sky drag panning, cursor-anchored wheel zoom (dolly on z, never fov-zoom), damped target-following everywhere, idle drift when hands-off.

## Current build status

**Built and working:**
- Landing screen: black void, centered prompt with typing-out placeholder, breathing glow + orbit-ring (these live *inside* `.prompt-wrapper` and recede with it), ambient hum + Enter whoosh, mute toggle.
- Transition: ease-in-out dolly (wind-up → hyperspace rip → settle); the prompt assembly recedes with real perspective math (scale/opacity/blur written per-frame by Scene.jsx) and dissolves into the distance.
- Constellation: 5 nodes (origin + 4 artifacts) as glowing sprites with drei `Html` labels, staggered birth cascade (edge draws in, star ignites with overshoot flare), idle breathing (desynced scale/opacity pulses).
- Free camera: damped target rig, wheel zoom clamped z 80–320 anchored at cursor, grab-the-sky drag pan with bounds, idle drift (Lissajous wander, fades out on input, respects reduced-motion).

**Next up, in order:**
1. Hover states (raycast sprites → ring fades in, label brightens, pointer cursor).
2. Hover glass summary panel (title, one-liner, "click to enter" hint — small, not the full artifact).
3. Click-to-dive: camera flies into a node (reuse dolly mechanics + second whoosh).
4. Canvas-board interior for artifacts (the big one — see decisions log).

**Polish backlog (unordered):** wire the actual typed prompt text into the origin star's label ("YOUR PROMPT" is a placeholder); further constellation layout tuning ("pretty good, not perfect"); remove the dead commented-out `<fog>` line in Scene.jsx; optionally rebuild a stronger landing glow via the glow divs (user currently prefers the cleaner look).

## Tech stack

React + Vite, plain CSS (no framework), React Three Fiber + `three`. `@react-three/drei` **is used** (its `Html` component projects the node labels) — do not remove it.

## File structure

```
src/
  App.jsx                — phase state machine (landing/dissolving/constellation), prompt UI, audio
  App.css                — all 2D UI styling (prompt, glows, node labels, cursor states)
  Scene.jsx              — R3F Canvas, CameraRig (dolly + free camera), FREE_CAM tuning
  HyperspaceStars.jsx    — streaking starfield (warp gated to intro)
  ConstellationNodes.jsx — node data (NODES/EDGES), sprites, birth animation, labels
  index.css              — global reset, font, page background
public/
  audio/
    ambient-hum.mp3      — looping bed, volume 0.25
    enter-whoosh.mp3     — plays on Enter
```

## Architecture notes

**Camera rig (Scene.jsx).** Two modes in one `CameraRig`: scripted dolly, then free camera. The mode switch is the `free` ref going from `null` to a target object at dolly completion. Free-camera rule: **input handlers never move the camera** — they write to the target (`free.current.x/y/z`) or bank pixel deltas in refs; `useFrame` drains inputs, damps a stored *base* position toward the target, and renders `camera = base + drift`. Drift is added after the damp on purpose — folding it into the follow makes them fight. Pixel→world conversion happens in `useFrame` (`worldPerPixel = 2·z·tan(fov/2)/viewportHeight`), which auto-scales pan speed with zoom. Zoom-to-cursor math runs in target space (assumes camera is at target); the damp reconciles.

**Nodes (ConstellationNodes.jsx).** Fully data-driven: `NODES` (id, label, position, parent, size) and `EDGES` derived from `parent`. Stars are sprites sharing one canvas-painted radial-gradient texture. Birth: staggered per-node ignition (`BIRTH_STAGGER`), each edge starts `EDGE_LEAD` before its child star. Component mounts only when the dolly completes (`showNodes`), which is what starts its clock. Labels are drei `Html` with per-node CSS `animationDelay`.

**Starfield (HyperspaceStars.jsx).** Streak length is velocity-driven: per-frame speed (Δz/Δt) is smoothed with `THREE.MathUtils.damp`, so streaks ramp and decay instead of snapping. The `warp` prop gates the *speed input* (not the output), so intro streaks decay naturally at handoff but free-camera motion reads as speed 0. Resting stars are constant-angular-size specks (`REST_STREAK_ANGULAR`). The old documented issues (invisible at rest, snap-to-zero) are fixed.

## Known gotchas — hard-won lessons

1. **Linter purity rules.** No mutating/reading refs during render; cleanups must capture ref values into locals. R3F's mutate-in-`useFrame` pattern is correct but looks like a violation. House pattern (used by all three scene components): JSX returns an empty `<group ref>`, the scene graph is built imperatively in a mount `useEffect`, all mutable state lives in one `useRef` object, mutations happen only in `useEffect`/`useFrame`. Prop values needed inside `useFrame` are mirrored into refs via a `useEffect`.
2. **CSS animations beat inline styles.** In the cascade, running/held animations (including `fill-mode: forwards` and infinite loops) outrank `style=""`. This silently blocked the prompt recede once already. Scene.jsx writes inline transform/opacity/filter to `.prompt-wrapper` — that's why `.phase-dissolving .prompt-wrapper` sets `animation: none`. Never add a CSS animation to an element whose style Scene.jsx drives per-frame.
3. **Transparent root backgrounds leak white.** The page gradient's center stop is 94% transparent; on `html` that showed the browser's default **white** backdrop and produced a giant phantom "orb" that survived every DOM fix. `index.css` must keep `background-color: black` under the gradient. If a mystery glow appears, hide the canvas and check the DOM before blaming the scene.
4. **One change at a time in HyperspaceStars.jsx.** A historical bundled fix (streak scaling + idle rotation) desynced streak direction from rendered position and had to be reverted. Isolated, single-purpose changes only; test each before combining.
5. **Glow/ring centering uses negative margins, not transform** — their keyframes (breathe/ambient/spin) own the `transform` property and would overwrite a `translate(-50%, -50%)`.

## Tuning knobs (where the feel lives)

- `Scene.jsx` → `DOLLY` (warp duration/ease), `FREE_CAM` (damp, zoom step/limits, pan bounds, drift amp/freqs/idle delay).
- `ConstellationNodes.jsx` → `NODES` positions/sizes, `BIRTH_STAGGER`, `BIRTH_DURATION`, `EDGE_LEAD`, `EDGE_OPACITY`, `CORE_SIZE`, breathing amplitudes in `useFrame`.
- `HyperspaceStars.jsx` → `STAR_COUNT` (1400), `MAX_STREAK`, `STREAK_SCALE`, `SPEED_SMOOTHING`, `REST_STREAK_ANGULAR`.
- `App.jsx` → `DISSOLVE_DURATION` (matches the 0.5s CSS fade), audio volumes/fades.

## Conventions

- Respect `prefers-reduced-motion` in any new CSS animation *and* any new JS-driven motion (see drift weight and the reduced-motion media check in Scene.jsx).
- Keep the visual language restrained — one signature element per screen.
- The user works by pasting reviewed snippets: propose remove/add blocks and explain what/why rather than silently rewriting files, unless asked to edit directly.
- Verify visual changes by running the dev server and looking (the user often has it on localhost:5173). Note: browser rendering suspends when the Chrome window is occluded — screenshots of a hidden window show stale frames.