import { useRef, useEffect } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import HyperspaceStars from './HyperspaceStars'
import ConstellationNodes from './ConstellationNodes'
import { NODES } from './constellationData'
import * as THREE from 'three'

// slow ignition → violent mid-jump → smooth settle. easeOutCubic had its
// peak velocity at frame zero (instant warp); this gives the launch a beat
// of thrust build-up so the prompt visibly starts drifting before the rip.
const easeInOutCubic = (t) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2

const DOLLY = {
  duration: 2.2, // longer than before so the wind-up doesn't eat the cruise
  startZ: 1,
  targetZ: 220, // stays inside the star shell (radius 40-300) so stars remain visible after the dolly
  startFov: 45,
  endFov: 90,
  ease: easeInOutCubic,
}

const PROMPT_REFERENCE_DISTANCE = 30 // virtual distance to the prompt: larger = shrinks more gradually
const PROMPT_VANISH_SCALE = 0.05 // below this on-screen scale, unmount the prompt
const PROMPT_FADE_BOOST = 2 // opacity = scale × this — solid until ~half size, then fades out
const PROMPT_MAX_BLUR = 2.5 // px of blur once fully receded — melts the crisp UI edges
const PROMPT_MAX_GLOW = 2 // extra brightness once fully receded — small + bright + blurred = star
const DIVE_STANDOFF = 26

// free camera (post-dolly): inputs never move the camera directly — they
// write to a target, and the camera glides toward it every frame
const FREE_CAM = {
  damp: 4,       // follow tightness — higher snaps, lower floats
  zoomStep: 1.1, // zoom multiplier per 100px of wheel delta
  minZ: 80,      // closest approach to the node plane
  maxZ: 320,     // far enough to see everything, not the starfield's edge
  boundsX: [-260, 205], // pan limits: node extents plus breathing room,
  boundsY: [-175, 155], // so nobody strands themselves in empty void
  driftAmp: 3,       // world units of idle wander — a whisper, not a wobble
  driftFreqX: 0.21,  // rad/s; the two frequencies are deliberately unrelated,
  driftFreqY: 0.14,  // so the wander path never visibly repeats
  driftIdleDelay: 2, // seconds of stillness before the drift breathes back in
  driftDamp: 1.2,    // slow fade for the drift weight — it eases in, not pops
}

