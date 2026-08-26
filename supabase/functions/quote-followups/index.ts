/**
 * Daily quote follow-ups (§9.1 / Day 18).
 * pg_cron or admin manual POST → expire stale quotes → capped follow-up emails.
 */
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { brandedEmailHtml } from '../_shared/email-layout.ts'
import { fetchCompanyBrand, resolveEmailLogoUrl } from '../_shared/company.ts'
import { requireCronOrAdmin } from '../_shared/cron-auth.ts'
import { corsFor, corsPreflight } from '../_shared/cors.ts'
import { quotePageUrl } from '../_shared/quote-url.ts'
import { countSentEmails, sendAndLogEmail } from '../_shared/send-email.ts'
import { readJsonBody, rejectWrongMethod, unexpectedError } from '../_shared/http.ts'

const FOLLOWUP_TEMPLATES = ['quote_followup_sent', 'quote_followup_viewed'] as const
const MAX_FOLLOWUPS_PER_QUOTE = 2
const SENT_REMINDER_MS = 48 * 60 * 60 * 1000
const VIEWED_NUDGE_MS = 3 * 24 * 60 * 60 * 1000

const json = (req: Request, body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsFor(req), 'Content-Type': 'application/json' },
  })

function parseNow(raw: unknown): Date | null {
  if (raw == null || raw === '') return new Date()
  if (typeof raw !== 'string') return null
  const d = new Date(raw)
  return Number.isNaN(d.getTime()) ? null : d
}

async function automationsPaused(
  admin: SupabaseClient,
  companyId: string,
): Promise<boolean> {
  const { data } = await admin
    .from('company_settings')
    .select('automations_paused')
    .eq('company_id', companyId)
    .maybeSingle()
  return data?.automations_paused === true
}

async function expireQuotes(
  admin: SupabaseClient,
  now: Date,
  companyId: string | null,
): Promise<number> {
  let q = admin
    .from('quotes')
    .select('id, company_id, status')
    .in('status', ['sent', 'viewed'])
    .lt('valid_until', now.toISOString())

  if (companyId) q = q.eq('company_id', companyId)

  const { data, error } = await q
  if (error || !data?.length) return 0

  let expired = 0
  for (const row of data) {
    const { error: upErr } = await admin
      .from('quotes')
      .update({ status: 'expired' })
      .eq('id', row.id)
      .in('status', ['sent', 'viewed'])
    if (!upErr) expired++
  }
  return expired
}

type QuoteRow = {
  id: string
  company_id: string
  status: string
  token: string | null
  valid_until: string | null
  viewed_at: string | null
  updated_at: string
  total: number | string
  deposit_amount: number | string
  requests: {
    customer_name: string
    customer_email: string
  } | null
}

async function loadQuotes(
  admin: SupabaseClient,
  status: 'sent' | 'viewed',
  companyId: string | null,
): Promise<QuoteRow[]> {
  let q = admin
    .from('quotes')
    .select(
      'id, company_id, status, token, valid_until, viewed_at, updated_at, total, deposit_amount, requests(customer_name, customer_email)',
    )
    .eq('status', status)

  if (companyId) q = q.eq('company_id', companyId)

  const { data, error } = await q
  if (error) {
    console.error('loadQuotes:', error.message)
    return []
  }
  return (data ?? []) as QuoteRow[]
}

