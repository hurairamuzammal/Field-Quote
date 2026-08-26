import { inviteEmailHtml } from '../_shared/email-layout.ts'
import { fetchCompanyBrand, resendFromHeader, resolveEmailLogoUrl } from '../_shared/company.ts'
import { corsFor, corsPreflight } from '../_shared/cors.ts'
import { requireActiveAdmin } from '../_shared/require-admin.ts'
import { readJsonBody, unexpectedError } from '../_shared/http.ts'

const json = (req: Request, b: unknown, s = 200) =>
  new Response(JSON.stringify(b), {
    status: s,
    headers: { ...corsFor(req), 'Content-Type': 'application/json' },
  })

function passwordSetupBase(): string {
  return (
    Deno.env.get('BUBBLE_PASSWORD_SETUP_URL') ??
    'https://fieldquote-26446.bubbleapps.io/version-test/password_setup'
  ).replace(/\/$/, '')
}

function isBanned(bannedUntil: string | null | undefined): boolean {
  if (!bannedUntil) return false
  const t = Date.parse(bannedUntil)
  return Number.isFinite(t) && t > Date.now()
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return corsPreflight(req)
  if (req.method !== 'POST') return json(req, { error: 'Method not allowed' }, 405)

  try {
    const gate = await requireActiveAdmin(req, corsFor(req))
    if (!gate.ok) return gate.response
    const { admin: adminClient, companyId } = gate.caller

    const parsed = await readJsonBody<{ email?: string }>(req)
    if (!parsed.ok) return parsed.response
    const body = parsed.value
    const email = typeof body.email === 'string'
      ? body.email.trim().replace(/^["']+|["']+$/g, '').toLowerCase()
      : ''
    if (!email) return json(req, { error: 'email is required' }, 400)
    if (!Deno.env.get('RESEND_API_KEY')) {
      return json(req, { error: 'Server misconfigured (RESEND_API_KEY)' }, 500)
    }

    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .select('id, role, active, setup_complete, full_name, email, company_id')
      .eq('company_id', companyId)
      .ilike('email', email)
      .maybeSingle()

    if (profileError) return json(req, { error: profileError.message }, 500)
    if (!profile || profile.role !== 'technician') {
      return json(req, { error: 'No technician with that email' }, 404)
    }
    // Pending = setup_complete false, even if active flipped early (GoTrue
    // placeholder password / verify-without-Set-Password). Resend must still work.
    if (profile.setup_complete === true) {
      return json(req, {
        error: profile.active === true
          ? 'Password already set. Use Forgot password instead of Resend invite.'
          : 'This technician is deactivated. Activate them instead of resending an invite.',
      }, 409)
    }

    const { data: authData, error: authErr } = await adminClient.auth.admin.getUserById(profile.id)
    if (authErr || !authData.user) return json(req, { error: 'Auth user not found' }, 404)
    if (isBanned(authData.user.banned_until as string | undefined)) {
      return json(req, {
        error: 'This technician is deactivated. Activate them instead of resending an invite.',
      }, 409)
    }

    const brandRes = await fetchCompanyBrand(adminClient, companyId)
    if ('error' in brandRes) return json(req, { error: brandRes.error }, 500)

    const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
      type: 'invite',
      email: profile.email,
    })
    if (linkError || !linkData?.properties?.hashed_token) {
      return json(req, { error: linkError?.message ?? 'Could not create invite link' }, 500)
    }
    const tokenHash = linkData.properties.hashed_token
    const setPasswordUrl = `${passwordSetupBase()}?token_hash=${tokenHash}&type=invite`

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: resendFromHeader(brandRes.brand.name),
        to: [profile.email],
        subject: `Your ${brandRes.brand.name} invite (resent)`,
        html: inviteEmailHtml({
          setPasswordUrl,
          resent: true,
          fullName: profile.full_name || undefined,
          companyName: brandRes.brand.name,
          logoUrl: resolveEmailLogoUrl(brandRes.brand.logo_key),
        }),
      }),
    })
    const resendData = await resendRes.json().catch(() => ({})) as Record<string, unknown>
    const resendMessage = typeof resendData.message === 'string'
      ? resendData.message
      : typeof (resendData.error as { message?: string } | undefined)?.message === 'string'
        ? (resendData.error as { message: string }).message
        : null

    await adminClient.from('email_log').insert({
      company_id: companyId,
      to_email: profile.email,
      template: 'technician_invite_resend',
      related_id: profile.id,
      resend_id: typeof resendData.id === 'string' ? resendData.id : null,
      status: resendRes.ok ? 'sent' : 'failed',
    })

    if (!resendRes.ok) {
      return json(req, {
        error: 'Invite link created but email failed to send',
        resend_status: resendRes.status,
        resend_message: resendMessage,
      }, 502)
    }

    return json(req, { success: true, user_id: profile.id })
  } catch {
    return unexpectedError(req)
  }
})
