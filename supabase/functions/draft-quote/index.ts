import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsFor, corsPreflight } from '../_shared/cors.ts'
import {
  bytesToBase64,
  getObject,
  mimeFromKey,
  signGetUrl,
} from '../_shared/r2-sign.ts'
import { transcribeAudio } from '../_shared/transcribe-audio.ts'
import { readJsonBody, unexpectedError } from '../_shared/http.ts'

const json = (req: Request, b: unknown, s = 200) =>
  new Response(JSON.stringify(b), {
    status: s,
    headers: { ...corsFor(req), 'Content-Type': 'application/json' },
  })

const round2 = (n: number) => Math.round((Number(n) + Number.EPSILON) * 100) / 100

/**
 * Primary: Z.AI GLM free vision Flash — best for small/test audiences (no $/token;
 * throughput ~1 concurrent / ~1 rps, not a hard daily cap). Override with ZAI_MODEL.
 * Docs: https://docs.z.ai/guides/overview/pricing
 */
const DEFAULT_ZAI_MODEL = 'glm-4.6v-flash'
/** Free text Flash — preferred when no photos (JSON drafts). Override with ZAI_TEXT_MODEL. */
const DEFAULT_ZAI_TEXT_MODEL = 'glm-4.5-flash'
/** Fallback: OpenRouter Gemini Flash (cheap + vision). Override with OPENROUTER_MODEL. */
const DEFAULT_OPENROUTER_MODEL = 'google/gemini-2.0-flash-001'

type BookItem = {
  id: string
  name: string
  category: string
  unit: string
  unit_price: number | string
  keywords: string
}

type ModelLine = {
  price_book_item_id?: string | null
  label?: string
  qty?: number
  unit_price?: unknown
}

type ModelDraft = {
  line_items?: ModelLine[]
  assumptions?: string[]
  clarifying_questions?: string[]
  /** Model may send the enum or a float; normalizeConfidence() handles both. */
  confidence?: unknown
}

type ImagePart = {
  url: string
  media_type?: string
  /** How the bytes reached the model. Not sent in the chat payload. */
  delivery?: 'inline' | 'url'
}

/** GLM vision cap is 5 MB/image after encoding; leave headroom for base64. */
const MAX_INLINE_IMAGE_BYTES = 3.5 * 1024 * 1024
const MAX_INLINE_TOTAL_BYTES = 10 * 1024 * 1024
const INLINE_IMAGE_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
/** GLM vision does not accept HEIC/SVG; a bad part can fail the whole call. */
const SKIP_VISION_MIME = new Set(['image/heic', 'image/heif', 'image/svg+xml'])

function normalizeBearer(req: Request): string | null {
  const raw = (req.headers.get('Authorization') ?? req.headers.get('authorization') ?? '').trim()
  if (!raw) return null
  const m = raw.match(/^bearer\s+(.+)$/i)
  if (m?.[1]?.trim()) return `Bearer ${m[1].trim()}`
  if (raw.startsWith('eyJ')) return `Bearer ${raw}`
  return null
}

/** GLM vision/thinking models often wrap the answer in these tags. */
function stripModelWrappers(text: string): string {
  let t = text.trim()
  // Drop thinking blocks (may leave JSON after)
  t = t.replace(/<think>[\s\S]*?<\/think>/gi, '')
  t = t.replace(/<\|begin_of_box\|>([\s\S]*?)<\|end_of_box\|>/gi, '$1')
  return t.trim()
}

/** Z.AI / OpenRouter may return content as a string or as multimodal parts[]. */
function normalizeMessageContent(content: unknown): string {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') return part
        if (!part || typeof part !== 'object') return ''
        const p = part as Record<string, unknown>
        if (typeof p.text === 'string') return p.text
        if (typeof p.content === 'string') return p.content
        return ''
      })
      .filter(Boolean)
      .join('\n')
  }
  return ''
}

