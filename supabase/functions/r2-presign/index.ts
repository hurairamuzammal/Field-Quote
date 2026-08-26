import { AwsClient } from 'https://esm.sh/aws4fetch@1.0.18'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsFor, corsPreflight } from '../_shared/cors.ts'
import { assertRateLimit, rateLimitResponse } from '../_shared/rate-limit.ts'
import { readJsonBody, rejectWrongMethod } from '../_shared/http.ts'

const json = (req: Request, b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsFor(req), 'Content-Type': 'application/json' } })

const EXT_MIME: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
  svg: 'image/svg+xml',
  heic: 'image/heic', heif: 'image/heif',
  webm: 'audio/webm', m4a: 'audio/mp4', mp4: 'audio/mp4',
  mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', aac: 'audio/aac',
}

const MAX_BYTES: Record<string, number> = {
  photo: 10 * 1024 ** 2,
  audio: 20 * 1024 ** 2,
  logo: 10 * 1024 ** 2,
}

const ALLOWED_GET_PREFIXES = ['requests/photos/', 'requests/audio/'] as const
const LOGO_GET_KEY = /^companies\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/logo\//i
const LOGO_EXTS = new Set(['jpg', 'jpeg', 'png', 'webp', 'svg'])

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

const JOB_KEY = /^jobs\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/photos\//i

type Staff = { userId: string; role: string; active: boolean; companyId: string | null }

async function getStaff(req: Request): Promise<{ ok: true; staff: Staff; authHeader: string } | { ok: false; response: Response }> {
  const authHeader = normalizeBearer(req)
  if (!authHeader) {
    return {
      ok: false,
      response: json(req, {
        error: 'Missing Authorization Bearer token',
        hint: 'Set header Authorization to: Bearer <access_token> (one space after Bearer).',
      }, 401),
    }
  }

  const userClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  )
  const { data: { user }, error: authError } = await userClient.auth.getUser()
  if (authError || !user) return { ok: false, response: json(req, { error: 'Invalid session' }, 401) }

  const { data: profile, error: profileError } = await userClient
    .from('profiles')
    .select('role, active, company_id')
    .eq('id', user.id)
    .maybeSingle()

  if (profileError || !profile || profile.active === false) {
    return { ok: false, response: json(req, { error: 'Not allowed' }, 403) }
  }
  if (profile.role !== 'admin' && profile.role !== 'technician') {
    return { ok: false, response: json(req, { error: 'Not allowed' }, 403) }
  }

  return {
    ok: true,
    staff: {
      userId: user.id,
      role: profile.role,
      active: profile.active,
      companyId: (profile.company_id as string | null) ?? null,
    },
    authHeader,
  }
}

async function requireAdmin(req: Request): Promise<Response | null> {
  const staff = await getStaff(req)
  if (!staff.ok) return staff.response
  if (staff.staff.role !== 'admin') return json(req, { error: 'Admin only' }, 403)
  return null
}

