import type { ToolContext } from './types.ts'
import { logTool } from '../log.ts'
import { TOOL_NAMES } from './defs.ts'
import { searchJobs } from './search-jobs.ts'
import { searchQuotes } from './search-quotes.ts'
import { searchRequests } from './search-requests.ts'
import { getPipelineSummary } from './pipeline-summary.ts'
import { getCustomerHistory } from './customer-history.ts'
import { proposeScheduleJob, proposeFollowupEmail } from './propose.ts'

export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  ctx: ToolContext,
): Promise<unknown> {
  if (!TOOL_NAMES.has(name)) {
    return { error: `Unknown tool: ${name}` }
  }

  const base = { req: ctx.reqId ?? '-', session: ctx.sessionId }
  const started = Date.now()

  try {
    let result: unknown
    switch (name) {
      case 'search_jobs':
        result = await searchJobs(ctx, args)
        break
      case 'search_requests':
        result = await searchRequests(ctx, args)
        break
      case 'search_quotes':
        result = await searchQuotes(ctx, args)
        break
      case 'get_pipeline_summary':
        result = await getPipelineSummary(ctx)
        break
      case 'get_customer_history':
        result = await getCustomerHistory(ctx, args)
        break
      case 'propose_schedule_job':
        result = await proposeScheduleJob(ctx, args)
        break
      case 'propose_followup_email':
        result = await proposeFollowupEmail(ctx, args)
        break
      default:
        return { error: `Unknown tool: ${name}` }
    }

    const count = (result && typeof result === 'object' && 'count' in result &&
      typeof (result as { count: unknown }).count === 'number')
      ? (result as { count: number }).count
      : undefined

    logTool(base, { tool: name, ms: Date.now() - started, ok: true, count })
    return result
  } catch (e) {
    logTool(base, { tool: name, ms: Date.now() - started, ok: false, error: String(e).slice(0, 200) })
    return { error: String(e) }
  }
}
