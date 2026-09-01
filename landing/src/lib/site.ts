const BUBBLE_APP_URL = 'https://fieldquote-26446.bubbleapps.io/version-test';

export const SITE_NAME = 'FieldQuote';

export const SITE_TITLE =
  'FieldQuote — Electrical Work, Quoted and Scheduled Clearly';

export const SITE_DESCRIPTION =
  'Request electrical work, review a professionally prepared quote, pay securely, and receive clear updates through completion.';

export const SITE_LINKS = {
  requestQuote: `${BUBBLE_APP_URL}/`,
  staffLogin: `${BUBBLE_APP_URL}/login`,
} as const;

/** Canonical origin for metadataBase, OG urls, sitemap, robots. */
export function siteOrigin(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, '');

  const vercelProd = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercelProd) {
    return `https://${vercelProd.replace(/^https?:\/\//, '').replace(/\/$/, '')}`;
  }

  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) {
    return `https://${vercel.replace(/^https?:\/\//, '').replace(/\/$/, '')}`;
  }

  return 'http://localhost:3000';
}
