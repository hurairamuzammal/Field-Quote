import type { ToolContext } from './types.ts'

export type CustomerHistoryItem = {
  kind: 'job' | 'request'
  id: string
  customer_name: string
  customer_email: string | null
  status: string
  summary: string
  created_at: string
}

export async function getCustomerHistory(
  ctx: ToolContext,
  args: Record<string, unknown>,
): Promise<{ query: string; count: number; items: CustomerHistoryItem[]; error?: string }> {
  const query = typeof args.query === 'string' ? args.query.trim() : ''
  if (query.length < 3) {
    return {
      query,
      count: 0,
      items: [],
      error: 'query must be at least 3 characters',
    }
  }

  const safe = query.replace(/[%_]/g, '')
  const pattern = `%${safe}%`

  const [jobsRes, requestsRes] = await Promise.all([
    ctx.admin
      .from('jobs')
      .select('id, customer_name, customer_email, status, work_summary, created_at')
      .eq('company_id', ctx.companyId)
      .or(`customer_name.ilike.${pattern},customer_email.ilike.${pattern}`)
      .order('created_at', { ascending: false })
      .limit(10),
    ctx.admin
      .from('requests')
      .select('id, customer_name, customer_email, status, description, created_at')
      .eq('company_id', ctx.companyId)
      .or(`customer_name.ilike.${pattern},customer_email.ilike.${pattern}`)
      .order('created_at', { ascending: false })
      .limit(10),
  ])

  if (jobsRes.error) throw new Error(jobsRes.error.message)
  if (requestsRes.error) throw new Error(requestsRes.error.message)

  const items: CustomerHistoryItem[] = []

  for (const j of jobsRes.data ?? []) {
    items.push({
      kind: 'job',
      id: j.id as string,
      customer_name: j.customer_name as string,
      customer_email: (j.customer_email as string) ?? null,
      status: j.status as string,
      summary: (j.work_summary as string) ?? '',
      created_at: j.created_at as string,
    })
  }

  for (const r of requestsRes.data ?? []) {
    items.push({
      kind: 'request',
      id: r.id as string,
      customer_name: r.customer_name as string,
      customer_email: (r.customer_email as string) ?? null,
      status: r.status as string,
      summary: (r.description as string) ?? '',
      created_at: r.created_at as string,
    })
  }

  items.sort((a, b) => b.created_at.localeCompare(a.created_at))
  const capped = items.slice(0, 20)

  return { query, count: capped.length, items: capped }
}
