/** Shared request gates: method, JSON size, generic 500 (no stack traces). */

import { corsJson } from './cors.ts'

/** Default JSON body cap (256 KiB). `submit-request` uses a tighter cap of its own. */
export const MAX_JSON_BYTES = 256 * 1024

export function rejectWrongMethod(req: Request, allowed: readonly string[]): Response | null {
  if (allowed.includes(req.method)) return null
  return corsJson(req, { error: 'Method not allowed' }, 405)
}

export async function readJsonBody<T = Record<string, unknown>>(
  req: Request,
  maxBytes = MAX_JSON_BYTES,
): Promise<{ ok: true; value: T } | { ok: false; response: Response }> {
  const declared = req.headers.get('content-length')
  if (declared && Number(declared) > maxBytes) {
    return { ok: false, response: corsJson(req, { error: 'Payload too large' }, 413) }
  }

  const text = await req.text().catch(() => '')
  if (text.length > maxBytes) {
    return { ok: false, response: corsJson(req, { error: 'Payload too large' }, 413) }
  }
  if (!text.trim()) return { ok: true, value: {} as T }

  try {
    return { ok: true, value: JSON.parse(text) as T }
  } catch {
    return { ok: false, response: corsJson(req, { error: 'Invalid JSON' }, 400) }
  }
}

export function unexpectedError(req: Request): Response {
  return corsJson(req, { error: 'Unexpected error' }, 500)
}
