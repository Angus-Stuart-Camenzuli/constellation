import { Html } from '@react-three/drei'
import { NODES, BOARDS } from './constellationData'

// The inside of an artifact node: generated JSON rendered as real artifacts.
// Design rule: the model decides content, these renderers decide pixels —
// everything speaks the same monochrome glass language.
// All renderers live in this file (non-exported) so the module's only
// export is a component (keeps Vite Fast Refresh happy).

const SLOTS = [
  [-150, 55],
  [0, 64],
  [150, 52],
  [-148, -56],
  [4, -66],
  [150, -50],
]

const FRAME_DISTANCE_FACTOR = 250

const WHITE = (a) => `rgba(255, 255, 255, ${a})`
const BLUE = (a) => `rgba(150, 190, 255, ${a})`

// ---------- tiny shared pieces ----------

const sectionLabel = {
  fontSize: 10,
  letterSpacing: 2,
  textTransform: 'uppercase',
  color: WHITE(0.45),
  margin: '10px 0 4px',
}

const bodyText = {
  fontSize: 12,
  fontWeight: 300,
  lineHeight: 1.5,
  color: WHITE(0.68),
}

function List({ items }) {
  return (
    <div>
      {(items ?? []).map((it, i) => (
        <div key={i} style={{ ...bodyText, display: 'flex', gap: 6, marginBottom: 3 }}>
          <span style={{ color: WHITE(0.3) }}>·</span>
          <span>{it}</span>
        </div>
      ))}
    </div>
  )
}

// ---------- requirements ----------

