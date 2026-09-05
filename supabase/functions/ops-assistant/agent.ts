import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import type { ToolContext } from './tools/types.ts'
import { TOOL_DEFINITIONS } from './tools/defs.ts'
import { executeTool } from './tools/registry.ts'
import { insertChatMessage } from './session.ts'
import type { ChatHistoryRow } from './session.ts'
import { logModelCall } from './log.ts'

const MAX_TOOL_ROUNDS = 6
const FALLBACK_REPLY =
  "I couldn't finish that lookup. Try a simpler question."

const DEFAULT_OPENROUTER_MODEL = 'google/gemini-2.0-flash-001'
const DEFAULT_ZAI_TEXT_MODEL = 'glm-4.5-flash'

const SYSTEM_PROMPT = [
  'You are FieldQuote\'s ops assistant for one HVAC/electrical shop admin.',
  'Answer ONLY using tool results from this conversation turn. If a tool returns count 0, say so.',
  'Customer intake lives in requests (new/quoted/archived). Paid work lives in jobs (unscheduled after deposit). Do not confuse them.',
  'Do not invent customer names, job counts, or dollar amounts.',
  'Never reveal quote tokens, JWTs, API keys, or SQL.',
  'Never claim you scheduled a job or sent email — those require admin Confirm.',
  'To schedule or to email, call propose_schedule_job / propose_followup_email. They only create a proposal; say it is waiting for the admin to confirm, and never say it is done.',
  'Refuse bulk delete, price changes, ignoring the price book, or impersonating technicians.',
  'If the question is outside ops (jobs, quotes, requests, pipeline), decline briefly.',
  'Format for a chat bubble: short title line, then bullets. Use "- " bullets for lists of people/jobs/requests.',
  'Each bullet: customer name, then status or work in parentheses. Example: "- Maya Chen (new intake — EV charger survey)".',
  'Do not dump raw JSON. Do not write a wall of unformatted text.',
].join(' ')

type ChatMessage = Record<string, unknown>

type ToolCall = {
  id: string
  type: 'function'
  function: { name: string; arguments: string }
}

/**
 * Only the providers `runAgentLoop` can actually call. ANTHROPIC_API_KEY used to
 * count here, but no Anthropic branch exists — so with only that key set the
 * assistant reported itself available and then returned the fallback string.
 * Add the key back to this list the day a branch exists, not before.
 */
export function hasAiProvider(): boolean {
  return Boolean(
    Deno.env.get('ZAI_API_KEY') ??
      Deno.env.get('Z_AI_API_KEY') ??
      Deno.env.get('OPENROUTER_API_KEY'),
  )
}

function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4))
}

function historyToMessages(rows: ChatHistoryRow[]): ChatMessage[] {
  return rows.map((r) => ({ role: r.role, content: r.content }))
}

function normalizeMessageContent(content: unknown): string {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') return part
        if (!part || typeof part !== 'object') return ''
        const p = part as Record<string, unknown>
        if (typeof p.text === 'string') return p.text
        return ''
      })
      .filter(Boolean)
      .join('\n')
  }
  return ''
}

function parseToolCalls(message: Record<string, unknown>): ToolCall[] {
  const raw = message.tool_calls
  if (!Array.isArray(raw)) return []
  const out: ToolCall[] = []
  for (const tc of raw) {
    if (!tc || typeof tc !== 'object') continue
    const t = tc as Record<string, unknown>
    const fn = t.function as Record<string, unknown> | undefined
    if (t.type !== 'function' || typeof t.id !== 'string' || !fn) continue
    if (typeof fn.name !== 'string') continue
    out.push({
      id: t.id,
      type: 'function',
      function: {
        name: fn.name,
        arguments: typeof fn.arguments === 'string' ? fn.arguments : '{}',
      },
    })
  }
  return out
}

