# Constellation

Hackathon project (Hoobit Hacks 2026). Read this whole file before making changes — it captures decisions and context that aren't visible from the code alone.

## Concept

A spatial interface for AI: instead of a chatbot with a text box and vertical transcript, AI interactions exist as objects in a 3D space. User types what they want to build, an AI would eventually construct requirements/architecture/database/wireframes as interconnected nodes in that space.

**This is an experience prototype, not a working product.** Philosophy: build the feeling before the functionality. Do not add AI agents, database generation, or full app generation without being asked.

## Design direction

Inspiration: Iron Man JARVIS interface, Interstellar, Apple product design, space/constellation metaphors.

Avoid: cyberpunk aesthetics, neon gamer UI, overly complex HUDs, generic chatbot appearance.

The feeling: "an intelligent system is waking up." Minimal, elegant, futuristic, calm — but also huge and full at once (dense enough to feel like real matter, spacious enough not to feel cluttered).

## Current build status

**Built:** black-void landing screen with a centered prompt (typing-out placeholder, breathing glow, single restrained orbit-ring), Enter key triggers a dissolve → camera dolly through a custom starfield (hyperspace warp effect) → settles into open space.

**Explicitly deferred — do not build without being asked:**
- Nodes (Requirements/Database/Architecture/Wireframe) and connecting beams. A first attempt was built and explicitly rejected by the user as looking bad — needs a fresh design pass before rebuilding, not a repeat of that attempt.
- The "AI orb" (the glow/seed-point during the dissolve) persisting permanently with idle/listening/thinking states. Concept is agreed but not implemented — currently it just fades out once the camera dolly finishes.
- Actual AI integration (OpenAI call processing the typed prompt). Enter currently only triggers the visual transition, nothing is sent anywhere.
- Subtle/calm dolly mode. This was explicitly removed — hyperspace is the only mode. Don't reintroduce a calm mode without direction.

## Tech stack

React + Vite, plain CSS (no framework), React Three Fiber (`@react-three/fiber`) + `three` for the 3D starfield/camera. `@react-three/drei` is installed but no longer used (the starfield is fully custom now) — fine to leave or remove.

## File structure

```
src/
  App.jsx              — phase state machine (landing/dissolving/constellation), prompt UI, sound triggers
  App.css              — all 2D UI styling
  Scene.jsx            — R3F Canvas + camera dolly
  HyperspaceStars.jsx  — custom streaking starfield
  index.css            — global reset, font, base background
public/
  audio/
    ambient-hum.mp3     — referenced by App.jsx, not yet added by user
    enter-whoosh.mp3     — referenced by App.jsx, not yet added by user
```

## Known gotchas — read before touching HyperspaceStars.jsx

This project's linter enforces strict React purity rules (no mutating/reading refs during render, effect cleanups must capture ref values into a local variable rather than reading `.current` again). R3F's normal pattern — mutating a Three.js buffer every frame via `useFrame` — looks like a violation to this linter even though it's the correct, intended R3F pattern.

The pattern that satisfies the linter: all mutable Three.js state (geometry, star data, previous-frame values) lives in a single `useRef` object, touched only inside `useEffect` or `useFrame`, never in the render body. The component's JSX return is just `<group ref={groupRef} />`; the real scene graph is built imperatively in a `useEffect` on mount and mutated every frame in `useFrame`. If a similar error appears while extending this file, the fix is almost always: move the read/write into `useEffect`/`useFrame`, and capture any ref value into a local `const` before using it in a cleanup function.

**A star-field bug fix was attempted and reverted**: an attempt to fix stars being invisible at rest (by scaling streak length with distance) also added idle rotation of the star group, which caused visible streaks to appear to drag in from one side of the screen. Root cause: streak direction was computed from each star's *unrotated* position, then the whole group was rotated afterward, so direction and rendered position fell out of sync. **Lesson: don't bundle multiple changes to this file together** — the visibility fix, color/blending changes, and idle rotation should each be tested in isolation before combining them. The current file (`HyperspaceStars.jsx`) is the last known-good version, with two open, not-yet-fixed problems: (1) stars aren't visually present at rest (landing screen) or once the dolly settles, and (2) streak length snaps to zero instantly when the camera stops instead of decaying smoothly. Tuning knobs at the top of the file: `MIN_STREAK`, `MAX_STREAK`, `STREAK_SCALE`.

## Conventions

- Respect `prefers-reduced-motion` in any new CSS animation, matching the existing pattern in `App.css`.
- Keep the visual language restrained — one signature element per screen (e.g. the single orbit-ring), not multiple competing effects.
- Full code snippets in chat responses are not needed here since you can read the files directly — just make the edit and explain what changed and why.
