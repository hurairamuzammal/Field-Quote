import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

export type AdminCaller = {
  userId: string
  companyId: string
  admin: SupabaseClient
}

export function normalizeBearer(req: Request): string | null {
  const raw = (req.headers.get('Authorization') ?? req.headers.get('authorization') ?? '').trim()
  if (!raw) return null
  const m = raw.match(/^bearer\s+(.+)$/i)
  if (m?.[1]?.trim()) return `Bearer ${m[1].trim()}`
  if (raw.startsWith('eyJ')) return `Bearer ${raw}`
  return null
}

function json(
  cors: Record<string, string>,
  body: unknown,
  status: number,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

/** Admin JWT + profiles.role = admin + profiles.active = true. */
export async function requireActiveAdmin(
  req: Request,
  cors: Record<string, string>,
): Promise<{ ok: true; caller: AdminCaller } | { ok: false; response: Response }> {
  const authHeader = normalizeBearer(req)
  if (!authHeader) {
    return {
      ok: false,
      response: json(cors, {
        error: 'Missing Authorization Bearer token',
        hint: 'Authorization: Bearer <admin access_token>',
      }, 401),
    }
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !anonKey || !serviceKey) {
    return {
      ok: false,
      response: json(cors, { error: 'Server misconfigured (Supabase env)' }, 500),
    }
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: { user }, error: authError } = await userClient.auth.getUser()
  if (authError || !user) {
    return { ok: false, response: json(cors, { error: 'Invalid session' }, 401) }
  }

  const admin = createClient(supabaseUrl, serviceKey)
  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('role, active, company_id')
    .eq('id', user.id)
    .maybeSingle()

  if (profileError) {
    return { ok: false, response: json(cors, { error: profileError.message }, 500) }
  }
  if (!profile || profile.role !== 'admin' || profile.active === false) {
    return { ok: false, response: json(cors, { error: 'Admin access required' }, 403) }
  }

  const companyId = typeof profile.company_id === 'string' ? profile.company_id : ''
  if (!companyId) {
    return {
      ok: false,
      response: json(cors, { error: 'Admin profile missing company_id' }, 500),
    }
  }

  return { ok: true, caller: { userId: user.id, companyId, admin } }
}
