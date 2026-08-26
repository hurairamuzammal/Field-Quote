/** Browser CORS for Bubble + landing. Never send `*` — echo an allowed Origin. */

const ALLOW_HEADERS = 'authorization, x-client-info, apikey, content-type'
const ALLOW_METHODS = 'GET, POST, PUT, PATCH, DELETE, OPTIONS'

function originHost(origin: string): string | null {
  try {
    const u = new URL(origin)
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null
    if (u.protocol === 'http:' && u.hostname !== 'localhost' && u.hostname !== '127.0.0.1') {
      return null
    }
    return u.hostname.toLowerCase()
  } catch {
    return null
  }
}

function extraAllowedOrigins(): string[] {
  const raw = [
    Deno.env.get('PUBLIC_LANDING_URL'),
    Deno.env.get('EMAIL_ASSET_BASE_URL'),
    Deno.env.get('CORS_ALLOWED_ORIGINS'),
  ]
    .filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
    .flatMap((s) => s.split(','))
    .map((s) => s.trim().replace(/\/$/, ''))
    .filter(Boolean)
  return raw
}

export function isAllowedOrigin(origin: string): boolean {
  const host = originHost(origin)
  if (!host) return false
  if (host === 'localhost' || host === '127.0.0.1') return true
  if (host === 'fieldquote-26446.bubbleapps.io') return true
  if (host === 'bubble.io' || host.endsWith('.bubble.io')) return true
  if (host.endsWith('.bubbleapps.io')) return true
  if (host.endsWith('.vercel.app')) return true
  const originNorm = origin.replace(/\/$/, '')
  return extraAllowedOrigins().some((allowed) => {
    try {
      return new URL(allowed).origin === originNorm || allowed === originNorm
    } catch {
      return allowed === originNorm
    }
  })
}

export function corsFor(req: Request): Record<string, string> {
  const origin = (req.headers.get('Origin') ?? '').trim()
  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers': ALLOW_HEADERS,
    'Access-Control-Allow-Methods': ALLOW_METHODS,
    Vary: 'Origin',
  }
  if (origin && isAllowedOrigin(origin)) {
    headers['Access-Control-Allow-Origin'] = origin
  }
  return headers
}

export function corsJson(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsFor(req), 'Content-Type': 'application/json' },
  })
}

export function corsPreflight(req: Request): Response {
  return new Response('ok', { headers: corsFor(req) })
}
