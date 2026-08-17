import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { normalizeBearer } from '../_shared/require-admin.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), {
    status: s,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })

function isBanned(bannedUntil: string | null | undefined): boolean {
  if (!bannedUntil) return false
  const t = Date.parse(bannedUntil)
  return Number.isFinite(t) && t > Date.now()
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    const authHeader = normalizeBearer(req)
    if (!authHeader) {
      return json({ error: 'Missing Authorization Bearer token' }, 401)
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !anonKey || !serviceKey) {
      return json({ error: 'Server misconfigured (Supabase env)' }, 500)
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: authError } = await userClient.auth.getUser()
    if (authError || !user) return json({ error: 'Invalid session' }, 401)

    const admin = createClient(supabaseUrl, serviceKey)
    const { data: authUser, error: adminErr } = await admin.auth.admin.getUserById(user.id)
    if (adminErr || !authUser.user) return json({ error: 'User not found' }, 404)

    if (isBanned(authUser.user.banned_until as string | undefined)) {
      return json({ error: 'This account is disabled. Contact the office.' }, 403)
    }

    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('id, role, active, setup_complete')
      .eq('id', user.id)
      .maybeSingle()

    if (profileError) return json({ error: profileError.message }, 500)
    if (!profile) return json({ error: 'Profile not found' }, 404)

    if (profile.setup_complete === true && profile.active === false) {
      return json({ error: 'This account is disabled. Contact the office.' }, 403)
    }

    if (profile.active === true && profile.setup_complete === true) {
      return json({ success: true, active: true, setup_complete: true, already_active: true })
    }

    const { error: updateError } = await admin
      .from('profiles')
      .update({ active: true, setup_complete: true })
      .eq('id', user.id)

    if (updateError) return json({ error: updateError.message }, 500)

    return json({ success: true, active: true, setup_complete: true })
  } catch {
    return json({ error: 'Unexpected error' }, 500)
  }
})
