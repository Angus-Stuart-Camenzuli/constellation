import { useRef, useEffect, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { NODES, EDGES } from './constellationData'

const BIRTH_STAGGER = 0.45 // seconds between each star igniting
const BIRTH_DURATION = 0.9 // ignition ramp length per star
const EDGE_LEAD = 0.25     // edge starts drawing this long before its star
const EDGE_OPACITY = 0.28  // resting edge brightness — deliberately faint
const CORE_SIZE = 30        // sprite size in world units

// hover: ONE damped weight per node drives every response (scale, glow,
// ring, edges, label, stilled breathing) — they can never fall out of sync
const HOVER_DAMP = 6            // bloom speed — roughly a half-second ease
const HOVER_SCALE_BOOST = 0.25  // +25% size at full hover
const HOVER_RING_OPACITY = 0.35 // full thin white ring = "you're here" (the AI's arc stays blue + partial)
const EDGE_HOVER_OPACITY = 0.5  // edges touching the hovered node lift to this
const HOVER_MIN_RADIUS_PX = 16  // hit-area floor so distant stars stay hoverable
const LABEL_REST_ALPHA = 0.55
const LABEL_HOVER_ALPHA = 0.95

// static node positions as vectors + a scratch vector for projection math
const NODE_VECS = NODES.map((n) => new THREE.Vector3(...n.position))
const proj = new THREE.Vector3()

const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3)

