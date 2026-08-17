/** Shared FieldQuote transactional email HTML (Resend). */

const BRAND = {
  navy: '#0B1D2C',
  teal: '#00E0C4',
  ink: '#142433',
  muted: '#5B6B7A',
  border: '#E6EDF2',
  bg: '#F4F7F9',
  white: '#FFFFFF',
}

function escapeHtml(s: string | undefined | null): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Public base for /logos/* (Vercel landing URL). No trailing slash. */
export function emailAssetBase(): string {
  const raw =
    Deno.env.get('EMAIL_ASSET_BASE_URL') ??
    Deno.env.get('PUBLIC_LANDING_URL') ??
    ''
  return raw.replace(/\/$/, '')
}

export function emailLogoUrl(): string | null {
  const base = emailAssetBase()
  if (!base) return null
  return `${base}/logos/logo-email.png`
}

export type BrandedEmailArgs = {
  /** Shown under the logo in the header strip */
  eyebrow?: string
  /** Main heading inside the card */
  title: string
  /** Intro paragraphs (plain text; escaped) */
  paragraphs?: string[]
  /** Optional rich HTML (already safe) inserted after paragraphs */
  bodyHtml?: string
  /** Primary CTA — omit both when the email is notification-only (no button) */
  ctaLabel?: string
  ctaUrl?: string
  /** Small print under the button */
  note?: string
  /** Footer line */
  footer?: string
  /** Preheader (inbox snippet) */
  preheader?: string
  /** Company display name from company_settings (not hardcoded product string) */
  companyName?: string
}

/**
 * Table-based layout that works in Gmail / Outlook / Apple Mail.
 * Logo uses hosted PNG when EMAIL_ASSET_BASE_URL is set; otherwise a text wordmark.
 */
export function brandedEmailHtml(args: BrandedEmailArgs): string {
  const companyName = (args.companyName ?? 'Your company').trim() || 'Your company'
  const logo = emailLogoUrl()
  const preheader = escapeHtml(args.preheader ?? args.title)
  const eyebrow = args.eyebrow ? escapeHtml(args.eyebrow) : escapeHtml(companyName)
  const title = escapeHtml(args.title)
  const paragraphs = (args.paragraphs ?? [])
    .map(
      (p) =>
        `<p style="margin:0 0 16px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:${BRAND.ink};">${escapeHtml(p)}</p>`,
    )
    .join('')
  const bodyHtml = args.bodyHtml ?? ''
  const note = args.note
    ? `<p style="margin:20px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.5;color:${BRAND.muted};">${escapeHtml(args.note)}</p>`
    : ''
  const footer = escapeHtml(
    args.footer ??
      `${companyName} · You received this because of an account action.`,
  )
  const hasCta = Boolean(args.ctaLabel?.trim() && args.ctaUrl?.trim())
  const ctaLabel = escapeHtml(args.ctaLabel)
  const ctaUrl = escapeHtml(args.ctaUrl)
  const ctaBlock = hasCta
    ? `<tr>
                  <td style="padding:8px 28px 28px;" align="left">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="border-radius:8px;background:${BRAND.navy};">
                          <a href="${ctaUrl}" style="display:inline-block;padding:14px 22px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:700;color:${BRAND.white};text-decoration:none;border-radius:8px;">
                            ${ctaLabel}
                          </a>
                        </td>
                      </tr>
                    </table>
                    ${note}
                    <p style="margin:18px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.5;color:${BRAND.muted};word-break:break-all;">
                      If the button does not work, copy this link:<br/>
                      <a href="${ctaUrl}" style="color:${BRAND.navy};">${ctaUrl}</a>
                    </p>
                  </td>
                </tr>`
    : `<tr>
                  <td style="padding:8px 28px 28px;" align="left">
                    ${note}
                  </td>
                </tr>`

  const logoBlock = logo
    ? `<img src="${escapeHtml(logo)}" width="200" height="27" alt="${escapeHtml(companyName)}" style="display:block;border:0;outline:none;text-decoration:none;height:auto;max-width:200px;" />`
    : `<div style="font-family:Arial,Helvetica,sans-serif;font-size:18px;font-weight:800;letter-spacing:0.02em;color:${BRAND.navy};">${escapeHtml(companyName)}</div>`

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="light" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:${BRAND.bg};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${preheader}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${BRAND.bg};padding:32px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:560px;">
          <tr>
            <td style="padding:0 0 20px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="left" style="vertical-align:middle;">${logoBlock}</td>
                  <td align="right" style="vertical-align:middle;font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:${BRAND.muted};">${eyebrow}</td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background:${BRAND.white};border:1px solid ${BRAND.border};border-radius:12px;overflow:hidden;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="height:4px;background:${BRAND.teal};font-size:0;line-height:0;">&nbsp;</td>
                </tr>
                <tr>
                  <td style="padding:28px 28px 8px;">
                    <h1 style="margin:0 0 16px;font-family:Arial,Helvetica,sans-serif;font-size:22px;line-height:1.3;font-weight:700;color:${BRAND.navy};">${title}</h1>
                    ${paragraphs}
                    ${bodyHtml}
                  </td>
                </tr>
                ${ctaBlock}
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 8px 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.5;color:${BRAND.muted};text-align:center;">
              ${footer}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

export function inviteEmailHtml(opts: {
  setPasswordUrl: string
  fullName?: string
  resent?: boolean
  companyName: string
}): string {
  const company = opts.companyName.trim() || 'Your company'
  const name = opts.fullName?.trim()
  const greeting = name ? `Hi ${name},` : 'Hi,'
  return brandedEmailHtml({
    companyName: company,
    eyebrow: opts.resent ? 'Invite resent' : 'Technician invite',
    title: opts.resent
      ? `Your ${company} invite is ready again`
      : `You've been invited to ${company}`,
    paragraphs: [
      greeting,
      opts.resent
        ? 'Here is a fresh link to set up your technician account. The previous invite link may no longer work.'
        : `You've been invited to join as a technician on ${company}. Set your password to access your jobs and schedule.`,
      'This link expires soon — finish setup shortly after opening this email.',
    ],
    ctaLabel: 'Set up your account',
    ctaUrl: opts.setPasswordUrl,
    note: 'If you did not expect this invite, you can ignore this email.',
    preheader: opts.resent
      ? `Fresh invite link to set up your ${company} account`
      : `Set up your technician account on ${company}`,
  })
}

export function passwordResetEmailHtml(opts: {
  resetUrl: string
  companyName: string
}): string {
  const company = opts.companyName.trim() || 'Your company'
  return brandedEmailHtml({
    companyName: company,
    eyebrow: 'Security',
    title: `Reset your ${company} password`,
    paragraphs: [
      'We received a request to reset your password.',
      'Use the button below to choose a new password. If you did not request this, you can safely ignore this email — your password will stay the same.',
    ],
    ctaLabel: 'Set a new password',
    ctaUrl: opts.resetUrl,
    note: 'For your security, this link expires soon.',
    preheader: `Reset your ${company} password`,
  })
}
