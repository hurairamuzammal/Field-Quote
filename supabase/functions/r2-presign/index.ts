import { AwsClient } from 'https://esm.sh/aws4fetch@1.0.18'

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

const r2 = new AwsClient({
  accessKeyId: Deno.env.get('R2_ACCESS_KEY_ID')!,
  secretAccessKey: Deno.env.get('R2_SECRET_ACCESS_KEY')!,
  service: 's3',
  region: 'auto',
})
const bucket = Deno.env.get('R2_BUCKET') ?? Deno.env.get('R2_BUCKET_NAME')!
const BASE = `https://${Deno.env.get('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com/${bucket}`

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const { fileName, kind = 'photo', fileSize } = await req.json()

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
    return json({ error: String(e) }, 500)
  }
})