async function canAccessJob(jobId: string, staff: Staff): Promise<boolean> {
  const url = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !serviceKey) return false
  const admin = createClient(url, serviceKey)
  const { data } = await admin.from('jobs').select('id, technician_id').eq('id', jobId).maybeSingle()
  if (!data) return false
  if (staff.role === 'admin') return true
  return data.technician_id === staff.userId
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return corsPreflight(req)
  const wrong = rejectWrongMethod(req, ['POST'])
  if (wrong) return wrong

  try {
    const parsed = await readJsonBody<Record<string, unknown>>(req)
    if (!parsed.ok) return parsed.response
    const body = parsed.value
    const mode = String(body.mode ?? (body.key && !body.fileName ? 'get' : 'put')).toLowerCase()

    // ── Download ──────────────────────────────────────────────────────
    if (mode === 'get' || mode === 'download') {
      const key = String(body.key ?? '').trim()
      if (!key) return json(req, { error: 'key is required' }, 400)
      if (key.includes('..') || key.startsWith('/') || key.includes('\\')) {
        return json(req, { error: 'invalid key' }, 400)
      }

      const jobMatch = key.match(JOB_KEY)
      if (jobMatch) {
        const staff = await getStaff(req)
        if (!staff.ok) return staff.response
        if (!(await canAccessJob(jobMatch[1], staff.staff))) {
          return json(req, { error: 'key not allowed' }, 403)
        }
      } else if (LOGO_GET_KEY.test(key)) {
        const staff = await getStaff(req)
        if (!staff.ok) return staff.response
      } else {
        const denied = await requireAdmin(req)
        if (denied) return denied
        if (!ALLOWED_GET_PREFIXES.some((p) => key.startsWith(p))) {
          return json(req, { error: 'key not allowed' }, 400)
        }
      }

      const signed = await r2.sign(
        new Request(`${BASE}/${key}`, { method: 'GET' }),
        { aws: { signQuery: true } },
      )

      return json(req, { url: signed.url, key })
    }

    // ── Upload ────────────────────────────────────────────────────────
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !serviceKey) return json(req, { error: 'Server misconfigured' }, 500)
    const admin = createClient(supabaseUrl, serviceKey)
    const putLimit = await assertRateLimit(admin, {
      req,
      route: 'r2-presign-put',
      limit: 60,
      windowMs: 10 * 60 * 1000,
    })
    if (!putLimit.allowed) return rateLimitResponse(corsFor(req), putLimit.retryAfterSec)

    const { fileName, kind = 'photo', fileSize } = body
    const jobId = typeof body.job_id === 'string' ? body.job_id.trim() : ''

    const ext = String(fileName ?? '').split('.').pop()?.toLowerCase() ?? ''
    const mime = EXT_MIME[ext]
    if (!mime) return json(req, { error: 'Unsupported file type' }, 400)

    if (kind === 'photo' && !mime.startsWith('image/')) return json(req, { error: 'Expected an image' }, 400)
    if (kind === 'logo') {
      if (!LOGO_EXTS.has(ext) || !mime.startsWith('image/')) {
        return json(req, { error: 'Logo must be jpg, png, webp, or svg' }, 400)
      }
    }
    if (kind === 'audio' && !mime.startsWith('audio/')) return json(req, { error: 'Expected audio' }, 400)
    if (fileSize && Number(fileSize) > (MAX_BYTES[String(kind)] ?? MAX_BYTES.photo)) {
      return json(req, { error: 'File too large' }, 400)
    }

    let objectKey: string
    if (kind === 'logo') {
      const staff = await getStaff(req)
      if (!staff.ok) return staff.response
      if (staff.staff.role !== 'admin') return json(req, { error: 'Admin only' }, 403)
      if (!staff.staff.companyId) return json(req, { error: 'No company on profile' }, 400)
      objectKey = `companies/${staff.staff.companyId}/logo/${crypto.randomUUID()}.${ext}`
    } else if (jobId) {
      if (kind !== 'photo') return json(req, { error: 'Job uploads must be photos' }, 400)
      const staff = await getStaff(req)
      if (!staff.ok) return staff.response
      if (!(await canAccessJob(jobId, staff.staff))) {
        return json(req, { error: 'Job not found' }, 403)
      }
      objectKey = `jobs/${jobId}/photos/${crypto.randomUUID()}.${ext}`
    } else {
      const folder = kind === 'audio' ? 'requests/audio' : 'requests/photos'
      objectKey = `${folder}/${crypto.randomUUID()}.${ext}`
    }

    const signed = await r2.sign(
      new Request(`${BASE}/${objectKey}`, { method: 'PUT' }),
      { aws: { signQuery: true }, headers: {} },
    )

    return json(req, { url: signed.url, objectKey, mime })
  } catch (e) {
    return json(req, { error: 'Unexpected error' }, 500)
  }
})
