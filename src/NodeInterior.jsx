import { Html } from '@react-three/drei'
import { NODES, BOARDS } from './constellationData'

// The inside of an artifact: its contents as glass frames floating in
// space around the node's position. Pure CSS entrance animation — nothing
// here is driven per-frame, so keyframes are safe (no inline-style clash).
export default function NodeInterior({ nodeId }) {
  const node = NODES.find((n) => n.id === nodeId)
  const frames = BOARDS[nodeId] ?? []
  if (!node) return null
  const [nx, ny, nz] = node.position

  return (
    <group>
      <Html
        position={[nx, ny, nz]}
        center
        distanceFactor={320}
        style={{ pointerEvents: 'none' }}
      >
        <div className="interior-glow" />
      </Html>
      {frames.map((frame, i) => (
        <Html
          key={frame.title}
          position={[nx + frame.pos[0], ny + frame.pos[1], nz]}
          center
          distanceFactor={320}
          style={{ pointerEvents: 'none' }}
        >
          <div
            className="board-frame"
            style={{ width: frame.w, animationDelay: `${0.15 + i * 0.18}s` }}
          >
            <div className="board-frame-title">{frame.title}</div>
            {Array.from({ length: frame.lines }).map((_, j) => (
              <div
                key={j}
                className="board-frame-line"
                style={{ width: `${88 - j * 14}%` }}
              />
            ))}
          </div>
        </Html>
      ))}
    </group>
  )
}