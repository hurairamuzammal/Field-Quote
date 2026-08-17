import { brandedEmailHtml } from '../_shared/email-layout.ts'
import { resendFromHeader } from '../_shared/company.ts'
import { requireActiveAdmin } from '../_shared/require-admin.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), {
    status: s,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })

const round2 = (n: number) => Math.round((Number(n) + Number.EPSILON) * 100) / 100

function randomTokenHex(bytes = 16): string {
  const buf = new Uint8Array(bytes)
  crypto.getRandomValues(buf)
  return Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('')
}

function quotePageUrl(token: string): string {
  const base = (Deno.env.get('PUBLIC_QUOTE_PAGE_URL') ??
    'https://fieldquote-26446.bubbleapps.io/version-test/q').replace(/\/$/, '')
  return `${base}?token=${encodeURIComponent(token)}`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    const gate = await requireActiveAdmin(req, cors)
    if (!gate.ok) return gate.response
    const { admin, companyId } = gate.caller

    const resendKey = Deno.env.get('RESEND_API_KEY')
    if (!resendKey) {
      return json({ error: 'Server misconfigured (RESEND_API_KEY)' }, 500)
    }
    const body = await req.json().catch(() => ({}))
    const quoteId = typeof body.quote_id === 'string' ? body.quote_id.trim() : ''
    if (!quoteId) return json({ error: 'quote_id is required' }, 400)

    const { data: quote, error: quoteError } = await admin
      .from('quotes')
      .select(
        'id, company_id, request_id, status, subtotal, tax_amount, total, deposit_amount, deposit_pct, tax_pct, token, valid_until',
      )
      .eq('id', quoteId)
      .eq('company_id', companyId)
      .maybeSingle()

    if (quoteError) return json({ error: quoteError.message }, 500)
    if (!quote) return json({ error: 'Quote not found' }, 404)
    if (quote.status !== 'draft') {
      const alreadySent = quote.status === 'sent' ||
        quote.status === 'viewed' ||
        quote.status === 'accepted' ||
        quote.status === 'declined' ||
        quote.status === 'expired'
      return json({
        error: alreadySent
          ? 'Quote already sent'
          : 'Quote is not a draft',
        status: quote.status,
        hint: alreadySent
          ? 'This quote was already sent. Do not call send-quote again; use follow-ups later if needed.'
          : 'Only draft quotes can be sent.',
      }, 409)
    }

    const { data: lines, error: linesError } = await admin
      .from('quote_line_items')
      .select('id, label, qty, unit_price')
      .eq('quote_id', quoteId)
      .order('created_at', { ascending: true })

    if (linesError) return json({ error: linesError.message }, 500)
    if (!lines?.length) return json({ error: 'Quote has no line items' }, 400)

    const unpriced = lines.filter((l) => l.unit_price == null)
    if (unpriced.length) {
      return json({
        error: 'Cannot send: one or more lines need manual pricing',
        unpriced_line_ids: unpriced.map((l) => l.id),
        needs_manual_pricing: true,
      }, 400)
    }

    const { data: requestRow, error: requestError } = await admin
      .from('requests')
      .select('id, customer_name, customer_email, customer_phone, customer_address, description')
      .eq('id', quote.request_id)
      .maybeSingle()

    if (requestError) return json({ error: requestError.message }, 500)
    if (!requestRow?.customer_email) {
      return json({ error: 'Request missing customer_email' }, 400)
    }

    const { data: settings, error: settingsError } = await admin
      .from('company_settings')
      .select('name, deposit_pct, tax_pct, quote_validity_days')
      .eq('company_id', companyId)
      .maybeSingle()

    if (settingsError) return json({ error: settingsError.message }, 500)
    if (!settings) return json({ error: 'company_settings missing' }, 500)

    const taxPct = round2(Number(quote.tax_pct ?? settings.tax_pct))
    const depositPct = round2(Number(quote.deposit_pct ?? settings.deposit_pct))
    let subtotal = 0
    for (const line of lines) {
      subtotal += Number(line.qty) * Number(line.unit_price)
    }
    subtotal = round2(subtotal)
    const taxAmount = round2(subtotal * (taxPct / 100))
    const total = round2(subtotal + taxAmount)
    const depositAmount = round2(total * (depositPct / 100))

    const validityDays = Math.max(1, Number(settings.quote_validity_days) || 14)
    const validUntil = new Date(Date.now() + validityDays * 24 * 60 * 60 * 1000).toISOString()
    const token = quote.token && String(quote.token).length >= 20
      ? String(quote.token)
      : randomTokenHex(16)

    const { data: updated, error: updateError } = await admin
      .from('quotes')
      .update({
        status: 'sent',
        token,
        valid_until: validUntil,
        subtotal,
        tax_amount: taxAmount,
        total,
        deposit_amount: depositAmount,
        deposit_pct: depositPct,
        tax_pct: taxPct,
      })
      .eq('id', quoteId)
      .eq('status', 'draft')
      .select('id, status, token, valid_until, subtotal, tax_amount, total, deposit_amount')
      .maybeSingle()

    if (updateError) return json({ error: updateError.message }, 500)
    if (!updated) {
      return json({ error: 'Quote was not draft anymore (concurrent send?)' }, 409)
    }

    const link = quotePageUrl(token)
    const companyName = (settings.name && String(settings.name).trim()) || 'Your company'
    const lineHtml = lines
      .map((l) => {
        const lineTotal = round2(Number(l.qty) * Number(l.unit_price))
        return `<tr>
          <td style="padding:8px 6px;border-bottom:1px solid #E6EDF2;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#142433">${escapeHtml(String(l.label))}</td>
          <td style="padding:8px 6px;border-bottom:1px solid #E6EDF2;font-family:Arial,Helvetica,sans-serif;font-size:14px;text-align:right;color:#142433">${Number(l.qty)}</td>
          <td style="padding:8px 6px;border-bottom:1px solid #E6EDF2;font-family:Arial,Helvetica,sans-serif;font-size:14px;text-align:right;color:#142433">£${Number(l.unit_price).toFixed(2)}</td>
          <td style="padding:8px 6px;border-bottom:1px solid #E6EDF2;font-family:Arial,Helvetica,sans-serif;font-size:14px;text-align:right;color:#142433">£${lineTotal.toFixed(2)}</td>
        </tr>`
      })
      .join('')

    const bodyHtml = `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin:0 0 16px;">
        <thead>
          <tr>
            <th style="text-align:left;padding:8px 6px;border-bottom:2px solid #0B1D2C;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#5B6B7A;">Item</th>
            <th style="text-align:right;padding:8px 6px;border-bottom:2px solid #0B1D2C;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#5B6B7A;">Qty</th>
            <th style="text-align:right;padding:8px 6px;border-bottom:2px solid #0B1D2C;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#5B6B7A;">Unit</th>
            <th style="text-align:right;padding:8px 6px;border-bottom:2px solid #0B1D2C;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#5B6B7A;">Line</th>
          </tr>
        </thead>
        <tbody>${lineHtml}</tbody>
      </table>
      <p style="margin:0 0 8px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.55;color:#142433;">
        <strong>Subtotal:</strong> £${subtotal.toFixed(2)}<br/>
        <strong>Tax (${taxPct}%):</strong> £${taxAmount.toFixed(2)}<br/>
        <strong>Total:</strong> £${total.toFixed(2)}<br/>
        <strong>Deposit due (${depositPct}%):</strong> £${depositAmount.toFixed(2)}
      </p>
    `

    const html = brandedEmailHtml({
      companyName,
      eyebrow: 'Quote',
      title: `Your quote from ${companyName}`,
      paragraphs: [
        `Hi ${requestRow.customer_name},`,
        `${companyName} has sent you a quote. Review the line items below, then open the secure link to respond.`,
      ],
      bodyHtml,
      ctaLabel: 'View quote & respond',
      ctaUrl: link,
      note: `This quote is valid until ${validUntil.slice(0, 10)}.`,
      preheader: `Quote from ${companyName} — total £${total.toFixed(2)}`,
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
        subject: `Your quote from ${companyName}`,
        html,
      }),
    })
    const resendData = await resendRes.json().catch(() => ({}))

    await admin.from('email_log').insert({
      company_id: companyId,
      to_email: requestRow.customer_email,
      template: 'quote_sent',
      related_id: quoteId,
      resend_id: resendData?.id ?? null,
      status: resendRes.ok ? 'sent' : 'failed',
    })

    if (!resendRes.ok) {
      // Quote is already sent in DB (token live). Surface email failure so admin can retry later.
      return json({
        ok: false,
        quote_id: quoteId,
        status: 'sent',
        token,
        quote_url: link,
        valid_until: validUntil,
        email_status: 'failed',
        email_error: resendData?.message ?? resendData?.error ?? 'Resend failed',
        totals: { subtotal, tax_amount: taxAmount, total, deposit_amount: depositAmount },
      }, 502)
    }

    return json({
      ok: true,
      quote_id: quoteId,
      status: 'sent',
      token,
      quote_url: link,
      valid_until: validUntil,
      email_status: 'sent',
      resend_id: resendData?.id ?? null,
      customer_email: requestRow.customer_email,
      totals: { subtotal, tax_amount: taxAmount, total, deposit_amount: depositAmount },
    })
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})

function escapeHtml(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}
