/**
 * Public waitlist (§11 / Day 23).
 * Landing → POST here → validate → insert waitlist → Resend confirmation → email_log.
 * No user JWT. Anon RLS insert remains available; this path uses service role after checks.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { brandedEmailHtml } from '../_shared/email-layout.ts'
import { fetchCompanyBrand, resendFromHeader, resolveEmailLogoUrl } from '../_shared/company.ts'
import { corsFor, corsPreflight } from '../_shared/cors.ts'
import { assertRateLimit, rateLimitResponse } from '../_shared/rate-limit.ts'
import { readJsonBody, rejectWrongMethod, unexpectedError } from '../_shared/http.ts'

const COMPANY_ID = '00000000-0000-0000-0000-000000000001'
const HOUR_MS = 60 * 60 * 1000
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsFor(req), 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return corsPreflight(req)
  const wrong = rejectWrongMethod(req, ['POST'])
  if (wrong) return wrong

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const resendKey = Deno.env.get('RESEND_API_KEY')
    if (!supabaseUrl || !serviceKey) return json(req, { error: 'Server misconfigured' }, 500)

    const parsed = await readJsonBody<{
      email?: unknown
      source?: unknown
      hp?: unknown
    }>(req)
    if (!parsed.ok) return parsed.response
    const body = parsed.value

    // Honeypot — bots fill hidden fields; look like success
    if (typeof body.hp === 'string' && body.hp.trim()) {
      return json(req, { ok: true })
    }

    const emailRaw = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    if (!emailRaw || emailRaw.length > 254 || !EMAIL_RE.test(emailRaw)) {
      return json(req, { error: 'Valid email is required' }, 400)
    }

    const source =
      typeof body.source === 'string' && body.source.trim()
        ? body.source.trim().slice(0, 64)
        : 'landing'

    const admin = createClient(supabaseUrl, serviceKey)

    const ipLimit = await assertRateLimit(admin, {
      req,
      route: 'submit-waitlist-ip-hour',
      limit: 10,
      windowMs: HOUR_MS,
    })
    if (!ipLimit.allowed) return rateLimitResponse(corsFor(req), ipLimit.retryAfterSec)

    const emailLimit = await assertRateLimit(admin, {
      req,
      route: 'submit-waitlist-email-hour',
      limit: 3,
      windowMs: HOUR_MS,
      identity: emailRaw,
    })
    if (!emailLimit.allowed) return rateLimitResponse(corsFor(req), emailLimit.retryAfterSec)

    const { data: inserted, error: insertErr } = await admin
      .from('waitlist')
      .insert({
        company_id: COMPANY_ID,
        email: emailRaw,
        source,
      })
      .select('id')
      .maybeSingle()

    let waitlistId: string | null = (inserted?.id as string) ?? null
    let already = false

    if (insertErr) {
      // unique (company_id, email) → already joined; still 200
      if (insertErr.code === '23505' || /duplicate|unique/i.test(insertErr.message)) {
        already = true
        const { data: existing } = await admin
          .from('waitlist')
          .select('id')
          .eq('company_id', COMPANY_ID)
          .eq('email', emailRaw)
          .maybeSingle()
        waitlistId = (existing?.id as string) ?? null
      } else {
        console.error('waitlist insert:', insertErr.message)
        return json(req, { error: 'Could not join waitlist' }, 500)
      }
    }

    // Confirmation email (skip Resend if duplicate to avoid spam; still ok response)
    if (!already && resendKey) {
      const brandRes = await fetchCompanyBrand(admin, COMPANY_ID)
      const companyName = 'error' in brandRes ? 'FieldQuote' : brandRes.brand.name
      const logoUrl = 'error' in brandRes ? null : resolveEmailLogoUrl(brandRes.brand.logo_key)

      const html = brandedEmailHtml({
        companyName,
        logoUrl,
        eyebrow: 'Waitlist',
        title: "You're on the list",
        paragraphs: [
          `Thanks for joining the ${companyName} waitlist.`,
          "We'll email you when we're ready for early access. No spam — just one confirmation for now.",
        ],
        note: 'If you did not request this, you can ignore this email.',
        preheader: `Waitlist confirmation — ${companyName}`,
        footer: `${companyName} · Landing waitlist`,
      })

      const resendRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: resendFromHeader(companyName),
          to: [emailRaw],
          subject: `You're on the ${companyName} waitlist`,
          html,
        }),
      })
      const resendData = await resendRes.json().catch(() => ({})) as { id?: string }

      await admin.from('email_log').insert({
        company_id: COMPANY_ID,
        to_email: emailRaw,
        template: 'waitlist_confirm',
        related_id: waitlistId,
        resend_id: typeof resendData.id === 'string' ? resendData.id : null,
        status: resendRes.ok ? 'sent' : 'failed',
      })
    }

    return json(req, { ok: true, already })
  } catch {
    return unexpectedError(req)
  }
})
