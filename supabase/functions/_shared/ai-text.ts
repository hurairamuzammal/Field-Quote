/**
 * Small text-only model call for copy personalisation (§9.1).
 *
 * Deliberately NOT the same code path as `draft-quote`: this one is short, cheap,
 * always optional, and must never throw into a cron run. Same provider order as
 * everywhere else — Z.AI GLM primary, OpenRouter fallback.
 *
 * The scope's rule is "tone locked; the model fills specifics". So callers pass a
 * hard template and use this only for slot values, then validate what comes back
 * (see `sanitiseSlot`) and fall back to static copy on any doubt.
 */

const DEFAULT_ZAI_TEXT_MODEL = 'glm-4.5-flash'
const DEFAULT_OPENROUTER_MODEL = 'google/gemini-2.0-flash-001'

export function hasTextProvider(): boolean {
  return Boolean(
    Deno.env.get('ZAI_API_KEY') ??
      Deno.env.get('Z_AI_API_KEY') ??
      Deno.env.get('OPENROUTER_API_KEY'),
  )
}

async function callOnce(args: {
  provider: 'zai' | 'openrouter'
  apiKey: string
  model: string
  system: string
  user: string
  maxTokens: number
  signal: AbortSignal
}): Promise<string> {
  const url = args.provider === 'zai'
    ? (Deno.env.get('ZAI_BASE_URL')?.replace(/\/$/, '') ||
      'https://api.z.ai/api/paas/v4/chat/completions')
    : 'https://openrouter.ai/api/v1/chat/completions'

  const headers: Record<string, string> = {
    Authorization: `Bearer ${args.apiKey}`,
    'Content-Type': 'application/json',
  }
  if (args.provider === 'openrouter') {
    headers['HTTP-Referer'] = 'https://fieldquote-26446.bubbleapps.io'
    headers['X-Title'] = 'FieldQuote follow-ups'
  }

  const body: Record<string, unknown> = {
    model: args.model,
    temperature: 0.3,
    max_tokens: args.maxTokens,
    messages: [
      { role: 'system', content: args.system },
      { role: 'user', content: args.user },
    ],
  }
  if (args.provider === 'zai') body.thinking = { type: 'disabled' }

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: args.signal,
  })
  const raw = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(`${args.provider} ${res.status}`)

  const content = raw?.choices?.[0]?.message?.content
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .map((p: unknown) =>
        p && typeof p === 'object' && typeof (p as { text?: unknown }).text === 'string'
          ? (p as { text: string }).text
          : ''
      )
      .join('')
  }
  return ''
}

/**
 * Returns model text, or null on any failure. Never throws.
 * Hard-capped by `timeoutMs` so one slow provider can't stall a whole cron sweep.
 */
export async function generateText(args: {
  system: string
  user: string
  maxTokens?: number
  timeoutMs?: number
}): Promise<string | null> {
  const zaiKey = Deno.env.get('ZAI_API_KEY') ?? Deno.env.get('Z_AI_API_KEY')
  const openRouterKey = Deno.env.get('OPENROUTER_API_KEY')
  const maxTokens = args.maxTokens ?? 120

  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), args.timeoutMs ?? 8000)

  try {
    if (zaiKey) {
      try {
        return await callOnce({
          provider: 'zai',
          apiKey: zaiKey,
          model: Deno.env.get('ZAI_TEXT_MODEL') ?? DEFAULT_ZAI_TEXT_MODEL,
          system: args.system,
          user: args.user,
          maxTokens,
          signal: ctrl.signal,
        })
      } catch (e) {
        console.error('ai-text zai failed:', String(e))
      }
    }
    if (openRouterKey) {
      try {
        return await callOnce({
          provider: 'openrouter',
          apiKey: openRouterKey,
          model: Deno.env.get('OPENROUTER_MODEL') ?? DEFAULT_OPENROUTER_MODEL,
          system: args.system,
          user: args.user,
          maxTokens,
          signal: ctrl.signal,
        })
      } catch (e) {
        console.error('ai-text openrouter failed:', String(e))
      }
    }
    return null
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Code-side guard on a model-written slot (§9.1 "tone locked").
 *
 * Rejects anything that could change the commercial meaning or the tone of an
 * admin-approved template: links, money, markdown, quotes, multi-sentence rambling.
 * Returns null → caller uses its static fallback.
 */
export function sanitiseSlot(
  raw: string | null,
  opts: { maxChars?: number } = {},
): string | null {
  if (!raw) return null
  const maxChars = opts.maxChars ?? 160

  let s = raw
    .replace(/<[^>]*>/g, ' ') // no HTML — the layout owns the markup
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^["'`]+|["'`]+$/g, '')
    .trim()

  if (!s) return null
  if (s.length > maxChars) return null
  if (/https?:\/\/|www\.|@[\w.-]+\.\w/i.test(s)) return null // no links or addresses
  if (/[£$€]|\b\d+(?:[.,]\d{2})\b|\bper cent\b|%/i.test(s)) return null // never restate money
  if (/[*_#|]{2,}|^[-*]\s/.test(s)) return null // no markdown
  if (/\b(as an ai|language model|i cannot|i'm sorry)\b/i.test(s)) return null // refusal leakage

  // One or two sentences, no more.
  if ((s.match(/[.!?](\s|$)/g) ?? []).length > 2) return null

  return s
}
