import { useRef, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const STAR_COUNT = 3000
const FIELD_MIN_RADIUS = 40
const FIELD_MAX_RADIUS = 300

const MIN_STREAK = 0.4 // baseline added on top of motion streak during warp — unrelated to the resting look
const MAX_STREAK = 40
const STREAK_SCALE = 18 // tune this to taste — higher = more dramatic streaking

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

export default function HyperspaceStars({ active }) {
  // groupRef is only ever touched inside useEffect/useFrame, never read during render
  const groupRef = useRef()
  // everything mutable (geometry, star data, previous camera z) lives here,
  // completely outside React's render cycle
  const dataRef = useRef({ geometry: null, starPositions: null, prevCamZ: null })
  const activeRef = useRef(active)
  useEffect(() => {
    activeRef.current = active
  }, [active])

  useEffect(() => {
    const group = groupRef.current

    const starPositions = Array.from({ length: STAR_COUNT }, () =>
      randomPointInShell(FIELD_MIN_RADIUS, FIELD_MAX_RADIUS)
    )
    const positions = new Float32Array(STAR_COUNT * 2 * 3)

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))

    const material = new THREE.LineBasicMaterial({
      color: '#ffffff',
      transparent: true,
      opacity: 0.85,
    })

    const line = new THREE.LineSegments(geometry, material)
    group.add(line)

    dataRef.current = { geometry, starPositions, prevCamZ: null }

    return () => {
      group.remove(line)
      geometry.dispose()
      material.dispose()
    }
  }, [])

  useFrame((state) => {
    const data = dataRef.current
    if (!data.geometry) return

    const cam = state.camera
    cam.getWorldDirection(camForward)
    if (data.prevCamZ === null) data.prevCamZ = cam.position.z
    const speed = Math.abs(cam.position.z - data.prevCamZ) * 60 // approx per-second velocity
    data.prevCamZ = cam.position.z

    const positions = data.geometry.attributes.position.array

    for (let i = 0; i < STAR_COUNT; i++) {
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

      const streak = activeRef.current
        ? Math.min(MIN_STREAK + (speed * STREAK_SCALE) / dist, MAX_STREAK)
        : REST_STREAK_ANGULAR * dist

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