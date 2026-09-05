import type { ToolContext, RequestStatus } from './types.ts'
import { REQUEST_STATUSES } from './types.ts'

export type RequestRow = {
  id: string
  status: string
  customer_name: string
  customer_email: string
  description: string
  created_at: string
}

export async function searchRequests(
  ctx: ToolContext,
  args: Record<string, unknown>,
): Promise<{ count: number; requests: RequestRow[] }> {
  const status = parseRequestStatus(args)

  const { data, error } = await ctx.admin
    .from('requests')
    .select('id, status, customer_name, customer_email, description, created_at')
    .eq('company_id', ctx.companyId)
    .eq('status', status)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) throw new Error(error.message)

  const requests = (data ?? []) as RequestRow[]
  return { count: requests.length, requests }
}

export function parseRequestStatus(args: Record<string, unknown>): RequestStatus {
  const raw = args.status
  if (typeof raw === 'string' && (REQUEST_STATUSES as readonly string[]).includes(raw)) {
    return raw as RequestStatus
  }
  return 'new'
}
