# Complete Intake Pipeline — Text + Dictation + Audio + Photos → Admin Inbox → (Future) AI Draft

## The full flow, end to end

```
Customer (no login, public page)
  │
  ├─ types description, OR dictates via Web Speech API (fills the same text field, free, no upload)
  ├─ optionally records a short voice note (actual audio file — reference only, never transcribed by AI)
  ├─ attaches up to 5 photos
  │
  ▼ clicks "Send"
Bubble → submit-request (edge function)
  │  - validates: honeypot field empty, basic rate limit, required fields present
  │  - inserts ONE row into `requests` (service_role, bypasses RLS — but only after validation)
  │  - inserts ONE row per file into `request_media`
  │  - sends confirmation email to customer, notification email to admin (Resend)
  ▼
`requests` table — new row appears
  │
  ▼ (Supabase Realtime — already wired per your Week 1 build)
Bubble admin inbox — new request appears live, no page refresh needed
  │
  ▼ admin reviews it, clicks "Draft with AI" button  ⚠️ THIS IS THE STEP YOU'RE DEFERRING
draft-quote (edge function, Day 8 — NOT BUILT YET, no model key yet)
  │  - loads the request + your price book
  │  - sends text (+ later, photos) to Claude
  │  - gets back structured JSON: line items, assumptions, questions, confidence
  │  - code re-verifies every price against the real price book (never trusts the model's number)
  │  - writes `quotes` + `quote_line_items`
  ▼
Admin reviews/edits the draft, sends the quote (separate, later flow)
```

**The AI step is admin-triggered, on demand — not automatic.** A request can sit in the inbox indefinitely with no draft; nothing breaks by not having a model connected yet. This is the exact design in your own roadmap (Day 8: *trigger: admin "Draft with AI" button, JWT verified*) — so skipping it right now isn't a workaround, it's just building the pipeline up to the point where that button would be added later.

---

## Part 1 — Build now: the full customer-facing intake page

### 1a. Text description + dictation (no file, no upload)

- A plain textarea, `Input Description`.
- A microphone button next to it, wired via the Toolbox plugin's JavaScript-to-Bubble bridge, using `webkitSpeechRecognition` (browser-native, free, real-time):
  - Speech-to-text fills `Input Description`'s value directly, as if typed.
  - If `'webkitSpeechRecognition' in window` is false (unsupported browser), hide the mic button entirely — graceful degrade, no error shown.
- **Nothing here touches Supabase or R2 at all** — it's pure browser JavaScript filling a text field.

### 1b. Optional audio recording (actual file, reference-only)

- A "Record a voice note" button using the browser's `MediaRecorder` API (same Toolbox JS-bridge pattern).
- On stop, produces an audio blob → presign via `r2-presign` (`kind: "audio"`) → upload directly to R2, same mechanism as photos.
- Store the resulting `objectKey` in a page state: `s_audio_key` (single text, not a list — only one voice note per request).
- **No transcription, no AI involvement** — this file just gets attached for the admin to optionally listen to later. Per your roadmap, Claude never touches this file.

### 1c. Up to 5 photos

- Multi-file Uploader, max 5 files.
- Batched presign (one `r2-presign` call requesting URLs for all files at once, per the design already in your R2 guide) → recursive per-file upload to R2 → each successful upload's `objectKey` appended to `s_photo_keys` (list of texts).

### 1d. Contact fields

- `Input Name`, `Input Phone`, `Input Email`, `Input Address`, `Input Preferred Timing` — plain text/date inputs, matching the `requests` table's actual columns (`customer_name`, `customer_phone`, `customer_email`, `customer_address`, `preferred_timing`).

### 1e. Honeypot field (spam defense — required by your own architecture doc)

