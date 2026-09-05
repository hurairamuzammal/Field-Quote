import type { ToolContext, JobStatus } from './types.ts'
import { JOB_STATUSES } from './types.ts'

export type JobRow = {
  id: string
  status: string
  customer_name: string
  work_summary: string
  scheduled_at: string | null
  technician_id: string | null
  created_at: string
}

export async function searchJobs(
  ctx: ToolContext,
  args: Record<string, unknown>,
): Promise<{ count: number; jobs: JobRow[] }> {
  const raw = args.status
  const status: JobStatus =
    typeof raw === 'string' && (JOB_STATUSES as readonly string[]).includes(raw)
      ? raw as JobStatus
      : 'unscheduled'

  const { data, error } = await ctx.admin
    .from('jobs')
    .select('id, status, customer_name, work_summary, scheduled_at, technician_id, created_at')
    .eq('company_id', ctx.companyId)
    .eq('status', status)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) throw new Error(error.message)

  const jobs = (data ?? []) as JobRow[]
  return { count: jobs.length, jobs }
}
