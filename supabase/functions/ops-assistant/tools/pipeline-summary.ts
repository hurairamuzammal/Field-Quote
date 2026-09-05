import type { ToolContext } from './types.ts'

const ACTIVE_JOB_STATUSES = ['scheduled', 'en_route', 'in_progress'] as const

export type PipelineSummary = {
  requests_new: number
  quotes_draft: number
  quotes_sent: number
  quotes_viewed: number
  quotes_accepted: number
  quotes_declined: number
  quotes_expired: number
  jobs_unscheduled: number
  jobs_active: number
  jobs_completed: number
  jobs_cancelled: number
}

async function countWhere(
  ctx: ToolContext,
  table: 'requests' | 'quotes' | 'jobs',
  status?: string,
): Promise<number> {
  let q = ctx.admin.from(table).select('id', { count: 'exact', head: true }).eq(
    'company_id',
    ctx.companyId,
  )
  if (status) q = q.eq('status', status)
  const { count, error } = await q
  if (error) throw new Error(error.message)
  return count ?? 0
}

export async function getPipelineSummary(ctx: ToolContext): Promise<PipelineSummary> {
  const [
    requests_new,
    quotes_draft,
    quotes_sent,
    quotes_viewed,
    quotes_accepted,
    quotes_declined,
    quotes_expired,
    jobs_unscheduled,
    jobs_scheduled,
    jobs_en_route,
    jobs_in_progress,
    jobs_completed,
    jobs_cancelled,
  ] = await Promise.all([
    countWhere(ctx, 'requests', 'new'),
    countWhere(ctx, 'quotes', 'draft'),
    countWhere(ctx, 'quotes', 'sent'),
    countWhere(ctx, 'quotes', 'viewed'),
    countWhere(ctx, 'quotes', 'accepted'),
    countWhere(ctx, 'quotes', 'declined'),
    countWhere(ctx, 'quotes', 'expired'),
    countWhere(ctx, 'jobs', 'unscheduled'),
    countWhere(ctx, 'jobs', 'scheduled'),
    countWhere(ctx, 'jobs', 'en_route'),
    countWhere(ctx, 'jobs', 'in_progress'),
    countWhere(ctx, 'jobs', 'completed'),
    countWhere(ctx, 'jobs', 'cancelled'),
  ])

  return {
    requests_new,
    quotes_draft,
    quotes_sent,
    quotes_viewed,
    quotes_accepted,
    quotes_declined,
    quotes_expired,
    jobs_unscheduled,
    jobs_active: jobs_scheduled + jobs_en_route + jobs_in_progress,
    jobs_completed,
    jobs_cancelled,
  }
}