function extractJsonObject(text: string): ModelDraft {
  const trimmed = stripModelWrappers(text)
  try {
    return JSON.parse(trimmed) as ModelDraft
  } catch {
    /* try fenced or embedded object */
  }
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence?.[1]) {
    return JSON.parse(fence[1].trim()) as ModelDraft
  }
  const start = trimmed.indexOf('{')
  const end = trimmed.lastIndexOf('}')
  if (start >= 0 && end > start) {
    return JSON.parse(trimmed.slice(start, end + 1)) as ModelDraft
  }
  throw new Error(`Model response was not valid JSON: ${trimmed.slice(0, 200)}`)
}

function buildMessages(args: {
  description: string
  book: BookItem[]
  images?: ImagePart[]
  reinforceJson?: boolean
}) {
  const system = [
    'You are an electrician / HVAC field-service quoting assistant.',
    'Match work ONLY to items in the provided price book (use their exact id UUID).',
    'If nothing matches, still return line_items with price_book_item_id null and a clear label.',
    'ALWAYS return at least one line_item. Never return an empty line_items array.',
    'Never invent price book ids. Never set prices — omit unit_price entirely.',
    'Prefer matching keywords/name/category when the request clearly fits an item.',
    'If photos are attached, they are the customer site photos — use them only to understand the work, still match price book ids only.',
    'If a voice-note transcription is included, treat that raw dictation as the customer speaking about the job.',
    'Return ONLY a JSON object (no markdown) with this shape:',
    JSON.stringify({
      line_items: [{ price_book_item_id: 'uuid|null', label: 'string', qty: 1 }],
      assumptions: ['string'],
      clarifying_questions: ['string'],
      confidence: 'high|med|low',
    }),
  ].join(' ')

  const bookCompact = args.book.map((b) => ({
    id: b.id,
    name: b.name,
    category: b.category,
    unit: b.unit,
    unit_price: b.unit_price,
    keywords: b.keywords,
  }))

  let text = [
    'Customer request description:',
    args.description,
    '',
    'Active price book (JSON):',
    JSON.stringify(bookCompact),
  ].join('\n')

  if (args.reinforceJson) {
    text += '\n\nIMPORTANT: Reply with ONLY valid JSON matching the schema. No markdown.'
  }

  const images = args.images?.filter((i) => i.url?.trim()) ?? []
  if (images.length) {
    text += `\n\n${images.length} site photo(s) are attached as images in this message. Use them to understand the work.`
  }
  if (!images.length) {
    return [
      { role: 'system', content: system },
      { role: 'user', content: text },
    ]
  }

  // OpenAI-compatible multimodal content (Z.AI + OpenRouter)
  const content: Array<Record<string, unknown>> = [{ type: 'text', text }]
  for (const img of images.slice(0, 5)) {
    content.push({
      type: 'image_url',
      image_url: { url: img.url },
    })
  }

  return [
    { role: 'system', content: system },
    { role: 'user', content },
  ]
}

async function callChatCompletions(args: {
  provider: 'zai' | 'openrouter'
  apiKey: string
  model: string
  description: string
  book: BookItem[]
  images?: ImagePart[]
  reinforceJson?: boolean
}): Promise<{ parsed: ModelDraft; raw: unknown; model: string; provider: string }> {
  const messages = buildMessages(args)
  // Vision GLM docs show thinking enabled; text Flash can disable for cleaner JSON.
  const isVisionModel = /v[-.]|vlm/i.test(args.model) || /4\.6v|4\.5v|5v/i.test(args.model)
  const body: Record<string, unknown> = {
    model: args.model,
    temperature: 0.2,
    messages,
  }
  if (args.provider === 'zai' && !isVisionModel) {
    body.thinking = { type: 'disabled' }
  }

  // Z.AI OpenAI-compatible: https://api.z.ai/api/paas/v4/chat/completions
  const url = args.provider === 'zai'
    ? (Deno.env.get('ZAI_BASE_URL')?.replace(/\/$/, '') ||
      'https://api.z.ai/api/paas/v4/chat/completions')
    : 'https://openrouter.ai/api/v1/chat/completions'

  const headers: Record<string, string> = {
    Authorization: `Bearer ${args.apiKey}`,
    'Content-Type': 'application/json',
  }
  if (args.provider === 'openrouter') {
    headers['HTTP-Referer'] = 'https://fieldquote-26446.bubbleapps.io'
    headers['X-Title'] = 'FieldQuote draft-quote'
  }

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })

  const raw = await res.json().catch(() => ({}))
  if (!res.ok) {
    const label = args.provider === 'zai' ? 'Z.AI' : 'OpenRouter'
    throw new Error(`${label} ${res.status}: ${JSON.stringify(raw).slice(0, 400)}`)
  }

  const message = raw?.choices?.[0]?.message ?? {}
  let text = normalizeMessageContent(message.content)
  // Some GLM responses put the answer only in reasoning_content / leave content blank
  if (!text.trim()) {
    text = normalizeMessageContent(message.reasoning_content)
  }
  if (!text.trim()) {
    throw new Error(
      `${args.provider} returned empty content: ${JSON.stringify(message).slice(0, 300)}`,
    )
  }

  const modelUsed = typeof raw?.model === 'string' ? raw.model : args.model
  return {
    parsed: extractJsonObject(text),
    raw,
    model: `${args.provider}:${modelUsed}`,
    provider: args.provider,
  }
}

