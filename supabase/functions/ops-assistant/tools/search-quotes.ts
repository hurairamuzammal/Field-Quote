import type { ToolContext, QuoteStatus } from './types.ts'
import { QUOTE_STATUSES } from './types.ts'

export type QuoteRow = {
  id: string
  status: string
  total: number | string
  created_at: string
  request_id: string
}

export async function searchQuotes(
  ctx: ToolContext,
  args: Record<string, unknown>,
): Promise<{ count: number; quotes: QuoteRow[] }> {
  let statuses: QuoteStatus[] = ['sent', 'viewed']

  if (Array.isArray(args.statuses)) {
    const filtered = args.statuses.filter(
      (s): s is QuoteStatus =>
        typeof s === 'string' && (QUOTE_STATUSES as readonly string[]).includes(s),
    )
    if (filtered.length) statuses = filtered
  }

  const { data, error } = await ctx.admin
    .from('quotes')
    .select('id, status, total, created_at, request_id')
    .eq('company_id', ctx.companyId)
    .in('status', statuses)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) throw new Error(error.message)

  const quotes = (data ?? []) as QuoteRow[]
  return { count: quotes.length, quotes }
}
