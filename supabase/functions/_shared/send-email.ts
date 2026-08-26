import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { resendFromHeader } from './company.ts'

export type SendEmailResult =
  | { ok: true; resendId: string | null }
  | { ok: false; error: string; status: number }

/** Resend send + mandatory email_log row (§13 R8). */
export async function sendAndLogEmail(opts: {
  admin: SupabaseClient
  companyId: string
  toEmail: string
  template: string
  relatedId: string | null
  subject: string
  html: string
  companyName: string
}): Promise<SendEmailResult> {
  const resendKey = Deno.env.get('RESEND_API_KEY')?.trim()
  if (!resendKey) return { ok: false, error: 'RESEND_API_KEY missing', status: 500 }

  const to = opts.toEmail.trim()
  if (!to) return { ok: false, error: 'Missing to_email', status: 400 }

  const resendRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: resendFromHeader(opts.companyName),
      to: [to],
      subject: opts.subject,
      html: opts.html,
    }),
  })
  const resendData = await resendRes.json().catch(() => ({})) as { id?: string; message?: string }
  const resendId = typeof resendData.id === 'string' ? resendData.id : null

  await opts.admin.from('email_log').insert({
    company_id: opts.companyId,
    to_email: to,
    template: opts.template,
    related_id: opts.relatedId,
    resend_id: resendId,
    status: resendRes.ok ? 'sent' : 'failed',
  })

  if (!resendRes.ok) {
    return {
      ok: false,
      error: typeof resendData.message === 'string' ? resendData.message : 'Resend failed',
      status: 502,
    }
  }
  return { ok: true, resendId }
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
