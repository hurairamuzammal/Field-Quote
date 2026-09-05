import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { brandedEmailHtml } from '../_shared/email-layout.ts'
import { fetchCompanyBrand, resendFromHeader, resolveEmailLogoUrl } from '../_shared/company.ts'
import { corsFor, corsPreflight } from '../_shared/cors.ts'
import { missingTokenError, readQuoteToken } from '../_shared/quote-token.ts'
import { unexpectedError } from '../_shared/http.ts'
import { assertRateLimit, rateLimitResponse } from '../_shared/rate-limit.ts'

/** §7.1 asks for a reason, so an empty one is a validation error, not a null. */
const MIN_DECLINE_REASON = 3
const MAX_DECLINE_REASON = 500

const json = (req: Request, b: unknown, s = 200) =>
  new Response(JSON.stringify(b), {
    status: s,
    headers: { ...corsFor(req), 'Content-Type': 'application/json' },
  })

type QuoteRow = {
  id: string
  company_id: string
  request_id: string
  status: string
  deposit_amount: number
  valid_until: string | null
}

function envUrl(name: string, fallback: string): string {
  const raw = Deno.env.get(name)?.trim()
  return (raw || fallback).replace(/\/$/, '')
}

function quotePageUrl(token: string): string {
  const base = envUrl(
    'PUBLIC_QUOTE_PAGE_URL',
    'https://fieldquote-26446.bubbleapps.io/version-test/q',
  )
  return `${base}?token=${encodeURIComponent(token)}`
}

function successUrl(token: string): string {
  const base = envUrl(
    'PUBLIC_QUOTE_SUCCESS_URL',
    'https://fieldquote-26446.bubbleapps.io/version-test/q-success',
  )
  return `${base}?token=${encodeURIComponent(token)}&kind=deposit`
}

async function loadActionableQuote(
  admin: SupabaseClient,
  token: string,
): Promise<
  | { ok: true; quote: QuoteRow }
  | { ok: false; status: number; body: Record<string, unknown> }
> {
  const { data: quote, error } = await admin
    .from('quotes')
    .select('id, company_id, request_id, status, deposit_amount, valid_until')
    .eq('token', token)
    .maybeSingle()

  if (error) return { ok: false, status: 500, body: { error: error.message } }
  if (!quote) {
    return { ok: false, status: 404, body: { error: 'Quote not found', actionable: false } }
  }

  const now = Date.now()
  const expiredByDate = quote.valid_until && new Date(quote.valid_until).getTime() < now
  const deadStatuses = new Set(['declined', 'expired', 'accepted'])

  if (deadStatuses.has(quote.status) || expiredByDate) {
    if (
      expiredByDate &&
      quote.status !== 'expired' &&
      quote.status !== 'accepted' &&
      quote.status !== 'declined'
    ) {
      await admin.from('quotes').update({ status: 'expired' }).eq('id', quote.id)
    }
    return {
      ok: false,
      status: 410,
      body: {
        actionable: false,
        status: expiredByDate && quote.status !== 'accepted' && quote.status !== 'declined'
          ? 'expired'
          : quote.status,
        message: 'This quote is no longer available.',
      },
    }
  }

  if (quote.status !== 'sent' && quote.status !== 'viewed') {
    return {
      ok: false,
      status: 410,
      body: {
        actionable: false,
        status: quote.status,
        message: 'This quote is not open for a response.',
      },
    }
  }

  return { ok: true, quote: quote as QuoteRow }
}

async function createStripeCheckoutSession(
  quote: QuoteRow,
  token: string,
  stripeKey: string,
): Promise<{ checkout_url: string } | { error: string }> {
  const deposit = Number(quote.deposit_amount)
  if (!Number.isFinite(deposit) || deposit <= 0) {
    return { error: 'Quote has no deposit amount' }
  }

  const unitAmount = Math.round(deposit * 100)
  if (unitAmount < 50) {
    return { error: 'Deposit amount is below Stripe minimum' }
  }

  const params = new URLSearchParams()
  params.set('mode', 'payment')
  params.set('success_url', successUrl(token))
  params.set('cancel_url', quotePageUrl(token))
  params.set('line_items[0][quantity]', '1')
  params.set('line_items[0][price_data][currency]', 'gbp')
  params.set('line_items[0][price_data][unit_amount]', String(unitAmount))
  params.set('line_items[0][price_data][product_data][name]', 'Quote deposit')
  params.set('metadata[quote_id]', quote.id)
  params.set('metadata[kind]', 'deposit')
  params.set('metadata[company_id]', quote.company_id)

  const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${stripeKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg = typeof data?.error?.message === 'string'
      ? data.error.message
      : 'Stripe Checkout Session failed'
    return { error: msg }
  }

  const url = typeof data?.url === 'string' ? data.url : ''
  if (!url) return { error: 'Stripe returned no checkout URL' }
  return { checkout_url: url }
}

