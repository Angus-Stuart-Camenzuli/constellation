# Constellation — Backend & AI Plan

Decisions locked: Anthropic API (Claude), no streaming (complete-then-ignite),
acceptance criteria folded into story cards, one ERD (no GRD), planning node is
the convergence of architecture + database + wireframes.

## Pipeline (mirrors the constellation topology)

```
prompt ──> requirements ──┬──> architecture ──┐
                          ├──> database     ──┼──> planning
                          └──> wireframes  ──┘
```

- Stage 1: prompt → requirements (also emits the screen list wireframes will use)
- Stage 2: three parallel calls, each gets prompt + requirements JSON
- Stage 3: planning gets prompt + requirements + component list + screen list
- Generation kicks off on Enter (runs behind the warp + birth choreography)

Node states: `waiting` (dim) → `building` (blue partial arc orbiting — the
reserved accent color's one job) → `ready` (full ignition animation) →
`error` (dim + retry later; v1 just logs).

## Server

`server/index.js` — Node + Express, ~120 lines. One route.

- `POST /api/generate` body `{ kind, prompt, context }` → returns artifact JSON
- SDK: `@anthropic-ai/sdk`, model `claude-sonnet-5`, `max_tokens` ~4000
- **Structured output via tool use**: per kind, define one tool whose
  `input_schema` is the artifact schema below; force it with
  `tool_choice: { type: 'tool', name: 'emit_<kind>' }`; the `tool_use` content
  block's `input` IS the artifact JSON. No prose parsing.
- One retry on failure/invalid JSON, then 502.
- `ANTHROPIC_API_KEY` in `server/.env` — never in client code.
- Vite proxy: `/api` → `http://localhost:3001` in vite.config.
- **MOCK=1 mode**: returns canned fixture JSON per kind with a 1.5–3s fake
  delay. This is demo insurance (offline judging rooms) and free development.
  Build fixtures first; they double as schema documentation.

## Artifact schemas (tool input_schema per kind)

Keep counts capped (maxItems) — boards must stay readable and tokens cheap.

**requirements**
```json
{
  "summary": "one-liner",
  "stories": [{ "as": "", "want": "", "so": "", "acceptance": ["", ""] }],   // max 5
  "useCases": { "actors": [""], "cases": [""], "links": [[0, 0]] },
  "scope": { "in": [""], "out": [""], "assumptions": [""] },
  "screens": [{ "name": "", "purpose": "", "device": "mobile|desktop" }]     // max 4, feeds wireframes
}
```

**architecture** — three node/edge graphs, same shape:
```json
{
  "context":    { "nodes": [{ "id": "", "label": "", "type": "system|external|user" }], "edges": [{ "from": "", "to": "", "label": "" }] },
  "components": { "nodes": [{ "id": "", "label": "", "type": "ui|service|store|external" }], "edges": [...] },
  "dataFlow":   { "nodes": [...], "edges": [...] }
}
```

**database**
```json
{
  "entities": [{ "name": "", "fields": [{ "name": "", "type": "", "pk": false, "fk": "", "required": true }] }],  // max 6
  "relations": [{ "from": "", "to": "", "cardinality": "1-1|1-N|N-N", "label": "" }],
  "ddl": "full CREATE TABLE SQL as one string"
}
```

**wireframes** — one layout per screen from requirements.screens:
```json
{
  "screens": [{
    "name": "", "device": "mobile|desktop",
    "elements": [{ "type": "navbar|tabbar|list|card|form|input|button|image|text", "label": "", "x": 0, "y": 0, "w": 6, "h": 2 }]
  }]
}
```
Grid units: 12 columns × 18 rows; renderer scales to the frame.

**planning**
```json
{
  "phases": [{ "name": "", "startWeek": 1, "weeks": 2, "deps": [""] }],   // max 7
  "milestones": [{ "name": "", "week": 3 }],
  "risks": [{ "risk": "", "likelihood": "L|M|H", "impact": "L|M|H", "mitigation": "" }]  // max 5
}
```

## Frontend changes

1. **Multi-parent edges** (`constellationData.js`): nodes get `parents: []`
   (array) replacing single `parent`; `EDGES` derivation flat-maps and carries
   the child index for birth timing (ConstellationNodes edge timing currently
   assumes edge i → child i+1; switch to reading `EDGES[i]`'s child).
   Planning: `parents: ['architecture','database','wireframes']`, position
   moves to the right terminus, e.g. `[185, -5, -8]` — flow reads
   left → right → converges.
2. **State-driven ignition** (`ConstellationNodes.jsx`): birth stops being
   clock-scheduled; a `nodeStates` prop ({ id: waiting|building|ready }) drives
   it. `building` = dim core + rotating partial arc (RingGeometry with
   thetaLength ~1.6rad, color rgba(150,190,255), rotated in useFrame).
   `ready` records that node's ignition start time → existing birth animation
   plays from there. Edges draw when their child ignites. Origin ignites right
   after dolly handoff.
3. **Orchestrator** (`App.jsx`): `runPipeline(prompt)` — fires on Enter.
   Sequential/parallel fetches per the pipeline; owns `nodeStates` and
   `boards` state ({ nodeId: artifactJson }). Boards replace the static
   BOARDS import in NodeInterior (keep static file as the MOCK fixtures).
4. **Renderers** (`NodeInterior.jsx` + new components) — model decides
   content, these decide pixels; all styled in the existing glass language:
   - `CardsFrame` — user stories w/ acceptance checklist
   - `TextFrame` — scope, risks, data dictionary (label: value lists)
   - `CodeFrame` — DDL in mono font
   - `DiagramFrame` — SVG node/edge graphs (use case, context, components,
     data flow, ERD). Auto-layout: BFS layering from roots → columns, order
     within column by degree; ~30 lines, good enough at these sizes.
   - `WireframeFrame` — skeleton boxes on the 12×18 grid inside a device frame
   - `GanttFrame` — phase bars on a week grid + milestone diamonds
   - Frame positions on the board: computed slots around the central glow
     (count varies per artifact now), not hardcoded pos.

## Build order

**Phase A (foundation):** server route + schemas + fixtures + MOCK mode;
multi-parent refactor; nodeStates + building arc + state-driven ignition;
pipeline wired end-to-end against mocks. *Exit criteria: type a prompt, watch
nodes ignite in dependency order, boards show fixture content.*

**Phase B (real AI + renderers):** live API calls with prompt tuning per kind;
DiagramFrame + WireframeFrame + GanttFrame + CardsFrame/TextFrame/CodeFrame.
*Exit criteria: arbitrary prompt produces coherent boards in every node.*

**Phase C (hardening + polish):** error retry per node; exit-flight frame
recede (task #9); content caps verified; three full demo dry-runs with
different prompts; CLAUDE.md updated with backend architecture.

## Notes

- Model: `claude-sonnet-5`. If stage 2 feels slow, wireframes/planning can drop
  to a Haiku model — but measure first.
- Keep every system prompt short and per-kind: role, the app idea, the schema
  intent ("realistic, specific, no filler"), and the caps.
- Do not add auth, persistence, or queues. Demo runs live; localStorage only
  if refresh-survival turns out to matter.
