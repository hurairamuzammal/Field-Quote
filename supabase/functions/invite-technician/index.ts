import { inviteEmailHtml } from '../_shared/email-layout.ts'
import { fetchCompanyBrand, resendFromHeader, resolveEmailLogoUrl } from '../_shared/company.ts'
import { corsFor, corsPreflight } from '../_shared/cors.ts'
import { requireActiveAdmin } from '../_shared/require-admin.ts'
import { readJsonBody, rejectWrongMethod, unexpectedError } from '../_shared/http.ts'

function passwordSetupBase(): string {
  return (
    Deno.env.get('BUBBLE_PASSWORD_SETUP_URL') ??
    'https://fieldquote-26446.bubbleapps.io/version-test/password_setup'
  ).replace(/\/$/, '')
}

Deno.serve(async (req) => {
  const corsHeaders = corsFor(req)
  if (req.method === 'OPTIONS') {
    return corsPreflight(req)
  }
  const wrong = rejectWrongMethod(req, ['POST'])
  if (wrong) return wrong

  try {
    const gate = await requireActiveAdmin(req, corsHeaders)
    if (!gate.ok) return gate.response
    const { caller } = gate
    const { admin: adminClient, companyId } = caller

    const brandRes = await fetchCompanyBrand(adminClient, companyId)
    if ('error' in brandRes) {
      return new Response(JSON.stringify({ error: brandRes.error }), {
        status: 500,
        headers: corsHeaders,
      })
    }
    const { brand } = brandRes

    const parsed = await readJsonBody<{ email?: string; full_name?: string }>(req)
    if (!parsed.ok) return parsed.response
    const { email, full_name } = parsed.value
    if (!email) {
      return new Response(JSON.stringify({ error: 'email is required' }), {
        status: 400,
        headers: corsHeaders,
      })
    }

    const { data: created, error: createError } = await adminClient.auth.admin.createUser({
      email,
      email_confirm: false,
      app_metadata: {
        fieldquote_role: 'technician',
      },
      user_metadata: {
        full_name: full_name ?? '',
        company_id: companyId,
      },
    })

    if (createError) {
      const isDuplicate = createError.message?.toLowerCase().includes('already') ||
        createError.status === 422
      return new Response(
        JSON.stringify({ error: isDuplicate ? 'User already exists' : createError.message }),
        { status: isDuplicate ? 409 : 500, headers: corsHeaders },
      )
    }

    // Trigger inserts active=false (no password). Pin company + technician role.
    if (created.user?.id) {
      const patch: Record<string, unknown> = {
        company_id: companyId,
        role: 'technician',
        active: false,
        setup_complete: false,
      }
      if (typeof full_name === 'string' && full_name.trim()) {
        patch.full_name = full_name.trim()
      }
      await adminClient.from('profiles').update(patch).eq('id', created.user.id)
    }

    const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
      type: 'invite',
      email,
    })

    if (linkError) {
      return new Response(JSON.stringify({ error: linkError.message }), {
        status: 500,
        headers: corsHeaders,
      })
    }

    const tokenHash = linkData.properties?.hashed_token
    const setPasswordUrl =
      `${passwordSetupBase()}?token_hash=${tokenHash}&type=invite`

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: resendFromHeader(brand.name),
        to: [email],
        subject: `You've been invited to ${brand.name}`,
        html: inviteEmailHtml({
          setPasswordUrl,
          fullName: typeof full_name === 'string' ? full_name : undefined,
          companyName: brand.name,
          logoUrl: resolveEmailLogoUrl(brand.logo_key),
        }),
      }),
    })

    const resendData = await resendRes.json()

    await adminClient.from('email_log').insert({
      to_email: email,
      template: 'technician_invite',
      related_id: created.user.id,
      resend_id: resendData?.id ?? null,
      status: resendRes.ok ? 'sent' : 'failed',
    })

    return new Response(JSON.stringify({ success: true, user_id: created.user.id }), {
      status: 200,
      headers: corsHeaders,
    })
  } catch {
    return unexpectedError(req)
  }
})