/** Try Z.AI first; on any failure / rate limit → OpenRouter. */
async function draftWithFailover(args: {
  zaiKey: string | undefined
  zaiModel: string
  zaiTextModel: string
  openRouterKey: string | undefined
  openRouterModel: string
  description: string
  book: BookItem[]
  images?: ImagePart[]
}): Promise<{
  parsed: ModelDraft
  raw: unknown
  model: string
  provider: string
  fallback_from?: string
  zai_error?: string
}> {
  const attempts: string[] = []
  const hasImages = (args.images?.length ?? 0) > 0
  // Text-only → free text Flash (more reliable JSON). Photos → vision model.
  const zaiModel = hasImages ? args.zaiModel : args.zaiTextModel

  if (args.zaiKey) {
    try {
      const first = await callChatCompletions({
        provider: 'zai',
        apiKey: args.zaiKey,
        model: zaiModel,
        description: args.description,
        book: args.book,
        images: args.images,
      })
      return first
    } catch (e1) {
      const msg = String(e1)
      attempts.push(`zai: ${msg}`)
      // Auth / hard client errors — don't burn a second identical call
      const noRetry = /\b401\b|\b403\b|token expired|incorrect|invalid api/i.test(msg)
      if (!noRetry) {
        try {
          const retry = await callChatCompletions({
            provider: 'zai',
            apiKey: args.zaiKey,
            model: zaiModel,
            description: args.description,
            book: args.book,
            images: args.images,
            reinforceJson: true,
          })
          return retry
        } catch (e1b) {
          attempts.push(`zai-retry: ${String(e1b)}`)
        }
      }
    }
  } else {
    attempts.push('zai: ZAI_API_KEY not set')
  }

  const zaiError = attempts.filter((a) => a.startsWith('zai')).join(' | ') || undefined

  if (args.openRouterKey) {
    try {
      const fb = await callChatCompletions({
        provider: 'openrouter',
        apiKey: args.openRouterKey,
        model: args.openRouterModel,
        description: args.description,
        book: args.book,
        images: args.images,
      })
      return { ...fb, fallback_from: 'zai', zai_error: zaiError }
    } catch (e2) {
      attempts.push(`openrouter: ${String(e2)}`)
      try {
        const fb2 = await callChatCompletions({
          provider: 'openrouter',
          apiKey: args.openRouterKey,
          model: args.openRouterModel,
          description: args.description,
          book: args.book,
          images: args.images,
          reinforceJson: true,
        })
        return { ...fb2, fallback_from: 'zai', zai_error: zaiError }
      } catch (e2b) {
        attempts.push(`openrouter-retry: ${String(e2b)}`)
      }
    }
  } else {
    attempts.push('openrouter: OPENROUTER_API_KEY not set')
  }

  throw new Error(`AI draft failed all providers. ${attempts.join(' | ')}`)
}

