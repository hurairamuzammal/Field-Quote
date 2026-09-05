/**
 * §8.1: "Customer receives a Resend confirmation with date/time and assigned tech's first name."
 *
 * Callers (same shape as send-final-invoice):
 *  - DB trigger `jobs_dispatch_schedule_confirmation` via pg_net, with `x-cron-secret`
 *  - Bubble/staff with an Authorization Bearer JWT (admin, or the assigned technician)
 *
 * Scheduling itself stays a plain PostgREST PATCH from Bubble — this function only
 * sends and logs, so it can never block or reverse the assignment.
 */
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { brandedEmailHtml } from '../_shared/email-layout.ts'
import { fetchCompanyBrand, resolveEmailLogoUrl } from '../_shared/company.ts'
import { corsFor, corsPreflight } from '../_shared/cors.ts'
import { callerMayTouchJob, identifyCaller } from '../_shared/job-mailer-auth.ts'
import { sendAndLogEmail } from '../_shared/send-email.ts'
import { readJsonBody, rejectWrongMethod, unexpectedError } from '../_shared/http.ts'

const TEMPLATE = 'job_scheduled'
/** Trigger + a manual staff call can race; collapse near-simultaneous duplicates. */
const DEDUPE_WINDOW_MS = 60 * 1000
/** A confirmation only makes sense while the visit is still ahead of the customer. */
const SENDABLE_STATUSES = ['scheduled', 'en_route', 'in_progress'] as const

const json = (req: Request, b: unknown, s = 200) =>
  new Response(JSON.stringify(b), {
    status: s,
    headers: { ...corsFor(req), 'Content-Type': 'application/json' },
  })

function escapeHtml(s: string): string {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

/** "Muhammad Abu Huraira" → "Muhammad". §8.1 asks for the first name only. */
function firstName(fullName: string | null | undefined): string {
  const first = String(fullName ?? '').trim().split(/\s+/)[0] ?? ''
  return first || 'your technician'
}

/**
 * Times are stored as timestamptz and rendered in UTC, matching `daily-reminders`.
 * Per-company timezone is not in company_settings yet — when it lands, thread it
 * through here and into the T-1 reminder together so the two never disagree.
 */
function formatWhen(scheduledAt: string): string {
  const d = new Date(scheduledAt)
  if (Number.isNaN(d.getTime())) return 'the agreed time'
  return d.toLocaleString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
  }) + ' UTC'
}


