# FieldQuote — Edge functions guide (section by section)

Trainee-friendly walkthrough of every function under `supabase/functions/`.  
Read this with the matching `index.ts` open. Line numbers move; follow **section names**.

**Shared ideas (all functions)**

| Idea | Meaning |
|------|---------|
| `Deno.serve(...)` | Starts the HTTP server for this function |
| CORS / `OPTIONS` | Browser preflight — return `ok` so Bubble / landing can call from another origin |
| `json(...)` helper | Build a JSON response + CORS headers |
| **Anon client + JWT** | “Who is calling?” — RLS applies |
| **Service role client** | “Trusted server” — bypasses RLS **only after** we validated the caller (or public checks) |
| Secrets | `Deno.env.get('…')` — set with `supabase secrets set`, never in Bubble |

**Who may call what**

| Function | Auth |
|----------|------|
| `submit-request` | Public (honeypot) |
| `r2-presign` PUT | Public (intake upload) |
| `r2-presign` GET | Admin JWT |
| `invite-technician` / `resend-invite` | Admin JWT |
| `company-brand` | Public (apikey only; name + logo URL, never rates) |
| `request-password-reset` | Public (always looks like success) |
| `draft-quote` / `send-quote` | Admin JWT |
| `resolve-quote-token` | Public (secret token in body/query) |

**Deploy pattern:** `supabase functions deploy <name> --no-verify-jwt`  
(JWT checked **inside** the function when needed.)

---

## Map — customer / staff journey

```
Customer intake
  → r2-presign (PUT photos/audio)
  → submit-request (row + media keys)

Admin
  → draft-quote (AI → draft quote + lines)
  → (Bubble PATCH lines/totals — not an edge fn yet)
  → send-quote (token + email)
  → invite-technician / resend-invite

Customer quote page
  → resolve-quote-token (safe payload; sent → viewed)

Anyone (forgot password)
  → request-password-reset
```

Shared HTML: `_shared/email-layout.ts` (invite, reset, send-quote).

---

# 1. `submit-request`

**File:** `supabase/functions/submit-request/index.ts`  
**Called by:** public intake (landing / Bubble public form)  
**Does:** create a `requests` row + optional `request_media` rows (R2 keys only).

### Imports + helpers
- Supabase JS client.
- `cors` + `json()` — standard response helpers.

### Handler start
1. **OPTIONS** → empty OK (CORS).
2. **Parse JSON body** — customer fields, `photo_keys`, `audio_key`, honeypot `hp`.

### § Honeypot
- If `hp` is filled → return `{ success: true }` **without writing**.  
  Bots fill hidden fields; humans leave them empty. Silent reject (no “you’re a bot”).

### § Validate
- Need at least one of: `description`, photos, or audio. Else **400**.

### § Service client + company
- Uses **service role** (public intake can’t use a user JWT).
- Resolves `company_id` via `fetchSoleCompanyId` from **`company_settings`** (not a hardcoded UUID).

### § Insert `requests`
- Status `'new'`.
- Returns `request.id`.

### § Insert `request_media`
- Up to **5** photo keys + optional audio key.
- Stores **R2 object keys**, not files.
- Media insert errors are logged; request still succeeds (soft fail).

### Success
`{ success: true, request_id }`.

---

# 2. `r2-presign`

**File:** `supabase/functions/r2-presign/index.ts`  
**Does:** temporary signed URLs so the browser uploads/downloads to Cloudflare R2 **without** putting R2 secrets in Bubble.

### Setup
- `AwsClient` (aws4fetch) with R2 keys.
- `EXT_MIME` / `MAX_BYTES` — allow-list extensions and size caps.
- `ALLOWED_GET_PREFIXES` — downloads only under `requests/photos/` or `requests/audio/`.

### `normalizeBearer`
- Accepts `Bearer …`, `bearer …`, or raw JWT (Bubble quirks).

### `requireAdmin`
- Resolve user from JWT → load `profiles` → must be **admin** + **active**.  
- Returns an error `Response` or `null` if OK.

### Mode selection
- Body `mode`: `'get'` / `'download'` vs upload (default PUT).
- Heuristic: if `key` present and no `fileName` → treat as get.

### § Download (admin)
1. Admin check.
2. Validate `key` (prefix + no `..` / weird paths).
3. Sign **GET** URL → `{ url, key }`.

### § Upload (public intake)
1. Read `fileName`, `kind` (`photo`|`audio`), `fileSize`.
2. Extension → MIME; reject wrong type / too large.
3. Build random key: `requests/photos|<uuid>.ext` or `…/audio/…`.
4. Sign **PUT** URL → `{ url, objectKey, mime }`.  
   Browser PUTs the file to `url`; later `submit-request` stores `objectKey`.

---

# 3. `invite-technician`

**File:** `supabase/functions/invite-technician/index.ts`  
**Does:** admin invites a tech → Auth user + email with password-setup link.

