import { corsFor, corsPreflight } from '../_shared/cors.ts'
import { requireActiveAdmin } from '../_shared/require-admin.ts'
import { readJsonBody, rejectWrongMethod, unexpectedError } from '../_shared/http.ts'
import { assertRateLimit, rateLimitResponse } from '../_shared/rate-limit.ts'
import { searchJobs } from './tools/search-jobs.ts'
import { formatUnscheduledJobs } from './template.ts'
import {
  MAX_MESSAGE_CHARS,
  MAX_SESSION_TOKENS,
  SESSION_TOKEN_WARN_AT,
  SESSION_FULL_REPLY,
  resolveSession,
  insertChatMessage,
  insertChatMessageReturningId,
  linkActionsToMessage,
  loadChatHistory,
  getSessionTokenCount,
  touchSessionTokenCount,
} from './session.ts'
import { hasAiProvider, runAgentLoop } from './agent.ts'
import { newRequestId, logTurnStart, logTurnEnd, logDenied } from './log.ts'

/** Paid model call per message — cap the burst. */
const RATE_LIMIT_PER_MIN = 12

function json(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsFor(req), 'Content-Type': 'application/json' },
  })
}

type RequestBody = {
  message?: string
  session_id?: string
  /** `template` = Phase B (search_jobs unscheduled only, no model). `agent` = tool-use loop. */
  mode?: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return corsPreflight(req)
  const wrong = rejectWrongMethod(req, ['POST'])
  if (wrong) return wrong

  try {
    const gate = await requireActiveAdmin(req, corsFor(req))
    if (!gate.ok) return gate.response

    const { caller } = gate
    const { admin, companyId, userId } = caller

    const reqId = newRequestId()
    const startedAt = Date.now()

    const parsed = await readJsonBody<RequestBody>(req)
    if (!parsed.ok) return parsed.response

    const message = typeof parsed.value.message === 'string' ? parsed.value.message.trim() : ''
    if (!message) {
      logDenied({ req: reqId }, { reason: 'empty_message' })
      return json(req, { error: 'message is required' }, 400)
    }
    if (message.length > MAX_MESSAGE_CHARS) {
      logDenied({ req: reqId }, { reason: 'too_long' })
      return json(req, { error: `message exceeds ${MAX_MESSAGE_CHARS} characters` }, 400)
    }

    // Per-admin burst cap. Identity is the user id, not the IP: several admins
    // behind one office IP must not share a bucket.
    const limit = await assertRateLimit(admin, {
      req,
      route: 'ops-assistant',
      limit: RATE_LIMIT_PER_MIN,
      windowMs: 60_000,
      identity: userId,
    })
    if (!limit.allowed) {
      logDenied({ req: reqId }, { reason: 'rate_limited', retryAfterSec: limit.retryAfterSec })
      return rateLimitResponse(corsFor(req), limit.retryAfterSec)
    }

    const rawSessionId = typeof parsed.value.session_id === 'string'
      ? parsed.value.session_id.trim()
      : ''
    const sessionIdInput = rawSessionId || undefined

    const sessionRes = await resolveSession(
      admin,
      companyId,
      userId,
      sessionIdInput,
      message,
    )
    if (!sessionRes.ok) {
      logDenied({ req: reqId }, { reason: 'bad_session' })
      return json(req, { error: sessionRes.error }, 400)
    }
    const sessionId = sessionRes.sessionId

    // Thread ceiling. Checked before any model work so a full session costs nothing.
    const openingTokens = await getSessionTokenCount(admin, sessionId)
    if (openingTokens >= MAX_SESSION_TOKENS) {
      await insertChatMessage(admin, companyId, sessionId, 'user', message)
      await insertChatMessage(admin, companyId, sessionId, 'assistant', SESSION_FULL_REPLY)
      logDenied({ req: reqId, session: sessionId }, { reason: 'session_full' })
      logTurnEnd({ req: reqId, session: sessionId }, {
        mode: 'blocked',
        toolRounds: 0,
        replyChars: SESSION_FULL_REPLY.length,
        tokenEstimate: 0,
        tokenCount: openingTokens,
        ms: Date.now() - startedAt,
        sessionFull: true,
      })
      return json(req, {
        ok: true,
        session_id: sessionId,
        reply: SESSION_FULL_REPLY,
        token_count: openingTokens,
        token_limit: MAX_SESSION_TOKENS,
        session_full: true,
        session_near_limit: true,
        mode: 'blocked',
      })
    }

    await insertChatMessage(admin, companyId, sessionId, 'user', message)

    const requestedMode = typeof parsed.value.mode === 'string'
      ? parsed.value.mode.trim().toLowerCase()
      : ''
    const useAgent = requestedMode === 'agent' || (requestedMode !== 'template' && hasAiProvider())
    const mode = useAgent ? 'agent' : 'template'

    logTurnStart({ req: reqId, session: sessionId }, {
      mode,
      messageChars: message.length,
      tokenCount: openingTokens,
    })

    let reply: string
    let tokenEstimate = 0
    let toolRounds = 0
    let proposedActionIds: string[] = []

    if (mode === 'template') {
      const { jobs } = await searchJobs(
        { admin, companyId, reqId, sessionId },
        { status: 'unscheduled' },
      )
      reply = formatUnscheduledJobs(jobs)
      tokenEstimate = Math.ceil(reply.length / 4)
    } else {
      const history = await loadChatHistory(admin, sessionId)
      const agentResult = await runAgentLoop({
        admin,
        companyId,
        sessionId,
        history,
        toolCtx: { admin, companyId, reqId, sessionId },
        reqId,
      })
      reply = agentResult.reply
      tokenEstimate = agentResult.tokenEstimate
      toolRounds = agentResult.toolRounds
      proposedActionIds = agentResult.proposedActionIds
    }

    // The proposal rows were written during the tool loop, before this reply
    // existed — link them now so the UI can anchor a Confirm card under it.
    const assistantMessageId = await insertChatMessageReturningId(
      admin, companyId, sessionId, 'assistant', reply,
    )
    if (proposedActionIds.length && assistantMessageId) {
      await linkActionsToMessage(admin, proposedActionIds, assistantMessageId)
    }
    const tokenCount = await touchSessionTokenCount(admin, sessionId, tokenEstimate)

    logTurnEnd({ req: reqId, session: sessionId }, {
      mode,
      toolRounds,
      replyChars: reply.length,
      tokenEstimate,
      tokenCount,
      ms: Date.now() - startedAt,
    })

    return json(req, {
      ok: true,
      session_id: sessionId,
      reply,
      token_count: tokenCount,
      token_limit: MAX_SESSION_TOKENS,
      session_full: tokenCount >= MAX_SESSION_TOKENS,
      session_near_limit: tokenCount >= SESSION_TOKEN_WARN_AT,
      mode,
      message_id: assistantMessageId,
      proposed_action_ids: proposedActionIds,
      has_proposal: proposedActionIds.length > 0,
    })
  } catch {
    return unexpectedError(req)
  }
})
