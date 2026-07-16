// Artifact schemas + per-kind system prompts.
// Each schema is handed to Claude as a FORCED tool's input_schema, so the
// response is schema-shaped JSON by construction — no prose parsing anywhere.
// Caps (maxItems) keep boards readable and tokens cheap.

// shared shape for node/edge diagrams (context, components, data flow — and
// close cousin of the ERD). `types` constrains what the renderer must draw.
const graphSchema = (types) => ({
  type: 'object',
  required: ['nodes', 'edges'],
  properties: {
    nodes: {
      type: 'array',
      maxItems: 9,
      items: {
        type: 'object',
        required: ['id', 'label', 'type'],
        properties: {
          id: { type: 'string', description: 'short unique id, kebab-case' },
          label: { type: 'string' },
          type: { type: 'string', enum: types },
        },
      },
    },
    edges: {
      type: 'array',
      maxItems: 12,
      items: {
        type: 'object',
        required: ['from', 'to'],
        properties: {
          from: { type: 'string', description: 'node id' },
          to: { type: 'string', description: 'node id' },
          label: { type: 'string' },
        },
      },
    },
  },
})

export const SCHEMAS = {
  requirements: {
    type: 'object',
    required: ['summary', 'stories', 'useCases', 'scope', 'screens'],
    properties: {
      summary: { type: 'string', description: 'one sentence: what this product is' },
      stories: {
        type: 'array',
        maxItems: 5,
        items: {
          type: 'object',
          required: ['as', 'want', 'so', 'acceptance'],
          properties: {
            as: { type: 'string' },
            want: { type: 'string' },
            so: { type: 'string' },
            acceptance: { type: 'array', maxItems: 3, items: { type: 'string' } },
          },
        },
      },
      useCases: {
        type: 'object',
        required: ['actors', 'cases', 'links'],
        properties: {
          actors: { type: 'array', maxItems: 4, items: { type: 'string' } },
          cases: { type: 'array', maxItems: 6, items: { type: 'string' } },
          links: {
            type: 'array',
            items: {
              type: 'array',
              items: { type: 'integer' },
              minItems: 2,
              maxItems: 2,
              description: '[actorIndex, caseIndex]',
            },
          },
        },
      },
      scope: {
        type: 'object',
        required: ['in', 'out', 'assumptions'],
        properties: {
          in: { type: 'array', maxItems: 6, items: { type: 'string' } },
          out: { type: 'array', maxItems: 5, items: { type: 'string' } },
          assumptions: { type: 'array', maxItems: 4, items: { type: 'string' } },
        },
      },
      screens: {
        type: 'array',
        maxItems: 4,
        description: 'the screens the wireframe stage will lay out',
        items: {
          type: 'object',
          required: ['name', 'purpose', 'device'],
          properties: {
            name: { type: 'string' },
            purpose: { type: 'string' },
            device: { type: 'string', enum: ['mobile', 'desktop'] },
          },
        },
      },
    },
  },

  architecture: {
    type: 'object',
    required: ['context', 'components', 'dataFlow'],
    properties: {
      context: graphSchema(['system', 'external', 'user']),
      components: graphSchema(['ui', 'service', 'store', 'external']),
      dataFlow: graphSchema(['process', 'store', 'external', 'user']),
    },
  },

  database: {
    type: 'object',
    required: ['entities', 'relations', 'ddl'],
    properties: {
      entities: {
        type: 'array',
        maxItems: 6,
        items: {
          type: 'object',
          required: ['name', 'fields'],
          properties: {
            name: { type: 'string', description: 'snake_case table name' },
            fields: {
              type: 'array',
              maxItems: 8,
              items: {
                type: 'object',
                required: ['name', 'type'],
                properties: {
                  name: { type: 'string' },
                  type: { type: 'string', description: 'SQL type' },
                  pk: { type: 'boolean' },
                  fk: { type: 'string', description: 'referenced table name, if foreign key' },
                  required: { type: 'boolean' },
                },
              },
            },
          },
        },
      },
      relations: {
        type: 'array',
        maxItems: 8,
        items: {
          type: 'object',
          required: ['from', 'to', 'cardinality'],
          properties: {
            from: { type: 'string', description: 'entity name' },
            to: { type: 'string', description: 'entity name' },
            cardinality: { type: 'string', enum: ['1-1', '1-N', 'N-N'] },
            label: { type: 'string' },
          },
        },
      },
      ddl: { type: 'string', description: 'CREATE TABLE statements for all entities, one SQL string' },
    },
  },

  wireframes: {
    type: 'object',
    required: ['screens'],
    properties: {
      screens: {
        type: 'array',
        maxItems: 4,
        items: {
          type: 'object',
          required: ['name', 'device', 'elements'],
          properties: {
            name: { type: 'string', description: 'must match a screen name from requirements' },
            device: { type: 'string', enum: ['mobile', 'desktop'] },
            elements: {
              type: 'array',
              maxItems: 12,
              items: {
                type: 'object',
                required: ['type', 'x', 'y', 'w', 'h'],
                properties: {
                  type: {
                    type: 'string',
                    enum: ['navbar', 'tabbar', 'list', 'card', 'form', 'input', 'button', 'image', 'text'],
                  },
                  label: { type: 'string' },
                  x: { type: 'integer', minimum: 0, maximum: 11 },
                  y: { type: 'integer', minimum: 0, maximum: 17 },
                  w: { type: 'integer', minimum: 1, maximum: 12 },
                  h: { type: 'integer', minimum: 1, maximum: 18 },
                },
              },
            },
          },
        },
      },
    },
  },

  planning: {
    type: 'object',
    required: ['phases', 'milestones', 'risks'],
    properties: {
      phases: {
        type: 'array',
        maxItems: 7,
        items: {
          type: 'object',
          required: ['name', 'startWeek', 'weeks'],
          properties: {
            name: { type: 'string' },
            startWeek: { type: 'integer', minimum: 1, maximum: 12 },
            weeks: { type: 'integer', minimum: 1, maximum: 8 },
            deps: { type: 'array', items: { type: 'string', description: 'phase name' } },
          },
        },
      },
      milestones: {
        type: 'array',
        maxItems: 5,
        items: {
          type: 'object',
          required: ['name', 'week'],
          properties: {
            name: { type: 'string' },
            week: { type: 'integer', minimum: 1, maximum: 12 },
          },
        },
      },
      risks: {
        type: 'array',
        maxItems: 5,
        items: {
          type: 'object',
          required: ['risk', 'likelihood', 'impact', 'mitigation'],
          properties: {
            risk: { type: 'string' },
            likelihood: { type: 'string', enum: ['L', 'M', 'H'] },
            impact: { type: 'string', enum: ['L', 'M', 'H'] },
            mitigation: { type: 'string' },
          },
        },
      },
    },
  },
}

