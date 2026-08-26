import { NextResponse } from 'next/server'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Landing waitlist proxy → Supabase edge `submit-waitlist`.
 * Keeps the function URL + anon key off the browser if desired;
 * browser may also call the edge URL directly (CORS allows *.vercel.app).
 */
export async function POST(req: Request) {
  let body: { email?: string; source?: string; hp?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const email = typeof body.email === 'string' ? body.email.trim() : ''
  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: 'Valid email is required' }, { status: 400 })
  }

  // Server-only env (no NEXT_PUBLIC_) — form posts to this route; key never ships to the browser.
  // Accept classic anon JWT or new publishable key (sb_publishable_…).
  const base = (
    process.env.SUPABASE_URL
    ?? process.env.NEXT_PUBLIC_SUPABASE_URL
    ?? ''
  )
    .trim()
    .replace(/\/$/, '')
  const anon = (
    process.env.SUPABASE_ANON_KEY
    ?? process.env.SUPABASE_PUBLISHABLE_KEY
    ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    ?? ''
  ).trim()

  if (!base || !anon) {
    console.error('waitlist: missing SUPABASE_URL or SUPABASE_ANON_KEY / SUPABASE_PUBLISHABLE_KEY')
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
  }

  const upstream = await fetch(`${base}/functions/v1/submit-waitlist`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: anon,
      Authorization: `Bearer ${anon}`,
    },
    body: JSON.stringify({
      email,
      source: typeof body.source === 'string' ? body.source : 'landing',
      hp: typeof body.hp === 'string' ? body.hp : '',
    }),
  })

  const data = await upstream.json().catch(() => ({}))
  return NextResponse.json(data, { status: upstream.status })
}
