// Shared constellation data — lives in its own module so component files
// only export components (keeps Vite Fast Refresh working) and so App,
// Scene, and ConstellationNodes all read the same source of truth.

export const NODES = [
  { id: 'origin', label: 'YOUR PROMPT', position: [-190, -95, 0], parent: null, size: 0.75,
    blurb: 'The idea this constellation grew from.', enterable: false },
  { id: 'requirements', label: 'REQUIREMENTS', position: [-60, -10, 0], parent: 'origin', size: 1.2,
    blurb: 'User stories, scope and acceptance criteria.' },
  { id: 'architecture', label: 'ARCHITECTURE', position: [95, 85, 10], parent: 'requirements', size: 0.95,
    blurb: 'System design, components and data flow.' },
  { id: 'database', label: 'DATABASE', position: [135, -5, -15], parent: 'requirements', size: 0.95,
    blurb: 'Schema, entities and relationships.' },
  { id: 'wireframes', label: 'WIREFRAMES', position: [75, -105, 8], parent: 'requirements', size: 0.95,
    blurb: 'Screen layouts and user flows.' },
]

// edge list derived from each node's parent — [fromIndex, toIndex]
const INDEX_BY_ID = Object.fromEntries(NODES.map((n, i) => [n.id, i]))

export const EDGES = NODES.filter((n) => n.parent).map((n) => [
  INDEX_BY_ID[n.parent],
  INDEX_BY_ID[n.id],
])