const BASE =
  'You are the design engine inside Constellation, a software planning tool. ' +
  'The user typed a one-line product idea; you produce professional software design artifacts for it. ' +
  'Be realistic and specific to THIS product — no filler, no generic placeholders. ' +
  'Respect every maxItems cap. Emit ONLY the tool call.'

export const SYSTEM_PROMPTS = {
  requirements:
    BASE +
    ' Produce requirements: user stories in as/want/so form each with 2-3 testable acceptance criteria, ' +
    'a use case model (links are [actorIndex, caseIndex] into your own arrays), in/out scope with assumptions, ' +
    'and the 3-4 key screens the product needs (these drive wireframing later).',
  architecture:
    BASE +
    ' Produce three diagrams as node/edge graphs: system context (the product, its users, external systems), ' +
    'components (ui/services/stores), and data flow. Edge from/to must reference your own node ids exactly. ' +
    'Keep each graph SMALL and readable: 4-7 nodes, at most 8 edges. Node labels must be 1-2 short words ' +
    '(e.g. "REST API", "Feed service"). Edge labels at most 3 words.',
  database:
    BASE +
    ' Produce the data model: entities with snake_case names and typed fields (mark pks and fks), ' +
    'relations with cardinality between entity names, and complete CREATE TABLE DDL matching the entities exactly.',
  wireframes:
    BASE +
    ' Produce one wireframe per screen listed in the requirements context, reusing those exact screen names. ' +
    'Layout on a 12-column x 18-row grid (y grows downward). HARD RULES: elements must NOT overlap — stack ' +
    'full-width rows top to bottom, where each element starts at y = previous element y + previous h. ' +
    'Mobile screens: navbar at y=0 h=2 first, tabbar at y=16 h=2 last, content rows between (5-8 elements total). ' +
    'Prefer list/card/form/image blocks for content; use short labels (1-3 words). Two elements may share a row ' +
    'only if their x ranges do not intersect.',
  planning:
    BASE +
    ' Produce a delivery plan over a 12-week horizon: phases with start week, duration and dependencies ' +
    '(deps reference other phase names exactly), 3-5 milestones, and the top risks with likelihood/impact/mitigation.',
}

// minimal response validation: these top-level keys must exist per kind
export const REQUIRED_KEYS = Object.fromEntries(
  Object.entries(SCHEMAS).map(([kind, schema]) => [kind, schema.required ?? []])
)
