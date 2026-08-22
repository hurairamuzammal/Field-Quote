import { corsFor, corsPreflight } from '../_shared/cors.ts'
import { requireActiveAdmin } from '../_shared/require-admin.ts'
import { readJsonBody } from '../_shared/http.ts'

const json = (req: Request, b: unknown, s = 200) =>
  new Response(JSON.stringify(b), {
    status: s,
    headers: { ...corsFor(req), 'Content-Type': 'application/json' },
  })

const BAN_DURATION = '876000h'

function asBool(v: unknown): boolean | null {
  if (typeof v === 'boolean') return v
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase()
    if (s === 'true' || s === 'yes') return true
    if (s === 'false' || s === 'no') return false
  }
  return null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return corsPreflight(req)
  if (req.method !== 'POST') return json(req, { error: 'Method not allowed' }, 405)

  try {
    const gate = await requireActiveAdmin(req, corsFor(req))
    if (!gate.ok) return gate.response
    const { caller } = gate

    const parsed = await readJsonBody<{ technician_id?: string; active?: unknown }>(req)
    if (!parsed.ok) return parsed.response
    const body = parsed.value
    const technicianId = typeof body.technician_id === 'string' ? body.technician_id.trim() : ''
    const active = asBool(body.active)
    if (!technicianId) return json(req, { error: 'technician_id is required' }, 400)
    if (active === null) return json(req, { error: 'active must be true or false' }, 400)

    if (technicianId === caller.userId) {
      return json(req, { error: 'Cannot change your own active flag' }, 400)
    }

    const { data: target, error: targetError } = await caller.admin
      .from('profiles')
      .select('id, role, active, setup_complete, company_id')
      .eq('id', technicianId)
      .maybeSingle()

    if (targetError) return json(req, { error: targetError.message }, 500)
    if (!target || target.company_id !== caller.companyId) {
      return json(req, { error: 'Technician not found' }, 404)
    }
    if (target.role !== 'technician') {
      return json(req, { error: 'Only technicians can be deactivated here' }, 400)
    }

    if (active === false) {
      if (target.setup_complete !== true) {
        return json(req, {
          error: 'This technician has not set a password yet. Resend the invite instead of disabling.',
        }, 400)
      }
      const { error: banError } = await caller.admin.auth.admin.updateUserById(technicianId, {
        ban_duration: BAN_DURATION,
      })
      if (banError) return json(req, { error: banError.message }, 500)

      const { error: profileError } = await caller.admin
        .from('profiles')
        .update({ active: false })
        .eq('id', technicianId)
        .eq('company_id', caller.companyId)
      if (profileError) return json(req, { error: profileError.message }, 500)

      const nowIso = new Date().toISOString()
      const { data: unassigned, error: jobError } = await caller.admin
        .from('jobs')
        .update({
          technician_id: null,
          status: 'unscheduled',
          scheduled_at: null,
        })
        .eq('technician_id', technicianId)
        .eq('company_id', caller.companyId)
        .in('status', ['unscheduled', 'scheduled'])
        .or(`scheduled_at.is.null,scheduled_at.gt."${nowIso}"`)
        .select('id')

      if (jobError) return json(req, { error: jobError.message }, 500)

      return json(req, {
        success: true,
        technician_id: technicianId,
        active: false,
        unassigned_job_ids: (unassigned ?? []).map((j) => j.id),
      })
    }

    const { error: unbanError } = await caller.admin.auth.admin.updateUserById(technicianId, {
      ban_duration: 'none',
    })
    if (unbanError) return json(req, { error: unbanError.message }, 500)

    const { error: profileError } = await caller.admin
      .from('profiles')
      .update({ active: true })
      .eq('id', technicianId)
      .eq('company_id', caller.companyId)
    if (profileError) return json(req, { error: profileError.message }, 500)

    return json(req, {
      success: true,
      technician_id: technicianId,
      active: true,
    })
  } catch {
    return json(req, { error: 'Unexpected error' }, 500)
  }
})
