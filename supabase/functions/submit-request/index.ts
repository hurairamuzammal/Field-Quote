import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { brandedEmailHtml } from '../_shared/email-layout.ts'
import { fetchCompanyBrand, fetchSoleCompanyId, resolveEmailLogoUrl } from '../_shared/company.ts'
import { corsFor, corsPreflight } from '../_shared/cors.ts'
import { assertRateLimit, rateLimitResponse } from '../_shared/rate-limit.ts'
import { fetchAdminEmails, sendAndLogEmail } from '../_shared/send-email.ts'

const json = (req: Request, b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsFor(req), 'Content-Type': 'application/json' } })

type MediaKind = 'photo' | 'audio'

type MediaItem = {
  r2_key: string
  kind: MediaKind
  size_bytes: number
}

/** Bubble may send `media` as an array or a JSON string; legacy clients use photo_keys / audio_key. */
function parseMediaFromBody(body: Record<string, unknown>): MediaItem[] {
  const out: MediaItem[] = []

  // Bubble Submit Request: "media": [{ "key", "kind", "size" }] or stringified JSON
  let mediaRaw: unknown = body.media
  if (typeof mediaRaw === 'string' && mediaRaw.trim()) {
    // Hold the string: reassigning `mediaRaw` in the try loses the `string` narrowing.
    const asString = mediaRaw
    try {
      mediaRaw = JSON.parse(asString)
    } catch {
      // plain R2 key accidentally sent as string
      out.push({ r2_key: asString.trim(), kind: 'photo', size_bytes: 1 })
      mediaRaw = null
    }
  }

  if (Array.isArray(mediaRaw)) {
    for (const item of mediaRaw.slice(0, 6)) {
      if (typeof item === 'string' && item.trim()) {
        out.push({ r2_key: item.trim(), kind: 'photo', size_bytes: 1 })
        continue
      }
      if (!item || typeof item !== 'object') continue
      const row = item as Record<string, unknown>
      const key = String(row.key ?? row.r2_key ?? '').trim()
      if (!key) continue
      const kindRaw = String(row.kind ?? 'photo').toLowerCase()
      const kind: MediaKind = kindRaw === 'audio' ? 'audio' : 'photo'
      const size = Number(row.size ?? row.size_bytes ?? 1)
      out.push({
        r2_key: key,
        kind,
        size_bytes: Number.isFinite(size) && size > 0 ? Math.floor(size) : 1,
      })
    }
  }

  // Legacy: photo_keys[] + audio_key
  const photoKeys = body.photo_keys
  if (Array.isArray(photoKeys)) {
    for (const k of photoKeys.slice(0, 5)) {
      if (typeof k === 'string' && k.trim()) {
        out.push({ r2_key: k.trim(), kind: 'photo', size_bytes: 1 })
      }
    }
  }

  const audioKey = body.audio_key
  if (typeof audioKey === 'string' && audioKey.trim()) {
    out.push({ r2_key: audioKey.trim(), kind: 'audio', size_bytes: 1 })
  }

  // Dedupe by r2_key (keep first)
  const seen = new Set<string>()
  return out.filter((m) => {
    if (seen.has(m.r2_key)) return false
    seen.add(m.r2_key)
    return true
  }).slice(0, 6)
}

const EMAIL_RE =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/

function asTrimmed(v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}

function isEmail(s: string): boolean {
  return s.length >= 5 && s.length <= 254 && EMAIL_RE.test(s)
}

function hasLetter(s: string): boolean {
  return /[a-zA-Z]/.test(s)
}

/** Digits, spaces and the usual separators; 7-20 characters once trimmed. */
const PHONE_RE = /^[0-9\s()+.\-]{7,20}$/

function isPhone(s: string): boolean {
  if (!PHONE_RE.test(s)) return false
  // Reject "+++ --- ()" style input that passes the character class but has no number.
  return (s.match(/\d/g) ?? []).length >= 7
}

