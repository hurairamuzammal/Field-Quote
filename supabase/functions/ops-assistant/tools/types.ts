import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

export type ToolContext = {
  admin: SupabaseClient
  companyId: string
  /** Correlation ids for structured logs. Tools ignore these. */
  reqId?: string
  sessionId?: string
}

export const JOB_STATUSES = [
  'unscheduled',
  'scheduled',
  'en_route',
  'in_progress',
  'completed',
  'cancelled',
] as const

export type JobStatus = typeof JOB_STATUSES[number]

export const QUOTE_STATUSES = [
  'draft',
  'sent',
  'viewed',
  'accepted',
  'declined',
  'expired',
] as const

export type QuoteStatus = typeof QUOTE_STATUSES[number]

export const REQUEST_STATUSES = ['new', 'quoted', 'archived'] as const

export type RequestStatus = typeof REQUEST_STATUSES[number]

export type OpenAiToolDef = {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: Record<string, unknown>
  }
}
