import { AwsClient } from 'https://esm.sh/aws4fetch@1.0.18'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { assertRateLimit, rateLimitResponse } from '../_shared/rate-limit.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } })

const EXT_MIME: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
  heic: 'image/heic', heif: 'image/heif',
  webm: 'audio/webm', m4a: 'audio/mp4', mp4: 'audio/mp4',
  mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', aac: 'audio/aac',
}

const MAX_BYTES: Record<string, number> = { photo: 10 * 1024 ** 2, audio: 20 * 1024 ** 2 }

const ALLOWED_GET_PREFIXES = ['requests/photos/', 'requests/audio/'] as const

const r2 = new AwsClient({
  accessKeyId: Deno.env.get('R2_ACCESS_KEY_ID')!,
  secretAccessKey: Deno.env.get('R2_SECRET_ACCESS_KEY')!,
  service: 's3',
  region: 'auto',
})
const bucket = Deno.env.get('R2_BUCKET') ?? Deno.env.get('R2_BUCKET_NAME')!
const BASE = `https://${Deno.env.get('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com/${bucket}`

function normalizeBearer(req: Request): string | null {
  // Bubble often sends "bearer …" (lowercase). Sometimes only the raw JWT is pasted.
  const raw = (req.headers.get('Authorization') ?? req.headers.get('authorization') ?? '').trim()
  if (!raw) return null
  const m = raw.match(/^bearer\s+(.+)$/i)
  if (m?.[1]?.trim()) return `Bearer ${m[1].trim()}`
  // Raw JWT pasted as the whole Authorization value
  if (raw.startsWith('eyJ')) return `Bearer ${raw}`
  return null
}

async function requireAdmin(req: Request): Promise<Response | null> {
  const authHeader = normalizeBearer(req)
  if (!authHeader) {
    return json({
      error: 'Missing Authorization Bearer token',
      hint: 'Set header Authorization to: Bearer <access_token> (one space after Bearer). In Bubble Initialize, fill access_token — empty param = this 401.',
    }, 401)
  }

  const userClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  )

  const { data: { user }, error: authError } = await userClient.auth.getUser()
  if (authError || !user) return json({ error: 'Invalid session' }, 401)

  const { data: profile, error: profileError } = await userClient
    .from('profiles')
    .select('role, active')
    .eq('id', user.id)
    .maybeSingle()

  if (profileError || !profile || profile.role !== 'admin' || profile.active === false) {
    return json({ error: 'Admin only' }, 403)
  }
  return null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const body = await req.json()
    const mode = String(body.mode ?? (body.key && !body.fileName ? 'get' : 'put')).toLowerCase()

    // ── Download (admin JWT) ──────────────────────────────────────────
    if (mode === 'get' || mode === 'download') {
      const denied = await requireAdmin(req)
      if (denied) return denied

      const key = String(body.key ?? '').trim()
      if (!key) return json({ error: 'key is required' }, 400)
      if (!ALLOWED_GET_PREFIXES.some((p) => key.startsWith(p))) {
        return json({ error: 'key not allowed' }, 400)
      }
      // No path traversal / odd keys
      if (key.includes('..') || key.startsWith('/') || key.includes('\\')) {
        return json({ error: 'invalid key' }, 400)
      }

      const signed = await r2.sign(
        new Request(`${BASE}/${key}`, { method: 'GET' }),
        { aws: { signQuery: true } },
      )

      return json({ url: signed.url, key })
    }

    // ── Upload (public intake — existing behaviour) ───────────────────
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !serviceKey) return json({ error: 'Server misconfigured' }, 500)
    const admin = createClient(supabaseUrl, serviceKey)
    const putLimit = await assertRateLimit(admin, {
      req,
      route: 'r2-presign-put',
      limit: 15,
      windowMs: 10 * 60 * 1000,
    })
    if (!putLimit.allowed) return rateLimitResponse(cors, putLimit.retryAfterSec)

    const { fileName, kind = 'photo', fileSize } = body

    const ext = String(fileName ?? '').split('.').pop()?.toLowerCase() ?? ''
    const mime = EXT_MIME[ext]
    if (!mime) return json({ error: 'Unsupported file type' }, 400)

    if (kind === 'photo' && !mime.startsWith('image/')) return json({ error: 'Expected an image' }, 400)
    if (kind === 'audio' && !mime.startsWith('audio/')) return json({ error: 'Expected audio' }, 400)
    if (fileSize && fileSize > (MAX_BYTES[kind] ?? MAX_BYTES.photo)) return json({ error: 'File too large' }, 400)

    const folder = kind === 'audio' ? 'requests/audio' : 'requests/photos'
    const objectKey = `${folder}/${crypto.randomUUID()}.${ext}`

    const signed = await r2.sign(
      new Request(`${BASE}/${objectKey}`, { method: 'PUT' }),
      { aws: { signQuery: true }, headers: {} },
    )

    return json({ url: signed.url, objectKey, mime })
  } catch (e) {
    return json({ error: 'Unexpected error' }, 500)
  }
})
