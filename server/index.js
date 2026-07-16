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
    max_tokens: 4000,
    system: SYSTEM_PROMPTS[kind],
    tools: [
      {
        name: `emit_${kind}`,
        description: `Emit the ${kind} artifact as structured JSON.`,
        input_schema: SCHEMAS[kind],
      },
    ],
    tool_choice: { type: 'tool', name: `emit_${kind}` },
    messages: [{ role: 'user', content: buildUserMessage(kind, prompt, context) }],
  })

  const block = msg.content.find((b) => b.type === 'tool_use')
  if (!block) throw new Error('no tool_use block in response')

  const missing = (REQUIRED_KEYS[kind] ?? []).filter((k) => !(k in block.input))
  if (missing.length) throw new Error(`response missing keys: ${missing.join(', ')}`)

  return block.input
}

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

app.listen(PORT, () => {
  console.log(
    `constellation server → http://localhost:${PORT} ` +
      (MOCK ? '[MOCK: serving fixtures]' : `[live: ${MODEL}]`)
  )
})