async function maybeSendFollowup(args: {
  admin: SupabaseClient
  quote: QuoteRow
  template: typeof FOLLOWUP_TEMPLATES[number]
  companyName: string
  logoUrl: string | null
  subject: string
  paragraphs: string[]
  token: string
}): Promise<'sent' | 'skipped' | 'failed'> {
  const total = await countSentEmails(args.admin, args.quote.id, [...FOLLOWUP_TEMPLATES])
  if (total >= MAX_FOLLOWUPS_PER_QUOTE) return 'skipped'

  const same = await countSentEmails(args.admin, args.quote.id, [args.template])
  if (same > 0) return 'skipped'

  const email = args.quote.requests?.customer_email?.trim()
  if (!email) return 'skipped'

  const link = quotePageUrl(args.token)
  const html = brandedEmailHtml({
    companyName: args.companyName,
    logoUrl: args.logoUrl,
    eyebrow: 'Quote reminder',
    title: args.template === 'quote_followup_sent'
      ? 'Your quote is waiting'
      : 'Still thinking it over?',
    paragraphs: args.paragraphs,
    ctaLabel: 'View your quote',
    ctaUrl: link,
    note: 'If you already accepted or declined, you can ignore this email.',
    preheader: `Quote follow-up — ${args.companyName}`,
  })

  const res = await sendAndLogEmail({
    admin: args.admin,
    companyId: args.quote.company_id,
    toEmail: email,
    template: args.template,
    relatedId: args.quote.id,
    subject: args.subject,
    html,
    companyName: args.companyName,
  })
  return res.ok ? 'sent' : 'failed'
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return corsPreflight(req)
  const wrong = rejectWrongMethod(req, ['POST'])
  if (wrong) return wrong

  try {
    const auth = await requireCronOrAdmin(req, corsFor(req))
    if (!auth.ok) return auth.response

    const parsed = await readJsonBody<{ now?: unknown }>(req)
    if (!parsed.ok) return parsed.response
    const now = parseNow(parsed.value.now)
    if (!now) return json(req, { error: 'Invalid now (use ISO-8601)' }, 400)

    const { admin, companyId } = auth
    const nowMs = now.getTime()
    const stats = {
      expired: 0,
      sent_reminders: 0,
      viewed_nudges: 0,
      skipped: 0,
      failed: 0,
    }

    stats.expired = await expireQuotes(admin, now, companyId)

    const brandCache = new Map<string, { name: string; logoUrl: string | null }>()

    const sentQuotes = await loadQuotes(admin, 'sent', companyId)
    for (const quote of sentQuotes) {
      if (await automationsPaused(admin, quote.company_id)) {
        stats.skipped++
        continue
      }
      if (quote.viewed_at) {
        stats.skipped++
        continue
      }
      if (quote.valid_until && new Date(quote.valid_until).getTime() <= nowMs) {
        stats.skipped++
        continue
      }
      const sentAt = new Date(quote.updated_at).getTime()
      if (nowMs - sentAt < SENT_REMINDER_MS) {
        stats.skipped++
        continue
      }
      const token = typeof quote.token === 'string' ? quote.token : ''
      if (token.length < 20) {
        stats.skipped++
        continue
      }

      let cached = brandCache.get(quote.company_id)
      if (!cached) {
        const brand = await fetchCompanyBrand(admin, quote.company_id)
        cached = 'error' in brand
          ? { name: 'Your company', logoUrl: null }
          : { name: brand.brand.name, logoUrl: resolveEmailLogoUrl(brand.brand.logo_key) }
        brandCache.set(quote.company_id, cached)
      }

      const name = quote.requests?.customer_name?.trim() || 'there'
      const outcome = await maybeSendFollowup({
        admin,
        quote,
        template: 'quote_followup_sent',
        companyName: cached.name,
        logoUrl: cached.logoUrl,
        subject: `Reminder: your quote from ${cached.name}`,
        paragraphs: [
          `Hi ${name}, we sent you a quote a couple of days ago.`,
          `Total £${Number(quote.total).toFixed(2)} (deposit £${Number(quote.deposit_amount).toFixed(2)}).`,
          'Open the link below when you have a moment — it expires on the date shown in the quote.',
        ],
        token,
      })
      if (outcome === 'sent') stats.sent_reminders++
      else if (outcome === 'failed') stats.failed++
      else stats.skipped++
    }

    const viewedQuotes = await loadQuotes(admin, 'viewed', companyId)
    for (const quote of viewedQuotes) {
      if (await automationsPaused(admin, quote.company_id)) {
        stats.skipped++
        continue
      }
      if (!quote.viewed_at) {
        stats.skipped++
        continue
      }
      if (quote.valid_until && new Date(quote.valid_until).getTime() <= nowMs) {
        stats.skipped++
        continue
      }
      const viewedMs = new Date(quote.viewed_at).getTime()
      if (nowMs - viewedMs < VIEWED_NUDGE_MS) {
        stats.skipped++
        continue
      }
      const token = typeof quote.token === 'string' ? quote.token : ''
      if (token.length < 20) {
        stats.skipped++
        continue
      }

      let cached = brandCache.get(quote.company_id)
      if (!cached) {
        const brand = await fetchCompanyBrand(admin, quote.company_id)
        cached = 'error' in brand
          ? { name: 'Your company', logoUrl: null }
          : { name: brand.brand.name, logoUrl: resolveEmailLogoUrl(brand.brand.logo_key) }
        brandCache.set(quote.company_id, cached)
      }

      const name = quote.requests?.customer_name?.trim() || 'there'
      const outcome = await maybeSendFollowup({
        admin,
        quote,
        template: 'quote_followup_viewed',
        companyName: cached.name,
        logoUrl: cached.logoUrl,
        subject: `Follow-up on your quote — ${cached.name}`,
        paragraphs: [
          `Hi ${name}, you viewed your quote recently.`,
          'If you would like to go ahead, accept and pay the deposit from the link below.',
          'If you have questions, reply to this email and we will help.',
        ],
        token,
      })
      if (outcome === 'sent') stats.viewed_nudges++
      else if (outcome === 'failed') stats.failed++
      else stats.skipped++
    }

    return json(req, { ok: true, now: now.toISOString(), ...stats })
  } catch {
    return unexpectedError(req)
  }
})
