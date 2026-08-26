export function quotePageUrl(token: string): string {
  const base = (Deno.env.get('PUBLIC_QUOTE_PAGE_URL') ??
    'https://fieldquote-26446.bubbleapps.io/version-test/q').replace(/\/$/, '')
  return `${base}?token=${encodeURIComponent(token)}`
}
