import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsFor, corsPreflight } from '../_shared/cors.ts'
import { resolveEmailLogoUrl } from '../_shared/company.ts'
import { missingTokenError, readQuoteToken } from '../_shared/quote-token.ts'
import { unexpectedError } from '../_shared/http.ts'
import { assertRateLimit, rateLimitResponse } from '../_shared/rate-limit.ts'

const json = (req: Request, b: unknown, s = 200) =>
  new Response(JSON.stringify(b), {
    status: s,
    headers: { ...corsFor(req), 'Content-Type': 'application/json' },
  })

/**
 * Public (no JWT). Customer opens /q?token=… → Bubble calls this.
 * Returns safe quote payload. First successful open stamps viewed_at + status=viewed.
 *
 * Accept / Decline are NOT handled here — see create-checkout:
 * - Accept → Stripe deposit → stripe-webhook sets quotes.status=accepted + creates job
 * - Decline → create-checkout → quotes.status=declined + declined_reason
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return corsPreflight(req)
  if (req.method !== 'POST' && req.method !== 'GET') {
    return json(req, { error: 'Method not allowed' }, 405)
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !serviceKey) {
      return json(req, { error: 'Server misconfigured' }, 500)
    }

    const parsed = await readQuoteToken(req)
    if (parsed.too_large) return json(req, { error: 'Payload too large' }, 413)
    const token = parsed.token

    if (!token || token.length < 20) {
      return json(req, missingTokenError(parsed), 400)
    }

    const admin = createClient(supabaseUrl, serviceKey)

    // Public and unauthenticated: every call is a service-role read on a free-tier
    // database. The 128-bit token makes guessing pointless, but nothing stopped a
    // single IP hammering this endpoint.
    const limit = await assertRateLimit(admin, {
      req,
      route: 'resolve-quote-token-ip',
      limit: 60,
      windowMs: 60 * 60 * 1000,
    })
    if (!limit.allowed) return rateLimitResponse(corsFor(req), limit.retryAfterSec)

    const { data: quote, error: quoteError } = await admin
      .from('quotes')
      .select(
        'id, company_id, request_id, status, subtotal, tax_amount, total, deposit_amount, deposit_pct, tax_pct, valid_until, viewed_at, declined_reason',
      )
      .eq('token', token)
      .maybeSingle()

    if (quoteError) return json(req, { error: quoteError.message }, 500)
    if (!quote) return json(req, { error: 'Quote not found', actionable: false }, 404)

    const now = Date.now()
    const expiredByDate = quote.valid_until && new Date(quote.valid_until).getTime() < now

    // Paid quotes: 200 so q-success can poll status=accepted.
    // Still not actionable (Accept lives in create-checkout, which rejects accepted).
    if (quote.status === 'accepted') {
      return json(req, {
        actionable: false,
        status: 'accepted',
        message: 'Payment received.',
      })
    }

    if (quote.status === 'declined' || quote.status === 'expired' || expiredByDate) {
      if (expiredByDate && quote.status !== 'expired' && quote.status !== 'declined') {
        await admin.from('quotes').update({ status: 'expired' }).eq('id', quote.id)
      }
      return json(req, {
        actionable: false,
        status: expiredByDate && quote.status !== 'declined' ? 'expired' : quote.status,
        message: 'This quote is no longer available.',
        declined_reason: quote.declined_reason ?? null,
      }, 410)
    }

    // First open: sent → viewed
    if (quote.status === 'sent') {
      await admin
        .from('quotes')
        .update({
          status: 'viewed',
          viewed_at: quote.viewed_at ?? new Date().toISOString(),
        })
        .eq('id', quote.id)
        .eq('status', 'sent')
      quote.status = 'viewed'
      quote.viewed_at = quote.viewed_at ?? new Date().toISOString()
    }

    const { data: lines } = await admin
      .from('quote_line_items')
      .select('label, qty, unit_price')
      .eq('quote_id', quote.id)
      .order('created_at', { ascending: true })

    const { data: requestRow } = await admin
      .from('requests')
      .select('customer_name, customer_email, customer_address, description')
      .eq('id', quote.request_id)
      .maybeSingle()

    const { data: settings } = await admin
      .from('company_settings')
      .select('name, logo_key, contact_email, contact_phone, contact_address')
      .eq('company_id', quote.company_id)
      .maybeSingle()

    const logoUrl = resolveEmailLogoUrl(settings?.logo_key as string | null | undefined)

    return json(req, {
      actionable: true,
      status: quote.status,
      company_name: (settings?.name && String(settings.name).trim()) || 'Your company',
      // §7.1 company details. A customer being asked for a deposit needs to know
      // who is asking and how to reach them.
      company_email: settings?.contact_email ?? null,
      company_phone: settings?.contact_phone ?? null,
      company_address: settings?.contact_address ?? null,
      company_logo_url: logoUrl,
      customer_name: requestRow?.customer_name ?? null,
      description: requestRow?.description ?? null,
      valid_until: quote.valid_until,
      viewed_at: quote.viewed_at,
      line_items: (lines ?? []).map((l) => ({
        label: l.label,
        qty: l.qty,
        unit_price: l.unit_price,
        line_total: Number(l.qty) * Number(l.unit_price ?? 0),
      })),
      subtotal: quote.subtotal,
      tax_pct: quote.tax_pct,
      tax_amount: quote.tax_amount,
      total: quote.total,
      deposit_pct: quote.deposit_pct,
      deposit_amount: quote.deposit_amount,
      // Accept / Decline buttons call later Week-3 functions with the same token (never quote id).
      next_actions: ['accept', 'decline'],
    })
  } catch {
    return unexpectedError(req)
  }
})
