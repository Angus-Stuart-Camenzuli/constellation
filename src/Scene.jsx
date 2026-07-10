import { useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import HyperspaceStars from './HyperspaceStars'

// starts with real velocity immediately (no ramp-up), then settles into the target
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3)

const DOLLY = {
  duration: 1.8,
  startZ: 1,
  targetZ: 220, // stays inside the star shell (radius 40-300) so stars remain visible after the dolly
  startFov: 45,
  endFov: 90,
  ease: easeOutCubic,
}

// The prompt is treated as a fixed point the camera launches away from. Its
// on-screen scale each frame is real perspective math driven by the same
// z/fov values moving the camera — not a separate CSS animation — so it
// recedes at exactly the camera's speed. PROMPT_REFERENCE_DISTANCE is how far
// the point sits from the camera's start position: larger = shrinks more
// gradually, smaller = shrinks faster. (The camera's own startZ is ~0, so
// using startZ directly here would make it vanish almost instantly.)
const PROMPT_REFERENCE_DISTANCE = 30
const PROMPT_VANISH_SCALE = 0.05

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
      const fovShift =
        Math.tan((DOLLY.startFov * Math.PI) / 360) /
        Math.tan((state.camera.fov * Math.PI) / 360)
      const scale = Math.max(
        (PROMPT_REFERENCE_DISTANCE / (PROMPT_REFERENCE_DISTANCE + traveled)) * fovShift,
        0
      )

      promptRef.current.style.transform = `scale(${scale})`

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

export default function Scene({ dollyActive, onDollyComplete, promptRef, onPromptFar }) {
  return (
    <Canvas
      className="scene-canvas"
      camera={{ position: [0, 0, DOLLY.startZ], fov: DOLLY.startFov }}
      gl={{ antialias: true }}
    >
      <HyperspaceStars active={dollyActive} />
      <CameraRig
        active={dollyActive}
        onComplete={onDollyComplete}
        promptRef={promptRef}
        onPromptFar={onPromptFar}
      />
    </Canvas>
  )
}