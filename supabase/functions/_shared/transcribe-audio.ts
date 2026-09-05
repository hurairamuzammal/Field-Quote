/**
 * Speech-to-text for intake voice notes.
 *
 * Browser recordings are usually webm/m4a. Z.AI GLM-ASR only documents wav/mp3
 * (and caps at 30s), so OpenRouter Whisper is the practical path for FieldQuote
 * audio. Z.AI is tried first when the file is wav/mp3 so we don't spend the
 * fallback key on a format it already handles.
 *
 * Never throws — a failed transcript must not block quoting.
 */
import { bytesToBase64, extOfKey } from './r2-sign.ts'

const DEFAULT_ZAI_ASR_MODEL = 'glm-asr-2512'
const DEFAULT_OPENROUTER_STT_MODEL = 'openai/whisper-1'
const MAX_AUDIO_BYTES = 24 * 1024 * 1024
const STT_TIMEOUT_MS = 45_000

const ZAI_ASR_EXTS = new Set(['wav', 'mp3'])
const OPENROUTER_STT_EXTS = new Set(['wav', 'mp3', 'flac', 'm4a', 'ogg', 'webm', 'aac', 'mp4'])

export type TranscribeResult = {
  text: string | null
  provider: string | null
  note: string
}

function audioFormatFromKey(key: string): string {
  const ext = extOfKey(key)
  if (ext === 'mp4') return 'm4a'
  if (OPENROUTER_STT_EXTS.has(ext)) return ext
  return 'webm'
}

function filenameFromKey(key: string): string {
  return key.split('?')[0].split('/').pop() || `audio.${audioFormatFromKey(key)}`
}

function zaiApiRoot(): string {
  const raw = Deno.env.get('ZAI_BASE_URL')?.replace(/\/$/, '') || ''
  if (!raw) return 'https://api.z.ai/api/paas/v4'
  return raw.replace(/\/chat\/completions$/i, '')
}

function extractTranscriptText(raw: unknown): string {
  if (!raw || typeof raw !== 'object') return ''
  const obj = raw as Record<string, unknown>
  if (typeof obj.text === 'string') return obj.text.trim()
  if (typeof obj.transcript === 'string') return obj.transcript.trim()
  return ''
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs = STT_TIMEOUT_MS,
): Promise<Response> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    return await fetch(url, { ...init, signal: ctrl.signal })
  } finally {
    clearTimeout(timer)
  }
}

async function transcribeZai(
  bytes: Uint8Array,
  filename: string,
  mime: string,
  apiKey: string,
): Promise<string> {
  const form = new FormData()
  form.append('model', Deno.env.get('ZAI_ASR_MODEL') ?? DEFAULT_ZAI_ASR_MODEL)
  form.append('stream', 'false')
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  form.append('file', new Blob([copy], { type: mime || 'audio/mpeg' }), filename)

  const res = await fetchWithTimeout(`${zaiApiRoot()}/audio/transcriptions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  })
  const raw = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(`zai-asr ${res.status}: ${JSON.stringify(raw).slice(0, 300)}`)
  }
  const text = extractTranscriptText(raw)
  if (!text) throw new Error('zai-asr empty transcript')
  return text
}

async function transcribeOpenRouter(
  bytes: Uint8Array,
  format: string,
  apiKey: string,
): Promise<string> {
  const res = await fetchWithTimeout('https://openrouter.ai/api/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://fieldquote-26446.bubbleapps.io',
      'X-Title': 'FieldQuote draft-quote',
    },
    body: JSON.stringify({
      model: Deno.env.get('OPENROUTER_STT_MODEL') ?? DEFAULT_OPENROUTER_STT_MODEL,
      input_audio: {
        data: bytesToBase64(bytes),
        format,
      },
    }),
  })
  const raw = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(`openrouter-stt ${res.status}: ${JSON.stringify(raw).slice(0, 300)}`)
  }
  const text = extractTranscriptText(raw)
  if (!text) throw new Error('openrouter-stt empty transcript')
  return text
}

export async function transcribeAudio(args: {
  bytes: Uint8Array
  key: string
  contentType?: string
}): Promise<TranscribeResult> {
  if (!args.bytes.length) return { text: null, provider: null, note: 'empty_file' }
  if (args.bytes.length > MAX_AUDIO_BYTES) {
    return { text: null, provider: null, note: 'too_large' }
  }

  const zaiKey = Deno.env.get('ZAI_API_KEY') ?? Deno.env.get('Z_AI_API_KEY')
  const openRouterKey = Deno.env.get('OPENROUTER_API_KEY')
  const format = audioFormatFromKey(args.key)
  const filename = filenameFromKey(args.key)
  const mime = args.contentType && args.contentType.startsWith('audio/')
    ? args.contentType
    : `audio/${format === 'mp3' ? 'mpeg' : format}`

  const attempts: string[] = []
  const tryZai = Boolean(zaiKey) && ZAI_ASR_EXTS.has(format)

  if (!zaiKey && !openRouterKey) {
    return { text: null, provider: null, note: 'no_stt_provider' }
  }
  if (!openRouterKey && !tryZai) {
    // Browser recordings are webm/m4a; Z.AI ASR only documents wav/mp3.
    return { text: null, provider: null, note: 'unsupported_format' }
  }

  if (tryZai && zaiKey) {
    try {
      const text = await transcribeZai(args.bytes, filename, mime, zaiKey)
      return { text, provider: 'zai', note: 'transcribed' }
    } catch (e) {
      attempts.push(String(e))
    }
  }

  if (openRouterKey) {
    try {
      const text = await transcribeOpenRouter(args.bytes, format, openRouterKey)
      return { text, provider: 'openrouter', note: 'transcribed' }
    } catch (e) {
      attempts.push(String(e))
    }
  }

  console.error('transcribeAudio failed:', attempts.join(' | '))
  return { text: null, provider: null, note: 'transcribe_failed' }
}