function StoriesFrame({ stories }) {
  return (
    <div>
      {(stories ?? []).map((s, i) => (
        <div
          key={i}
          style={{
            padding: '6px 8px',
            marginBottom: 6,
            border: `1px solid ${WHITE(0.1)}`,
            borderRadius: 8,
          }}
        >
          <div style={{ ...bodyText, fontSize: 11.5, color: WHITE(0.85) }}>
            As <em>{s.as}</em>, I want {s.want}, so {s.so}.
          </div>
          {(s.acceptance ?? []).map((a, j) => (
            <div key={j} style={{ ...bodyText, fontSize: 10.5, display: 'flex', gap: 5, marginTop: 3 }}>
              <span style={{ color: BLUE(0.6) }}>✓</span>
              <span style={{ color: WHITE(0.5) }}>{a}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

function ScopeFrame({ scope }) {
  return (
    <div>
      <div style={sectionLabel}>In scope</div>
      <List items={scope?.in} />
      <div style={sectionLabel}>Out of scope</div>
      <List items={scope?.out} />
      <div style={sectionLabel}>Assumptions</div>
      <List items={scope?.assumptions} />
    </div>
  )
}

function ScreensFrame({ screens }) {
  return (
    <div>
      {(screens ?? []).map((s, i) => (
        <div key={i} style={{ ...bodyText, marginBottom: 6 }}>
          <span style={{ color: WHITE(0.85) }}>{s.name}</span>
          <span style={{ color: WHITE(0.35) }}> — {s.purpose} ({s.device})</span>
        </div>
      ))}
    </div>
  )
}

// ---------- diagrams (context, components, data flow, use cases) ----------

// BFS-layered auto layout: roots (no inbound edges) on the left, columns by
// depth, rows staggered so long edges don't stack on one axis.
function layoutGraph(nodes, edges, w, h) {
  const indeg = Object.fromEntries(nodes.map((n) => [n.id, 0]))
  edges.forEach((e) => {
    if (e.to in indeg) indeg[e.to]++
  })
  const adj = {}
  edges.forEach((e) => (adj[e.from] ??= []).push(e.to))
  const roots = nodes.filter((n) => indeg[n.id] === 0).map((n) => n.id)
  if (!roots.length && nodes.length) roots.push(nodes[0].id)
  const depth = {}
  const seen = new Set(roots)
  const queue = roots.map((id) => [id, 0])
  while (queue.length) {
    const [id, d] = queue.shift()
    depth[id] = d
    for (const nx of adj[id] ?? []) {
      if (!seen.has(nx)) {
        seen.add(nx)
        queue.push([nx, d + 1])
      }
    }
  }
  nodes.forEach((n) => {
    if (depth[n.id] === undefined) depth[n.id] = 0
  })
  const cols = {}
  nodes.forEach((n) => (cols[depth[n.id]] ??= []).push(n))
  const colKeys = Object.keys(cols).map(Number).sort((a, b) => a - b)

  // deep chains produce many skinny columns → 80-wide boxes overflow them.
  // Cap at 3 columns: fold nodes (in BFS order, column-major) into a grid,
  // so flow still reads left→right but nothing can collide horizontally
  let arranged
  if (colKeys.length > 3) {
    const ordered = [...nodes].sort((a, b) => depth[a.id] - depth[b.id])
    const rowsPerCol = Math.ceil(ordered.length / 3)
    arranged = []
    for (let c = 0; c < 3; c++) {
      const col = ordered.slice(c * rowsPerCol, (c + 1) * rowsPerCol)
      if (col.length) arranged.push(col)
    }
  } else {
    arranged = colKeys.map((k) => cols[k])
  }

  const maxRows = Math.max(...arranged.map((c) => c.length))
  const height = Math.max(190, maxRows * 62) // grow vertically, never squeeze
  const pos = {}
  arranged.forEach((colNodes, ci) => {
    colNodes.forEach((n, ri) => {
      pos[n.id] = {
        x: (ci + 0.5) * (w / arranged.length) + (ri % 2 === 0 ? -10 : 10),
        y: (ri + 0.5) * (height / colNodes.length),
      }
    })
  })
  return { pos, h: height }
}

// wrap a label into at most two ~13-char lines
function wrapLabel(label = '', max = 13) {
  if (label.length <= max) return [label]
  const words = label.split(' ')
  const lines = ['']
  for (const word of words) {
    const cur = lines[lines.length - 1]
    if (cur && (cur + ' ' + word).length > max) lines.push(word)
    else lines[lines.length - 1] = (cur + ' ' + word).trim()
  }
  if (lines.length > 2) {
    lines[1] = lines.slice(1).join(' ')
    if (lines[1].length > max) lines[1] = lines[1].slice(0, max - 1) + '…'
  }
  return lines.slice(0, 2)
}

const EDGE_TEXT_BACKING = {
  paintOrder: 'stroke',
  stroke: 'rgba(6, 9, 16, 0.9)',
  strokeWidth: 3,
}

function DiagramNode({ node, pos }) {
  const { x, y } = pos
  const lines = wrapLabel(node.label)
  if (node.type === 'user') {
    return (
      <g>
        <circle cx={x} cy={y - 7} r={5} fill="none" stroke={WHITE(0.5)} />
        <line x1={x} y1={y - 2} x2={x} y2={y + 8} stroke={WHITE(0.5)} />
        <text x={x} y={y + 19} textAnchor="middle" fontSize="8.5" fill={WHITE(0.85)} style={EDGE_TEXT_BACKING}>
          {node.label}
        </text>
      </g>
    )
  }
  if (node.type === 'case') {
    return (
      <g>
        <ellipse cx={x} cy={y} rx={46} ry={13} fill="rgba(10, 14, 24, 0.85)" stroke={WHITE(0.4)} />
        <text x={x} y={y + 3} textAnchor="middle" fontSize="8.5" fill={WHITE(0.85)}>
          {lines[0].length > 18 ? lines[0].slice(0, 17) + '…' : lines.join(' ').slice(0, 18)}
        </text>
      </g>
    )
  }
  const dashed = node.type === 'external' ? '4 3' : 'none'
  const isStore = node.type === 'store'
  const bh = lines.length > 1 ? 30 : 24
  return (
    <g>
      <rect
        x={x - 40}
        y={y - bh / 2}
        width={80}
        height={bh}
        rx={isStore ? 2 : 7}
        fill="rgba(10, 14, 24, 0.85)"
        stroke={WHITE(0.45)}
        strokeDasharray={dashed}
      />
      {isStore && <line x1={x - 40} y1={y - bh / 2 + 5} x2={x + 40} y2={y - bh / 2 + 5} stroke={WHITE(0.35)} />}
      {lines.map((ln, i) => (
        <text
          key={i}
          x={x}
          y={y + (lines.length > 1 ? i * 10 - 2 : 3)}
          textAnchor="middle"
          fontSize="8.5"
          fill={WHITE(0.85)}
        >
          {ln}
        </text>
      ))}
    </g>
  )
}

function DiagramFrame({ graph, w = 340 }) {
  const nodes = graph?.nodes ?? []
  const edges = graph?.edges ?? []
  const { pos, h } = layoutGraph(nodes, edges, w)
  const showEdgeLabels = edges.length <= 7
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" style={{ display: 'block' }}>
      <defs>
        <marker id="af-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M0 0 L8 4 L0 8 z" fill={WHITE(0.4)} />
        </marker>
      </defs>
      {edges.map((e, i) => {
        const a = pos[e.from]
        const b = pos[e.to]
        if (!a || !b) return null
        return (
          <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={WHITE(0.2)} markerEnd="url(#af-arrow)" />
        )
      })}
      {nodes.map((n) => (
        <DiagramNode key={n.id} node={n} pos={pos[n.id]} />
      ))}
      {showEdgeLabels &&
        edges.map((e, i) => {
          const a = pos[e.from]
          const b = pos[e.to]
          if (!a || !b || !e.label) return null
          // stagger labels along their edge — edges converging on one node
          // otherwise stack their midpoint labels on top of each other
          const t = [0.5, 0.34, 0.66][i % 3]
          return (
            <text
              key={`l${i}`}
              x={a.x + (b.x - a.x) * t}
              y={a.y + (b.y - a.y) * t - 4}
              textAnchor="middle"
              fontSize="7.5"
              fill={WHITE(0.5)}
              style={EDGE_TEXT_BACKING}
            >
              {e.label.length > 22 ? e.label.slice(0, 21) + '…' : e.label}
            </text>
          )
        })}
    </svg>
  )
}

// use cases arrive as actors/cases/links — convert to a graph
function useCaseGraph(useCases) {
  const actors = useCases?.actors ?? []
  const cases = useCases?.cases ?? []
  return {
    nodes: [
      ...actors.map((a, i) => ({ id: `a${i}`, label: a, type: 'user' })),
      ...cases.map((c, i) => ({ id: `c${i}`, label: c, type: 'case' })),
    ],
    edges: (useCases?.links ?? []).map(([ai, ci]) => ({ id: `${ai}-${ci}`, from: `a${ai}`, to: `c${ci}` })),
  }
}

// ---------- database ----------

function EntitiesFrame({ entities }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {(entities ?? []).map((e) => (
        <div
          key={e.name}
          style={{ border: `1px solid ${WHITE(0.14)}`, borderRadius: 6, minWidth: 110, flex: '1 1 40%' }}
        >
          <div
            style={{
              ...bodyText,
              color: WHITE(0.85),
              padding: '4px 8px',
              borderBottom: `1px solid ${WHITE(0.12)}`,
              fontFamily: 'ui-monospace, monospace',
              fontSize: 11,
            }}
          >
            {e.name}
          </div>
          {(e.fields ?? []).map((f) => (
            <div
              key={f.name}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 8,
                padding: '2px 8px',
                fontFamily: 'ui-monospace, monospace',
                fontSize: 10,
                color: WHITE(0.55),
              }}
            >
              <span style={{ color: f.pk ? BLUE(0.85) : WHITE(0.7) }}>
                {f.pk ? '⚿ ' : ''}{f.name}{f.fk ? ' →' + f.fk : ''}
              </span>
              <span style={{ color: WHITE(0.35) }}>{f.type}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

function RelationsFrame({ relations }) {
  return (
    <div>
      {(relations ?? []).map((r, i) => (
        <div key={i} style={{ ...bodyText, fontFamily: 'ui-monospace, monospace', fontSize: 11, marginBottom: 4 }}>
          <span style={{ color: WHITE(0.8) }}>{r.from}</span>
          <span style={{ color: BLUE(0.7) }}> {r.cardinality} </span>
          <span style={{ color: WHITE(0.8) }}>{r.to}</span>
          {r.label && <span style={{ color: WHITE(0.35) }}>  · {r.label}</span>}
        </div>
      ))}
    </div>
  )
}

function CodeFrame({ code }) {
  return <pre className="board-frame-json">{code}</pre>
}

// ---------- wireframes: app-skeleton rendering, not labeled boxes ----------

const WF_GRID = { cols: 12, rows: 18 }

function WfEl({ el }) {
  const base = {
    position: 'absolute',
    left: `${(el.x / WF_GRID.cols) * 100}%`,
    top: `${(el.y / WF_GRID.rows) * 100}%`,
    width: `${(el.w / WF_GRID.cols) * 100}%`,
    height: `${(el.h / WF_GRID.rows) * 100}%`,
    boxSizing: 'border-box',
    padding: 2,
    overflow: 'hidden',
  }
  const tiny = {
    fontSize: 7,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: WHITE(0.5),
    whiteSpace: 'nowrap',
    overflow: 'hidden',
  }
  switch (el.type) {
    case 'navbar':
      return (
        <div style={{ ...base, padding: 0, background: WHITE(0.09), display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ ...tiny, color: WHITE(0.65) }}>{el.label}</span>
        </div>
      )
    case 'tabbar':
      return (
        <div style={{ ...base, padding: 0, background: WHITE(0.09), display: 'flex', alignItems: 'center', justifyContent: 'space-around' }}>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} style={{ width: 7, height: 7, borderRadius: 2, background: WHITE(0.3) }} />
          ))}
        </div>
      )
    case 'button':
      return (
        <div style={{ ...base, display: 'flex' }}>
          <div style={{ flex: 1, borderRadius: 9, background: WHITE(0.16), display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ ...tiny, color: WHITE(0.75) }}>{el.label}</span>
          </div>
        </div>
      )
    case 'input':
      return (
        <div style={base}>
          <div style={{ height: '100%', border: `1px solid ${WHITE(0.22)}`, borderRadius: 5, display: 'flex', alignItems: 'center', paddingLeft: 5 }}>
            <span style={tiny}>{el.label}</span>
          </div>
        </div>
      )
    case 'image':
      return (
        <div style={base}>
          <div
            style={{
              height: '100%',
              borderRadius: 4,
              border: `1px solid ${WHITE(0.1)}`,
              background: `repeating-linear-gradient(45deg, transparent, transparent 5px, ${WHITE(0.06)} 5px, ${WHITE(0.06)} 6px)`,
            }}
          />
        </div>
      )
    case 'list': {
      const rows = Math.max(2, Math.min(5, Math.floor(el.h / 2)))
      return (
        <div style={{ ...base, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 4, borderBottom: `1px solid ${WHITE(0.06)}` }}>
              <div style={{ width: 9, height: 9, borderRadius: '50%', background: WHITE(0.12), flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ height: 3, width: '70%', borderRadius: 2, background: WHITE(0.18), marginBottom: 2 }} />
                <div style={{ height: 3, width: '45%', borderRadius: 2, background: WHITE(0.08) }} />
              </div>
            </div>
          ))}
        </div>
      )
    }
    case 'card':
      return (
        <div style={base}>
          <div style={{ height: '100%', borderRadius: 6, background: WHITE(0.05), border: `1px solid ${WHITE(0.1)}`, padding: 4 }}>
            <div style={{ height: 3, width: '55%', background: WHITE(0.2), borderRadius: 2, marginBottom: 3 }} />
            <div style={{ height: 3, width: '85%', background: WHITE(0.08), borderRadius: 2 }} />
          </div>
        </div>
      )
    case 'form': {
      const rows = Math.max(2, Math.min(4, Math.floor(el.h / 2)))
      return (
        <div style={{ ...base, display: 'flex', flexDirection: 'column', gap: 3 }}>
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} style={{ flex: 1, border: `1px solid ${WHITE(0.14)}`, borderRadius: 4 }} />
          ))}
        </div>
      )
    }
    case 'text':
    default:
      return (
        <div style={{ ...base, display: 'flex', flexDirection: 'column', gap: 2, justifyContent: 'center' }}>
          <div style={{ height: 3, width: '80%', background: WHITE(0.15), borderRadius: 2 }} />
          <div style={{ height: 3, width: '55%', background: WHITE(0.08), borderRadius: 2 }} />
        </div>
      )
  }
}

function WireframeFrame({ screen }) {
  const mobile = screen.device !== 'desktop'
  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        aspectRatio: mobile ? '2 / 3' : '3 / 2',
        border: `1px solid ${WHITE(0.2)}`,
        borderRadius: mobile ? 14 : 6,
        background: 'rgba(4, 6, 12, 0.6)',
        overflow: 'hidden',
      }}
    >
      {(screen.elements ?? []).map((el, i) => (
        <WfEl key={i} el={el} />
      ))}
    </div>
  )
}