const EMAIL_LIMIT_PER_DAY = 3
/** §5.1 also asks for a per-IP limit: varying the email address must not be unlimited. */
const IP_LIMIT_PER_HOUR = 10
const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000
const MAX_BODY_BYTES = 32 * 1024

function adminDashboardUrl(): string {
  return (
    Deno.env.get('BUBBLE_ADMIN_URL') ??
    'https://fieldquote-26446.bubbleapps.io/version-test/admin_dashboard'
  ).replace(/\/$/, '')
}

function escapeHtml(s: string): string {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

type RequestSummary = {
  id: string
  customer_name: string
  customer_email: string
  customer_phone: string
  customer_address: string
  description: string
  preferred_timing: string | null
  media_count: number
}

/**
 * §5.1: the customer gets a confirmation and the admin gets a notification.
 *
 * Best-effort by design — the request row already exists and the customer already
 * saw the confirmation screen, so a Resend outage must never turn a captured lead
 * into a 500. Failures are logged to `email_log` with status 'failed' (§13 R8) and
 * to the function log; the caller still gets 200.
 */
async function notifyNewRequest(
  admin: SupabaseClient,
  companyId: string,
  request: RequestSummary,
): Promise<{ customer: string; admin: string }> {
  const result = { customer: 'skipped', admin: 'skipped' }

  if (!Deno.env.get('RESEND_API_KEY')?.trim()) {
    console.error('notifyNewRequest: RESEND_API_KEY unset; skipping both sends')
    return result
  }

  const brandRes = await fetchCompanyBrand(admin, companyId)
  const companyName = 'error' in brandRes ? 'Your company' : brandRes.brand.name
  const logoUrl = 'error' in brandRes ? null : resolveEmailLogoUrl(brandRes.brand.logo_key)

  const mediaLine = request.media_count === 1
    ? '1 attachment'
    : `${request.media_count} attachments`

  // ── Customer confirmation ────────────────────────────────────────────
  try {
    const html = brandedEmailHtml({
      companyName,
      logoUrl,
      eyebrow: 'Request received',
      title: "We've got your request",
      paragraphs: [
        `Hi ${request.customer_name},`,
        `Thanks for getting in touch with ${companyName}. We have your details and we're putting together a quote for you.`,
        'You will receive a second email with the full quote and a secure link to approve it. No account or password needed.',
      ],
      bodyHtml: `
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin:0 0 16px;">
          <tr>
            <td style="padding:8px 6px;border-bottom:1px solid #E6EDF2;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#5B6B7A;width:120px;">What you told us</td>
            <td style="padding:8px 6px;border-bottom:1px solid #E6EDF2;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#142433;">${escapeHtml(request.description) || '—'}</td>
          </tr>
          <tr>
            <td style="padding:8px 6px;border-bottom:1px solid #E6EDF2;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#5B6B7A;">Address</td>
            <td style="padding:8px 6px;border-bottom:1px solid #E6EDF2;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#142433;">${escapeHtml(request.customer_address)}</td>
          </tr>
          <tr>
            <td style="padding:8px 6px;border-bottom:1px solid #E6EDF2;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#5B6B7A;">Preferred timing</td>
            <td style="padding:8px 6px;border-bottom:1px solid #E6EDF2;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#142433;">${escapeHtml(request.preferred_timing ?? '') || 'No preference given'}</td>
          </tr>
        </table>`,
      note: 'Need to change something? Just reply to this email.',
      preheader: `${companyName} received your request`,
      footer: companyName,
    })

    const res = await sendAndLogEmail({
      admin,
      companyId,
      toEmail: request.customer_email,
      template: 'request_received_customer',
      relatedId: request.id,
      subject: `We received your request — ${companyName}`,
      html,
      companyName,
    })
    result.customer = res.ok ? 'sent' : 'failed'
    if (!res.ok) console.error('request_received_customer:', res.error)
  } catch (e) {
    console.error('request_received_customer threw:', e)
    result.customer = 'failed'
  }

  // ── Admin notification ───────────────────────────────────────────────
  try {
    const adminEmails = await fetchAdminEmails(admin, companyId)
    if (!adminEmails.length) {
      console.error('notifyNewRequest: no active admin to notify for company', companyId)
      return result
    }

    const html = brandedEmailHtml({
      companyName,
      logoUrl,
      eyebrow: 'New request',
      title: `New request from ${request.customer_name}`,
      paragraphs: [
        `A new intake request just arrived (${mediaLine}).`,
      ],
      bodyHtml: `
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin:0 0 16px;">
          <tr>
            <td style="padding:8px 6px;border-bottom:1px solid #E6EDF2;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#5B6B7A;width:120px;">Customer</td>
            <td style="padding:8px 6px;border-bottom:1px solid #E6EDF2;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#142433;">${escapeHtml(request.customer_name)}</td>
          </tr>
          <tr>
            <td style="padding:8px 6px;border-bottom:1px solid #E6EDF2;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#5B6B7A;">Email</td>
            <td style="padding:8px 6px;border-bottom:1px solid #E6EDF2;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#142433;">${escapeHtml(request.customer_email)}</td>
          </tr>
          <tr>
            <td style="padding:8px 6px;border-bottom:1px solid #E6EDF2;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#5B6B7A;">Phone</td>
            <td style="padding:8px 6px;border-bottom:1px solid #E6EDF2;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#142433;">${escapeHtml(request.customer_phone) || '—'}</td>
          </tr>
          <tr>
            <td style="padding:8px 6px;border-bottom:1px solid #E6EDF2;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#5B6B7A;">Address</td>
            <td style="padding:8px 6px;border-bottom:1px solid #E6EDF2;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#142433;">${escapeHtml(request.customer_address)}</td>
          </tr>
          <tr>
            <td style="padding:8px 6px;border-bottom:1px solid #E6EDF2;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#5B6B7A;">Preferred timing</td>
            <td style="padding:8px 6px;border-bottom:1px solid #E6EDF2;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#142433;">${escapeHtml(request.preferred_timing ?? '') || 'No preference given'}</td>
          </tr>
          <tr>
            <td style="padding:8px 6px;border-bottom:1px solid #E6EDF2;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#5B6B7A;vertical-align:top;">Description</td>
            <td style="padding:8px 6px;border-bottom:1px solid #E6EDF2;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#142433;">${escapeHtml(request.description) || '—'}</td>
          </tr>
        </table>`,
      ctaLabel: 'Open the request inbox',
      ctaUrl: adminDashboardUrl(),
      note: 'Draft with AI from the request popup, then review before sending.',
      preheader: `New request — ${request.customer_name}`,
      footer: companyName,
    })

    const res = await sendAndLogEmail({
      admin,
      companyId,
      toEmail: adminEmails,
      template: 'request_received_admin',
      relatedId: request.id,
      subject: `New request — ${request.customer_name}`,
      html,
      companyName,
    })
    result.admin = res.ok ? 'sent' : 'failed'
    if (!res.ok) console.error('request_received_admin:', res.error)
  } catch (e) {
    console.error('request_received_admin threw:', e)
    result.admin = 'failed'
  }

  return result
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return corsPreflight(req)
  if (req.method !== 'POST') return json(req, { error: 'Method not allowed' }, 405)

  try {
    const raw = await req.text()
    if (raw.length > MAX_BODY_BYTES) return json(req, { error: 'Request too large' }, 413)

    const body = (raw ? JSON.parse(raw) : {}) as Record<string, unknown>
    const customer_name = asTrimmed(body.customer_name)
    const customer_email = asTrimmed(body.customer_email).toLowerCase()
    const customer_phone = asTrimmed(body.customer_phone)
    const customer_address = asTrimmed(body.customer_address)
    const description = asTrimmed(body.description)
    const preferred_timing = asTrimmed(body.preferred_timing) || null

    const honeypot = body.honeypot ?? body.hp
    if (typeof honeypot === 'string' ? honeypot.trim() : honeypot) {
      return json(req, { success: true }, 200)
    }

    const mediaItems = parseMediaFromBody(body)
    const desc = description

    if (!customer_name || customer_name.length < 2 || customer_name.length > 80 || !hasLetter(customer_name)) {
      return json(req, { error: 'Enter a valid name' }, 400)
    }
    if (!isEmail(customer_email)) {
      return json(req, { error: 'Enter a valid email' }, 400)
    }
    // Phone is optional on the intake form (no asterisk), so only validate the
    // format when one was actually given — making it required here would reject
    // submissions the UI happily accepts.
    if (customer_phone && !isPhone(customer_phone)) {
      return json(req, { error: 'Enter a valid phone number' }, 400)
    }
    if (!customer_address || customer_address.length < 8 || customer_address.length > 200) {
      return json(req, { error: 'Enter a valid address' }, 400)
    }
    if (!desc && mediaItems.length === 0) {
      return json(req, { error: 'Please provide a description, photo, or audio recording' }, 400)
    }
    if (desc && desc.length < 20 && mediaItems.length === 0) {
      return json(req, { error: 'Please describe the job in a bit more detail' }, 400)
    }
    if (desc.length > 4000) {
      return json(req, { error: 'Description is too long' }, 400)
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !serviceRoleKey) {
      return json(req, { error: 'Server misconfigured' }, 500)
    }
    const supabase = createClient(supabaseUrl, serviceRoleKey)

    // Two buckets: per-email stops one customer spamming, per-IP stops one script
    // cycling addresses. `identity` omitted -> assertRateLimit falls back to clientIp().
    const ipLimit = await assertRateLimit(supabase, {
      req,
      route: 'submit-request-ip-hour',
      limit: IP_LIMIT_PER_HOUR,
      windowMs: HOUR_MS,
    })
    if (!ipLimit.allowed) return rateLimitResponse(corsFor(req), ipLimit.retryAfterSec)

    const emailLimit = await assertRateLimit(supabase, {
      req,
      route: 'submit-request-email-day',
      limit: EMAIL_LIMIT_PER_DAY,
      windowMs: DAY_MS,
      identity: customer_email,
    })
    if (!emailLimit.allowed) return rateLimitResponse(corsFor(req), emailLimit.retryAfterSec)

    const company = await fetchSoleCompanyId(supabase)
    if ('error' in company) {
      return json(req, { error: company.error }, 500)
    }
    const companyId = company.company_id

    const { data: request, error: reqErr } = await supabase
      .from('requests')
      .insert({
        company_id: companyId,
        customer_name,
        customer_email,
        customer_phone,
        customer_address,
        description: desc || '',
        preferred_timing,
        status: 'new',
      })
      .select('id')
      .single()

    if (reqErr || !request) {
      return json(req, { error: 'Failed to create request' }, 500)
    }

    if (mediaItems.length > 0) {
      const mediaRows = mediaItems.map((m) => ({
        company_id: companyId,
        request_id: request.id,
        r2_key: m.r2_key,
        kind: m.kind,
        size_bytes: m.size_bytes,
      }))
      const { error: mediaErr } = await supabase.from('request_media').insert(mediaRows)
      if (mediaErr) {
        return json(req, {
          error: 'Request created but media failed to save',
          request_id: request.id,
        }, 500)
      }
    }

    // §5.1 notifications. Never allowed to fail the submission — see notifyNewRequest.
    let notified = { customer: 'skipped', admin: 'skipped' }
    try {
      notified = await notifyNewRequest(supabase, companyId, {
        id: request.id,
        customer_name,
        customer_email,
        customer_phone,
        customer_address,
        description: desc || '',
        preferred_timing,
        media_count: mediaItems.length,
      })
    } catch (e) {
      console.error('notifyNewRequest failed (request already saved):', e)
    }

    return json(req, {
      success: true,
      request_id: request.id,
      media_count: mediaItems.length,
      notified,
    }, 200)
  } catch {
    return json(req, { error: 'Unexpected error' }, 500)
  }
})