/** §6.1 confidence is an enum, not a float. Accept either shape from the model. */
function normalizeConfidence(raw: unknown): 'high' | 'med' | 'low' {
  if (typeof raw === 'string') {
    const s = raw.trim().toLowerCase()
    if (s.startsWith('high')) return 'high'
    if (s.startsWith('med')) return 'med'
    if (s.startsWith('low')) return 'low'
  }
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    // Models return either 0–1 or 0–100; normalise both.
    const n = raw > 1 ? raw / 100 : raw
    if (n >= 0.75) return 'high'
    if (n >= 0.45) return 'med'
    return 'low'
  }
  // Unknown → the cautious end, so a vague draft never looks confident.
  return 'low'
}

/**
 * §6.1: up to 5 request photos go to the model with the text.
 *
 * Bytes are fetched from R2 here and inlined as `data:image/...;base64,...`
 * whenever they fit. That is what actually puts pixels in the model request —
 * a signed URL only *points* at R2 and the provider still has to fetch it
 * (Z.AI often cannot reach Cloudflare). Too-large jpeg/png/webp files fall
 * back to a signed URL. HEIC/SVG are skipped (GLM vision rejects them).
 * Any failure degrades to fewer photos or text-only — a missing photo must
 * never block quoting.
 */
async function loadRequestPhotos(
  admin: SupabaseClient,
  requestId: string,
): Promise<{
  urls: ImagePart[]
  total: number
  inlined: number
  via_url: number
  note?: string
}> {
  const { data, error } = await admin
    .from('request_media')
    .select('r2_key')
    .eq('request_id', requestId)
    .eq('kind', 'photo')
    .order('created_at', { ascending: true })
    .limit(5)

  if (error) {
    console.error('loadRequestPhotos:', error.message)
    return { urls: [], total: 0, inlined: 0, via_url: 0, note: 'media_query_failed' }
  }

  const keys = (data ?? [])
    .map((r) => String(r.r2_key ?? '').trim())
    .filter(Boolean)
  if (!keys.length) return { urls: [], total: 0, inlined: 0, via_url: 0 }

  const parts: ImagePart[] = []
  let inlineUsed = 0

  const loaded = await Promise.all(keys.map(async (key) => {
    const obj = await getObject(key)
    const signed = await signGetUrl(key, 600)
    return { key, obj, signed }
  }))

  for (const item of loaded) {
    const mime = (item.obj?.contentType || mimeFromKey(item.key)).split(';')[0].trim().toLowerCase()
    if (SKIP_VISION_MIME.has(mime)) continue

    const bytes = item.obj?.bytes
    const canInline = Boolean(
      bytes &&
        bytes.length > 0 &&
        bytes.length <= MAX_INLINE_IMAGE_BYTES &&
        inlineUsed + bytes.length <= MAX_INLINE_TOTAL_BYTES &&
        INLINE_IMAGE_MIME.has(mime),
    )

    if (canInline && bytes) {
      parts.push({
        url: `data:${mime};base64,${bytesToBase64(bytes)}`,
        media_type: mime,
        delivery: 'inline',
      })
      inlineUsed += bytes.length
      continue
    }

    if (item.signed) {
      parts.push({ url: item.signed, media_type: mime || undefined, delivery: 'url' })
    }
  }

  if (!parts.length) {
    console.error('loadRequestPhotos: no photo could be inlined or signed; text-only draft')
    return { urls: [], total: keys.length, inlined: 0, via_url: 0, note: 'undeliverable' }
  }

  return {
    urls: parts,
    total: keys.length,
    inlined: parts.filter((p) => p.delivery === 'inline').length,
    via_url: parts.filter((p) => p.delivery === 'url').length,
  }
}

function foldDictationIntoDescription(typed: string, transcript: string | null): string {
  const description = typed.trim()
  const dictation = (transcript ?? '').trim()
  if (!dictation) return description
  if (!description) return `Voice note transcription (raw dictation):\n${dictation}`

  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim()
  if (norm(description) === norm(dictation)) return description
  if (norm(description).includes(norm(dictation))) return description

  return `${description}\n\nVoice note transcription (raw dictation):\n${dictation}`
}

