import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { brandedEmailHtml } from '../_shared/email-layout.ts'
import { fetchCompanyBrand, resendFromHeader } from '../_shared/company.ts'

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), {
    status: s,
    headers: { 'Content-Type': 'application/json' },
  })

const round2 = (n: number) => Math.round((Number(n) + Number.EPSILON) * 100) / 100

function parseStripeSignature(header: string): { t: string; v1: string[] } | null {
  let t = ''
  const v1: string[] = []
  for (const part of header.split(',')) {
    const [k, ...rest] = part.trim().split('=')
    const v = rest.join('=')
    if (k === 't') t = v
    if (k === 'v1' && v) v1.push(v)
  }
  if (!t || !v1.length) return null
  return { t, v1 }
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let out = 0
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return out === 0
}

async function hmacSha256Hex(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const buf = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload))
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('')
}

/** Verify Stripe-Signature on the RAW body. Fail → caller returns 400, write nothing. */
async function verifyStripeSignature(
  raw: string,
  header: string | null,
  secret: string,
): Promise<boolean> {
  if (!header) return false
  const parsed = parseStripeSignature(header)
  if (!parsed) return false
  const ts = Number(parsed.t)
  if (!Number.isFinite(ts)) return false
  // 5 minute tolerance (Stripe default)
  if (Math.abs(Date.now() / 1000 - ts) > 300) return false
  const expected = await hmacSha256Hex(secret, `${parsed.t}.${raw}`)
  return parsed.v1.some((sig) => timingSafeEqual(sig, expected))
}

type StripeSession = {
  id?: string
  amount_total?: number
  currency?: string
  payment_status?: string
  metadata?: Record<string, string>
}

function isUniqueViolation(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false
  return err.code === '23505' || /duplicate key|unique/i.test(err.message ?? '')
}

async function ensureJob(
  admin: SupabaseClient,
  quoteId: string,
  companyId: string,
): Promise<string | null> {
  const { data: existing } = await admin
    .from('jobs')
    .select('id')
    .eq('quote_id', quoteId)
    .maybeSingle()
  if (existing?.id) return existing.id as string

  const { data: created, error } = await admin
    .from('jobs')
    .insert({
      company_id: companyId,
      quote_id: quoteId,
      status: 'unscheduled',
    })
    .select('id')
    .maybeSingle()

  if (created?.id) return created.id as string
  if (isUniqueViolation(error)) {
    const { data: again } = await admin
      .from('jobs')
      .select('id')
      .eq('quote_id', quoteId)
      .maybeSingle()
    return (again?.id as string) ?? null
  }
  if (error) console.error('job insert failed:', error.message)
  return null
}

async function notifyDepositPaid(
  admin: SupabaseClient,
  quoteId: string,
  companyId: string,
  requestId: string,
  amount: number,
  currency: string,
): Promise<void> {
  const resendKey = Deno.env.get('RESEND_API_KEY')
  if (!resendKey) return

  try {
    const brandRes = await fetchCompanyBrand(admin, companyId)
    const companyName = 'error' in brandRes ? 'Your company' : brandRes.brand.name

    const { data: requestRow } = await admin
      .from('requests')
      .select('customer_name, customer_email')
      .eq('id', requestId)
      .maybeSingle()

    const { data: admins } = await admin
      .from('profiles')
      .select('email')
      .eq('company_id', companyId)
      .eq('role', 'admin')
      .eq('active', true)

    const adminEmails = (admins ?? [])
      .map((a) => (a.email && String(a.email).trim()) || '')
      .filter(Boolean)

    const customerName = requestRow?.customer_name ?? 'Customer'
    const amountLabel = `${currency.toUpperCase()} ${amount.toFixed(2)}`

    if (requestRow?.customer_email) {
      const html = brandedEmailHtml({
        companyName,
        eyebrow: 'Payment received',
        title: 'Your deposit is confirmed',
        paragraphs: [
          `Hi ${customerName},`,
          `We've received your deposit of ${amountLabel}. ${companyName} will be in touch to schedule the work.`,
        ],
        note: 'You do not need to take any further action on this email.',
        preheader: `Deposit ${amountLabel} received`,
      })
      const resendRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: resendFromHeader(companyName),
          to: [requestRow.customer_email],
          subject: `Deposit received — ${companyName}`,
          html,
        }),
      })
      const resendData = await resendRes.json().catch(() => ({}))
      await admin.from('email_log').insert({
        company_id: companyId,
        to_email: requestRow.customer_email,
        template: 'quote_deposit_paid_customer',
        related_id: quoteId,
        resend_id: resendData?.id ?? null,
        status: resendRes.ok ? 'sent' : 'failed',
      })
    }

    if (adminEmails.length) {
      const html = brandedEmailHtml({
        companyName,
        eyebrow: 'Deposit paid',
        title: 'A deposit was paid',
        paragraphs: [
          `${customerName} paid a deposit of ${amountLabel}.`,
          'A job is waiting to be scheduled. Open the admin dashboard → Jobs → Assign.',
        ],
        note: 'Assign a technician when you are ready.',
        preheader: `Deposit ${amountLabel} — assign a technician`,
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
          subject: `Deposit paid — ${customerName}`,
          html,
        }),
      })
      const resendData = await resendRes.json().catch(() => ({}))
      await admin.from('email_log').insert({
        company_id: companyId,
        to_email: adminEmails[0],
        template: 'quote_deposit_paid_admin',
        related_id: quoteId,
        resend_id: resendData?.id ?? null,
        status: resendRes.ok ? 'sent' : 'failed',
      })
    }
  } catch (e) {
    console.error('deposit notify failed:', e)
  }
}

