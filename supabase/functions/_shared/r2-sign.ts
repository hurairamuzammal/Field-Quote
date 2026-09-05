/**
 * Presigned R2 GET URLs + byte fetch for server-side consumers
 * (§13 R9 — the DB stores keys, never files).
 *
 * `r2-presign` mints these for browsers after an auth check. This helper is for
 * functions that already know the caller is allowed to see the object and just
 * need the bytes (vision / STT) or a short-lived URL a third party can fetch.
 */
import { AwsClient } from 'https://esm.sh/aws4fetch@1.0.18'

let client: AwsClient | null = null
let base = ''

const EXT_MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  heic: 'image/heic',
  heif: 'image/heif',
  webm: 'audio/webm',
  m4a: 'audio/mp4',
  mp4: 'audio/mp4',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  aac: 'audio/aac',
  flac: 'audio/flac',
}

/** null when R2 is not configured — callers must degrade, never throw. */
function ensureClient(): { client: AwsClient; base: string } | null {
  const accessKeyId = Deno.env.get('R2_ACCESS_KEY_ID')
  const secretAccessKey = Deno.env.get('R2_SECRET_ACCESS_KEY')
  const accountId = Deno.env.get('R2_ACCOUNT_ID')
  const bucket = Deno.env.get('R2_BUCKET') ?? Deno.env.get('R2_BUCKET_NAME')

  if (!accessKeyId || !secretAccessKey || !accountId || !bucket) return null

  if (!client) {
    client = new AwsClient({ accessKeyId, secretAccessKey, service: 's3', region: 'auto' })
    base = `https://${accountId}.r2.cloudflarestorage.com/${bucket}`
  }
  return { client, base }
}

/** Reject traversal / absolute keys before they reach the signer. */
function keyIsSafe(key: string): boolean {
  if (!key) return false
  if (key.includes('..') || key.startsWith('/') || key.includes('\\')) return false
  return true
}

export function extOfKey(key: string): string {
  const baseName = key.split('?')[0].split('/').pop() ?? ''
  const dot = baseName.lastIndexOf('.')
  return dot >= 0 ? baseName.slice(dot + 1).toLowerCase() : ''
}

export function mimeFromKey(key: string): string {
  return EXT_MIME[extOfKey(key)] ?? 'application/octet-stream'
}

/** Chunked so large photos/audio don't blow the call stack via spread. */
export function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

/**
 * Signed GET URL for one object key, or null if R2 is unconfigured / the key is unsafe.
 * `expiresInSec` is advisory — aws4fetch signs with the SigV4 default unless X-Amz-Expires
 * is supplied, so we pass it explicitly.
 */
export async function signGetUrl(key: string, expiresInSec = 600): Promise<string | null> {
  const cfg = ensureClient()
  if (!cfg || !keyIsSafe(key)) return null

  try {
    const url = new URL(`${cfg.base}/${key}`)
    url.searchParams.set('X-Amz-Expires', String(Math.max(60, Math.min(expiresInSec, 3600))))
    const signed = await cfg.client.sign(
      new Request(url.toString(), { method: 'GET' }),
      { aws: { signQuery: true } },
    )
    return signed.url
  } catch (e) {
    console.error('signGetUrl failed for key', key, e)
    return null
  }
}

/** Sign many keys, dropping any that fail. Order is preserved for the ones that succeed. */
export async function signGetUrls(keys: string[], expiresInSec = 600): Promise<string[]> {
  const signed = await Promise.all(keys.map((k) => signGetUrl(k, expiresInSec)))
  return signed.filter((u): u is string => typeof u === 'string' && u.length > 0)
}

/**
 * Download object bytes from R2 (header-signed GET). Returns null on any failure
 * so callers can degrade (text-only draft, skip one photo) instead of throwing.
 */
export async function getObject(
  key: string,
): Promise<{ bytes: Uint8Array; contentType: string } | null> {
  const cfg = ensureClient()
  if (!cfg || !keyIsSafe(key)) return null

  try {
    const signed = await cfg.client.sign(new Request(`${cfg.base}/${key}`, { method: 'GET' }))
    const res = await fetch(signed)
    if (!res.ok) {
      console.error('getObject', key, res.status)
      return null
    }
    const bytes = new Uint8Array(await res.arrayBuffer())
    const headerType = (res.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase()
    const guessed = mimeFromKey(key)
    const contentType = headerType && headerType !== 'application/octet-stream'
      ? headerType
      : guessed
    return { bytes, contentType }
  } catch (e) {
    console.error('getObject failed for key', key, e)
    return null
  }
}