// ---------- planning ----------

const GANTT_WEEKS = 12
const GANTT_LABEL_W = 90

function GanttFrame({ phases, milestones }) {
  return (
    <div>
      <div style={{ position: 'relative', height: 12, marginLeft: GANTT_LABEL_W, marginBottom: 4 }}>
        {(milestones ?? []).map((m, i) => (
          <div
            key={i}
            title={m.name}
            style={{
              position: 'absolute',
              left: `${((m.week - 0.5) / GANTT_WEEKS) * 100}%`,
              width: 7,
              height: 7,
              background: BLUE(0.8),
              transform: 'rotate(45deg)',
            }}
          />
        ))}
      </div>
      <div style={{ position: 'relative' }}>
        <div style={{ position: 'absolute', left: GANTT_LABEL_W, right: 0, top: 0, bottom: 0 }}>
          {Array.from({ length: GANTT_WEEKS + 1 }).map((_, i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: `${(i / GANTT_WEEKS) * 100}%`,
                top: 0,
                bottom: 0,
                width: 1,
                background: WHITE(i % 2 === 0 ? 0.08 : 0.03),
              }}
            />
          ))}
        </div>
        {(phases ?? []).map((ph, i) => (
          <div key={i} style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
            <div style={{ ...bodyText, fontSize: 10, width: GANTT_LABEL_W - 6, textAlign: 'right', color: WHITE(0.6) }}>
              {ph.name}
            </div>
            <div style={{ position: 'relative', flex: 1, height: 8 }}>
              <div
                style={{
                  position: 'absolute',
                  left: `${((ph.startWeek - 1) / GANTT_WEEKS) * 100}%`,
                  width: `${(ph.weeks / GANTT_WEEKS) * 100}%`,
                  height: '100%',
                  background: WHITE(0.3),
                  borderRadius: 4,
                }}
              />
            </div>
          </div>
        ))}
      </div>
      <div style={{ position: 'relative', height: 12, marginLeft: GANTT_LABEL_W, marginTop: 2 }}>
        {[2, 4, 6, 8, 10, 12].map((wk) => (
          <span
            key={wk}
            style={{
              position: 'absolute',
              left: `${(wk / GANTT_WEEKS) * 100}%`,
              transform: 'translateX(-50%)',
              fontSize: 8,
              color: WHITE(0.35),
            }}
          >
            {wk}
          </span>
        ))}
        <span style={{ position: 'absolute', left: 0, fontSize: 8, color: WHITE(0.25) }}>wk</span>
      </div>
    </div>
  )
}