async function handleCheckoutCompleted(
  admin: SupabaseClient,
  eventId: string,
  session: StripeSession,
): Promise<Response> {
  const quoteId = typeof session.metadata?.quote_id === 'string'
    ? session.metadata.quote_id.trim()
    : ''
  const kindRaw = typeof session.metadata?.kind === 'string'
    ? session.metadata.kind.trim().toLowerCase()
    : ''
  const kind = kindRaw === 'final' ? 'final' : kindRaw === 'deposit' ? 'deposit' : ''
  const sessionId = typeof session.id === 'string' ? session.id : ''

  if (!quoteId || !kind || !sessionId) {
    console.error('checkout.session.completed missing metadata/session id')
    return json({ received: true, skipped: 'missing_metadata' })
  }

  const pence = Number(session.amount_total)
  if (!Number.isFinite(pence) || pence < 0) {
    return json({ received: true, skipped: 'bad_amount' })
  }
  const amount = round2(pence / 100)
  const currency = (session.currency || 'gbp').toLowerCase().slice(0, 3)
  const payStatus = session.payment_status === 'paid' ? 'succeeded' : (session.payment_status || 'succeeded')

  const { data: quote, error: quoteError } = await admin
    .from('quotes')
    .select('id, company_id, request_id, status')
    .eq('id', quoteId)
    .maybeSingle()

  if (quoteError) return json({ error: quoteError.message }, 500)
  if (!quote) return json({ received: true, skipped: 'quote_not_found' })

  const companyId = quote.company_id as string

  let jobId: string | null = null
  if (kind === 'deposit') {
    jobId = await ensureJob(admin, quote.id, companyId)
    if (quote.status === 'sent' || quote.status === 'viewed') {
      await admin
        .from('quotes')
        .update({ status: 'accepted' })
        .eq('id', quote.id)
        .in('status', ['sent', 'viewed'])
    }
  } else if (kind === 'final') {
    const { data: job } = await admin
      .from('jobs')
      .select('id')
      .eq('quote_id', quote.id)
      .maybeSingle()
    jobId = (job?.id as string) ?? null
  }

  const { error: payError } = await admin.from('payments').insert({
    company_id: companyId,
    quote_id: quote.id,
    job_id: jobId,
    kind,
    amount,
    currency,
    stripe_session_id: sessionId,
    stripe_event_id: eventId,
    status: payStatus,
  })

  if (payError) {
    if (isUniqueViolation(payError)) {
      return json({ received: true, duplicate: true })
    }
    return json({ error: payError.message }, 500)
  }

  if (kind === 'deposit') {
    await notifyDepositPaid(admin, quote.id, companyId, quote.request_id, amount, currency)
  }

  return json({ received: true, kind, quote_id: quote.id, job_id: jobId })
}

/**
 * Stripe → this function. No user JWT.
 * Verify signature on RAW body, then service-role writes.
 * Money state only from this path (§13 R3).
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'stripe-signature, content-type',
      },
    })
  }
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!webhookSecret || !supabaseUrl || !serviceKey) {
    return json({ error: 'Server misconfigured' }, 500)
  }

  const raw = await req.text()
  const sig = req.headers.get('stripe-signature')
  const ok = await verifyStripeSignature(raw, sig, webhookSecret)
  if (!ok) return json({ error: 'Invalid signature' }, 400)

  let event: { id?: string; type?: string; data?: { object?: StripeSession } }
  try {
    event = JSON.parse(raw)
  } catch {
    return json({ error: 'Invalid JSON' }, 400)
  }

  const type = event.type ?? ''
  if (type === 'checkout.session.expired') {
    return json({ received: true, type })
  }
  if (type !== 'checkout.session.completed') {
    return json({ received: true, ignored: type })
  }

  const eventId = typeof event.id === 'string' ? event.id : ''
  const session = event.data?.object
  if (!eventId || !session) return json({ error: 'Malformed event' }, 400)

  const admin = createClient(supabaseUrl, serviceKey)
  try {
    return await handleCheckoutCompleted(admin, eventId, session)
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})