/** True when an identical confirmation was logged moments ago (trigger + manual race). */
async function sentJustNow(admin: SupabaseClient, jobId: string): Promise<boolean> {
  const since = new Date(Date.now() - DEDUPE_WINDOW_MS).toISOString()
  const { count, error } = await admin
    .from('email_log')
    .select('id', { count: 'exact', head: true })
    .eq('related_id', jobId)
    .eq('template', TEMPLATE)
    .eq('status', 'sent')
    .gte('sent_at', since)

  if (error) {
    // Fail closed on the dedupe check: better one missing email than a duplicate storm.
    console.error('sentJustNow:', error.message)
    return true
  }
  return (count ?? 0) > 0
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return corsPreflight(req)
  const wrong = rejectWrongMethod(req, ['POST'])
  if (wrong) return wrong

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !serviceKey) return json(req, { error: 'Server misconfigured' }, 500)

    // Identity before anything else — an anonymous caller must not be able to
    // spend a service-role query or learn whether a job id exists (rule 7).
    const caller = await identifyCaller(req)
    if (!caller) return json(req, { error: 'Not allowed' }, 401)

    const parsed = await readJsonBody<{ job_id?: unknown }>(req)
    if (!parsed.ok) return parsed.response
    const jobId = typeof parsed.value.job_id === 'string' ? parsed.value.job_id.trim() : ''
    if (!jobId) return json(req, { error: 'job_id is required' }, 400)

    const admin = createClient(supabaseUrl, serviceKey)

    const { data: job, error: jobErr } = await admin
      .from('jobs')
      .select(
        'id, company_id, status, technician_id, scheduled_at, duration_min, customer_name, customer_email, customer_address, work_summary',
      )
      .eq('id', jobId)
      .maybeSingle()

    if (jobErr) return json(req, { error: 'Job lookup failed' }, 500)
    if (!job) return json(req, { error: 'Job not found' }, 404)

    // Row-dependent half: a technician may only mail their own job.
    if (!callerMayTouchJob(caller, job.technician_id as string | null)) {
      return json(req, { error: 'Not allowed' }, 403)
    }

    if (!job.technician_id || !job.scheduled_at) {
      return json(req, {
        ok: true,
        skipped: 'not_scheduled',
        hint: 'Job needs both technician_id and scheduled_at before a confirmation makes sense.',
      })
    }
    if (!SENDABLE_STATUSES.includes(job.status as typeof SENDABLE_STATUSES[number])) {
      return json(req, { ok: true, skipped: 'status', status: job.status })
    }

    const toEmail = String(job.customer_email ?? '').trim()
    if (!toEmail) return json(req, { error: 'Customer email missing' }, 400)

    if (await sentJustNow(admin, job.id as string)) {
      return json(req, { ok: true, skipped: 'duplicate' })
    }

    const { data: tech } = await admin
      .from('profiles')
      .select('full_name')
      .eq('id', job.technician_id)
      .maybeSingle()

    const techFirstName = firstName(tech?.full_name as string | null)
    const when = formatWhen(job.scheduled_at as string)

    const brandRes = await fetchCompanyBrand(admin, job.company_id as string)
    const companyName = 'error' in brandRes ? 'Your company' : brandRes.brand.name
    const logoUrl = 'error' in brandRes ? null : resolveEmailLogoUrl(brandRes.brand.logo_key)

    const durationMin = Number(job.duration_min)
    const durationRow = Number.isFinite(durationMin) && durationMin > 0
      ? `<tr>
            <td style="padding:8px 6px;border-bottom:1px solid #E6EDF2;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#5B6B7A;width:120px;">Estimated time</td>
            <td style="padding:8px 6px;border-bottom:1px solid #E6EDF2;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#142433;">${durationMin} minutes</td>
          </tr>`
      : ''

    const html = brandedEmailHtml({
      companyName,
      logoUrl,
      eyebrow: 'Visit confirmed',
      title: 'Your visit is booked',
      paragraphs: [
        `Hi ${String(job.customer_name ?? 'there').trim() || 'there'},`,
        `${techFirstName} from ${companyName} is booked to carry out your work on ${when}.`,
      ],
      bodyHtml: `
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin:0 0 16px;">
          <tr>
            <td style="padding:8px 6px;border-bottom:1px solid #E6EDF2;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#5B6B7A;width:120px;">When</td>
            <td style="padding:8px 6px;border-bottom:1px solid #E6EDF2;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#142433;"><strong>${escapeHtml(when)}</strong></td>
          </tr>
          <tr>
            <td style="padding:8px 6px;border-bottom:1px solid #E6EDF2;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#5B6B7A;">Technician</td>
            <td style="padding:8px 6px;border-bottom:1px solid #E6EDF2;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#142433;">${escapeHtml(techFirstName)}</td>
          </tr>
          <tr>
            <td style="padding:8px 6px;border-bottom:1px solid #E6EDF2;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#5B6B7A;">Address</td>
            <td style="padding:8px 6px;border-bottom:1px solid #E6EDF2;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#142433;">${escapeHtml(String(job.customer_address ?? ''))}</td>
          </tr>
          <tr>
            <td style="padding:8px 6px;border-bottom:1px solid #E6EDF2;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#5B6B7A;vertical-align:top;">Work</td>
            <td style="padding:8px 6px;border-bottom:1px solid #E6EDF2;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#142433;">${escapeHtml(String(job.work_summary ?? ''))}</td>
          </tr>
          ${durationRow}
        </table>`,
      note: "We'll send a reminder the day before. Need to rearrange? Just reply to this email.",
      preheader: `${techFirstName} is booked for ${when}`,
      footer: companyName,
    })

    const sent = await sendAndLogEmail({
      admin,
      companyId: job.company_id as string,
      toEmail,
      template: TEMPLATE,
      relatedId: job.id as string,
      subject: `Your visit is booked — ${companyName}`,
      html,
      companyName,
    })

    if (!sent.ok) {
      return json(req, { error: 'Email failed', detail: sent.error }, 502)
    }

    return json(req, {
      ok: true,
      job_id: job.id,
      to_email: toEmail,
      technician_first_name: techFirstName,
      scheduled_at: job.scheduled_at,
    })
  } catch {
    return unexpectedError(req)
  }
})
