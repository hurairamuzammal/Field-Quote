import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { fetchSoleCompanyId } from '../_shared/company.ts'
import { corsFor, corsPreflight } from '../_shared/cors.ts'
import { assertRateLimit, rateLimitResponse } from '../_shared/rate-limit.ts'

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
  let mediaRaw = body.media
  if (typeof mediaRaw === 'string' && mediaRaw.trim()) {
    try {
      mediaRaw = JSON.parse(mediaRaw)
    } catch {
      // plain R2 key accidentally sent as string
      out.push({ r2_key: mediaRaw.trim(), kind: 'photo', size_bytes: 1 })
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

const EMAIL_LIMIT_PER_DAY = 3
const DAY_MS = 24 * 60 * 60 * 1000
const MAX_BODY_BYTES = 32 * 1024

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
    if (customer_phone.length > 40) {
      return json(req, { error: 'Phone is too long' }, 400)
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

    return json(req, {
      success: true,
      request_id: request.id,
      media_count: mediaItems.length,
    }, 200)
  } catch {
    return json(req, { error: 'Unexpected error' }, 500)
  }
})