- Add one extra input to the form that's **visually hidden** (CSS, not Bubble's "hidden" element behavior — a bot filling forms programmatically often still fills elements Bubble merely hides, so use an off-screen/zero-opacity approach instead) — e.g. `Input Company Website` with no visible label.
- Real humans never fill it in (they can't see it). Bots that blindly fill every field will. If it's non-empty at submit time, treat the request as spam.

---

## Part 2 — Build now: the `submit-request` edge function

```bash
supabase functions new submit-request
```

`supabase/functions/submit-request/index.ts`:

```typescript
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Simple in-memory rate limit (per function instance — good enough for Week 1;
// revisit with a durable store if abuse becomes a real problem later).
const recentSubmissions = new Map<string, number>()
const RATE_LIMIT_WINDOW_MS = 60_000

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const body = await req.json()
    const {
      description, customer_name, customer_phone, customer_email,
      customer_address, preferred_timing,
      photo_keys, audio_key,
      honeypot, // must be empty
    } = body

    // --- Honeypot check ---
    if (honeypot) {
      // Don't tell the bot anything useful — just pretend it worked.
      return new Response(JSON.stringify({ success: true }), { status: 200, headers: corsHeaders })
    }

    // --- Minimal required-field check ---
    if (!description || !customer_email) {
      return new Response(JSON.stringify({ error: 'description and customer_email are required' }), {
        status: 400, headers: corsHeaders,
      })
    }

    // --- Rate limit by email (cheap, per-instance; not bulletproof, good enough for now) ---
    const lastSubmit = recentSubmissions.get(customer_email)
    if (lastSubmit && Date.now() - lastSubmit < RATE_LIMIT_WINDOW_MS) {
      return new Response(JSON.stringify({ error: 'Please wait before submitting again' }), {
        status: 429, headers: corsHeaders,
      })
    }
    recentSubmissions.set(customer_email, Date.now())

    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: request, error: insertError } = await adminClient
      .from('requests')
      .insert({
        description, customer_name, customer_phone, customer_email,
        customer_address, preferred_timing, status: 'new',
      })
      .select()
      .single()

    if (insertError) {
      return new Response(JSON.stringify({ error: insertError.message }), { status: 500, headers: corsHeaders })
    }

    // --- Attach media rows ---
    const mediaRows = [
      ...(photo_keys ?? []).map((key: string) => ({
        request_id: request.id, r2_key: key, kind: 'photo',
      })),
      ...(audio_key ? [{ request_id: request.id, r2_key: audio_key, kind: 'audio' }] : []),
    ]
    if (mediaRows.length > 0) {
      await adminClient.from('request_media').insert(mediaRows)
    }

    // --- Notify (fire-and-forget style — don't fail the whole request if email fails) ---
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${Deno.env.get('RESEND_API_KEY')}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'RaftWorks <dev@raftworks.co>',
        to: [customer_email],
        subject: 'We received your request',
        html: `<p>Thanks — we've received your request and will follow up soon.</p>`,
      }),
    }).catch(() => {}) // don't let a Resend hiccup fail the whole submission

    return new Response(JSON.stringify({ success: true, request_id: request.id }), {
      status: 200, headers: corsHeaders,
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: corsHeaders })
  }
})
```

```bash
supabase functions deploy submit-request --no-verify-jwt
```

### Bubble side — the actual "Send" button

- `POST https://<ref>.functions.supabase.co/submit-request`
- Headers: `Content-Type: application/json` only.
- Body: `description`, all contact fields, `photo_keys` = `s_photo_keys`, `audio_key` = `s_audio_key`, `honeypot` = the hidden field's value.

---

## Part 3 — Build now: admin realtime inbox (no AI yet)

Per backend.md §8, Realtime is already meant to be wired this way — a Supabase Postgres change listener calling into Bubble via a JS bridge function (`bubble_fn_request`):

```sql
alter publication supabase_realtime add table requests, quotes, jobs, payments;
```

On the admin dashboard, a Repeating Group sourced from a `List Requests` Data-type call (`GET /rest/v1/requests?select=id,description,customer_name,status,created_at&order=created_at.desc`, admin's own token) — the Realtime subscription then pushes new rows in live, so the admin sees new requests appear without refreshing. This part is fully buildable and useful **with zero AI involved** — it's just a live list.

---

## Part 4 — Defer: where the model attaches, and exactly what's needed when you're ready

**Nothing above needs to change** when you add the model later. The seam is clean:

1. Add a **"Draft with AI"** button next to each request in the admin inbox — visible now, does nothing yet, or simply don't add it until you have a key.
2. When you have an Anthropic API key:
   ```bash
   supabase secrets set ANTHROPIC_API_KEY=<key>
   ```
3. Build `draft-quote` (Day 8) — an edge function that:
   - Requires a valid **admin JWT** (checked the same way as `invite-technician` — this one is never public).
   - Loads the specific `requests` row + your active price book.
   - Calls Claude's Messages API with the request's `description` text (Day 9 adds photos, fetched from R2 inside the function via presigned GET, base64-encoded into the same message).
   - Validates the response is well-formed JSON (Zod schema) — one retry on malformed output, then a clean error, never a blank screen.
   - **The guardrail that matters most**: for every line item Claude proposes, your code looks up the real price from `price_book_items` by ID and overwrites whatever price the model guessed. If a proposed item doesn't match a real price book ID, its price becomes `null` and it's flagged "needs manual pricing" — the model never gets to set a price that reaches a customer unchecked.
   - Writes `quotes` + `quote_line_items`, tagging them `ai_generated`, storing the model name and raw response (`ai_raw`) for auditability.

Nothing in Parts 1–3 needs rework to support this — `requests` already has everything `draft-quote` will need to read, and `request_media` already has the photo keys Day 9 will fetch.

---

## What you're deliberately not building yet, and why that's fine

- **No transcription of the audio file** — by design, per your own roadmap; it's a reference file for a human, not model input.
- **No automatic drafting on submission** — drafting is a deliberate admin action, not something that fires the instant a customer hits Send. This means a request with zero AI involvement is a completely valid, normal state for your app to be in.
- **No price book connection yet** — `draft-quote` reads `price_book_items`, but nothing before that step needs to know it exists.
