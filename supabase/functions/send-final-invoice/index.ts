import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { brandedEmailHtml } from '../_shared/email-layout.ts'
import { fetchCompanyBrand, resendFromHeader, resolveEmailLogoUrl } from '../_shared/company.ts'
import { corsFor, corsPreflight } from '../_shared/cors.ts'
import { readJsonBody, rejectWrongMethod, unexpectedError } from '../_shared/http.ts'

const json = (req: Request, b: unknown, s = 200) =>
  new Response(JSON.stringify(b), {
    status: s,
    headers: { ...corsFor(req), 'Content-Type': 'application/json' },
  })

const round2 = (n: number) => Math.round((Number(n) + Number.EPSILON) * 100) / 100

function envUrl(name: string, fallback: string): string {
  const raw = Deno.env.get(name)?.trim()
  return (raw || fallback).replace(/\/$/, '')
}

function successUrl(token: string): string {
  const base = envUrl(
    'PUBLIC_QUOTE_SUCCESS_URL',
    'https://fieldquote-26446.bubbleapps.io/version-test/q-success',
  )
  // kind=final so q-success can hide “technician will be assigned” copy
  return `${base}?token=${encodeURIComponent(token)}&kind=final`
}

function cancelUrl(token: string): string {
  const base = envUrl(
    'PUBLIC_QUOTE_PAGE_URL',
    'https://fieldquote-26446.bubbleapps.io/version-test/q',
  )
  return `${base}?token=${encodeURIComponent(token)}`
}

function cronSecretOk(req: Request): boolean {
  const expected = Deno.env.get('CRON_SECRET')?.trim() ?? ''
  if (!expected) return false
  const got = (req.headers.get('x-cron-secret') ?? '').trim()
  if (!got || got.length !== expected.length) return false
  let out = 0
  for (let i = 0; i < expected.length; i++) out |= expected.charCodeAt(i) ^ got.charCodeAt(i)
  return out === 0
}

function normalizeBearer(req: Request): string | null {
  const raw = (req.headers.get('Authorization') ?? '').trim()
  if (!raw) return null
  const m = raw.match(/^bearer\s+(.+)$/i)
  if (m?.[1]?.trim()) return `Bearer ${m[1].trim()}`
  if (raw.startsWith('eyJ')) return `Bearer ${raw}`
  return null
}

async function staffMayInvoice(
  req: Request,
  jobTechnicianId: string | null,
): Promise<boolean> {
  const authHeader = normalizeBearer(req)
  if (!authHeader) return false
  const url = Deno.env.get('SUPABASE_URL')
  const anon = Deno.env.get('SUPABASE_ANON_KEY')
  if (!url || !anon) return false
  const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } })
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return false
  const { data: profile } = await userClient
    .from('profiles')
    .select('role, active')
    .eq('id', user.id)
    .maybeSingle()
  if (!profile || profile.active === false) return false
  if (profile.role === 'admin') return true
  return profile.role === 'technician' && jobTechnicianId === user.id
}

