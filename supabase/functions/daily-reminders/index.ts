/**
 * Daily reminders (§9.2 / Day 19).
 * T-1 appointment, tech morning digest, final-invoice nudges (+3 / +7 days).
 */
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { brandedEmailHtml } from '../_shared/email-layout.ts'
import { fetchCompanyBrand, resolveEmailLogoUrl } from '../_shared/company.ts'
import { requireCronOrAdmin } from '../_shared/cron-auth.ts'
import { corsFor, corsPreflight } from '../_shared/cors.ts'
import { countSentEmails, fetchAdminEmails, sendAndLogEmail } from '../_shared/send-email.ts'
import { readJsonBody, rejectWrongMethod, unexpectedError } from '../_shared/http.ts'

const MS_DAY = 24 * 60 * 60 * 1000
const INVOICE_NUDGE_TEMPLATE = 'final_invoice_nudge'
const INVOICE_FLAG_TEMPLATE = 'final_invoice_flagged_admin'
const MAX_INVOICE_NUDGES = 2

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

function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
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

async function sentToday(
  admin: SupabaseClient,
  template: string,
  toEmail: string,
  dayStart: Date,
): Promise<boolean> {
  const { count } = await admin
    .from('email_log')
    .select('id', { count: 'exact', head: true })
    .eq('template', template)
    .eq('to_email', toEmail)
    .eq('status', 'sent')
    .gte('sent_at', dayStart.toISOString())
  return (count ?? 0) > 0
}

