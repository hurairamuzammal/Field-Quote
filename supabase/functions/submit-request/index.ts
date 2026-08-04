import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const body = await req.json()
    const {
      customer_name,
      customer_email,
      customer_phone,
      customer_address,
      description,
      preferred_timing,
      photo_keys,
      audio_key,
      hp, // honeypot field
    } = body

    // 1. Honeypot check — bots filling out hidden fields are rejected silently
    if (hp) {
      return json({ success: true }, 200)
    }

    // 2. Validate basic input fields
    if (!description && !photo_keys?.length && !audio_key) {
      return json({ error: 'Please provide a description, photo, or audio recording' }, 400)
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, serviceRoleKey)

    // 3. Insert intake request
    const { data: request, error: reqErr } = await supabase
      .from('requests')
      .insert({
        customer_name: customer_name || null,
        customer_email: customer_email || null,
        customer_phone: customer_phone || null,
        customer_address: customer_address || null,
        description: description || '',
        preferred_timing: preferred_timing || null,
        status: 'new',
      })
      .select('id')
      .single()

    if (reqErr || !request) {
      return json({ error: reqErr?.message || 'Failed to create request' }, 500)
    }

    // 4. Extract photo keys (capped at 5) and audio key into request_media rows
    const keys: string[] = Array.isArray(photo_keys) ? photo_keys.slice(0, 5) : []
    const mediaRows = [
      ...keys.map((k) => ({ request_id: request.id, r2_key: k, kind: 'photo' })),
      ...(audio_key ? [{ request_id: request.id, r2_key: audio_key, kind: 'audio' }] : []),
    ]

    if (mediaRows.length > 0) {
      const { error: mediaErr } = await supabase.from('request_media').insert(mediaRows)
      if (mediaErr) {
        console.error('Error inserting request media:', mediaErr)
      }
    }

    return json({ success: true, request_id: request.id }, 200)
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})
