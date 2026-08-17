import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

export type RateLimitOk = { allowed: true }
export type RateLimitDenied = { allowed: false; retryAfterSec: number }
export type RateLimitResult = RateLimitOk | RateLimitDenied

/** First public IP: CF, then X-Forwarded-For. Missing → `unknown` (shared bucket). */
export function clientIp(req: Request): string {
  const cf = req.headers.get('cf-connecting-ip')?.trim()
  if (cf) return cf
  const xff = req.headers.get('x-forwarded-for')
  if (xff) {
    const first = xff.split(',')[0]?.trim()
    if (first) return first
  }
  const realIp = req.headers.get('x-real-ip')?.trim()
  if (realIp) return realIp
  return 'unknown'
}

/**
 * Fail closed: DB/RPC errors deny the request (429).
 * Callers (item 6): submit-request, request-password-reset, r2 PUT, resolve-quote-token,
 * create-checkout, draft-quote, invite/resend.
 */
export async function assertRateLimit(
  admin: SupabaseClient,
  opts: {
    req: Request
    route: string
    limit: number
    windowMs: number
    /** If set, used instead of IP (e.g. normalized email). */
    identity?: string
  },
): Promise<RateLimitResult> {
  const id = (opts.identity?.trim() || clientIp(opts.req))
  const route = opts.route.trim() || 'unknown'
  const key = `${route}:${id}`
  const windowMs = Math.max(1000, opts.windowMs)
  const windowStart = new Date(Math.floor(Date.now() / windowMs) * windowMs).toISOString()

  const { data, error } = await admin.rpc('hit_rate_limit', {
    p_key: key,
    p_window_start: windowStart,
    p_limit: opts.limit,
  })

  if (error || typeof data !== 'number') {
    return { allowed: false, retryAfterSec: Math.ceil(windowMs / 1000) }
  }

  if (data > opts.limit) {
    const elapsed = Date.now() - new Date(windowStart).getTime()
    const retryAfterSec = Math.max(1, Math.ceil((windowMs - elapsed) / 1000))
    return { allowed: false, retryAfterSec }
  }

  return { allowed: true }
}

export function rateLimitResponse(
  cors: Record<string, string>,
  retryAfterSec: number,
): Response {
  return new Response(JSON.stringify({ error: 'Too many requests' }), {
    status: 429,
    headers: {
      ...cors,
      'Content-Type': 'application/json',
      'Retry-After': String(retryAfterSec),
    },
  })
}