export default function ConstellationNodes({ muted, hoverHoldRef, driftOffsetRef, onEnterNode, interactive = true, visible = true }) {
  // same house pattern as HyperspaceStars: JSX renders an empty group,
  // the real scene graph is built imperatively on mount and mutated
  // only inside useEffect/useFrame (keeps the purity linter happy)
  const groupRef = useRef()
  const dataRef = useRef({ sprites: [], edges: [], started: null })
  const labelRefs = useRef([])
  // one panel serves all nodes: React state decides WHICH node it shows
  // (rare change → setState is fine), the hover weight drives its opacity
  // per-frame through a ref (no re-renders)
  const [panelNode, setPanelNode] = useState(-1)
  const panelNodeRef = useRef(-1)
  const panelRef = useRef(null)
  const mutedRef = useRef(muted)
  const interactiveRef = useRef(interactive)
  const onEnterNodeRef = useRef(onEnterNode)
  const visibleRef = useRef(visible)
  useEffect(() => {
    mutedRef.current = muted
    interactiveRef.current = interactive
    onEnterNodeRef.current = onEnterNode
    visibleRef.current = visible
  }, [muted, interactive, onEnterNode, visible])

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

    // hover rings: thin full circles, invisible until hover raises them.
    // they live in the node plane (no billboarding) — the slight perspective
    // skew at screen edges reads as depth, not error
    const rings = NODES.map((node) => {
      const radius = CORE_SIZE * (node.size ?? 1) * 0.42
      const geometry = new THREE.RingGeometry(radius - 0.3, radius + 0.3, 64)
      const material = new THREE.MeshBasicMaterial({
        color: '#ffffff',
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
      const ring = new THREE.Mesh(geometry, material)
      ring.position.set(...node.position)
      group.add(ring)
      return ring
    })

    // pointer state banked into a plain object; useFrame does all the math.
    // hover is suppressed while a button is down so drags don't flicker it
    const pointer = { x: 0, y: 0, has: false, down: false, downX: 0, downY: 0, downHovered: -1 }
    const onMove = (e) => {
      pointer.x = e.clientX
      pointer.y = e.clientY
      pointer.has = true
    }
    const onDown = (e) => {
      pointer.down = true
      pointer.downX = e.clientX
      pointer.downY = e.clientY
      // capture the hover target at press time — hover detection pauses
      // while the button is down, so data.hovered is already -1 by release
      pointer.downHovered = dataRef.current.hovered
    }
    const onUp = (e) => {
      pointer.down = false
      // a click is a press that didn't travel — drags never enter nodes
      const moved = Math.hypot(e.clientX - pointer.downX, e.clientY - pointer.downY)
      // const data = dataRef.current
      if (
        moved < 6 &&
        interactiveRef.current &&
        pointer.downHovered >= 0 &&
        NODES[pointer.downHovered].enterable !== false
      ) {
        onEnterNodeRef.current?.(NODES[pointer.downHovered].id)
      }
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerdown', onDown)
    window.addEventListener('pointerup', onUp)

    const tick = new Audio('/audio/hover-tick.mp3')
    tick.volume = 0.24
    tick.preload = 'auto'

    dataRef.current = {
      sprites,
      edges,
      rings,
      tick,
      prevHovered: -1,
      hoverW: NODES.map(() => 0),
      hovered: -1,
      started: null,
      pointer,
    }

    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointerup', onUp)
      sprites.forEach((s) => {
        group.remove(s)
        s.material.dispose()
      })
      edges.forEach((l) => {
        group.remove(l)
        l.geometry.dispose()
        l.material.dispose()
      })
      rings.forEach((r) => {
        group.remove(r)
        r.geometry.dispose()
        r.material.dispose()
      })
      texture.dispose()
    }
  }, [])

  useFrame((state, delta) => {
    const data = dataRef.current
    if (!data.sprites.length) return
    // hidden while inside a node — visibility toggles, component never
    // unmounts, so the birth cascade doesn't replay when you come back
    groupRef.current.visible = visibleRef.current
    if (!visibleRef.current) return
    if (data.started === null) data.started = state.clock.elapsedTime
    const t = state.clock.elapsedTime - data.started
    const time = state.clock.elapsedTime

    // hover detection — no raycast needed: stars are round, so "project to
    // screen, measure pixel distance to the pointer" is the whole test
    const { width, height } = state.size
    const ptr = data.pointer
    let hovered = -1
    if (interactiveRef.current && ptr.has && !ptr.down) {
      const tanHalf = Math.tan((state.camera.fov * Math.PI) / 360)
      let best = Infinity
      NODES.forEach((node, i) => {
        proj.copy(NODE_VECS[i]).project(state.camera)
        if (proj.z > 1) return // behind the camera
        // the star's hot core, converted to on-screen pixels at its depth
        const dist = state.camera.position.distanceTo(NODE_VECS[i])
        const pxPerUnit = height / 2 / (dist * tanHalf)
        // undo drift's screen-space shift: camera moving +x slides the star
        // -x on screen, so adding driftX·ppu back reprojects it as the
        // drift-free base camera would see it
        const drift = driftOffsetRef?.current
        const sx = ((proj.x + 1) / 2) * width + (drift ? drift.x * pxPerUnit : 0)
        const sy = ((1 - proj.y) / 2) * height - (drift ? drift.y * pxPerUnit : 0)
        const dPx = Math.hypot(ptr.x - sx, ptr.y - sy)
        const radius = Math.max(
          CORE_SIZE * (node.size ?? 1) * 0.35 * pxPerUnit,
          HOVER_MIN_RADIUS_PX
        )
        if (dPx < radius && dPx < best) {
          best = dPx
          hovered = i
        }
      })
    }
    data.hovered = hovered // the click/dive slice will read this
    if (hoverHoldRef) hoverHoldRef.current = hovered >= 0
    // repoint the summary panel when a new star is hovered; it stays
    // mounted on unhover so the fade-out can play
    if (hovered >= 0 && hovered !== panelNodeRef.current) {
      panelNodeRef.current = hovered
      setPanelNode(hovered)
    }
    if (panelRef.current && panelNodeRef.current >= 0) {
      const raw = data.hoverW[panelNodeRef.current]
      const w = raw > 0.99 ? 1 : raw // snap: crisp text needs exact 1 / exact 0px
      panelRef.current.style.opacity = w
      panelRef.current.style.transform = `translateY(${(1 - w) * 8}px)`
    }

    // tick once per arrival on a star — not while resting on it
    if (hovered !== data.prevHovered) {
      if (hovered >= 0 && !mutedRef.current) {
        data.tick.currentTime = 0
        data.tick.play().catch(() => {})
      }
      data.prevHovered = hovered
    }

    state.gl.domElement.style.cursor = hovered >= 0 ? 'pointer' : ''

    NODES.forEach((node, i) => {
      const w = THREE.MathUtils.damp(
        data.hoverW[i], i === hovered ? 1 : 0, HOVER_DAMP, delta
      )
      data.hoverW[i] = w

      const p = THREE.MathUtils.clamp(
        (t - i * BIRTH_STAGGER) / BIRTH_DURATION, 0, 1
      )
      const eased = easeOutCubic(p)
      const sprite = data.sprites[i]

      // breathing stills as hover rises — the star snaps to attention
      const calm = 1 - w
      const breathe = 1 + 0.05 * calm * Math.sin(time * 0.9 + i * 1.7)
      const flicker = 0.9 + 0.1 * calm * Math.sin(time * 1.3 + i * 2.3)
      sprite.material.opacity = eased * THREE.MathUtils.lerp(flicker, 1, w)

      // brief flare past full size, settling back — "ignition", not "fade-in"
      const overshoot = 1 + 0.35 * Math.sin(p * Math.PI)
      sprite.scale.setScalar(
        Math.max(
          eased * CORE_SIZE * (node.size ?? 1) * overshoot * breathe *
            (1 + HOVER_SCALE_BOOST * w),
          0.001
        )
      )

      // ring and label ride the same weight
      data.rings[i].material.opacity = eased * HOVER_RING_OPACITY * w
      const label = labelRefs.current[i]
      if (label) {
        label.style.color = `rgba(255, 255, 255, ${
          LABEL_REST_ALPHA + (LABEL_HOVER_ALPHA - LABEL_REST_ALPHA) * w
        })`
      }
    })

    data.edges.forEach((line, i) => {
      const [from, to] = EDGES[i]
      const nodeStart = (i + 1) * BIRTH_STAGGER
      const p = THREE.MathUtils.clamp(
        (t - (nodeStart - EDGE_LEAD)) / BIRTH_DURATION, 0, 1
      )
      // edges touching the hovered node lift — relationship preview
      const w = Math.max(data.hoverW[from], data.hoverW[to])
      line.material.opacity =
        easeOutCubic(p) *
        THREE.MathUtils.lerp(EDGE_OPACITY, EDGE_HOVER_OPACITY, w)
    })
  })

  return (
    <group ref={groupRef}>
      {visible && NODES.map((node, i) => (
        <Html
          key={node.id}
          position={[node.position[0], node.position[1] - 26, node.position[2]]}
          center
          distanceFactor={340}
          style={{ pointerEvents: 'none' }}
        >
          <div
            ref={(el) => {
              labelRefs.current[i] = el
            }}
            className="node-label"
            style={{ animationDelay: `${i * BIRTH_STAGGER + 0.5}s` }}
          >
            {node.label}
          </div>
        </Html>
      ))}
      {visible && panelNode >= 0 && (
        <Html
          position={[
            NODES[panelNode].position[0] + 24,
            NODES[panelNode].position[1] + 12,
            NODES[panelNode].position[2],
          ]}
          style={{ pointerEvents: 'none' }}
        >
          <div className="node-summary" ref={panelRef}>
            <div className="node-summary-title">{NODES[panelNode].label}</div>
            <div className="node-summary-blurb">{NODES[panelNode].blurb}</div>
            {NODES[panelNode].enterable !== false && (
              <div className="node-summary-hint">Click to enter</div>
            )}
          </div>
        </Html>
      )}
    </group>
  )
}