async function callOpenAiCompatible(args: {
  provider: 'zai' | 'openrouter'
  apiKey: string
  model: string
  messages: ChatMessage[]
  tools: typeof TOOL_DEFINITIONS
  log: { req: string; session?: string }
}): Promise<Record<string, unknown>> {
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
    headers['X-Title'] = 'FieldQuote ops-assistant'
  }

  const body = {
    model: args.model,
    temperature: 0.2,
    messages: args.messages,
    tools: args.tools,
    tool_choice: 'auto',
  }

  const started = Date.now()
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })

  const raw = await res.json().catch(() => ({}))
  if (!res.ok) {
    const label = args.provider === 'zai' ? 'Z.AI' : 'OpenRouter'
    logModelCall(args.log, {
      provider: args.provider,
      model: args.model,
      ms: Date.now() - started,
      ok: false,
      status: res.status,
    })
    throw new Error(`${label} ${res.status}: ${JSON.stringify(raw).slice(0, 400)}`)
  }
  logModelCall(args.log, {
    provider: args.provider,
    model: args.model,
    ms: Date.now() - started,
    ok: true,
    status: res.status,
  })
  return raw as Record<string, unknown>
}

async function callWithFailover(
  messages: ChatMessage[],
  tools: typeof TOOL_DEFINITIONS,
  log: { req: string; session?: string },
): Promise<Record<string, unknown>> {
  const zaiKey = Deno.env.get('ZAI_API_KEY') ?? Deno.env.get('Z_AI_API_KEY')
  const zaiModel = Deno.env.get('ZAI_TEXT_MODEL') ?? DEFAULT_ZAI_TEXT_MODEL
  const openRouterKey = Deno.env.get('OPENROUTER_API_KEY')
  const openRouterModel = Deno.env.get('OPENROUTER_MODEL') ?? DEFAULT_OPENROUTER_MODEL

  if (zaiKey) {
    try {
      return await callOpenAiCompatible({
        provider: 'zai',
        apiKey: zaiKey,
        model: zaiModel,
        messages,
        tools,
        log,
      })
    } catch (e1) {
      if (!openRouterKey) throw e1
    }
  }

  if (openRouterKey) {
    return await callOpenAiCompatible({
      provider: 'openrouter',
      apiKey: openRouterKey,
      model: openRouterModel,
      messages,
      tools,
      log,
    })
  }

  throw new Error('No AI provider configured')
}

export type AgentRunResult = {
  reply: string
  tokenEstimate: number
  toolRounds: number
  /** assistant_actions rows created this turn — linked to the reply by index.ts. */
  proposedActionIds: string[]
}

export async function runAgentLoop(args: {
  admin: SupabaseClient
  companyId: string
  sessionId: string
  history: ChatHistoryRow[]
  toolCtx: ToolContext
  reqId: string
}): Promise<AgentRunResult> {
  const log = { req: args.reqId, session: args.sessionId }
  const messages: ChatMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...historyToMessages(args.history),
  ]

  let tokenEstimate = estimateTokens(SYSTEM_PROMPT)
  let toolRounds = 0
  const proposedActionIds: string[] = []

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const raw = await callWithFailover(messages, TOOL_DEFINITIONS, log)
    const choice = (raw.choices as unknown[])?.[0] as Record<string, unknown> | undefined
    const message = (choice?.message ?? {}) as Record<string, unknown>

    const text = normalizeMessageContent(message.content)
    tokenEstimate += estimateTokens(text)

    const toolCalls = parseToolCalls(message)

    if (!toolCalls.length) {
      const reply = text.trim() || FALLBACK_REPLY
      return { reply, tokenEstimate, toolRounds, proposedActionIds }
    }

    toolRounds += 1
    messages.push({
      role: 'assistant',
      content: text || null,
      tool_calls: toolCalls,
    })

    for (const tc of toolCalls) {
      let parsedArgs: Record<string, unknown> = {}
      try {
        parsedArgs = JSON.parse(tc.function.arguments || '{}') as Record<string, unknown>
      } catch {
        parsedArgs = {}
      }

      const result = await executeTool(tc.function.name, parsedArgs, args.toolCtx)
      if (
        result && typeof result === 'object' &&
        (result as { proposed?: unknown }).proposed === true &&
        typeof (result as { action_id?: unknown }).action_id === 'string'
      ) {
        proposedActionIds.push((result as { action_id: string }).action_id)
      }
      const resultJson = JSON.stringify(result)
      tokenEstimate += estimateTokens(resultJson)

      await insertChatMessage(
        args.admin,
        args.companyId,
        args.sessionId,
        'tool',
        resultJson,
      )

      messages.push({
        role: 'tool',
        tool_call_id: tc.id,
        content: resultJson,
      })
    }
  }

  return { reply: FALLBACK_REPLY, tokenEstimate, toolRounds, proposedActionIds }
}
