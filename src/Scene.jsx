import { useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import HyperspaceStars from './HyperspaceStars'
import ConstellationNodes from './ConstellationNodes'

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

function CameraRig({ active, onComplete, promptRef, onPromptFar }) {
  const elapsed = useRef(0)
  const done = useRef(false)
  const promptGone = useRef(false)

  useFrame((state, delta) => {
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
      onComplete?.()
    }
  })

  return null
}

export default function Scene({ dollyActive, onDollyComplete, promptRef, onPromptFar, showNodes }) {
  return (
    <Canvas
      className="scene-canvas"
      camera={{ position: [0, 0, DOLLY.startZ], fov: DOLLY.startFov }}
      gl={{ antialias: true }}
    >
      {/* fades distant stars into black — kills the "fog of stars" cloud
          that stacks up at screen center when looking across the shell */}
      {/* <fog attach="fog" args={['#000000', 120, 420]} /> */}
      <HyperspaceStars /> 
      {showNodes && <ConstellationNodes />}
      <CameraRig
        active={dollyActive}
        onComplete={onDollyComplete}
        promptRef={promptRef}
        onPromptFar={onPromptFar}
      />
    </Canvas>
  )
}