async function finalInvoiceSentAt(
  admin: SupabaseClient,
  jobId: string,
): Promise<Date | null> {
  const { data } = await admin
    .from('email_log')
    .select('sent_at')
    .eq('related_id', jobId)
    .eq('template', 'final_invoice')
    .eq('status', 'sent')
    .order('sent_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (!data?.sent_at) return null
  const d = new Date(data.sent_at as string)
  return Number.isNaN(d.getTime()) ? null : d
}

/**
 * §9.2: "…nudged at +3 and +7 days, then flagged to admin — never more."
 *
 * `invoice_nudge_exhausted` alone was a column no human ever reads, so the
 * "flagged to admin" half never actually happened. This sends exactly one notice
 * per job — capped by counting email_log, same discipline as every other cap.
 */
async function flagInvoiceToAdmin(
  admin: SupabaseClient,
  job: { id: string; company_id: string; customer_name: string; customer_email: string },
  brand: { name: string; logoUrl: string | null },
): Promise<boolean> {
  const already = await countSentEmails(admin, job.id, [INVOICE_FLAG_TEMPLATE])
  if (already > 0) return false

  const adminEmails = await fetchAdminEmails(admin, job.company_id)
  if (!adminEmails.length) {
    console.error('flagInvoiceToAdmin: no active admin for company', job.company_id)
    return false
  }

  const html = brandedEmailHtml({
    companyName: brand.name,
    logoUrl: brand.logoUrl,
    eyebrow: 'Needs chasing',
    title: `Unpaid final invoice — ${job.customer_name}`,
    paragraphs: [
      `${job.customer_name} has not paid the final invoice after two automatic reminders.`,
      'Automatic chasing has stopped for this job, as per the follow-up cap. Please follow up manually.',
    ],
    note: 'You will not get another automatic reminder about this job.',
    preheader: `Unpaid invoice needs chasing — ${job.customer_name}`,
  })

  const res = await sendAndLogEmail({
    admin,
    companyId: job.company_id,
    toEmail: adminEmails,
    template: INVOICE_FLAG_TEMPLATE,
    relatedId: job.id,
    subject: `Unpaid invoice needs chasing — ${job.customer_name}`,
    html,
    companyName: brand.name,
  })
  if (!res.ok) console.error('flagInvoiceToAdmin:', res.error)
  return res.ok
}

type JobRow = {
  id: string
  company_id: string
  quote_id: string
  status: string
  technician_id: string | null
  scheduled_at: string | null
  customer_name: string
  customer_email: string
  customer_address: string
  work_summary: string
  invoice_nudge_exhausted: boolean
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
    const todayStart = startOfUtcDay(now)
    const tomorrowStart = new Date(todayStart.getTime() + MS_DAY)
    const tomorrowEnd = new Date(tomorrowStart.getTime() + MS_DAY)

    const stats = {
      appointment_reminders: 0,
      tech_digests: 0,
      invoice_nudges: 0,
      invoice_flags: 0,
      admin_flag_emails: 0,
      skipped: 0,
      failed: 0,
    }

    const brandCache = new Map<string, { name: string; logoUrl: string | null }>()

    // --- T-1 customer appointment reminders ---
    let apptQ = admin
      .from('jobs')
      .select(
        'id, company_id, quote_id, status, technician_id, scheduled_at, customer_name, customer_email, customer_address, work_summary, invoice_nudge_exhausted',
      )
      .eq('status', 'scheduled')
      .gte('scheduled_at', tomorrowStart.toISOString())
      .lt('scheduled_at', tomorrowEnd.toISOString())

    if (companyId) apptQ = apptQ.eq('company_id', companyId)

    const { data: tomorrowJobs } = await apptQ
    for (const job of (tomorrowJobs ?? []) as JobRow[]) {
      if (await automationsPaused(admin, job.company_id)) {
        stats.skipped++
        continue
      }
      const email = job.customer_email?.trim()
      if (!email) {
        stats.skipped++
        continue
      }
      if (await sentToday(admin, 'appointment_reminder', email, todayStart)) {
        stats.skipped++
        continue
      }

      let cached = brandCache.get(job.company_id)
      if (!cached) {
        const brand = await fetchCompanyBrand(admin, job.company_id)
        cached = 'error' in brand
          ? { name: 'Your company', logoUrl: null }
          : { name: brand.brand.name, logoUrl: resolveEmailLogoUrl(brand.brand.logo_key) }
        brandCache.set(job.company_id, cached)
      }
      const companyName = cached.name
      const logoUrl = cached.logoUrl

      const when = job.scheduled_at
        ? new Date(job.scheduled_at).toLocaleString('en-GB', {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
          timeZone: 'UTC',
        }) + ' UTC'
        : 'tomorrow'

      const html = brandedEmailHtml({
        companyName,
        logoUrl,
        eyebrow: 'Appointment',
        title: 'Your visit is tomorrow',
        paragraphs: [
          `Hi ${job.customer_name?.trim() || 'there'}, this is a reminder from ${companyName}.`,
          `We are scheduled for ${when}.`,
          `Address: ${job.customer_address}`,
          `Work: ${job.work_summary}`,
        ],
        note: 'Need to reschedule? Reply to this email.',
        preheader: `Appointment tomorrow — ${companyName}`,
      })

      const res = await sendAndLogEmail({
        admin,
        companyId: job.company_id,
        toEmail: email,
        template: 'appointment_reminder',
        relatedId: job.id,
        subject: `Appointment reminder — ${companyName}`,
        html,
        companyName,
      })
      if (res.ok) stats.appointment_reminders++
      else stats.failed++
    }

    // --- Tech morning digest (today's jobs) ---
    const todayEnd = tomorrowStart
    let todayQ = admin
      .from('jobs')
      .select(
        'id, company_id, technician_id, scheduled_at, customer_name, customer_address, status, work_summary',
      )
      .not('technician_id', 'is', null)
      .in('status', ['scheduled', 'en_route', 'in_progress'])
      .gte('scheduled_at', todayStart.toISOString())
      .lt('scheduled_at', todayEnd.toISOString())

    if (companyId) todayQ = todayQ.eq('company_id', companyId)

    const { data: todayJobs } = await todayQ
    const byTech = new Map<string, typeof todayJobs>()
    for (const row of todayJobs ?? []) {
      const tid = row.technician_id as string
      if (!byTech.has(tid)) byTech.set(tid, [])
      byTech.get(tid)!.push(row)
    }

    for (const [techId, jobs] of byTech) {
      const first = jobs![0]
      if (await automationsPaused(admin, first.company_id)) {
        stats.skipped++
        continue
      }

      const { data: profile } = await admin
        .from('profiles')
        .select('email, full_name, company_id')
        .eq('id', techId)
        .maybeSingle()
      const techEmail = profile?.email?.trim()
      if (!techEmail) {
        stats.skipped++
        continue
      }
      if (await sentToday(admin, 'tech_daily_digest', techEmail, todayStart)) {
        stats.skipped++
        continue
      }

      let cached = brandCache.get(first.company_id)
      if (!cached) {
        const brand = await fetchCompanyBrand(admin, first.company_id)
        cached = 'error' in brand
          ? { name: 'Your company', logoUrl: null }
          : { name: brand.brand.name, logoUrl: resolveEmailLogoUrl(brand.brand.logo_key) }
        brandCache.set(first.company_id, cached)
      }
      const companyName = cached.name
      const logoUrl = cached.logoUrl

      const lines = jobs!.map((j) => {
        const t = j.scheduled_at
          ? new Date(j.scheduled_at as string).toLocaleTimeString('en-GB', {
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'UTC',
          }) + ' UTC'
          : 'TBC'
        return `• ${t} — ${j.customer_name} @ ${j.customer_address} (${j.status})`
      })

      const html = brandedEmailHtml({
        companyName,
        logoUrl,
        eyebrow: 'Your day',
        title: `Today: ${jobs!.length} job${jobs!.length === 1 ? '' : 's'}`,
        paragraphs: [
          `Hi ${profile?.full_name?.trim() || 'there'}, here is your schedule for today:`,
          lines.join('\n'),
        ],
        preheader: `${jobs!.length} jobs today`,
      })

      const res = await sendAndLogEmail({
        admin,
        companyId: first.company_id,
        toEmail: techEmail,
        template: 'tech_daily_digest',
        relatedId: techId,
        subject: `Your jobs today — ${companyName}`,
        html,
        companyName,
      })
      if (res.ok) stats.tech_digests++
      else stats.failed++
    }

    // --- Final invoice nudges (+3 / +7 days after final_invoice email) ---
    let unpaidQ = admin
      .from('jobs')
      .select(
        'id, company_id, quote_id, status, customer_name, customer_email, invoice_nudge_exhausted',
      )
      .eq('status', 'completed')
      .eq('invoice_nudge_exhausted', false)

    if (companyId) unpaidQ = unpaidQ.eq('company_id', companyId)

    const { data: completedJobs } = await unpaidQ

    for (const job of (completedJobs ?? []) as JobRow[]) {
      if (await automationsPaused(admin, job.company_id)) {
        stats.skipped++
        continue
      }

      const { data: paidFinal } = await admin
        .from('payments')
        .select('id')
        .eq('quote_id', job.quote_id)
        .eq('kind', 'final')
        .eq('status', 'succeeded')
        .maybeSingle()
      if (paidFinal) {
        stats.skipped++
        continue
      }

      const sentAt = await finalInvoiceSentAt(admin, job.id)
      if (!sentAt) {
        stats.skipped++
        continue
      }

      const nudgeCount = await countSentEmails(admin, job.id, [INVOICE_NUDGE_TEMPLATE])
      if (nudgeCount >= MAX_INVOICE_NUDGES) {
        await admin.from('jobs').update({ invoice_nudge_exhausted: true }).eq('id', job.id)
      let cached = brandCache.get(job.company_id)
      if (!cached) {
        const brand = await fetchCompanyBrand(admin, job.company_id)
        cached = 'error' in brand
          ? { name: 'Your company', logoUrl: null }
          : { name: brand.brand.name, logoUrl: resolveEmailLogoUrl(brand.brand.logo_key) }
        brandCache.set(job.company_id, cached)
      }
        if (await flagInvoiceToAdmin(admin, job, cached)) stats.admin_flag_emails++
        stats.invoice_flags++
        continue
      }

      const daysSince = (now.getTime() - sentAt.getTime()) / MS_DAY
      const needFirst = nudgeCount === 0 && daysSince >= 3
      const needSecond = nudgeCount === 1 && daysSince >= 7
      if (!needFirst && !needSecond) {
        stats.skipped++
        continue
      }

      const email = job.customer_email?.trim()
      if (!email) {
        stats.skipped++
        continue
      }

      let cached = brandCache.get(job.company_id)
      if (!cached) {
        const brand = await fetchCompanyBrand(admin, job.company_id)
        cached = 'error' in brand
          ? { name: 'Your company', logoUrl: null }
          : { name: brand.brand.name, logoUrl: resolveEmailLogoUrl(brand.brand.logo_key) }
        brandCache.set(job.company_id, cached)
      }
      const companyName = cached.name
      const logoUrl = cached.logoUrl

      const html = brandedEmailHtml({
        companyName,
        logoUrl,
        eyebrow: 'Balance due',
        title: 'Friendly reminder — final payment',
        paragraphs: [
          `Hi ${job.customer_name?.trim() || 'there'},`,
          'Your job is complete and a final invoice was sent previously.',
          'If you have not paid the remaining balance yet, please use the link in that email or contact us.',
        ],
        note: 'Already paid? You can ignore this reminder.',
        preheader: `Final payment reminder — ${companyName}`,
      })

      const res = await sendAndLogEmail({
        admin,
        companyId: job.company_id,
        toEmail: email,
        template: INVOICE_NUDGE_TEMPLATE,
        relatedId: job.id,
        subject: `Reminder: final payment — ${companyName}`,
        html,
        companyName,
      })

      if (!res.ok) {
        stats.failed++
        continue
      }

      stats.invoice_nudges++
      const newCount = nudgeCount + 1
      if (newCount >= MAX_INVOICE_NUDGES) {
        await admin.from('jobs').update({ invoice_nudge_exhausted: true }).eq('id', job.id)
        if (await flagInvoiceToAdmin(admin, job, cached)) stats.admin_flag_emails++
        stats.invoice_flags++
      }
    }

    return json(req, { ok: true, now: now.toISOString(), ...stats })
  } catch {
    return unexpectedError(req)
  }
})
