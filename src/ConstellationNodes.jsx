import { useRef, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'

// Tree: prompt → requirements → everything else (requirements drive the
// design phase). Laid out as a diagonal flow — idea enters lower-left,
// work cascades up-right — with irregular angles and z-depth so it reads
// as a constellation, not an org chart. `size` scales the star: the origin
// is a memory, slightly smaller than the artifacts it spawned.
const NODES = [
  { id: 'origin', label: 'YOUR PROMPT', position: [-190, -95, 0], parent: null, size: 0.75 },
  { id: 'requirements', label: 'REQUIREMENTS', position: [-60, -10, 0], parent: 'origin', size: 1.2 },
  { id: 'architecture', label: 'ARCHITECTURE', position: [95, 85, 10], parent: 'requirements', size: 1 },
  { id: 'database', label: 'DATABASE', position: [135, -5, -15], parent: 'requirements', size: 1 },
  { id: 'wireframes', label: 'WIREFRAMES', position: [75, -105, 8], parent: 'requirements', size: 1 },
]

// edge list derived from each node's parent — [fromIndex, toIndex]
const INDEX_BY_ID = Object.fromEntries(NODES.map((n, i) => [n.id, i]))
const EDGES = NODES.filter((n) => n.parent).map((n) => [
  INDEX_BY_ID[n.parent],
  INDEX_BY_ID[n.id],
])

const BIRTH_STAGGER = 0.45 // seconds between each star igniting
const BIRTH_DURATION = 0.9 // ignition ramp length per star
const EDGE_LEAD = 0.25     // edge starts drawing this long before its star
const EDGE_OPACITY = 0.28  // resting edge brightness — deliberately faint
const CORE_SIZE = 30        // sprite size in world units

const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3)

export default function ConstellationNodes() {
  // same house pattern as HyperspaceStars: JSX renders an empty group,
  // the real scene graph is built imperatively on mount and mutated
  // only inside useEffect/useFrame (keeps the purity linter happy)
  const groupRef = useRef()
  const dataRef = useRef({ sprites: [], edges: [], started: null })

  useEffect(() => {
    const group = groupRef.current

    // radial glow drawn once onto a small canvas → texture for every star.
    // cheaper and softer than real point lights or bloom
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 128
    const ctx = canvas.getContext('2d')
    const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64)
    grad.addColorStop(0, 'rgba(255,255,255,1)')
    grad.addColorStop(0.3, 'rgba(224,236,255,0.9)')
    grad.addColorStop(0.55, 'rgba(150,190,255,0.22)')
    grad.addColorStop(1, 'rgba(150,190,255,0)')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, 128, 128)
    const texture = new THREE.CanvasTexture(canvas)

    const sprites = NODES.map((node) => {
      const material = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        opacity: 0,
        depthWrite: false, // glows shouldn't occlude each other
      })
      const sprite = new THREE.Sprite(material)
      sprite.position.set(...node.position)
      sprite.scale.setScalar(0.001)
      group.add(sprite)
      return sprite
    })

    const edges = EDGES.map(([fromIdx, toIdx]) => {
      const geometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(...NODES[fromIdx].position),
        new THREE.Vector3(...NODES[toIdx].position),
      ])
      const material = new THREE.LineBasicMaterial({
        color: '#ffffff',
        transparent: true,
        opacity: 0,
      })
      const line = new THREE.Line(geometry, material)
      group.add(line)
      return line
    })

    dataRef.current = { sprites, edges, started: null }

    return () => {
      sprites.forEach((s) => {
        group.remove(s)
        s.material.dispose()
      })
      edges.forEach((l) => {
        group.remove(l)
        l.geometry.dispose()
        l.material.dispose()
      })
      texture.dispose()
    }
  }, [])

  useFrame((state) => {
    const data = dataRef.current
    if (!data.sprites.length) return
    if (data.started === null) data.started = state.clock.elapsedTime
    const t = state.clock.elapsedTime - data.started

    NODES.forEach((node, i) => {
      const p = THREE.MathUtils.clamp(
        (t - i * BIRTH_STAGGER) / BIRTH_DURATION, 0, 1
      )
      const eased = easeOutCubic(p)
      const sprite = data.sprites[i]
      // idle breathing: small, slow, per-star phase offset so the sky
      // shimmers organically instead of pulsing in unison
      const time = state.clock.elapsedTime
      const breathe = 1 + 0.05 * Math.sin(time * 0.9 + i * 1.7)
      sprite.material.opacity = eased * (0.9 + 0.1 * Math.sin(time * 1.3 + i * 2.3))
      // brief flare past full size, settling back — "ignition", not "fade-in"
      const overshoot = 1 + 0.35 * Math.sin(p * Math.PI)
      sprite.scale.setScalar(
        Math.max(eased * CORE_SIZE * (node.size ?? 1) * overshoot * breathe, 0.001)
      )
    })

    data.edges.forEach((line, i) => {
      const nodeStart = (i + 1) * BIRTH_STAGGER
      const p = THREE.MathUtils.clamp(
        (t - (nodeStart - EDGE_LEAD)) / BIRTH_DURATION, 0, 1
      )
      line.material.opacity = easeOutCubic(p) * EDGE_OPACITY
    })
  })

  return (
    <group ref={groupRef}>
      {NODES.map((node, i) => (
        <Html
          key={node.id}
          position={[node.position[0], node.position[1] - 26, node.position[2]]}
          center
          distanceFactor={340}
          style={{ pointerEvents: 'none' }}
        >
          <div
            className="node-label"
            style={{ animationDelay: `${i * BIRTH_STAGGER + 0.5}s` }}
          >
            {node.label}
          </div>
        </Html>
      ))}
    </group>
  )
}