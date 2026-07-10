import { useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import HyperspaceStars from './HyperspaceStars'

const easeInExpo = (t) => (t === 0 ? 0 : Math.pow(2, 10 * (t - 1)))

const DOLLY = {
  duration: 1.8,
  startZ: 1,
  targetZ: 220, // stays inside the star shell (radius 40-300) so stars remain visible after the dolly
  startFov: 45,
  endFov: 90,
  ease: easeInExpo,
}

function CameraRig({ active, onComplete }) {
  const elapsed = useRef(0)
  const done = useRef(false)

  useFrame((state, delta) => {
    if (!active || done.current) return

    elapsed.current += delta
    const t = Math.min(elapsed.current / DOLLY.duration, 1)
    const eased = DOLLY.ease(t)

    state.camera.position.z = DOLLY.startZ + eased * (DOLLY.targetZ - DOLLY.startZ)
    state.camera.fov = DOLLY.startFov + eased * (DOLLY.endFov - DOLLY.startFov)
    state.camera.updateProjectionMatrix()

    if (t >= 1) {
      done.current = true
      onComplete?.()
    }
  })

  return null
}

export default function Scene({ dollyActive, onDollyComplete }) {
  return (
    <Canvas
      className="scene-canvas"
      camera={{ position: [0, 0, DOLLY.startZ], fov: DOLLY.startFov }}
      gl={{ antialias: true }}
    >
      <HyperspaceStars active={dollyActive} />
      <CameraRig active={dollyActive} onComplete={onDollyComplete} />
    </Canvas>
  )
}