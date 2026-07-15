import { useRef, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// two skies: the constellation's, and the quieter one inside a node.
// switching variant re-seeds the whole field — done behind the veil flash
const VARIANTS = {
  galaxy: { count: 1400, opacity: 0.85 },
  interior: { count: 450, opacity: 0.5 },
}
const FIELD_MIN_RADIUS = 40
const FIELD_MAX_RADIUS = 300

const MAX_STREAK = 40
const STREAK_SCALE = 18 // tune this to taste — higher = more dramatic streaking
const SPEED_SMOOTHING = 6 // damp lambda: lower = streaks take longer to decay after the camera stops

// Resting (non-warp) length is a fraction of distance rather than a flat
// world-space size, so every star reads as the same small speck on screen
// regardless of how close it sits inside the shell — a flat length made the
// near stars (close to FIELD_MIN_RADIUS) look like long dashes.
const REST_STREAK_ANGULAR = 0.002

function randomPointInShell(minR, maxR) {
  const r = minR + Math.random() * (maxR - minR)
  const theta = Math.random() * Math.PI * 2
  const phi = Math.acos(2 * Math.random() - 1)
  return new THREE.Vector3(
    r * Math.sin(phi) * Math.cos(theta),
    r * Math.sin(phi) * Math.sin(theta),
    r * Math.cos(phi)
  )
}

// reused scratch vectors to avoid per-frame allocation
const toCam = new THREE.Vector3()
const camForward = new THREE.Vector3()
const perp = new THREE.Vector3()
const half = new THREE.Vector3()
const p1 = new THREE.Vector3()
const p2 = new THREE.Vector3()

export default function HyperspaceStars({ warp, variant = 'galaxy' }) {
  // groupRef is only ever touched inside useEffect/useFrame, never read during render
  const groupRef = useRef()
  // everything mutable (geometry, star data, camera-speed state) lives here,
  // completely outside React's render cycle
  const dataRef = useRef({
    geometry: null,
    starPositions: null,
    prevCamZ: null,
    smoothedSpeed: 0,
  })
  // linter-safe prop mirror: read inside useFrame, updated only in an effect
  const warpRef = useRef(warp)
  useEffect(() => {
    warpRef.current = warp
  }, [warp])

  useEffect(() => {
    const group = groupRef.current
    const cfg = VARIANTS[variant] ?? VARIANTS.galaxy

    const starPositions = Array.from({ length: cfg.count }, () =>
      randomPointInShell(FIELD_MIN_RADIUS, FIELD_MAX_RADIUS)
    )
    const positions = new Float32Array(cfg.count * 2 * 3)

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))

    const material = new THREE.LineBasicMaterial({
      color: '#ffffff',
      transparent: true,
      opacity: cfg.opacity,
    })

    const line = new THREE.LineSegments(geometry, material)
    group.add(line)

    dataRef.current = { geometry, starPositions, prevCamZ: null, smoothedSpeed: 0 }

    return () => {
      group.remove(line)
      geometry.dispose()
      material.dispose()
    }
  }, [variant])

  useFrame((state, delta) => {
    const data = dataRef.current
    if (!data.geometry) return

    const cam = state.camera
    cam.getWorldDirection(camForward)
    if (data.prevCamZ === null) data.prevCamZ = cam.position.z
    // streaking is an intro-only effect: outside the dolly the measured
    // speed is forced to 0, so free-camera zoom/pan never triggers warp.
    // smoothedSpeed still decays through the damp — no snap at handoff
    const speed = warpRef.current && delta > 0
      ? Math.abs(cam.position.z - data.prevCamZ) / delta
      : 0
    data.prevCamZ = cam.position.z

    // exponential smoothing: streak length follows velocity with momentum,
    // ramping in and decaying out instead of snapping (CLAUDE.md issue #2)
    data.smoothedSpeed = THREE.MathUtils.damp(
      data.smoothedSpeed, speed, SPEED_SMOOTHING, delta
    )

    const positions = data.geometry.attributes.position.array

    for (let i = 0; i < data.starPositions.length; i++) {
      const star = data.starPositions[i]

      toCam.subVectors(star, cam.position)
      const dist = Math.max(toCam.length(), 1)

      // Streaks must radiate across the screen, not toward the camera: a
      // segment built along the camera-to-star ray projects to a single
      // point (both ends share the same screen position), so use the
      // component of the sightline perpendicular to the view axis instead.
      const depth = toCam.dot(camForward)
      perp.copy(toCam).addScaledVector(camForward, -depth)
      if (perp.lengthSq() > 1e-6) {
        perp.normalize()
      } else {
        perp.set(0, 0, 0)
      }

      // purely velocity-driven, floored at the resting speck size. The old
      // flat MIN_STREAK baseline is gone — 0.4 world units subtends a huge
      // angle for a star that randomly lands near the camera, which is what
      // made some stars render as lines when the camera was slow-but-active
      const warpStreak = Math.min((data.smoothedSpeed * STREAK_SCALE) / dist, MAX_STREAK)
      const streak = Math.max(REST_STREAK_ANGULAR * dist, warpStreak)

      half.copy(perp).multiplyScalar(streak / 2)
      p1.copy(star).sub(half)
      p2.copy(star).add(half)

      const idx = i * 6
      positions[idx] = p1.x
      positions[idx + 1] = p1.y
      positions[idx + 2] = p1.z
      positions[idx + 3] = p2.x
      positions[idx + 4] = p2.y
      positions[idx + 5] = p2.z
    }

    data.geometry.attributes.position.needsUpdate = true
  })

  return <group ref={groupRef} />
}