> Note: top of file still has unused Supabase template stub (`export default { fetch: withSupabase… }`). **Real entrypoint is `Deno.serve` below.** Ignore the stub when reading.

### `passwordSetupBase()`
- Bubble `password_setup` URL from env, or default test URL.

### CORS + Authorization
- Require `Authorization` header.

### Two clients
1. **userClient** (anon + caller JWT) → `auth.getUser()` — prove session.
2. **adminClient** (service role) → create users, read profiles, log email.

### Admin gate
- Load caller `profiles.role` → must be `'admin'` else **403**.

### Body
- `email` required; `full_name` optional.

### Step 1 — create Auth user
- `auth.admin.createUser` with `user_metadata: { role: 'technician', full_name }`.  
- DB trigger creates `profiles` row.
- Duplicate email → **409**.

### Step 2 — invite link
- `generateLink({ type: 'invite', email })` → `hashed_token`.
- Build Bubble URL: `…/password_setup?token_hash=…&type=invite`.

### Step 3 — Resend
- Branded HTML via `inviteEmailHtml` (`_shared/email-layout.ts`).

### Step 4 — `email_log`
- Always insert (§13 R8). Status `sent` / `failed`.

### Success
`{ success: true, user_id }`.

---

# 4. `resend-invite`

**File:** `supabase/functions/resend-invite/index.ts`  
**Does:** fresh invite email for an **existing** technician who has **not** set a password (`profiles.active = false`). Does not create a user.

1. Admin JWT (`requireActiveAdmin`)  
2. Body `{ email }` — must match a technician in the admin’s company  
3. **409** if `active = true` (use Forgot password) or Auth **banned** (use Activate)  
4. `generateLink` type `invite` (new token)  
5. Branded email (`resent: true`)  
6. `email_log` template `technician_invite_resend` (no `token_hash`)

Bubble: **Resend invite** on the List Team row when `setup_complete` is no — `doc/MD-files/perform/10-resend-invite-technicians-table.md`.

---

# 5. `request-password-reset`

**File:** `supabase/functions/request-password-reset/index.ts`  
**Does:** email a recovery link. **Public** — no JWT.

### Security rule (important)
- Always return `{ success: true }` even if the email is unknown.  
  Prevents attackers from discovering which emails exist.

### Flow
1. Require `email` (else 400 — empty body only).
2. Service role → `generateLink({ type: 'recovery', email })`.
3. If fail → log `email_log` failed, still return success.
4. Build `password_setup?token_hash=…&type=recovery`.
5. Resend branded `passwordResetEmailHtml`.
6. Log to `email_log` (`password_reset`).

---

# 5b. `company-brand`

**File:** `supabase/functions/company-brand/index.ts`  
**Does:** public company chrome (name + logo URL). **No JWT.**

### Security
- Gateway `verify_jwt = false`.
- Service role only after IP rate limit (60 / min).
- Selects `company_id, name, logo_key` only — **never** rates.
- Signs R2 GET only for keys matching `companies/{uuid}/logo/…` from the DB, not from the client.

### Flow
1. GET only.
2. Rate-limit by IP.
3. `fetchSoleCompanyId` + `fetchCompanyBrand`.
4. `logo_url` = `R2_PUBLIC_BASE_URL` + key, else signed GET (~24h), else `emailLogoUrl()`, else null.

Bubble: Data call **FN - Get Company Brand** on reusable **RE: Company Brand** — `perform/16-public-company-brand-re-guide.md`.

---

# 6. `draft-quote`

**File:** `supabase/functions/draft-quote/index.ts`  
**Does:** admin drafts a quote from a request using AI + **price guardrail** (§13 R1–2).

### Helpers (top of file)

| Piece | Role |
|-------|------|
| `round2` | Money rounding |
| `normalizeBearer` | JWT header cleanup |
| `extractJsonObject` | Parse model text → JSON (strips markdown fences) |
| `buildMessages` | System + user prompt; optional images (vision) |
| `callChatCompletions` | Call Z.AI or OpenRouter chat API |
| `draftWithFailover` | Z.AI first (retry) → OpenRouter (retry) |
| `applyGuardrail` | **Discard model prices**; re-attach live price book prices by id |

### Guardrail (core rule)
For each AI line:
- If `price_book_item_id` matches an active book item → use **book** `unit_price`, keep label/qty.
- Else → `unit_price: null`, label “needs manual pricing” (or AI label).  
**Never trust the model’s money.**

### Main handler

1. **POST only**; normalize Bearer; require admin profile (`role`, `active`, `company_id`).
2. Need `ZAI_API_KEY` and/or `OPENROUTER_API_KEY`.
3. Body: `request_id` required; optional `image_urls` for vision.
4. Load request; company must match admin’s company.
5. Load **active** `price_book_items` for that company; error if empty.
6. Call AI with description + book (+ images).
7. `applyGuardrail`; if zero lines → one unpriced fallback line (never empty draft).
8. Load `company_settings` → `deposit_pct`, `tax_pct`.
9. **Totals:**  
   - `subtotal` = sum of `qty * unit_price` for priced lines only  
   - `tax_amount` = subtotal × tax%  
   - `total` = subtotal + tax  
   - `deposit_amount` = total × deposit%  
   - `needs_manual_pricing` if any line has null price  
