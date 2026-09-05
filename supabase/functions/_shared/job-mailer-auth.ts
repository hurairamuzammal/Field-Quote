/**
 * Caller identity for the two job-triggered mailers (`send-final-invoice`,
 * `send-schedule-confirmation`).
 *
 * Both used to look the job up with the service-role client and only then decide
 * whether the caller was allowed to be here. Emails were still gated, so it was
 * never a send bypass — but with no credentials at all you learned whether a job
 * id existed, and the not-completed branch handed back its status. It also meant
 * an unauthenticated request could spend a service-role query. CLAUDE.md rule 7
 * is explicit about the order: validate first, service role only after.
 *
 * Splitting it in two is what makes that possible. `identifyCaller` answers "is
 * this anybody at all" using nothing but the request, so it can run before the
 * lookup. `callerMayTouchJob` answers "is it *this* job's technician", which
 * genuinely needs the row, so it stays after.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { cronSecretOk } from './cron-auth.ts'

export type JobMailerCaller =
  | { via: 'cron' }
  | { via: 'staff'; userId: string; role: string }

export function normalizeBearer(req: Request): string | null {
  const raw = (req.headers.get('Authorization') ?? req.headers.get('authorization') ?? '').trim()
  if (!raw) return null
  const m = raw.match(/^bearer\s+(.+)$/i)
  if (m?.[1]?.trim()) return `Bearer ${m[1].trim()}`
  if (raw.startsWith('eyJ')) return `Bearer ${raw}`
  return null
}

/**
 * Cheap, row-independent gate. Returns null when the caller is nobody — the
 * function should 401 immediately, before touching the database.
 */
export async function identifyCaller(req: Request): Promise<JobMailerCaller | null> {
  if (cronSecretOk(req)) return { via: 'cron' }

  const authHeader = normalizeBearer(req)
  if (!authHeader) return null

  const url = Deno.env.get('SUPABASE_URL')
  const anon = Deno.env.get('SUPABASE_ANON_KEY')
  if (!url || !anon) return null

  // Anon key + the caller's own JWT: RLS applies, so a forged token reads nothing.
  const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } })
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return null

  const { data: profile } = await userClient
    .from('profiles')
    .select('role, active')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile || profile.active === false) return null
  if (profile.role !== 'admin' && profile.role !== 'technician') return null

  return { via: 'staff', userId: user.id, role: profile.role as string }
}

/** Row-dependent half: admins get every job, a technician gets only their own. */
export function callerMayTouchJob(
  caller: JobMailerCaller,
  jobTechnicianId: string | null,
): boolean {
  if (caller.via === 'cron') return true
  if (caller.role === 'admin') return true
  return caller.role === 'technician' && jobTechnicianId === caller.userId
}
