// Constellation generation server.
// One route: POST /api/generate { kind, prompt, context } -> artifact JSON.
// Structured output via forced tool use: the schema IS the contract.
// MOCK mode (--mock flag or MOCK=1) serves fixtures with realistic latency —
// build/demo the whole frontend with zero tokens and zero wifi.

import express from 'express'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import Anthropic from '@anthropic-ai/sdk'
import { SCHEMAS, SYSTEM_PROMPTS, REQUIRED_KEYS } from './schemas.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '.env') })

const MOCK = process.env.MOCK === '1' || process.argv.includes('--mock')
const PORT = process.env.PORT || 3001
const MODEL = process.env.MODEL || 'claude-sonnet-5'

if (!MOCK && !process.env.ANTHROPIC_API_KEY) {
  console.error(
    'No ANTHROPIC_API_KEY found in server/.env — either add one, or run mock mode: npm run server:mock'
  )
  process.exit(1)
}

const app = express()
app.use(express.json())

// ---- demo gate (deployments only) ----
// Set DEMO_USER + DEMO_PASS in the host's env and the whole site (app + api)
// asks for credentials via the browser's native prompt — no login page needed.
// Unset locally = no gate. Credentials go in the Devpost submission.
const { DEMO_USER, DEMO_PASS } = process.env
if (DEMO_USER && DEMO_PASS) {
  app.use((req, res, next) => {
    const auth = req.headers.authorization ?? ''
    const decoded = Buffer.from(auth.split(' ')[1] ?? '', 'base64').toString()
    const idx = decoded.indexOf(':')
    const user = decoded.slice(0, idx)
    const pass = decoded.slice(idx + 1)
    if (idx > 0 && user === DEMO_USER && pass === DEMO_PASS) return next()
    res.set('WWW-Authenticate', 'Basic realm="constellation"')
    res.status(401).send('Credentials are in the Devpost submission.')
  })
}

// ---- static serving (deployments only) ----
// If a Vite build exists (npm run build), serve it — one service runs the
// whole product and /api is same-origin, so the dev proxy isn't needed.
const distDir = path.join(__dirname, '..', 'dist')
const hasBuild = fs.existsSync(path.join(distDir, 'index.html'))
if (hasBuild) {
  app.use(express.static(distDir))
}

const anthropic = MOCK ? null : new Anthropic()

const fixture = (kind) =>
  JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', `${kind}.json`), 'utf8'))

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function buildUserMessage(kind, prompt, context) {
  let text = `The product idea:\n"""${prompt}"""`
  if (context) {
    text += `\n\nContext from earlier design stages (JSON):\n${JSON.stringify(context)}`
  }
  text += `\n\nProduce the ${kind} artifact now by calling the emit_${kind} tool.`
  return text
}

async function generate(kind, prompt, context) {
  const msg = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 8000, // generous headroom — a truncated tool call returns partial/empty input
    system: SYSTEM_PROMPTS[kind],
    tools: [
      {
        name: `emit_${kind}`,
        // enumerate the exact top-level keys — without this the model
        // sometimes wraps the whole artifact under one property name
        description:
          `Emit the ${kind} artifact as structured JSON. The tool input's ` +
          `TOP-LEVEL keys must be exactly: ${(REQUIRED_KEYS[kind] ?? []).join(', ')}. ` +
          `Do not nest the artifact under any wrapper key.`,
        input_schema: SCHEMAS[kind],
      },
    ],
    tool_choice: { type: 'tool', name: `emit_${kind}`, disable_parallel_tool_use: true },
    messages: [{ role: 'user', content: buildUserMessage(kind, prompt, context) }],
  })

  const toolBlocks = msg.content.filter((b) => b.type === 'tool_use')
  if (!toolBlocks.length) {
    throw new Error(`no tool_use block (stop_reason=${msg.stop_reason})`)
  }
  // a response may split one artifact across several tool_use blocks —
  // merge all their inputs (later blocks win on key collisions)
  let input = Object.assign({}, ...toolBlocks.map((b) => b.input))

  // unwrap heuristic: the model sometimes nests the whole artifact under a
  // single stray key (observed: everything inside `scope`). If the inner
  // object matches our required keys better than the outer one, descend.
  const outerKeys = Object.keys(input)
  if (outerKeys.length === 1 && input[outerKeys[0]] && typeof input[outerKeys[0]] === 'object') {
    const inner = input[outerKeys[0]]
    const req = REQUIRED_KEYS[kind] ?? []
    const innerHits = req.filter((k) => k in inner).length
    const outerHits = req.filter((k) => k in input).length
    if (innerHits > outerHits) {
      console.warn(`[${kind}] unwrapped artifact from stray '${outerKeys[0]}' wrapper`)
      input = inner
    }
  }

  const missing = (REQUIRED_KEYS[kind] ?? []).filter((k) => !(k in input))
  if (missing.length) {
    console.warn(
      `[${kind}] stop_reason=${msg.stop_reason} blocks=${toolBlocks.length} ` +
        `model=${msg.model} output_tokens=${msg.usage?.output_tokens} ` +
        `received keys=[${Object.keys(input).join(', ')}]`
    )
    // full evidence dump — what did the API actually send back?
    console.warn(`[${kind}] raw content:\n${JSON.stringify(msg.content, null, 2).slice(0, 2500)}`)
    throw new Error(`response missing keys: ${missing.join(', ')}`)
  }

  return input
}

app.get('/', (req, res) => {
  res
    .type('text/plain')
    .send(
      'constellation generation server\n\nGET  /api/health\nPOST /api/generate { kind, prompt, context }'
    )
})

app.get('/api/health', (req, res) => {
  res.json({ ok: true, mock: MOCK, model: MOCK ? null : MODEL })
})

app.post('/api/generate', async (req, res) => {
  const { kind, prompt, context } = req.body ?? {}
  if (!SCHEMAS[kind]) {
    return res.status(400).json({ error: `unknown kind: ${kind}` })
  }
  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'prompt (string) is required' })
  }

  if (MOCK) {
    await sleep(1500 + Math.random() * 1500) // honest latency for the building-arc choreography
    return res.json(fixture(kind))
  }

  try {
    return res.json(await generate(kind, prompt, context))
  } catch (err) {
    console.warn(`[${kind}] attempt 1 failed: ${err.message} — retrying`)
    try {
      return res.json(await generate(kind, prompt, context))
    } catch (err2) {
      console.error(`[${kind}] attempt 2 failed: ${err2.message}`)
      return res.status(502).json({ error: `generation failed for ${kind}` })
    }
  }
})

// SPA fallback: any non-API GET that fell through gets the app.
// (Express 5 removed the '*' route pattern — a final middleware is the way.)
if (hasBuild) {
  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api')) return next()
    res.sendFile(path.join(distDir, 'index.html'))
  })
}

app.listen(PORT, () => {
  console.log(
    `constellation server → http://localhost:${PORT} ` +
      (MOCK ? '[MOCK: serving fixtures]' : `[live: ${MODEL}]`)
  )
})