function CameraRig({
  active,
  onComplete,
  promptRef,
  onPromptFar,
  holdDriftRef,
  driftOffsetRef,
  diveNodeId,
}) {
  const divingRef = useRef(false)
  const savedView = useRef(null)
  // effects record INTENT only — a pending command, drained by useFrame.
  // Mutating free.current inside an effect makes the compiler freeze it,
  // which breaks every other mutation site (pan, zoom, handoff)
  const diveCmd = useRef(null)
  useEffect(() => {
    divingRef.current = !!diveNodeId
    diveCmd.current = diveNodeId ? { enter: diveNodeId } : { exit: true }
  }, [diveNodeId])
  const elapsed = useRef(0)
  const done = useRef(false)
  const promptGone = useRef(false)
  // null while the dolly runs; becomes {x,y,z} at handoff — this IS the mode switch
  const free = useRef(null)
  // raw pixel deltas accumulate here between frames; useFrame drains them.
  // handlers never touch the camera — they don't know world units exist
  const drag = useRef({ active: false, lastX: 0, lastY: 0, dx: 0, dy: 0 })
  // idle-drift state: w ramps 0→1 with stillness, back to 0 on any input
  const driftRef = useRef({ w: 0, lastInput: 0 })
  const reducedMotion = useRef(false)
  useEffect(() => {
    reducedMotion.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }, [])


  // wheel → multiplicative zoom on the target. Multiplicative because zoom
  // perception is logarithmic: equal scroll should feel like equal zoom
  // whether you're close or far
  useEffect(() => {
    const noteInput = () => {
      driftRef.current.lastInput = performance.now() / 1000
    }

    const onWheel = (e) => {
      const f = free.current
      if (!f || divingRef.current) return // no manual nav during a dive/interior
      e.preventDefault()
      noteInput()
      const oldZ = f.z
      const factor = Math.pow(FREE_CAM.zoomStep, e.deltaY / 100)
      const newZ = THREE.MathUtils.clamp(oldZ * factor, FREE_CAM.minZ, FREE_CAM.maxZ)

      // zoom toward the cursor: shift the target so the world point under
      // the pointer stays under it. Shift = cursor's offset from center
      // (ndc, -1..1) × how much the visible half-extent changed (Δz × tan)
      const tanHalf = Math.tan((DOLLY.endFov * Math.PI) / 360)
      const aspect = window.innerWidth / window.innerHeight
      const ndcX = (e.clientX / window.innerWidth) * 2 - 1
      const ndcY = -((e.clientY / window.innerHeight) * 2 - 1)
      f.x = THREE.MathUtils.clamp(
        f.x + ndcX * tanHalf * aspect * (oldZ - newZ),
        FREE_CAM.boundsX[0], FREE_CAM.boundsX[1]
      )
      f.y = THREE.MathUtils.clamp(
        f.y + ndcY * tanHalf * (oldZ - newZ),
        FREE_CAM.boundsY[0], FREE_CAM.boundsY[1]
      )
      f.z = newZ
    }
    const onDown = (e) => {
      if (!free.current || divingRef.current) return
      if (e.target.closest('button, input')) return // UI keeps its clicks
      const d = drag.current
      d.active = true
      d.lastX = e.clientX
      d.lastY = e.clientY
      noteInput()
    }
    const onMove = (e) => {
      const d = drag.current
      if (!d.active) return
      d.dx += e.clientX - d.lastX
      d.dy += e.clientY - d.lastY
      d.lastX = e.clientX
      d.lastY = e.clientY
      noteInput()
    }
    const onUp = () => {
      drag.current.active = false
    }

    window.addEventListener('wheel', onWheel, { passive: false })
    window.addEventListener('pointerdown', onDown)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('wheel', onWheel)
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [])

  useFrame((state, delta) => {
    // free mode: glide toward the target. damp is frame-rate independent,
    // so the ease-out feels the same on a 60Hz and a 144Hz screen
    if (free.current) {
      const f = free.current
      const cam = state.camera

      // drain any pending dive command before regular inputs
      const cmd = diveCmd.current
      if (cmd) {
        diveCmd.current = null
        if (cmd.enter) {
          const node = NODES.find((n) => n.id === cmd.enter)
          if (node) {
            savedView.current = { x: f.x, y: f.y, z: f.z }
            f.x = node.position[0]
            f.y = node.position[1]
            f.z = node.position[2] + DIVE_STANDOFF
          }
        } else if (savedView.current) {
          f.x = savedView.current.x
          f.y = savedView.current.y
          f.z = savedView.current.z
          savedView.current = null
        }
      }

      // drain accumulated drag pixels → world units. worldPerPixel depends
      // on current distance and fov, so pan speed auto-scales with zoom
      const d = drag.current
      if (d.dx !== 0 || d.dy !== 0) {
        const worldPerPixel =
          (2 * cam.position.z * Math.tan((cam.fov * Math.PI) / 360)) /
          state.size.height
        // grab the sky: content follows the hand, so the camera moves opposite.
        // screen y grows downward, world y grows upward — hence the sign flip
        f.x = THREE.MathUtils.clamp(
          f.x - d.dx * worldPerPixel, FREE_CAM.boundsX[0], FREE_CAM.boundsX[1]
        )
        f.y = THREE.MathUtils.clamp(
          f.y + d.dy * worldPerPixel, FREE_CAM.boundsY[0], FREE_CAM.boundsY[1]
        )
        d.dx = 0
        d.dy = 0
      }

      // the follow damps the base, never the camera directly
      f.baseX = THREE.MathUtils.damp(f.baseX, f.x, FREE_CAM.damp, delta)
      f.baseY = THREE.MathUtils.damp(f.baseY, f.y, FREE_CAM.damp, delta)
      f.baseZ = THREE.MathUtils.damp(f.baseZ, f.z, FREE_CAM.damp, delta)

      // drift weight: eases toward 1 after driftIdleDelay of stillness,
      // toward 0 the instant the user touches anything
      const dr = driftRef.current
      const idle = !drag.current.active && performance.now() / 1000 - dr.lastInput > FREE_CAM.driftIdleDelay
      const wTarget =
        idle && !holdDriftRef?.current && !divingRef.current && !reducedMotion.current
          ? 1
          : 0
      dr.w = THREE.MathUtils.damp(dr.w, wTarget, FREE_CAM.driftDamp, delta)

            const t = state.clock.elapsedTime
      const driftX = dr.w * FREE_CAM.driftAmp * Math.sin(t * FREE_CAM.driftFreqX)
      const driftY = dr.w * FREE_CAM.driftAmp * Math.cos(t * FREE_CAM.driftFreqY)
      cam.position.x = f.baseX + driftX
      cam.position.y = f.baseY + driftY
      cam.position.z = f.baseZ
      if (driftOffsetRef) {
        driftOffsetRef.current.x = driftX
        driftOffsetRef.current.y = driftY
      }
      return
    }

    if (!active || done.current) return

    elapsed.current += delta
    const t = Math.min(elapsed.current / DOLLY.duration, 1)
    const eased = DOLLY.ease(t)

    state.camera.position.z = DOLLY.startZ + eased * (DOLLY.targetZ - DOLLY.startZ)
    state.camera.fov = DOLLY.startFov + eased * (DOLLY.endFov - DOLLY.startFov)
    state.camera.updateProjectionMatrix()

    if (promptRef?.current && !promptGone.current) {
      const traveled = eased * (DOLLY.targetZ - DOLLY.startZ)

      // real perspective, two factors: apparent size falls off with distance
      // (ref / (ref + traveled)), and the widening fov shrinks on-axis
      // objects further (ratio of the half-fov tangents)
      const fovShift = Math.tan((DOLLY.startFov * Math.PI) / 360) / Math.tan((state.camera.fov * Math.PI) / 360)
      const scale = (PROMPT_REFERENCE_DISTANCE / (PROMPT_REFERENCE_DISTANCE + traveled)) * fovShift

      // scale is the geometry; opacity is distance falloff; blur + brightness
      // is what bloom does to a small bright object — together the box stops
      // reading as UI and dissolves into a point of light
      const recede = 1 - scale
      const el = promptRef.current
      el.style.transform = `scale(${scale})`
      el.style.opacity = Math.min(1, scale * PROMPT_FADE_BOOST)
      el.style.filter = `blur(${recede * PROMPT_MAX_BLUR}px) ` + `brightness(${1 + recede * PROMPT_MAX_GLOW})`

      if (scale < PROMPT_VANISH_SCALE) {
        promptGone.current = true
        onPromptFar?.()
      }
    }
    if (t >= 1) {
      done.current = true
      // handoff: free mode begins exactly where the dolly parked
      free.current = {
        x: state.camera.position.x,
        y: state.camera.position.y,
        z: state.camera.position.z,
        baseX: state.camera.position.x,
        baseY: state.camera.position.y,
        baseZ: state.camera.position.z,
      }
      onComplete?.()
    }
  })

  return null
}

export default function Scene({
  dollyActive,
  onDollyComplete,
  promptRef,
  onPromptFar,
  showNodes,
  muted,
  diveNodeId,
  onEnterNode,
}) {
  // shared flag: ConstellationNodes writes "a node is hovered", CameraRig
  // reads it to hold the idle drift — reading deserves a still camera
  const hoverHoldRef = useRef(false)
  // CameraRig publishes its current drift offset here; hover detection
  // subtracts it — hover is tested against the drift-free camera, so
  // camera wander can never flap the hover state (no feedback loop)
  const driftOffsetRef = useRef({ x: 0, y: 0 })
  return (
    <Canvas
      className="scene-canvas"
      camera={{ position: [0, 0, DOLLY.startZ], fov: DOLLY.startFov }}
      gl={{ antialias: true }}
    >
      <HyperspaceStars warp={dollyActive} />
      {showNodes && (
        <ConstellationNodes
          muted={muted}
          hoverHoldRef={hoverHoldRef}
          driftOffsetRef={driftOffsetRef}
          onEnterNode={onEnterNode}
          interactive={!diveNodeId}
        />
      )}
      <CameraRig
        active={dollyActive}
        onComplete={onDollyComplete}
        promptRef={promptRef}
        onPromptFar={onPromptFar}
        holdDriftRef={hoverHoldRef}
      />
    </Canvas>
  )
}