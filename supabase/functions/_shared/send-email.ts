import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { resendFromHeader } from './company.ts'

export type SendEmailResult =
  | { ok: true; resendId: string | null }
  | { ok: false; error: string; status: number }

/**
 * Resend send + mandatory email_log row (§13 R8).
 *
 * `toEmail` accepts one address or several. Several = ONE Resend call (so the
 * recipients see each other's addresses only if you intend that — use it for
 * internal admin notices, not customer mail) and ONE email_log row per address,
 * so "every outbound email is logged" stays literally true and the follow-up
 * caps in `countSentEmails` keep counting real sends.
 *
 * A failed email_log insert is logged loudly rather than swallowed: dropping the
 * audit row silently is what let invite/reset mail go unlogged for weeks.
 */
export async function sendAndLogEmail(opts: {
  admin: SupabaseClient
  companyId: string
  toEmail: string | string[]
  template: string
  relatedId: string | null
  subject: string
  html: string
  companyName: string
}): Promise<SendEmailResult> {
  const resendKey = Deno.env.get('RESEND_API_KEY')?.trim()
  if (!resendKey) return { ok: false, error: 'RESEND_API_KEY missing', status: 500 }

  const recipients = (Array.isArray(opts.toEmail) ? opts.toEmail : [opts.toEmail])
    .map((e) => String(e ?? '').trim())
    .filter(Boolean)
  if (!recipients.length) return { ok: false, error: 'Missing to_email', status: 400 }

  const resendRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: resendFromHeader(opts.companyName),
      to: recipients,
      subject: opts.subject,
      html: opts.html,
    }),
  })
  const resendData = await resendRes.json().catch(() => ({})) as { id?: string; message?: string }
  const resendId = typeof resendData.id === 'string' ? resendData.id : null

  // `resend_id` is UNIQUE, so only the first row of a multi-recipient send can carry it.
  const { error: logError } = await opts.admin.from('email_log').insert(
    recipients.map((to, i) => ({
      company_id: opts.companyId,
      to_email: to,
      template: opts.template,
      related_id: opts.relatedId,
      resend_id: i === 0 ? resendId : null,
      status: resendRes.ok ? 'sent' : 'failed',
    })),
  )
  if (logError) {
    console.error(`email_log insert failed (${opts.template}):`, logError.message)
  }

  if (!resendRes.ok) {
    return {
      ok: false,
      error: typeof resendData.message === 'string' ? resendData.message : 'Resend failed',
      status: 502,
    }
  }
  return { ok: true, resendId }
}

/** Active admin addresses for a company — recipients for internal notifications. */
export async function fetchAdminEmails(
  admin: SupabaseClient,
  companyId: string,
): Promise<string[]> {
  const { data, error } = await admin
    .from('profiles')
    .select('email')
    .eq('company_id', companyId)
    .eq('role', 'admin')
    .eq('active', true)

  if (error) {
    console.error('fetchAdminEmails:', error.message)
    return []
  }
  return (data ?? [])
    .map((row) => String(row.email ?? '').trim())
    .filter(Boolean)
}

/** Count successful sends for cap enforcement (§13 R8). */
export async function countSentEmails(
  admin: SupabaseClient,
  relatedId: string,
  templates: string[],
): Promise<number> {
  const { count, error } = await admin
    .from('email_log')
    .select('id', { count: 'exact', head: true })
    .eq('related_id', relatedId)
    .eq('status', 'sent')
    .in('template', templates)
  if (error) return Number.MAX_SAFE_INTEGER
  return count ?? 0
}