async function createFinalCheckout(args: {
  quoteId: string
  jobId: string
  companyId: string
  token: string
  amount: number
  stripeKey: string
}): Promise<{ checkout_url: string } | { error: string }> {
  const unitAmount = Math.round(args.amount * 100)
  if (unitAmount < 50) return { error: 'Balance is below Stripe minimum' }

  const params = new URLSearchParams()
  params.set('mode', 'payment')
  params.set('success_url', successUrl(args.token))
  params.set('cancel_url', cancelUrl(args.token))
  params.set('line_items[0][quantity]', '1')
  params.set('line_items[0][price_data][currency]', 'gbp')
  params.set('line_items[0][price_data][unit_amount]', String(unitAmount))
  params.set('line_items[0][price_data][product_data][name]', 'Final invoice')
  params.set('metadata[quote_id]', args.quoteId)
  params.set('metadata[job_id]', args.jobId)
  params.set('metadata[kind]', 'final')
  params.set('metadata[company_id]', args.companyId)

  const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${args.stripeKey}`,
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
  const checkout_url = typeof data?.url === 'string' ? data.url : ''
  if (!checkout_url) return { error: 'Stripe returned no checkout URL' }
  return { checkout_url }
}

async function alreadySent(admin: SupabaseClient, jobId: string): Promise<boolean> {
  const { count } = await admin
    .from('email_log')
    .select('id', { count: 'exact', head: true })
    .eq('related_id', jobId)
    .eq('template', 'final_invoice')
    .eq('status', 'sent')
  return (count ?? 0) >= 1
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return corsPreflight(req)
  const wrong = rejectWrongMethod(req, ['POST'])
  if (wrong) return wrong

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !serviceKey) return json(req, { error: 'Server misconfigured' }, 500)

    const parsed = await readJsonBody<{ job_id?: unknown }>(req)
    if (!parsed.ok) return parsed.response
    const jobId = typeof parsed.value.job_id === 'string' ? parsed.value.job_id.trim() : ''
    if (!jobId) return json(req, { error: 'job_id is required' }, 400)

    const admin = createClient(supabaseUrl, serviceKey)

    const { data: job, error: jobErr } = await admin
      .from('jobs')
      .select('id, company_id, quote_id, status, technician_id, customer_name, customer_email')
      .eq('id', jobId)
      .maybeSingle()
    if (jobErr) return json(req, { error: 'Job lookup failed' }, 500)
    if (!job) return json(req, { error: 'Job not found' }, 404)
    if (job.status !== 'completed') {
      return json(req, { error: 'Job is not completed', status: job.status }, 409)
    }

    if (!cronSecretOk(req) && !(await staffMayInvoice(req, job.technician_id))) {
      return json(req, { error: 'Not allowed' }, 401)
    }

    const { data: existingFinal } = await admin
      .from('payments')
      .select('id')
      .eq('quote_id', job.quote_id)
      .eq('kind', 'final')
      .eq('status', 'succeeded')
      .maybeSingle()
    if (existingFinal) return json(req, { ok: true, already_paid: true })

    if (await alreadySent(admin, job.id)) {
      return json(req, { ok: true, already_sent: true })
    }

    const { data: quote, error: quoteErr } = await admin
      .from('quotes')
      .select('id, company_id, total, deposit_amount, token')
      .eq('id', job.quote_id)
      .maybeSingle()
    if (quoteErr || !quote) return json(req, { error: 'Quote not found' }, 500)

    const token = typeof quote.token === 'string' ? quote.token : ''
    if (token.length < 20) return json(req, { error: 'Quote token missing' }, 500)

    const total = round2(Number(quote.total))
    const deposit = round2(Number(quote.deposit_amount))
    const remaining = round2(total - deposit)
    const toEmail = String(job.customer_email ?? '').trim()
    if (!toEmail) return json(req, { error: 'Customer email missing' }, 400)

    const brandRes = await fetchCompanyBrand(admin, job.company_id)
    const companyName = 'error' in brandRes ? 'Your company' : brandRes.brand.name
    const logoUrl = 'error' in brandRes ? null : resolveEmailLogoUrl(brandRes.brand.logo_key)
    const customerLabel = String(job.customer_name ?? 'there')
    const resendKey = Deno.env.get('RESEND_API_KEY')
    if (!resendKey) return json(req, { error: 'Server misconfigured' }, 500)

    let checkoutUrl: string | null = null
    let paragraphs: string[]
    let ctaLabel: string | undefined
    let ctaUrl: string | undefined

    if (remaining < 0.5) {
      paragraphs = [
        `Hi ${customerLabel}, the work is complete.`,
        remaining <= 0
          ? 'There is no remaining balance on this job.'
          : 'The remaining balance is below the payment minimum, so no card payment is due.',
      ]
    } else {
      const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
      if (!stripeKey) return json(req, { error: 'Server misconfigured' }, 500)
      const session = await createFinalCheckout({
        quoteId: quote.id,
        jobId: job.id,
        companyId: job.company_id,
        token,
        amount: remaining,
        stripeKey,
      })
      if ('error' in session) return json(req, { error: session.error }, 502)
      checkoutUrl = session.checkout_url
      paragraphs = [
        `Hi ${customerLabel}, the work is complete.`,
        `Balance due: £${remaining.toFixed(2)} (total £${total.toFixed(2)} less deposit £${deposit.toFixed(2)}).`,
        'Pay the remaining balance with the button below. Card details are collected on Stripe, not on our site.',
      ]
      ctaLabel = 'Pay remaining balance'
      ctaUrl = checkoutUrl
    }

    const html = brandedEmailHtml({
      companyName,
      logoUrl,
      eyebrow: 'Job complete',
      title: remaining < 0.5 ? 'Your job is complete' : 'Final invoice',
      paragraphs,
      ctaLabel,
      ctaUrl,
      note: 'This link is unique to your job. Do not share it.',
      preheader: remaining < 0.5 ? 'Job complete' : `Balance due £${remaining.toFixed(2)}`,
    })

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: resendFromHeader(companyName),
        to: [toEmail],
        subject: remaining < 0.5
          ? `Job complete — ${companyName}`
          : `Final invoice £${remaining.toFixed(2)} — ${companyName}`,
        html,
      }),
    })
    const resendData = await resendRes.json().catch(() => ({})) as { id?: string; message?: string }

    await admin.from('email_log').insert({
      company_id: job.company_id,
      to_email: toEmail,
      template: 'final_invoice',
      related_id: job.id,
      resend_id: typeof resendData.id === 'string' ? resendData.id : null,
      status: resendRes.ok ? 'sent' : 'failed',
    })

    if (!resendRes.ok) {
      return json(req, { error: 'Email failed', detail: resendData.message ?? 'Resend error' }, 502)
    }

    return json(req, {
      ok: true,
      job_id: job.id,
      remaining,
      checkout_url: checkoutUrl,
    })
  } catch {
    return unexpectedError(req)
  }
})