async function handleDecline(
  req: Request,
  admin: SupabaseClient,
  quote: QuoteRow,
  declinedReason: string,
): Promise<Response> {
  const reason = declinedReason.trim() || null

  const { data: updated, error } = await admin
    .from('quotes')
    .update({ status: 'declined', declined_reason: reason })
    .eq('id', quote.id)
    .in('status', ['sent', 'viewed'])
    .select('id, status, declined_reason')
    .maybeSingle()

  if (error) return json(req, { error: error.message }, 500)
  if (!updated) {
    return json(req, { error: 'Quote was already updated', actionable: false }, 409)
  }

  // Quote is already declined — email failure must not surface as 500 to the customer.
  try {
    const resendKey = Deno.env.get('RESEND_API_KEY')
    if (resendKey) {
      const { data: requestRow } = await admin
        .from('requests')
        .select('customer_name, customer_email')
        .eq('id', quote.request_id)
        .maybeSingle()

      const brandRes = await fetchCompanyBrand(admin, quote.company_id)
      const companyName = 'error' in brandRes ? 'Your company' : brandRes.brand.name
      const logoUrl = 'error' in brandRes ? null : resolveEmailLogoUrl(brandRes.brand.logo_key)

      const { data: admins } = await admin
        .from('profiles')
        .select('email')
        .eq('company_id', quote.company_id)
        .eq('role', 'admin')
        .eq('active', true)

      const adminEmails = (admins ?? [])
        .map((a) => (a.email && String(a.email).trim()) || '')
        .filter(Boolean)

      if (adminEmails.length) {
        const customerLabel = requestRow?.customer_name ?? requestRow?.customer_email ?? 'Customer'
        const html = brandedEmailHtml({
          companyName,
          logoUrl,
          eyebrow: 'Quote declined',
          title: 'A customer declined a quote',
          paragraphs: [
            `${customerLabel} declined the quote.`,
            reason ? `Reason: ${reason}` : 'No reason was provided.',
          ],
          note: 'Open the admin dashboard to review the quote status.',
        })

        const resendRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${resendKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: resendFromHeader(companyName),
            to: adminEmails,
            subject: `Quote declined — ${customerLabel}`,
            html,
          }),
        })
        const resendData = await resendRes.json().catch(() => ({}))

        await admin.from('email_log').insert({
          company_id: quote.company_id,
          to_email: adminEmails[0],
          template: 'quote_declined_admin',
          related_id: quote.id,
          resend_id: resendData?.id ?? null,
          status: resendRes.ok ? 'sent' : 'failed',
        })
      }
    }
  } catch (emailErr) {
    console.error('decline admin notify failed:', emailErr)
  }

  return json(req, { ok: true, status: 'declined', declined_reason: updated.declined_reason })
}

/**
 * Public (no user JWT). Customer Accept / Decline on page q.
 * - accept → Stripe Checkout Session (deposit); DB updates only via stripe-webhook
 * - decline → quotes.status=declined immediately
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return corsPreflight(req)
  if (req.method !== 'POST') return json(req, { error: 'Method not allowed' }, 405)

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !serviceKey) {
      return json(req, { error: 'Server misconfigured' }, 500)
    }

    const parsed = await readQuoteToken(req)
    if (parsed.too_large) return json(req, { error: 'Payload too large' }, 413)
    const token = parsed.token
    const action = typeof parsed.body.action === 'string'
      ? parsed.body.action.trim().replace(/^["']+|["']+$/g, '').toLowerCase()
      : ''
    const declinedReason = typeof parsed.body.declined_reason === 'string'
      ? parsed.body.declined_reason
      : ''

    if (!token || token.length < 20) {
      return json(req, missingTokenError(parsed), 400)
    }
    if (action !== 'accept' && action !== 'decline') {
      return json(req, { error: 'action must be accept or decline' }, 400)
    }

    const admin = createClient(supabaseUrl, serviceKey)

    // Public and unauthenticated, and the accept branch reaches Stripe.
    const limit = await assertRateLimit(admin, {
      req,
      route: 'create-checkout-ip',
      limit: 20,
      windowMs: 60 * 60 * 1000,
    })
    if (!limit.allowed) return rateLimitResponse(corsFor(req), limit.retryAfterSec)

    if (action === 'decline') {
      const reason = declinedReason.trim()
      if (reason.length < MIN_DECLINE_REASON) {
        return json(req, {
          error: 'Please tell us why so we can improve the quote.',
          code: 'reason_required',
        }, 400)
      }
      if (reason.length > MAX_DECLINE_REASON) {
        return json(req, {
          error: `Please keep the reason under ${MAX_DECLINE_REASON} characters.`,
          code: 'reason_too_long',
        }, 400)
      }
    }

    const loaded = await loadActionableQuote(admin, token)
    if (!loaded.ok) return json(req, loaded.body, loaded.status)

    if (action === 'decline') {
      return await handleDecline(req, admin, loaded.quote, declinedReason)
    }

    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
    if (!stripeKey) {
      return json(req, { error: 'Server misconfigured (STRIPE_SECRET_KEY)' }, 500)
    }

    const session = await createStripeCheckoutSession(loaded.quote, token, stripeKey)
    if ('error' in session) {
      return json(req, { error: session.error }, 502)
    }

    return json(req, { checkout_url: session.checkout_url })
  } catch {
    return unexpectedError(req)
  }
})
