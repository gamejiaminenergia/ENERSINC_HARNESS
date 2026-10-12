/**
 * Complemento de DeepSeek Harness: herramientas nativas del cliente CREG.
 *
 * Plugin Cordis que registra tools del servicio `regulatorio/` (asistente de la
 * Comision de Regulacion de Energia y Gas de Colombia) usando `defineTool`.
 *
 * El adaptador habla con el servicio Express por HTTP; `baseUrl` es configurable
 * desde cordis.yml (nada hardcodeado).
 */
import Schema from '@deepseek-ai/schemastery'
import { defineTool } from '@deepseek-ai/dsh-tools'

export const name = 'creg-tools'
export const inject = ['tools']

export const Config = Schema.object({
  /** URL base del servicio CREG. */
  baseUrl: Schema.string().default('http://127.0.0.1:3000'),
})

async function cregRequest(baseUrl, path, init) {
  const response = await fetch(`${baseUrl}${path}`, init)
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

const asText = (value) => [{ type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value, null, 2) }]

export function apply(ctx, config) {
  const baseUrl = String(config.baseUrl).replace(/\/+$/, '')

  ctx.tools.register(
    defineTool({
      name: 'creg_health',
      description: 'Estado del servicio CREG (asistente de regulacion energetica colombiana): modo y pool.',
      parameters: {},
      output: { schema: { type: 'object', additionalProperties: true }, render: (_a, v) => asText(v) },
      async execute() {
        return cregRequest(baseUrl, '/health')
      },
    }),
  )

  ctx.tools.register(
    defineTool({
      name: 'creg_ask',
      description:
        'Pregunta al asistente de la CREG sobre regulacion energetica y de gas colombiana (tarifas, confiabilidad, mercados, normativa). Puede tardar de 12 a 180 segundos.',
      parameters: {
        question: { type: 'string', required: true, description: 'La pregunta (max 2000 caracteres)' },
        timeout: { type: 'number', description: 'Timeout en ms (30000-300000, default 180000)' },
      },
      output: { schema: { type: 'object', additionalProperties: true }, render: (_a, v) => asText(v) },
      async execute(args) {
        const timeout =
          Number.isFinite(args.timeout) && args.timeout > 0 ? Math.min(Math.max(args.timeout, 30000), 300000) : undefined
        return cregRequest(baseUrl, '/api/ask', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ question: String(args.question), ...(timeout ? { timeout } : {}) }),
        })
      },
    }),
  )

  ctx.tools.register(
    defineTool({
      name: 'creg_stats',
      description: 'Estadisticas del servicio CREG: pool, cola y cache.',
      parameters: {},
      output: { schema: { type: 'object', additionalProperties: true }, render: (_a, v) => asText(v) },
      async execute() {
        return cregRequest(baseUrl, '/api/stats')
      },
    }),
  )
}
