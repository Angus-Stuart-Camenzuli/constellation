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
  { id: 'planning', label: 'PLANNING', position: [40, 120, -5], parent: 'requirements', size: 0.95,
    blurb: 'Timeline, milestones and effort planning.' },
]

// edge list derived from each node's parent — [fromIndex, toIndex]
const INDEX_BY_ID = Object.fromEntries(NODES.map((n, i) => [n.id, i]))

export const EDGES = NODES.filter((n) => n.parent).map((n) => [
  INDEX_BY_ID[n.parent],
  INDEX_BY_ID[n.id],
])

// Placeholder board contents per enterable node — the seam where real
// AI-generated artifacts plug in later. pos is world units from node center.
export const BOARDS = {
  requirements: [
    { title: 'USER STORIES', lines: 4, w: 210, pos: [-70, 26] },
    { title: 'USE CASES', lines: 3, w: 180, pos: [58, 42] },
    { title: 'SCOPE', lines: 3, w: 190, pos: [-18, -44] },
    { title: 'ACCEPTANCE', lines: 3, w: 170, pos: [78, -28] },
  ],
  architecture: [
    { title: 'SYSTEM DIAGRAM', lines: 4, w: 220, pos: [-60, 20] },
    { title: 'COMPONENTS', lines: 3, w: 180, pos: [62, 38] },
    { title: 'DATA FLOW', lines: 3, w: 190, pos: [8, -46] },
  ],
  database: [
    { title: 'SCHEMA', lines: 4, w: 210, pos: [-64, 24] },
    { title: 'ENTITIES', lines: 3, w: 170, pos: [58, 36] },
    { title: 'RELATIONS', lines: 3, w: 180, pos: [-4, -44] },
  ],
  wireframes: [
    { title: 'LANDING', lines: 3, w: 190, pos: [-72, 24] },
    { title: 'CONSTELLATION VIEW', lines: 3, w: 210, pos: [52, 40] },
    { title: 'NODE DETAIL', lines: 3, w: 180, pos: [-8, -46] },
  ],

  planning: [
    { title: 'TIMELINE', lines: 4, w: 220, pos: [-62, 24] },
    { title: 'MILESTONES', lines: 3, w: 180, pos: [58, 40] },
    { title: 'RISKS', lines: 3, w: 170, pos: [-6, -44] },
  ],
}