function RisksFrame({ risks }) {
  return (
    <div>
      {(risks ?? []).map((r, i) => (
        <div key={i} style={{ marginBottom: 8 }}>
          <div style={{ ...bodyText, color: WHITE(0.8) }}>
            {r.risk}{' '}
            <span style={{ color: BLUE(0.6), fontSize: 10 }}>
              {r.likelihood}/{r.impact}
            </span>
          </div>
          <div style={{ ...bodyText, fontSize: 11, color: WHITE(0.45) }}>{r.mitigation}</div>
        </div>
      ))}
    </div>
  )
}

// ---------- board composition: artifact JSON → frames ----------

function buildFrames(nodeId, board) {
  switch (nodeId) {
    case 'requirements':
      return [
        { title: 'SUMMARY', w: 220, el: <div style={{ ...bodyText, color: WHITE(0.75) }}>{board.summary}</div> },
        { title: 'USER STORIES', w: 290, el: <StoriesFrame stories={board.stories} /> },
        { title: 'USE CASES', w: 330, el: <DiagramFrame graph={useCaseGraph(board.useCases)} /> },
        { title: 'SCOPE', w: 220, el: <ScopeFrame scope={board.scope} /> },
        { title: 'SCREENS', w: 250, el: <ScreensFrame screens={board.screens} /> },
      ]
    case 'architecture':
      return [
        { title: 'SYSTEM CONTEXT', w: 340, el: <DiagramFrame graph={board.context} /> },
        { title: 'COMPONENTS', w: 340, el: <DiagramFrame graph={board.components} /> },
        { title: 'DATA FLOW', w: 340, el: <DiagramFrame graph={board.dataFlow} /> },
      ]
    case 'database':
      return [
        { title: 'ERD — ENTITIES', w: 330, el: <EntitiesFrame entities={board.entities} /> },
        { title: 'RELATIONS', w: 250, el: <RelationsFrame relations={board.relations} /> },
        { title: 'DDL', w: 300, el: <CodeFrame code={board.ddl} /> },
      ]
    case 'wireframes':
      return (board.screens ?? []).map((s) => ({
        title: s.name?.toUpperCase() ?? 'SCREEN',
        w: s.device === 'desktop' ? 290 : 200,
        el: <WireframeFrame screen={s} />,
      }))
    case 'planning':
      return [
        { title: 'TIMELINE', w: 350, el: <GanttFrame phases={board.phases} milestones={board.milestones} /> },
        {
          title: 'MILESTONES',
          w: 230,
          el: <List items={(board.milestones ?? []).map((m) => `wk ${m.week} — ${m.name}`)} />,
        },
        { title: 'RISKS', w: 280, el: <RisksFrame risks={board.risks} /> },
      ]
    default:
      return Object.entries(board)
        .filter(([, v]) => v && (typeof v === 'object' || typeof v === 'string'))
        .slice(0, SLOTS.length)
        .map(([key, value]) => ({
          title: key.toUpperCase(),
          w: 260,
          el: <CodeFrame code={typeof value === 'string' ? value : JSON.stringify(value, null, 1)} />,
        }))
  }
}

