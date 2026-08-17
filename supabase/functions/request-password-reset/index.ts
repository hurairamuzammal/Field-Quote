import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { passwordResetEmailHtml } from '../_shared/email-layout.ts'
import {
  fetchCompanyBrand,
  fetchSoleCompanyId,
  resendFromHeader,
} from '../_shared/company.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function passwordSetupBase(): string {
  return (
    Deno.env.get('BUBBLE_PASSWORD_SETUP_URL') ??
    'https://fieldquote-26446.bubbleapps.io/version-test/password_setup'
  ).replace(/\/$/, '')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { email } = await req.json()
    if (!email) {
      return new Response(JSON.stringify({ error: 'email is required' }), {
        status: 400,
        headers: corsHeaders,
      })
    }

    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Brand: prefer profile's company; else sole company_settings (never invent a UUID)
    let companyId: string | null = null
    const { data: profile } = await adminClient
      .from('profiles')
      .select('company_id')
      .eq('email', email)
      .maybeSingle()

    if (profile?.company_id) {
      companyId = profile.company_id as string
    } else {
      const sole = await fetchSoleCompanyId(adminClient)
      if (!('error' in sole)) companyId = sole.company_id
    }

    let companyName = 'Your company'
    if (companyId) {
      const brandRes = await fetchCompanyBrand(adminClient, companyId)
      if (!('error' in brandRes)) companyName = brandRes.brand.name
    }

    const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
      type: 'recovery',
      email,
    })

    if (linkError || !linkData?.properties?.hashed_token) {
      await adminClient.from('email_log').insert({
        to_email: email,
        template: 'password_reset',
        status: 'failed',
      })
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: corsHeaders,
      })
    }

    const tokenHash = linkData.properties.hashed_token
    const resetUrl =
      `${passwordSetupBase()}?token_hash=${tokenHash}&type=recovery`

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: resendFromHeader(companyName),
        to: [email],
        subject: `Reset your ${companyName} password`,
        html: passwordResetEmailHtml({ resetUrl, companyName }),
      }),
    })
    const resendData = await resendRes.json()

    await adminClient.from('email_log').insert({
      to_email: email,
      template: 'password_reset',
      resend_id: resendData?.id ?? null,
      status: resendRes.ok ? 'sent' : 'failed',
      token_hash: tokenHash,
    })

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: corsHeaders,
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: corsHeaders,
    })
  }
})