10. Insert `quotes` (`status: draft`, AI metadata, `internal_notes` from assumptions/questions).  
11. Insert `quote_line_items`; on failure **delete** the quote (cleanup).  
12. If request was `new` → set status `quoted`.  
13. Return `quote_id`, lines, totals, `needs_manual_pricing`, model info.

---

# 7. `send-quote`

**File:** `supabase/functions/send-quote/index.ts`  
**Does:** only **draft** quotes → mark `sent`, create customer **token**, email branded quote.

### Helpers
- `randomTokenHex` — ≥20-char hex token (customer link; never raw quote id in URL).
- `quotePageUrl` — Bubble public `q` page + `?token=`.
- `brandedEmailHtml` — shared layout + line-item table.

### Main handler

1. Admin JWT + profile.
2. Body `quote_id`; load quote for admin’s `company_id`.
3. Must be `status === 'draft'` else 400.
4. Load lines; reject if empty or any `unit_price` null (`needs_manual_pricing`).
5. Load request — need `customer_email`.
6. Load settings (name, validity days, fallback tax/deposit %).
7. **Recompute totals** from lines (same math as draft) and snapshot onto quote.
8. `valid_until` = now + `quote_validity_days`.
9. Reuse existing token if long enough, else new random token.
10. Update quote: `status: sent`, token, validity, totals — **only if still draft** (race → 409).
11. Build HTML email → Resend → always `email_log`.
12. If Resend fails → **502** but quote is already `sent` (token live); response includes `quote_url` for manual resend later.
13. Success → `ok`, `token`, `quote_url`, totals, `email_status`.

---

# 8. `resolve-quote-token`

**File:** `supabase/functions/resolve-quote-token/index.ts`  
**Does:** public customer page loader. **No JWT.** Token is the secret.

### Out of scope here
- Accept → later `create-checkout` + Stripe webhook.  
- Decline → later respond path.

### Main handler

1. POST or GET; read `token` from body or query.
2. Token required, length ≥ 20.
3. Service role: find quote by `token` (quotes table is not anon-readable).
4. If missing → 404.
5. If declined / expired / accepted, or past `valid_until` → **410** `actionable: false` (may stamp `expired`).
6. If `sent` → first open updates to `viewed` + `viewed_at`.
7. Load lines, request snippet, company name.
8. Return **safe** JSON: lines, totals, customer name, `actionable: true`, `next_actions: ['accept','decline']`.  
   No internal notes / AI raw / staff fields.

---

# 9. Shared: `_shared/company.ts` + `_shared/email-layout.ts`

| Export | Purpose |
|--------|---------|
| `fetchSoleCompanyId` | Public paths: read the one `company_settings.company_id` (no hardcoded UUID) |
| `fetchCompanyBrand` | `name` + `logo_key` for a given company_id |
| `resendFromHeader` | `"Company Name <RESEND_FROM_EMAIL>"` |
| `brandedEmailHtml` / invite / reset | Card layout; **companyName** from DB |

**Do not** hardcode `0000…0001` or “FieldQuote” in edge mail/intake. Seed may still use that UUID in SQL; runtime resolves from tables.

---

## Totals cheat sheet (draft + send)

```
subtotal        = Σ (qty × unit_price)   // only lines with a price
tax_amount      = subtotal × (tax_pct / 100)
total           = subtotal + tax_amount
deposit_amount  = total × (deposit_pct / 100)
```

Unpriced lines do **not** add to subtotal; they set `needs_manual_pricing` and **block send**.

---

## Quick debug

| Symptom | Likely cause |
|---------|----------------|
| Intake OK but draft “no company / empty book” | `submit-request` missing `company_id` (fixed in current code) |
| draft-quote 401/403 | Missing/expired admin JWT or not admin |
| draft-quote 502 AI | Both Z.AI and OpenRouter failed / keys missing |
| send-quote 400 needs_manual_pricing | Patch unpriced lines first |
| resolve 410 | Expired / declined / already accepted |
| Invite email plain / no logo | Deploy new functions; set `EMAIL_ASSET_BASE_URL` after landing hosts PNG |
| R2 GET 403 | Not admin JWT |

---

## Related guides

| Topic | Doc |
|-------|-----|
| Inbox → draft → send (Bubble) | `perform/05-request-inbox-ai-quote-send-guide.md` |
| Auth / invite UI | `perform/01-fieldquote-auth-implementation-guide.md` |
| Schema / secrets | `doc/plan/P2-backend.md` |
| Cache-bust → Realtime | `perform/07-realtime-cachebust-to-supabase-guide.md` |
| Doc index | `doc/MD-files/00-INDEX.md` |
| Handoff / status | `PROJECT_MEMORY.md` |

**Updated:** 2026-08-09
