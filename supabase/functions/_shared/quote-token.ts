/** Parse customer quote token from Bubble (body / query). */

export type TokenParse = {
  token: string
  json_parsed: boolean
  source: 'body' | 'query' | 'none'
  token_length: number
  body: Record<string, unknown>
  raw: string
  too_large?: boolean
}

function stripQuotes(s: string): string {
  return s.trim().replace(/^["']+|["']+$/g, '').trim()
}

export function cleanToken(raw: unknown): string {
  if (raw == null) return ''
  let s = stripQuotes(String(raw))
  if (!s) return ''
  if (/token=/i.test(s)) {
    try {
      const href = s.includes('://') ? s : `https://placeholder.invalid/${s.startsWith('?') ? s : `?${s}`}`
      const t = new URL(href).searchParams.get('token')
      if (t) s = stripQuotes(t)
    } catch {
      /* ignore */
    }
  }
  return s
}

export async function readQuoteToken(req: Request): Promise<TokenParse> {
  const queryToken = cleanToken(new URL(req.url).searchParams.get('token'))
  let jsonParsed = false
  let bodyToken = ''
  let body: Record<string, unknown> = {}
  let raw = ''

  if (req.method !== 'GET') {
    raw = await req.text().catch(() => '')
    if (raw.length > 256 * 1024) {
      return {
        token: '',
        json_parsed: false,
        source: 'none',
        token_length: 0,
        body: {},
        raw: '',
        too_large: true,
      }
    }
    if (raw.trim()) {
      try {
        const parsed = JSON.parse(raw)
        jsonParsed = true
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          body = parsed as Record<string, unknown>
        }
        bodyToken = cleanToken(body.token)
      } catch {
        jsonParsed = false
        const quoted = raw.match(/"token"\s*:\s*"([^"]*)"/)
        const bare = raw.match(/"token"\s*:\s*([A-Za-z0-9_-]+)/)
        bodyToken = cleanToken(quoted?.[1] ?? bare?.[1] ?? '')
        const actionM = raw.match(/"action"\s*:\s*"?([A-Za-z]+)"?/)
        const reasonM = raw.match(/"declined_reason"\s*:\s*"([^"]*)"/)
        if (actionM?.[1]) body.action = actionM[1]
        if (reasonM?.[1]) body.declined_reason = reasonM[1]
      }
    }
  }

  if (bodyToken) {
    return { token: bodyToken, json_parsed: jsonParsed, source: 'body', token_length: bodyToken.length, body, raw }
  }
  if (queryToken) {
    return { token: queryToken, json_parsed: jsonParsed, source: 'query', token_length: queryToken.length, body, raw }
  }
  return { token: '', json_parsed: jsonParsed, source: 'none', token_length: 0, body, raw }
}

export function missingTokenError(_parsed: TokenParse) {
  return { error: 'Invalid or missing token' }
}