export default function NodeInterior({ nodeId, board }) {
  const node = NODES.find((n) => n.id === nodeId)
  if (!node) return null
  const [nx, ny, nz] = node.position

  const frames = board
    ? buildFrames(nodeId, board)
    : (BOARDS[nodeId] ?? []).map((f) => ({ title: f.title, lines: f.lines, w: f.w }))

  return (
    <group>
      <Html position={[nx, ny, nz]} center distanceFactor={320} style={{ pointerEvents: 'none' }}>
        <div className="interior-glow" />
      </Html>
      {frames.map((frame, i) => {
        const pos = SLOTS[i % SLOTS.length]
        return (
          <Html
            key={frame.title + i}
            position={[nx + pos[0], ny + pos[1], nz]}
            center
            distanceFactor={FRAME_DISTANCE_FACTOR}
            style={{ pointerEvents: 'none' }}
          >
            <div
              className="board-frame"
              style={{ width: frame.w ?? 230, animationDelay: `${0.15 + i * 0.18}s` }}
            >
              <div className="board-frame-title">{frame.title}</div>
              {frame.el ??
                Array.from({ length: frame.lines ?? 3 }).map((_, j) => (
                  <div key={j} className="board-frame-line" style={{ width: `${88 - j * 14}%` }} />
                ))}
            </div>
          </Html>
        )
      })}
    </group>
  )
}
