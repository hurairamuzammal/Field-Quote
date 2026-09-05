/**
 * ops-confirm — the gated half of Phase D.
 *
 * The assistant only ever writes `assistant_actions.status = 'proposed'`.
 * Nothing reaches `jobs` or Resend until an admin clicks Confirm and this
 * endpoint runs. P2 §5.6 / P1 Day 22.
 *
 * The client sends ONLY the action id and a decision. Every value that gets
 * written comes from the stored `payload`, so a tampered body changes nothing.
 */
import { corsFor, corsPreflight } from '../_shared/cors.ts'
import { requireActiveAdmin } from '../_shared/require-admin.ts'
import { readJsonBody, rejectWrongMethod, unexpectedError } from '../_shared/http.ts'
import { assertRateLimit, rateLimitResponse } from '../_shared/rate-limit.ts'
import { sendAndLogEmail } from '../_shared/send-email.ts'
import { fetchCompanyBrand } from '../_shared/company.ts'

/** A proposal older than this is stale — the schedule may have moved under it. */
const PROPOSAL_TTL_MS = 15 * 60 * 1000

function json(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsFor(req), 'Content-Type': 'application/json' },
  })
}

type Body = { action_id?: string; decision?: string }

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return corsPreflight(req)
  const wrong = rejectWrongMethod(req, ['POST'])
  if (wrong) return wrong

  try {
    const gate = await requireActiveAdmin(req, corsFor(req))
    if (!gate.ok) return gate.response
    const { admin, companyId, userId } = gate.caller

    const parsed = await readJsonBody<Body>(req)
    if (!parsed.ok) return parsed.response

    const actionId = typeof parsed.value.action_id === 'string' ? parsed.value.action_id.trim() : ''
    const decision = typeof parsed.value.decision === 'string'
      ? parsed.value.decision.trim().toLowerCase()
      : 'confirm'

    if (!actionId) return json(req, { error: 'action_id is required' }, 400)
    if (decision !== 'confirm' && decision !== 'decline') {
      return json(req, { error: 'decision must be confirm or decline' }, 400)
    }

    const limit = await assertRateLimit(admin, {
      req,
      route: 'ops-confirm',
      limit: 20,
      windowMs: 60_000,
      identity: userId,
    })
    if (!limit.allowed) return rateLimitResponse(corsFor(req), limit.retryAfterSec)

    const { data: action } = await admin
      .from('assistant_actions')
      .select('id, company_id, action_name, payload, status, created_at')
      .eq('id', actionId)
      .maybeSingle()

    if (!action || action.company_id !== companyId) {
      return json(req, { error: 'No such action.' }, 404)
    }
    if (action.status !== 'proposed') {
      // Idempotent: a second click is not an error, it is a no-op.
      return json(req, {
        ok: true,
        already: true,
        action_id: actionId,
        status: action.status,
      })
    }

    if (Date.now() - new Date(action.created_at as string).getTime() > PROPOSAL_TTL_MS) {
      await admin.from('assistant_actions')
        .update({ status: 'declined', executed_by: userId, executed_at: new Date().toISOString() })
        .eq('id', actionId).eq('status', 'proposed')
      return json(req, {
        ok: false,
        action_id: actionId,
        status: 'declined',
        error: 'This suggestion is out of date. Ask again and confirm the new one.',
      }, 409)
    }

    if (decision === 'decline') {
      await admin.from('assistant_actions')
        .update({ status: 'declined', executed_by: userId, executed_at: new Date().toISOString() })
        .eq('id', actionId).eq('status', 'proposed')
      return json(req, { ok: true, action_id: actionId, status: 'declined' })
    }

    // Claim the row BEFORE doing the work.
    //
    // The status check above is a read; two Confirm clicks landing together both
    // passed it, both scheduled the job or sent the email, and only then wrote
    // the status. Moving to 'executing' with `.eq('status','proposed')` makes the
    // claim atomic — exactly one request gets a row back, and the loser returns
    // the same idempotent "already" answer a second click has always returned.
    const { data: claimed } = await admin
      .from('assistant_actions')
      .update({ status: 'executing', executed_by: userId })
      .eq('id', actionId)
      .eq('status', 'proposed')
      .select('id')
      .maybeSingle()

    if (!claimed) {
      return json(req, {
        ok: true,
        already: true,
        action_id: actionId,
        status: 'executing_or_done',
      })
    }

    const payload = (action.payload ?? {}) as Record<string, unknown>
    let failure: string | null = null

    if (action.action_name === 'schedule_job') {
      // Re-validate: the world may have moved since the proposal was written.
      const jobId = String(payload.job_id ?? '')
      const { data: job } = await admin
        .from('jobs')
        .select('id, status, company_id')
        .eq('id', jobId)
        .eq('company_id', companyId)
        .maybeSingle()

      if (!job) {
        failure = 'That job no longer exists.'
      } else if (job.status !== 'unscheduled' && job.status !== 'scheduled') {
        failure = `That job is now ${job.status} and can no longer be scheduled.`
      } else {
        const { error } = await admin
          .from('jobs')
          .update({
            technician_id: String(payload.technician_id ?? ''),
            scheduled_at: String(payload.scheduled_at ?? ''),
            duration_min: Number(payload.duration_min ?? 60),
            status: 'scheduled',
          })
          .eq('id', jobId)
          .eq('company_id', companyId)
        if (error) failure = error.message
      }
    } else if (action.action_name === 'draft_followup_email') {
      const toEmail = String(payload.to_email ?? '')
      const subject = String(payload.subject ?? '')
      const body = String(payload.body ?? '')
      if (!toEmail || !subject || !body) {
        failure = 'That draft is incomplete.'
      } else {
        const brandRes = await fetchCompanyBrand(admin, companyId)
        const companyName = 'brand' in brandRes ? brandRes.brand.name : 'Your company'
        const html = `<div style="font-family:Manrope,Arial,sans-serif;font-size:15px;line-height:1.6;color:#0f1923">${
          escapeHtml(body).replace(/\n/g, '<br>')
        }</div>`
        const sent = await sendAndLogEmail({
          admin,
          companyId,
          toEmail,
          template: 'ops_assistant_followup',
          relatedId: String(payload.quote_id ?? '') || null,
          subject,
          html,
          companyName,
        })
        if (!sent.ok) failure = sent.error
      }
    } else {
      failure = `Unknown action: ${action.action_name}`
    }

    const nowIso = new Date().toISOString()
    await admin
      .from('assistant_actions')
      .update({
        status: failure ? 'failed' : 'executed',
        executed_by: userId,
        executed_at: nowIso,
      })
      .eq('id', actionId)
      .eq('status', 'executing')

    if (failure) {
      return json(req, { ok: false, action_id: actionId, status: 'failed', error: failure }, 409)
    }

    return json(req, {
      ok: true,
      action_id: actionId,
      status: 'executed',
      action_name: action.action_name,
      executed_at: nowIso,
    })
  } catch {
    return unexpectedError(req)
  }
})
