import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { passwordResetEmailHtml } from '../_shared/email-layout.ts'
import {
  fetchCompanyBrand,
  fetchSoleCompanyId,
  resendFromHeader,
  resolveEmailLogoUrl,
} from '../_shared/company.ts'
import { corsFor, corsPreflight } from '../_shared/cors.ts'
import { sendAndLogEmail } from '../_shared/send-email.ts'
import { assertRateLimit, rateLimitResponse } from '../_shared/rate-limit.ts'
import { readJsonBody, rejectWrongMethod, unexpectedError } from '../_shared/http.ts'

const DAY_MS = 24 * 60 * 60 * 1000
const EMAIL_LIMIT_PER_DAY = 3

function passwordSetupBase(): string {
  return (
    Deno.env.get('BUBBLE_PASSWORD_SETUP_URL') ??
    'https://fieldquote-26446.bubbleapps.io/version-test/password_setup'
  ).replace(/\/$/, '')
}

Deno.serve(async (req) => {
  const corsHeaders = corsFor(req)
  if (req.method === 'OPTIONS') return corsPreflight(req)
  const wrong = rejectWrongMethod(req, ['POST'])
  if (wrong) return wrong

  try {
    const parsed = await readJsonBody<{ email?: string }>(req)
    if (!parsed.ok) return parsed.response
    const { email } = parsed.value
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

    const emailNorm = String(email).trim().replace(/^["']+|["']+$/g, '').toLowerCase()
    const emailLimit = await assertRateLimit(adminClient, {
      req,
      route: 'request-password-reset-email-day',
      limit: EMAIL_LIMIT_PER_DAY,
      windowMs: DAY_MS,
      identity: emailNorm,
    })
    if (!emailLimit.allowed) return rateLimitResponse(corsHeaders, emailLimit.retryAfterSec)

    // Brand: prefer profile's company; else sole company_settings (never invent a UUID)
    let companyId: string | null = null
    const { data: profile } = await adminClient
      .from('profiles')
      .select('company_id')
      .eq('email', emailNorm)
      .maybeSingle()

    if (profile?.company_id) {
      companyId = profile.company_id as string
    } else {
      const sole = await fetchSoleCompanyId(adminClient)
      if (!('error' in sole)) companyId = sole.company_id
    }

    let companyName = 'Your company'
    let logoUrl: string | null = null
    if (companyId) {
      const brandRes = await fetchCompanyBrand(adminClient, companyId)
      if (!('error' in brandRes)) {
        companyName = brandRes.brand.name
        logoUrl = resolveEmailLogoUrl(brandRes.brand.logo_key)
      }
    }

    const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
      type: 'recovery',
      email: emailNorm,
    })

    if (linkError || !linkData?.properties?.hashed_token) {
      // No such user (or GoTrue refused). Still 200 — never reveal account existence.
      // Log only when we know the company: email_log.company_id is NOT NULL with no default,
      // so inserting without it silently drops the row (§13 R8).
      if (companyId) {
        const { error: logError } = await adminClient.from('email_log').insert({
          company_id: companyId,
          to_email: emailNorm,
          template: 'password_reset',
          status: 'failed',
        })
        if (logError) console.error('email_log insert failed (password_reset):', logError.message)
      } else {
        console.error('password_reset: no company_id resolved; audit row skipped')
      }
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: corsHeaders,
      })
    }

    const tokenHash = linkData.properties.hashed_token
    const resetUrl =
      `${passwordSetupBase()}?token_hash=${tokenHash}&type=recovery`

    const html = passwordResetEmailHtml({ resetUrl, companyName, logoUrl })

    if (companyId) {
      // Shared helper logs with company_id; the old hand-rolled insert omitted it (§13 R8).
      const sent = await sendAndLogEmail({
        admin: adminClient,
        companyId,
        toEmail: emailNorm,
        template: 'password_reset',
        relatedId: null,
        subject: `Reset your ${companyName} password`,
        html,
        companyName,
      })
      if (!sent.ok) console.error('password_reset send failed:', sent.error)
    } else {
      console.error('password_reset: no company_id resolved; sending unlogged')
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: resendFromHeader(companyName),
          to: [emailNorm],
          subject: `Reset your ${companyName} password`,
          html,
        }),
      })
    }

    // Always 200, whatever happened above — no account enumeration, no send-failure signal.
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: corsHeaders,
    })
  } catch {
    return unexpectedError(req)
  }
})
