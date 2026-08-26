/**
 * Public company chrome (name + logo URL). No user JWT.
 * Returns only brand fields — never rates. Service role after IP rate limit.
 */
import { AwsClient } from 'https://esm.sh/aws4fetch@1.0.18'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { emailLogoUrl } from '../_shared/email-layout.ts'
import {
  companyLogoPublicUrl,
  fetchCompanyBrand,
  fetchSoleCompanyId,
} from '../_shared/company.ts'
import { corsFor, corsPreflight } from '../_shared/cors.ts'
import { assertRateLimit, rateLimitResponse } from '../_shared/rate-limit.ts'
import { rejectWrongMethod, unexpectedError } from '../_shared/http.ts'

const LOGO_KEY = /^companies\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/logo\//i

const json = (req: Request, b: unknown, s = 200) =>
  new Response(JSON.stringify(b), {
    status: s,
    headers: {
      ...corsFor(req),
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=60',
    },
  })

async function signedLogoGetUrl(key: string): Promise<string | null> {
  const account = Deno.env.get('R2_ACCOUNT_ID')
  const accessKeyId = Deno.env.get('R2_ACCESS_KEY_ID')
  const secretAccessKey = Deno.env.get('R2_SECRET_ACCESS_KEY')
  const bucket = Deno.env.get('R2_BUCKET') ?? Deno.env.get('R2_BUCKET_NAME')
  if (!account || !accessKeyId || !secretAccessKey || !bucket) return null
  if (!LOGO_KEY.test(key)) return null

  const r2 = new AwsClient({ accessKeyId, secretAccessKey, service: 's3', region: 'auto' })
  const base = `https://${account}.r2.cloudflarestorage.com/${bucket}`
  const signed = await r2.sign(
    new Request(`${base}/${key}?X-Amz-Expires=86400`, { method: 'GET' }),
    { aws: { signQuery: true } },
  )
  return signed.url
}

async function resolveLogoUrl(logoKey: string | null): Promise<string | null> {
  const publicUrl = companyLogoPublicUrl(logoKey)
  if (publicUrl) return publicUrl
  if (logoKey) {
    const signed = await signedLogoGetUrl(logoKey)
    if (signed) return signed
  }
  return emailLogoUrl()
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return corsPreflight(req)
  const wrong = rejectWrongMethod(req, ['GET'])
  if (wrong) return wrong

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !serviceKey) return json(req, { error: 'Server misconfigured' }, 500)

    const admin = createClient(supabaseUrl, serviceKey)
    const limit = await assertRateLimit(admin, {
      req,
      route: 'company-brand',
      limit: 60,
      windowMs: 60 * 1000,
    })
    if (!limit.allowed) return rateLimitResponse(corsFor(req), limit.retryAfterSec)

    const sole = await fetchSoleCompanyId(admin)
    if ('error' in sole) return json(req, { error: 'Brand unavailable' }, 500)

    const brandRes = await fetchCompanyBrand(admin, sole.company_id)
    if ('error' in brandRes) return json(req, { error: 'Brand unavailable' }, 500)

    const { company_id, name, logo_key } = brandRes.brand
    const logo_url = await resolveLogoUrl(logo_key)

    return json(req, { company_id, name, logo_key, logo_url })
  } catch {
    return unexpectedError(req)
  }
})