async function transcribeRequestAudio(
  admin: SupabaseClient,
  requestId: string,
): Promise<{ text: string | null; provider: string | null; note: string; available: number }> {
  const { data, error } = await admin
    .from('request_media')
    .select('r2_key')
    .eq('request_id', requestId)
    .eq('kind', 'audio')
    .order('created_at', { ascending: true })
    .limit(1)

  if (error) {
    console.error('transcribeRequestAudio:', error.message)
    return { text: null, provider: null, note: 'media_query_failed', available: 0 }
  }

  const key = String(data?.[0]?.r2_key ?? '').trim()
  if (!key) return { text: null, provider: null, note: 'no_audio', available: 0 }

  const obj = await getObject(key)
  if (!obj) return { text: null, provider: null, note: 'fetch_failed', available: 1 }

  const result = await transcribeAudio({ bytes: obj.bytes, key, contentType: obj.contentType })
  return { ...result, available: 1 }
}

function applyGuardrail(parsed: ModelDraft, bookById: Map<string, BookItem>) {
  const assumptions = Array.isArray(parsed.assumptions)
    ? parsed.assumptions.filter((x) => typeof x === 'string')
    : []
  const clarifying_questions = Array.isArray(parsed.clarifying_questions)
    ? parsed.clarifying_questions.filter((x) => typeof x === 'string')
    : []
  const confidence = normalizeConfidence(parsed.confidence)

  const linesIn = Array.isArray(parsed.line_items) ? parsed.line_items : []
  const lines = linesIn.map((line) => {
    const rawId = line.price_book_item_id
    const id = typeof rawId === 'string' && rawId.trim() ? rawId.trim() : null
    let qty = Number(line.qty)
    if (!Number.isFinite(qty) || qty <= 0) qty = 1
    qty = round2(qty)

    const book = id ? bookById.get(id) : undefined
    if (book) {
      return {
        price_book_item_id: book.id,
        label: (typeof line.label === 'string' && line.label.trim()) || book.name,
        qty,
        unit_price: round2(Number(book.unit_price)),
        overridden: false,
        // §6.1: where the number came from. Always the book here — the model's
        // own unit_price was discarded above, whatever it said.
        unit_price_source: 'price_book' as const,
      }
    }
    // Unknown / null id → needs manual pricing. Discard any model price.
    return {
      price_book_item_id: null as string | null,
      label: (typeof line.label === 'string' && line.label.trim()) || 'Needs manual pricing',
      qty,
      unit_price: null as number | null,
      overridden: false,
      unit_price_source: 'needs_manual_pricing' as const,
    }
  })

  return { lines, assumptions, clarifying_questions, confidence }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return corsPreflight(req)
  if (req.method !== 'POST') return json(req, { error: 'Method not allowed' }, 405)

  try {
    const authHeader = normalizeBearer(req)
    if (!authHeader) {
      return json(req, {
        error: 'Missing Authorization Bearer token',
        hint: 'Authorization: Bearer <admin access_token>',
      }, 401)
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const zaiKey = Deno.env.get('ZAI_API_KEY') ?? Deno.env.get('Z_AI_API_KEY')
    const zaiModel = Deno.env.get('ZAI_MODEL') ?? DEFAULT_ZAI_MODEL
    const zaiTextModel = Deno.env.get('ZAI_TEXT_MODEL') ?? DEFAULT_ZAI_TEXT_MODEL
    const openRouterKey = Deno.env.get('OPENROUTER_API_KEY')
    const openRouterModel = Deno.env.get('OPENROUTER_MODEL') ?? DEFAULT_OPENROUTER_MODEL

    if (!zaiKey && !openRouterKey) {
      return json(req, {
        error: 'No AI key configured',
        hint: 'Set ZAI_API_KEY (primary, Z.AI GLM) and/or OPENROUTER_API_KEY (fallback)',
      }, 500)
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const admin = createClient(supabaseUrl, serviceKey)

    const { data: { user }, error: authError } = await userClient.auth.getUser()
    if (authError || !user) return json(req, { error: 'Invalid session' }, 401)

    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('role, active, company_id')
      .eq('id', user.id)
      .maybeSingle()

    if (profileError || !profile || profile.role !== 'admin' || profile.active === false) {
      return json(req, { error: 'Admin only' }, 403)
    }

    const parsedBody = await readJsonBody<{ request_id?: string; image_urls?: unknown }>(req)
    if (!parsedBody.ok) return parsedBody.response
    const body = parsedBody.value
    const requestId = typeof body.request_id === 'string' ? body.request_id.trim() : ''
    if (!requestId) return json(req, { error: 'request_id is required' }, 400)

    // Explicit override, for testing a specific set of images.
    const overrideImages = Array.isArray(body.image_urls)
      ? body.image_urls
        .filter((u: unknown) => typeof u === 'string' && u.trim())
        .map((u: string) => ({ url: u.trim() }))
        .slice(0, 5)
      : []

    const { data: requestRow, error: requestError } = await admin
      .from('requests')
      .select(
        'id, company_id, description, customer_name, customer_email, customer_phone, customer_address, preferred_timing, status',
      )
      .eq('id', requestId)
      .maybeSingle()

    if (requestError) return json(req, { error: requestError.message }, 500)
    if (!requestRow) return json(req, { error: 'Request not found' }, 404)
    if (profile.company_id && requestRow.company_id !== profile.company_id) {
      return json(req, { error: 'Request not in your company' }, 403)
    }
    // Only brand-new requests get an AI draft. Quoted/archived must open the existing quote.
    if (requestRow.status !== 'new') {
      return json(req, {
        error: requestRow.status === 'quoted'
          ? 'Request already quoted'
          : `Request status is ${requestRow.status}; only new requests can be drafted`,
        status: requestRow.status,
      }, 409)
    }

    const companyId = requestRow.company_id as string

    const { data: bookRows, error: bookError } = await admin
      .from('price_book_items')
      .select('id, name, category, unit, unit_price, keywords')
      .eq('company_id', companyId)
      .eq('active', true)
      .order('category', { ascending: true })
      .order('name', { ascending: true })

    if (bookError) return json(req, { error: bookError.message }, 500)
    const book = (bookRows ?? []) as BookItem[]
    if (!book.length) return json(req, { error: 'No active price book items' }, 400)

    const bookById = new Map(book.map((b) => [b.id, b]))

    // §6.1: request text + voice dictation + up to 5 photos + price book.
    const photos = overrideImages.length
      ? {
        urls: overrideImages,
        total: overrideImages.length,
        inlined: 0,
        via_url: overrideImages.length,
        note: 'override' as string | undefined,
      }
      : await loadRequestPhotos(admin, requestId)
    const imageUrls = photos.urls

    const audio = await transcribeRequestAudio(admin, requestId)
    const descriptionForModel = foldDictationIntoDescription(
      String(requestRow.description ?? ''),
      audio.text,
    )

    let parsed: ModelDraft
    let raw: unknown
    let modelUsed: string
    let providerUsed: string
    let fallbackFrom: string | undefined
    let zaiError: string | undefined
    try {
      const result = await draftWithFailover({
        zaiKey,
        zaiModel,
        zaiTextModel,
        openRouterKey,
        openRouterModel,
        description: descriptionForModel,
        book,
        images: imageUrls,
      })
      parsed = result.parsed
      raw = result.raw
      modelUsed = result.model
      providerUsed = result.provider
      fallbackFrom = result.fallback_from
      zaiError = result.zai_error
    } catch {
      return json(req, { error: 'AI draft failed' }, 502)
    }

    const { lines: guardedLines, assumptions, clarifying_questions, confidence } = applyGuardrail(
      parsed,
      bookById,
    )

    // Never block the draft on an empty model array — fall back to one unpriced line
    const lines = guardedLines.length
      ? guardedLines
      : [{
        price_book_item_id: null as string | null,
        label: `Needs manual pricing: ${descriptionForModel.slice(0, 120)}`,
        qty: 1,
        unit_price: null as number | null,
        overridden: false,
        unit_price_source: 'needs_manual_pricing' as const,
      }]

    const { data: settings, error: settingsError } = await admin
      .from('company_settings')
      .select('deposit_pct, tax_pct')
      .eq('company_id', companyId)
      .maybeSingle()

    if (settingsError) return json(req, { error: settingsError.message }, 500)
    if (!settings) return json(req, { error: 'company_settings missing' }, 500)

    const depositPct = round2(Number(settings.deposit_pct))
    const taxPct = round2(Number(settings.tax_pct))

    let subtotal = 0
    for (const line of lines) {
      if (line.unit_price != null) subtotal += line.qty * line.unit_price
    }
    subtotal = round2(subtotal)
    const taxAmount = round2(subtotal * (taxPct / 100))
    const total = round2(subtotal + taxAmount)
    const depositAmount = round2(total * (depositPct / 100))
    const needsManualPricing = lines.some((l) => l.unit_price == null)

    const notesParts = [
      audio.text ? `Voice dictation (transcribed):\n${audio.text}` : '',
      assumptions.length ? `Assumptions:\n- ${assumptions.join('\n- ')}` : '',
      clarifying_questions.length
        ? `Clarifying questions:\n- ${clarifying_questions.join('\n- ')}`
        : '',
    ].filter(Boolean)

    const { data: quote, error: quoteError } = await admin
      .from('quotes')
      .insert({
        company_id: companyId,
        request_id: requestId,
        status: 'draft',
        subtotal,
        tax_amount: taxAmount,
        total,
        deposit_amount: depositAmount,
        deposit_pct: depositPct,
        tax_pct: taxPct,
        ai_generated: true,
        ai_model: modelUsed,
        ai_raw: raw,
        internal_notes: notesParts.join('\n\n') || null,
        needs_manual_pricing: needsManualPricing,
      })
      .select('id')
      .single()

    if (quoteError || !quote) {
      return json(req, { error: quoteError?.message ?? 'Failed to insert quote' }, 500)
    }

    const lineRows = lines.map((l) => ({
      company_id: companyId,
      quote_id: quote.id,
      price_book_item_id: l.price_book_item_id,
      label: l.label,
      qty: l.qty,
      unit_price: l.unit_price,
      overridden: false,
    }))

    const { data: insertedLines, error: linesError } = await admin
      .from('quote_line_items')
      .insert(lineRows)
      .select('id, price_book_item_id, label, qty, unit_price, overridden')

    if (linesError) {
      await admin.from('quotes').delete().eq('id', quote.id)
      return json(req, { error: linesError.message }, 500)
    }

    if (requestRow.status === 'new') {
      await admin.from('requests').update({ status: 'quoted' }).eq('id', requestId)
    }

    return json(req, {
      quote_id: quote.id,
      line_items: (insertedLines ?? []).map((l) => ({
        ...l,
        unit_price_source: l.price_book_item_id ? 'price_book' : 'needs_manual_pricing',
      })),
      assumptions,
      clarifying_questions,
      confidence,
      needs_manual_pricing: needsManualPricing,
      subtotal,
      tax_amount: taxAmount,
      total,
      deposit_amount: depositAmount,
      deposit_pct: depositPct,
      tax_pct: taxPct,
      ai_model: modelUsed,
      ai_provider: providerUsed,
      ai_fallback: Boolean(fallbackFrom),
      zai_error: zaiError ?? null,
      // Lets the admin UI say "drafted from 3 photos" — and makes a silent
      // degrade to text-only visible instead of invisible.
      photos_used: imageUrls.length,
      photos_available: photos.total,
      photos_inlined: photos.inlined,
      photos_via_url: photos.via_url,
      photos_note: photos.note ?? null,
      audio_available: audio.available,
      audio_transcribed: Boolean(audio.text),
      audio_transcription: audio.text,
      audio_stt_provider: audio.provider,
      audio_note: audio.note,
    })
  } catch {
    return unexpectedError(req)
  }
})
