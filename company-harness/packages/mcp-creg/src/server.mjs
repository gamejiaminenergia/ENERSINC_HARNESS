#!/usr/bin/env node
/**
 * Servidor MCP (stdio) del cliente CREG.
 *
 * Envuelve el servicio Express `regulatorio/` (asistente de IA de la Comision de
 * Regulacion de Energia y Gas de Colombia) y expone sus endpoints como
 * herramientas MCP. DeepSeek Harness lo monta con `@deepseek-ai/dsh-mcp-client`.
 *
 * Es un adaptador: no implementa la consulta, solo traduce MCP <-> HTTP.
 * Config: CREG_URL (default http://127.0.0.1:3000).
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'

const CREG_URL = (process.env.CREG_URL ?? 'http://127.0.0.1:3000').replace(/\/+$/, '')

/** Llama al servicio CREG y devuelve el JSON o lanza. */
async function creg(path, init) {
  const response = await fetch(`${CREG_URL}${path}`, init)
  const raw = await response.text()
  let body
  try {
    body = JSON.parse(raw)
  } catch {
    body = raw
  }
  if (!response.ok) {
    const detail = typeof body === 'string' ? body : JSON.stringify(body)
    throw new Error(`El servicio CREG respondio ${response.status} en ${path}: ${detail}`)
  }
  return body
}

const asText = (value) => ({
  content: [{ type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value, null, 2) }],
})

const server = new McpServer({ name: 'creg', version: '0.1.0' })

server.registerTool(
  'health',
  {
    title: 'CREG: estado',
    description: 'Estado del servicio CREG (asistente de regulacion energetica colombiana): modo y pool.',
    inputSchema: {},
    annotations: { readOnlyHint: true, idempotentHint: true },
  },
  async () => asText(await creg('/health')),
)

server.registerTool(
  'ask',
  {
    title: 'CREG: preguntar',
    description:
      'Hace una pregunta al asistente de la CREG sobre regulacion energetica y de gas colombiana (tarifas, confiabilidad, mercados, normativa). Puede tardar de 12 a 180 segundos. Devuelve titulo, contenido, enlaces y listas.',
    inputSchema: {
      question: z.string().min(1).max(2000).describe('La pregunta (max 2000 caracteres)'),
      timeout: z.number().int().min(30000).max(300000).optional().describe('Timeout en ms (30000-300000, default 180000)'),
    },
    annotations: { readOnlyHint: true },
  },
  async ({ question, timeout }) =>
    asText(
      await creg('/api/ask', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ question, ...(timeout ? { timeout } : {}) }),
      }),
    ),
)

server.registerTool(
  'stats',
  {
    title: 'CREG: estadisticas',
    description: 'Estadisticas del servicio CREG: pool, cola y cache.',
    inputSchema: {},
    annotations: { readOnlyHint: true },
  },
  async () => asText(await creg('/api/stats')),
)

server.registerTool(
  'cache_clear',
  {
    title: 'CREG: limpiar cache',
    description: 'Vacia la cache de respuestas del servicio CREG.',
    inputSchema: {},
    annotations: { readOnlyHint: false },
  },
  async () => asText(await creg('/api/cache/clear')),
)

await server.connect(new StdioServerTransport())
