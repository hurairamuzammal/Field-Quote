import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { requireActiveAdmin } from './require-admin.ts'

/** Constant-time compare for x-cron-secret vs CRON_SECRET env. */
export function cronSecretOk(req: Request): boolean {
  const expected = Deno.env.get('CRON_SECRET')?.trim() ?? ''
  if (!expected) return false
  const got = (req.headers.get('x-cron-secret') ?? '').trim()
  if (!got || got.length !== expected.length) return false
  let out = 0
  for (let i = 0; i < expected.length; i++) out |= expected.charCodeAt(i) ^ got.charCodeAt(i)
  return out === 0
}

export type CronOrAdminAuth =
  | { ok: true; admin: SupabaseClient; companyId: string | null; via: 'cron' | 'admin' }
  | { ok: false; response: Response }

/** pg_cron / pg_net (no JWT) or manual admin run from Bubble. */
export async function requireCronOrAdmin(
  req: Request,
  cors: Record<string, string>,
): Promise<CronOrAdminAuth> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceKey) {
    return {
      ok: false,
      response: new Response(JSON.stringify({ error: 'Server misconfigured' }), {
        status: 500,
        headers: { ...cors, 'Content-Type': 'application/json' },
      }),
    }
  }

  const cronHeader = (req.headers.get('x-cron-secret') ?? '').trim()
  const expectedCron = Deno.env.get('CRON_SECRET')?.trim() ?? ''

  if (cronHeader) {
    if (!expectedCron) {
      return {
        ok: false,
        response: new Response(JSON.stringify({
          error: 'Server misconfigured (CRON_SECRET not set on edge function)',
        }), {
          status: 500,
          headers: { ...cors, 'Content-Type': 'application/json' },
        }),
      }
    }
    if (!cronSecretOk(req)) {
      return {
        ok: false,
        response: new Response(JSON.stringify({ error: 'Invalid x-cron-secret' }), {
          status: 401,
          headers: { ...cors, 'Content-Type': 'application/json' },
        }),
      }
    }
    return {
      ok: true,
      admin: createClient(supabaseUrl, serviceKey),
      companyId: null,
      via: 'cron',
    }
  }

  const gate = await requireActiveAdmin(req, cors)
  if (!gate.ok) return gate
  return {
    ok: true,
    admin: gate.caller.admin,
    companyId: gate.caller.companyId,
    via: 'admin',
  }
}
