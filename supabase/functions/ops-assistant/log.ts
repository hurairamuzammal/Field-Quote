/**
 * Structured, single-line JSON logs so Supabase log search can filter them.
 * Never log message content, tool arguments values, tokens or keys — only
 * shapes and counts. `learn/08` §7: show the tool count in logs.
 */

export type LogBase = {
  req: string
  session?: string
}

function emit(payload: Record<string, unknown>): void {
  try {
    console.log(JSON.stringify(payload))
  } catch {
    // logging must never break a request
  }
}

/** Short correlation id so one chat turn can be followed across lines. */
export function newRequestId(): string {
  return crypto.randomUUID().slice(0, 8)
}

export function logTurnStart(base: LogBase, info: {
  mode: string
  messageChars: number
  tokenCount: number
}): void {
  emit({ evt: 'ops.turn.start', ...base, ...info })
}

export function logTool(base: LogBase, info: {
  tool: string
  ms: number
  ok: boolean
  /** Row count when the tool returns a list — the number §7 asks for. */
  count?: number
  error?: string
}): void {
  emit({ evt: 'ops.tool', ...base, ...info })
}

export function logModelCall(base: LogBase, info: {
  provider: string
  model: string
  ms: number
  ok: boolean
  status?: number
  error?: string
}): void {
  emit({ evt: 'ops.model', ...base, ...info })
}

export function logTurnEnd(base: LogBase, info: {
  mode: string
  toolRounds: number
  replyChars: number
  tokenEstimate: number
  tokenCount: number
  ms: number
  sessionFull?: boolean
}): void {
  emit({ evt: 'ops.turn.end', ...base, ...info })
}

export function logDenied(base: LogBase, info: {
  reason: 'rate_limited' | 'session_full' | 'bad_session' | 'empty_message' | 'too_long'
  retryAfterSec?: number
}): void {
  emit({ evt: 'ops.denied', ...base, ...info })
}
