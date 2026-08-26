import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsFor, corsPreflight } from '../_shared/cors.ts'
import { normalizeBearer } from '../_shared/require-admin.ts'

const json = (req: Request, b: unknown, s = 200) =>
  new Response(JSON.stringify(b), {
    status: s,
    headers: { ...corsFor(req), 'Content-Type': 'application/json' },
  })

function isBanned(bannedUntil: string | null | undefined): boolean {
  if (!bannedUntil) return false
  const t = Date.parse(bannedUntil)
  return Number.isFinite(t) && t > Date.now()
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return corsPreflight(req)
  if (req.method !== 'POST') return json(req, { error: 'Method not allowed' }, 405)

  try {
    const authHeader = normalizeBearer(req)
    if (!authHeader) {
      return json(req, { error: 'Missing Authorization Bearer token' }, 401)
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !anonKey || !serviceKey) {
      return json(req, { error: 'Server misconfigured (Supabase env)' }, 500)
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: authError } = await userClient.auth.getUser()
    if (authError || !user) return json(req, { error: 'Invalid session' }, 401)

    const admin = createClient(supabaseUrl, serviceKey)
    const { data: authUser, error: adminErr } = await admin.auth.admin.getUserById(user.id)
    if (adminErr || !authUser.user) return json(req, { error: 'User not found' }, 404)

    if (isBanned(authUser.user.banned_until as string | undefined)) {
      return json(req, { error: 'This account is disabled. Contact the office.' }, 403)
    }

    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('id, role, active, setup_complete')
      .eq('id', user.id)
      .maybeSingle()

    if (profileError) return json(req, { error: profileError.message }, 500)
    if (!profile) return json(req, { error: 'Profile not found' }, 404)

    if (profile.setup_complete === true && profile.active === false) {
      return json(req, { error: 'This account is disabled. Contact the office.' }, 403)
    }

    if (profile.active === true && profile.setup_complete === true) {
      return json(req, { success: true, active: true, setup_complete: true, already_active: true })
    }

    const { error: updateError } = await admin
      .from('profiles')
      .update({ active: true, setup_complete: true })
      .eq('id', user.id)

    if (updateError) return json(req, { error: updateError.message }, 500)

    return json(req, { success: true, active: true, setup_complete: true })
  } catch {
    return json(req, { error: 'Unexpected error' }, 500)
  }
})
