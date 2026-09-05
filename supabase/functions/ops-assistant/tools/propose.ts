/**
 * Phase D write tools. These never touch `jobs` or Resend — they validate, then
 * insert a row in `assistant_actions` with status `proposed` and hand the id
 * back to the model. Execution happens in `ops-confirm`, after an admin clicks.
 *
 * P2 §5.6 / P1 Day 22: "returns a proposed action the admin confirms in Bubble
 * before a separate gated call executes it."
 */
import type { ToolContext } from './types.ts'

export type ProposalResult = {
  proposed: true
  action_id: string
  action_name: string
  summary: string
  payload: Record<string, unknown>
  warning?: string
} | {
  proposed: false
  error: string
}

async function insertProposal(
  ctx: ToolContext,
  actionName: string,
  payload: Record<string, unknown>,
  summary: string,
  warning?: string,
): Promise<ProposalResult> {
  const { data, error } = await ctx.admin
    .from('assistant_actions')
    .insert({
      company_id: ctx.companyId,
      session_id: ctx.sessionId ?? null,
      action_name: actionName,
      payload,
      status: 'proposed',
    })
    .select('id')
    .single()

  if (error || !data) {
    return { proposed: false, error: error?.message ?? 'Could not record the proposal' }
  }
  return {
    proposed: true,
    action_id: data.id as string,
    action_name: actionName,
    summary,
    payload,
    ...(warning ? { warning } : {}),
  }
}

/* ------------------------------------------------------------------ schedule */

export async function proposeScheduleJob(
  ctx: ToolContext,
  args: Record<string, unknown>,
): Promise<ProposalResult> {
  const jobId = typeof args.job_id === 'string' ? args.job_id.trim() : ''
  const technicianId = typeof args.technician_id === 'string' ? args.technician_id.trim() : ''
  const scheduledAtRaw = typeof args.scheduled_at === 'string' ? args.scheduled_at.trim() : ''
  const durationMin = typeof args.duration_min === 'number' ? Math.round(args.duration_min) : 60

  if (!jobId) return { proposed: false, error: 'job_id is required. Use search_jobs first.' }
  if (!technicianId) return { proposed: false, error: 'technician_id is required.' }
  if (!scheduledAtRaw) return { proposed: false, error: 'scheduled_at is required (ISO 8601).' }

  const when = new Date(scheduledAtRaw)
  if (Number.isNaN(when.getTime())) {
    return { proposed: false, error: 'scheduled_at is not a valid date.' }
  }
  if (when.getTime() < Date.now()) {
    return { proposed: false, error: 'That time is in the past.' }
  }
  if (durationMin <= 0) return { proposed: false, error: 'duration_min must be greater than zero.' }

  const { data: job } = await ctx.admin
    .from('jobs')
    .select('id, status, customer_name, work_summary, technician_id, scheduled_at')
    .eq('id', jobId)
    .eq('company_id', ctx.companyId)
    .maybeSingle()

  if (!job) return { proposed: false, error: 'No such job in this company.' }
  if (job.status !== 'unscheduled' && job.status !== 'scheduled') {
    return {
      proposed: false,
      error: `That job is ${job.status}; only unscheduled or scheduled jobs can be re-timed.`,
    }
  }

  const { data: tech } = await ctx.admin
    .from('profiles')
    .select('id, full_name, role, active')
    .eq('id', technicianId)
    .eq('company_id', ctx.companyId)
    .maybeSingle()

  if (!tech) return { proposed: false, error: 'No such technician in this company.' }
  if (tech.role !== 'technician') return { proposed: false, error: 'That person is not a technician.' }
  if (!tech.active) return { proposed: false, error: `${tech.full_name} is deactivated.` }

  // Overlap is a WARNING, not a block — P1 Day 16 / scope §8.1.
  const endsAt = new Date(when.getTime() + durationMin * 60_000)
  const dayStart = new Date(when); dayStart.setUTCHours(0, 0, 0, 0)
  const dayEnd = new Date(dayStart.getTime() + 86_400_000)

  const { data: sameDay } = await ctx.admin
    .from('jobs')
    .select('id, customer_name, scheduled_at, duration_min')
    .eq('company_id', ctx.companyId)
    .eq('technician_id', technicianId)
    .in('status', ['scheduled', 'en_route', 'in_progress'])
    .gte('scheduled_at', dayStart.toISOString())
    .lt('scheduled_at', dayEnd.toISOString())
    .neq('id', jobId)

  let warning: string | undefined
  for (const other of sameDay ?? []) {
    if (!other.scheduled_at) continue
    const oStart = new Date(other.scheduled_at as string).getTime()
    const oEnd = oStart + ((other.duration_min as number | null) ?? 60) * 60_000
    if (when.getTime() < oEnd && endsAt.getTime() > oStart) {
      warning = `${tech.full_name} already has ${other.customer_name} at that time.`
      break
    }
  }

  const payload: Record<string, unknown> = {
    job_id: jobId,
    customer_name: job.customer_name,
    work_summary: job.work_summary,
    technician_id: technicianId,
    technician_name: tech.full_name,
    scheduled_at: when.toISOString(),
    ends_at: endsAt.toISOString(),
    duration_min: durationMin,
    previous_status: job.status,
  }
  // Persist on the row — the Confirm card reads payload.warning, not the
  // tool result the model saw. Omit when empty so Bubble's "is not empty" works.
  if (warning) payload.warning = warning

  return await insertProposal(
    ctx,
    'schedule_job',
    payload,
    `Schedule ${job.customer_name} with ${tech.full_name}`,
    warning,
  )
}

/* ------------------------------------------------------------- follow-up draft */

export async function proposeFollowupEmail(
  ctx: ToolContext,
  args: Record<string, unknown>,
): Promise<ProposalResult> {
  const quoteId = typeof args.quote_id === 'string' ? args.quote_id.trim() : ''
  const subject = typeof args.subject === 'string' ? args.subject.trim() : ''
  const body = typeof args.body === 'string' ? args.body.trim() : ''

  if (!quoteId) return { proposed: false, error: 'quote_id is required. Use search_quotes first.' }
  if (!subject) return { proposed: false, error: 'subject is required.' }
  if (body.length < 20) return { proposed: false, error: 'body is too short to send.' }
  if (body.length > 4000) return { proposed: false, error: 'body is too long.' }

  const { data: quote } = await ctx.admin
    .from('quotes')
    .select('id, status, total, request_id, requests(customer_name, customer_email)')
    .eq('id', quoteId)
    .eq('company_id', ctx.companyId)
    .maybeSingle()

  if (!quote) return { proposed: false, error: 'No such quote in this company.' }

  const req = (quote as { requests?: { customer_name?: string; customer_email?: string } }).requests
  const toEmail = req?.customer_email ?? ''
  if (!toEmail) return { proposed: false, error: 'That quote has no customer email.' }
  if (!['sent', 'viewed'].includes(String(quote.status))) {
    return {
      proposed: false,
      error: `That quote is ${quote.status}; follow-ups only make sense for sent or viewed quotes.`,
    }
  }

  const payload = {
    quote_id: quoteId,
    to_email: toEmail,
    customer_name: req?.customer_name ?? '',
    subject,
    body,
  }

  return await insertProposal(
    ctx,
    'draft_followup_email',
    payload,
    `Follow-up email to ${req?.customer_name ?? toEmail}`,
  )
}
