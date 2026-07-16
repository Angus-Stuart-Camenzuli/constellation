import { Html } from '@react-three/drei'
import { NODES, BOARDS } from './constellationData'

// The inside of an artifact node. Phase A: generated artifacts render as
// raw JSON frames (one per top-level section) so the pipeline is visibly
// end-to-end; Phase B replaces these with real renderers (diagrams,
// wireframes, gantt). With no generated board yet, the static placeholder
// frames from constellationData keep the room furnished.
const SLOTS = [
  [-70, 26],
  [58, 42],
  [-18, -44],
  [78, -28],
  [-95, -10],
  [8, 58],
]

const PREVIEW_CHARS = 420

export default function NodeInterior({ nodeId, board }) {
  const node = NODES.find((n) => n.id === nodeId)
  if (!node) return null
  const [nx, ny, nz] = node.position

  const frames = board
    ? Object.entries(board)
        .filter(([, v]) => v && (typeof v === 'object' || typeof v === 'string'))
        .slice(0, SLOTS.length)
        .map(([key, value], i) => {
          const text = typeof value === 'string' ? value : JSON.stringify(value, null, 1)
          return {
            title: key.toUpperCase(),
            json: text.length > PREVIEW_CHARS ? text.slice(0, PREVIEW_CHARS) + '…' : text,
            pos: SLOTS[i],
          }
        })
    : (BOARDS[nodeId] ?? []).map((f) => ({
        title: f.title,
        lines: f.lines,
        w: f.w,
        pos: f.pos,
      }))

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
            style={{ width: frame.w ?? 230, animationDelay: `${0.15 + i * 0.18}s` }}
          >
            <div className="board-frame-title">{frame.title}</div>
            {frame.json ? (
              <pre className="board-frame-json">{frame.json}</pre>
            ) : (
              Array.from({ length: frame.lines }).map((_, j) => (
                <div
                  key={j}
                  className="board-frame-line"
                  style={{ width: `${88 - j * 14}%` }}
                />
              ))
            )}
          </div>
        </Html>
      ))}
    </group>
  )
}
