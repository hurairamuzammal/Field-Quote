# FieldQuote — Backend & Data Plan

Companion to `roadmap.md`. This is the reference you'll keep open while building: the schema explained from zero, exactly how Bubble and Supabase talk, where Stripe and Claude slot in, every secret and where it lives, and your two named pain points (Vercel↔Bubble in §8, GitHub↔Supabase in §6).

---

## §1. The database schema, explained simply

### 1.1 How to think about data modeling (the 4 ideas this whole schema uses)

You said schema design is a weak spot, so here's the entire toolkit this project needs — there are only four ideas:

1. **One table per "thing," one row per instance.** A *request* is a thing. A *quote* is a thing. A *photo attached to a request* is its own thing (because one request has many photos — see idea 2).
2. **One-to-many = a foreign key on the "many" side.** One quote has many line items → each `quote_line_items` row carries a `quote_id` column pointing at its quote. That pointer *is* the relationship; there's nothing else to build. When you see `xxx_id`, read it as "belongs to xxx."
3. **Snapshot what must not change later.** A quote line stores its own `unit_price` copied from the price book at draft time. If it only *pointed* at the price book, raising a price next month would silently rewrite every old quote — a bug that looks like data corruption. Same reason `quotes` copies deposit % and tax % from settings. **Rule: live data points; historical documents copy.**
4. **Append-only for anything you'd need in a dispute.** `payments` and `job_events` only ever get new rows — never edits, never deletes. "What happened and when" stays trustworthy because nothing can rewrite it.

That's it. Every table below is one of: a *thing*, a *belongs-to*, a *snapshot*, or an *append-only log*.

### 1.2 The relationship map

```
company_settings (1 row)        profiles (staff: admin + technicians)
                                     │
requests ──< request_media           │ technician_id
   │  (1 request, many files)        │
   │ request_id                      ▼
   ▼                     ┌──────── jobs ──< job_events (append-only)
 quotes ──< quote_line_items │        └──< job_media
   │            │ price_book_item_id (nullable)
   │            ▼
   │      price_book_items
   │ quote_id
   ├──────< payments (append-only; deposit + final)
   └── token ──> the customer's only key to their quote

email_log, chat_sessions/chat_messages/assistant_actions, waitlist — standalone logs
```

Read `──<` as "one-to-many." The one flow to internalize: **request → quote → (deposit paid) → job → (completed, final paid) → done**, and each arrow in that flow is a foreign key.

### 1.3 Table-by-table (with the *why*)

**`profiles`** — staff only (customers never get accounts, §2).
`id uuid PK` (mirrors `auth.users.id` — same person, same id in both), `company_id`, `role` (`'admin' | 'technician'` — a CHECK constraint, not free text), `full_name`, `email`, `phone`, `active bool`.
*Why `id` mirrors auth:* RLS policies compare row data against `auth.uid()` (the logged-in user's id from the JWT). Sharing the id makes that comparison a plain equality.

**`company_settings`** — one row. `company_id`, `name`, `logo_key` (an R2 path string — files never live in the DB, §13 Rule 9), `deposit_pct`, `tax_pct`, `quote_validity_days`, `labor_rate`.
*Why it exists at all:* so commercial rules are data the admin edits, not numbers buried in code — and so quotes can snapshot them (idea 3).

**`price_book_items`** — `id`, `company_id`, `name`, `category`, `unit` (`'job'|'hour'|'unit'`), `unit_price numeric` (never float — floats do 0.1+0.2=0.30000000000000004; `numeric` is exact money math), `keywords text` (the AI matches on this — write them generously), `active bool`.
*Why `active` instead of delete:* old quote lines point here; deleting would orphan them. Deactivate = hidden from new quotes, preserved on old ones (§4.2).

**`requests`** — `id`, `description`, `customer_name/phone/email/address`, `preferred_timing`, `status` (`'new'|'quoted'|'archived'`), `created_at`.
**`request_media`** — `id`, `request_id FK`, `r2_key`, `kind` (`'photo'|'audio'`), `size_bytes`.
*Why media is its own table:* idea 2 — up to 5 photos + audio per request. Columns like `photo1..photo5` are the classic beginner trap; a child table costs nothing and never runs out.

**`quotes`** — `id`, `request_id FK`, `status` (`draft→sent→viewed→accepted|declined|expired`, enforced by a trigger — Day 11), `token text UNIQUE` (32 random hex chars; the customer's only handle, §13 Rule 5), `subtotal/tax_amount/total/deposit_amount numeric` (snapshots), `deposit_pct/tax_pct` (snapshot the *rates* too, so the math is auditable), `ai_generated bool`, `ai_model text`, `ai_raw jsonb` (the raw Claude response, for debugging per §6.1), `valid_until`, `viewed_at`, `declined_reason`.

**`quote_line_items`** — `id`, `quote_id FK`, `price_book_item_id FK **nullable**`, `label`, `qty numeric`, `unit_price numeric` (snapshot), `overridden bool`.
*The nullable FK is the AI guardrail expressed as schema:* a real item id = grounded price; NULL = "AI couldn't match this — needs manual pricing," and the send function refuses to send while any NULL-priced line remains (§13 Rule 1). The database itself makes an invented price unrepresentable.

**`jobs`** — `id`, `quote_id FK`, `status` (`unscheduled→scheduled→en_route→in_progress→completed`, + `cancelled`), `technician_id FK → profiles`, `scheduled_at timestamptz`, `duration_min`, `completion_notes`.
*Why jobs are created only by the Stripe webhook (§7.2):* a job means money committed. If Bubble could create jobs, a redirect-URL visit could fake a paid deposit.

**`job_events`** — append-only: `id`, `job_id FK`, `actor_id FK`, `from_status`, `to_status`, `created_at`. Written by a DB trigger on every status change, so it can't be forgotten or forged.
**`job_media`** — `id`, `job_id FK`, `r2_key`, `kind` (`'completion_photo'`).

**`payments`** — append-only: `id`, `quote_id FK`, `job_id FK nullable`, `kind` (`'deposit'|'final'`), `amount numeric`, `currency`, `stripe_session_id`, `stripe_event_id text **UNIQUE**`, `status`, `created_at`.
*The UNIQUE on `stripe_event_id` is the idempotency mechanism (§7.3):* a replayed webhook tries to insert the same event id, the constraint refuses, your code catches it and returns 200. One line of schema defeats double-charging.

**`email_log`** — `id`, `to_email`, `template`, `related_id`, `resend_id`, `status`, `sent_at`. Every send, no exceptions (§13 Rule 8) — and it doubles as the *enforcement* of follow-up caps: "may I send follow-up #2?" is answered by counting this table, not by trusting workflow logic.

**`chat_sessions` / `chat_messages` / `assistant_actions`** — ops-assistant persistence + audit (`assistant_actions`: what tool ran, proposed vs executed, `executed_by`, timestamps).

**`waitlist`** — `id`, `email`, `source`, `created_at`. The only table anon may INSERT into.

*Every table carries `company_id`* — dead weight in v1, but multi-tenant later becomes "add tenancy policies" instead of a rewrite (§12 note).

---

## §2. RLS — the actual security layer

### 2.1 The mental model
RLS = a WHERE clause the database force-appends to every query based on who's asking. Bubble sends the user's JWT; Postgres reads `auth.uid()` out of it; policies decide row visibility. Bubble conditionals are decoration (§13 Rule 6) — the final eval tests the database, not your UI.

### 2.2 The three access tiers
| Who | Gets |
|---|---|
| Admin (JWT, role=admin) | Everything, via PostgREST + RLS |
| Technician (JWT) | Only their `jobs` (+ events/media); status/notes/media writes only. **No** quotes, payments, prices, requests |
| Anon (no JWT) | `waitlist` INSERT. Nothing else — public flows go through edge functions that validate first, then use the service role (§2.4) |

### 2.3 Policy patterns (copy these)

```sql
alter table jobs enable row level security;   -- repeat for EVERY table

create function auth_role() returns text language sql stable security definer
as $$ select role from profiles where id = auth.uid() $$;

-- Admin: full access
create policy admin_all on jobs for all
  using (auth_role() = 'admin') with check (auth_role() = 'admin');

-- Technician: their rows only
create policy tech_read on jobs for select
  using (technician_id = auth.uid());
create policy tech_update on jobs for update
  using (technician_id = auth.uid())
  with check (technician_id = auth.uid());
```

Column limiting for techs (simplest version): revoke broad column updates and grant only the allowed ones —
```sql
revoke update on jobs from authenticated;
grant update (status, completion_notes) on jobs to authenticated;
```
(Admins bypass this via their own PostgREST calls only if you keep admin updates in an edge function, or grant admin columns through a `security definer` RPC — pick one and note it; the roadmap uses the grant approach + admin edits via RPC for `scheduled_at`/`technician_id`.)

Tables with **no** technician/anon policy (quotes, payments, price_book_items, requests, settings, logs) are simply invisible to those roles — absence of a policy *is* the denial.

### 2.4 The service-role pattern (public flows)
`submit-request`, `resolve-quote-token`, `create-checkout`, `stripe-webhook` all serve people with no JWT. They run in edge functions holding the **service-role key** (which bypasses RLS) — but only *after their own validation*: honeypot/rate-limit for intake, token match for quotes, Stripe signature for the webhook. The rule: **service role never touches a request that hasn't independently proven itself.**

### 2.5 The negative test (write once, run forever)
```sql
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"<technician-uuid>"}';
select count(*) from quotes;            -- must be 0
select count(*) from payments;          -- must be 0
select count(*) from price_book_items;  -- must be 0
select count(*) from jobs where technician_id <> '<technician-uuid>'; -- must be 0
rollback;
```
Keep it in `tests/rls/`, run after every migration. A silent RLS regression is the worst bug class in this project because nothing *looks* broken.

---

## §3. How Bubble and Supabase talk (step by step)

The whole integration is: **Bubble's API Connector makes HTTP calls to three Supabase surfaces** — Auth (`/auth/v1/...`), PostgREST (`/rest/v1/...`, auto-generated REST over your tables), and your edge functions (`/functions/v1/...`). Bubble stores no domain data.

### 3.1 One-time API Connector setup
1. Plugins → API Connector → Add another API → name it `Supabase`.
2. Shared headers (apply to all calls):
   - `apikey: <ANON KEY>` — mark **private** (Bubble sends it server-side). The anon key is *designed* to be public-ish; RLS is the security, but private is tidier.
   - Do **not** put Authorization here — it must be dynamic per call.
3. Per call, add header `Authorization: Bearer [token]` where `[token]` is a **dynamic value** (checkbox in the connector). Every workflow passes the current user's JWT into it. **This is the single most important wiring in the app** — a wrong/missing JWT doesn't error, it just makes RLS return empty lists, and you'll debug the wrong layer for hours. When any screen mysteriously shows nothing: check this header first, always.

### 3.2 The auth calls
| Call | Method + path | Body | Returns |
|---|---|---|---|
| Login | POST `/auth/v1/token?grant_type=password` | `{email, password}` | `access_token`, `refresh_token`, `expires_in`, `user.id` |
| Refresh | POST `/auth/v1/token?grant_type=refresh_token` | `{refresh_token}` | new token pair |
| Reset | POST `/auth/v1/recover` | `{email}` | 200 (email via Resend; whitelist the Bubble reset page URL in Supabase Auth settings) |
| Logout | POST `/auth/v1/logout` | — (JWT header) | 204 |

Initialize each call once with a real seeded user so Bubble learns the response shape.

### 3.3 PostgREST in one box
```
GET  /rest/v1/quotes?status=eq.sent&order=created_at.desc&select=id,total,customer:requests(customer_name)
POST /rest/v1/price_book_items          body: {...}          (header Prefer: return=representation to get the row back)
PATCH /rest/v1/jobs?id=eq.<uuid>        body: {"status":"scheduled", ...}
```
Filters are `column=op.value` (`eq`, `gt`, `in`, `ilike`); `select=` chooses columns **and** pulls related tables through FKs (that `customer:requests(...)` bit is a join — you'll use it constantly). Never `select=*` in production calls; list columns, so techs' calls physically can't request price fields. Practice: `doc/MD-files/learn/06-postgrest-embed-practice.md`.

### 3.4 Session keeping (the part tutorials skip)
Access tokens die hourly. Build one reusable element, drop it on every protected page: on load → if `expires_at − now < 5 min` → call Refresh → store the new pair (Bubble custom states + localStorage via Toolbox is fine; that's legitimately "transient UI state" per §1.1) → refresh fails → clear + go to login. Without this, users get silently logged out mid-quote and blame your app.

### 3.5 The realtime bridge
One HTML element (reusable), Toolbox "JavaScript to Bubble" elements alongside it:
```html
<script type="module">
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';
const sb = createClient('https://<ref>.supabase.co', '<ANON KEY>');
sb.realtime.setAuth('<USER_JWT>');   // realtime obeys RLS too
sb.channel('ops')
  .on('postgres_changes', {event:'INSERT', schema:'public', table:'requests'}, p => bubble_fn_request(JSON.stringify(p.new)))
  .on('postgres_changes', {event:'*',      schema:'public', table:'jobs'},     p => bubble_fn_job(JSON.stringify(p.new)))
  .on('postgres_changes', {event:'INSERT', schema:'public', table:'payments'}, p => bubble_fn_payment(JSON.stringify(p.new)))
  .subscribe(s => bubble_fn_live(s === 'SUBSCRIBED'));
</script>
```
Enable tables for realtime once: `alter publication supabase_realtime add table requests, quotes, jobs, payments;`. The `bubble_fn_live` flag drives your "live" indicator and reconnect handling (§8.3).

### 3.6 When to call what (decision rule)
| Situation | Use |
|---|---|
| Logged-in user reads/writes their own-permission data | PostgREST directly (RLS protects) |
| A secret is involved (Claude, Stripe, Resend, R2, service role) | Edge function |
| Caller has no JWT (intake, token page, webhook) | Edge function (validate → service role) |
| Multi-step "transaction" (send quote: check + snapshot + email + log) | Edge function |
| Recurring | pg_cron → edge function |

Note **Bubble backend workflows are used for nothing** in this architecture — the scope deliberately keeps server logic in Supabase so it's Git-tracked and portable (§1.1). If you catch yourself reaching for Bubble's backend workflows tab, the answer is almost certainly "that's an edge function."

---

## §4. Where Stripe fits (the money flow, end to end)

```
Customer clicks Accept on /q/<token>
  → [create-checkout fn] token re-validated → Stripe Checkout Session created
        (amount = deposit; metadata = {quote_id, kind:"deposit"})
  → customer pays on STRIPE'S hosted page (never yours — §13 Rule 4)
  → redirect back = UX only, proves nothing
  → Stripe POSTs event → [stripe-webhook fn]
        1. verify Stripe-Signature on the RAW body   (fail → 400, write nothing)
        2. insert payments (stripe_event_id UNIQUE → replay = no-op)
        3. quote → accepted;  jobs row created (unscheduled)
        4. confirmation emails; realtime flips the customer's "processing…" page
Final invoice = same loop with kind:"final", amount = total − deposit,
  and success additionally fires the Make.com review webhook (fire-and-forget).
```

**Events that matter:** `checkout.session.completed` (both kinds, split on metadata) and `checkout.session.expired`. Ignore everything else in v1.
**Data Stripe needs from you:** amount + currency, metadata (`quote_id`, `kind`), success/cancel URLs.
**Data you take from Stripe (webhook payload only):** amount, currency, session id, event id. Never write money fields from anywhere else — Stripe is the source of truth (§7.3).
**Test rig:** `stripe listen --forward-to https://<ref>.supabase.co/functions/v1/stripe-webhook` + `stripe trigger checkout.session.completed`; card `4242 4242 4242 4242`. Your standing regression: trigger → replay same event → assert exactly one payment + one job.

---

## §5. Where Claude fits (all four touchpoints)

### 5.1 Edge function boilerplate every function shares
```ts
const cors = { 'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey' };
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  // ...handler...
});
```
Forgetting the OPTIONS/CORS block is why "it works in curl but not in Bubble."

### 5.2 R2 CORS (set on the bucket BEFORE first upload test)
```json
[{"AllowedOrigins": ["https://<your-bubble-app>.bubbleapps.io", "https://<custom-domain>"],
  "AllowedMethods": ["PUT", "GET"], "AllowedHeaders": ["*"], "MaxAgeSeconds": 3600}]
```

### 5.3 `draft-quote` — the flagship integration
**Prompt shape:** system = role + rules ("match work to the provided price book; if nothing matches, output the line with item_id null; return ONLY JSON matching this schema; list assumptions and clarifying questions; never state a price for an unmatched line") → user = request description + up to 5 photos (fetched from R2 server-side, base64 image blocks) + the active price book as compact JSON `{id, name, category, unit, unit_price, keywords}`.
**The guardrail is code, not prompt (§13 Rule 1):** after parsing (Zod schema, one retry on malformed), loop the lines — item_id present? → verify it exists + is active, then **overwrite unit_price with the stored price** (the model's number is discarded either way); item_id null/unknown? → keep as "needs manual pricing." The model *proposes matches*; your code *sets prices*. Store everything + `ai_raw` on the quote.

### 5.4 Webhook raw-body gotcha (Day 15's likely 3 hours)
```ts
const raw = await req.text();                     // BEFORE any json()
const event = await stripe.webhooks.constructEventAsync(
  raw, req.headers.get('stripe-signature')!, Deno.env.get('STRIPE_WEBHOOK_SECRET')!);
```
Any middleware/parse step that touches the body first breaks the signature forever. Verify → then `JSON.parse(raw)` if you like.

### 5.5 Cron-called functions (follow-ups, reminders)
pg_cron can't send a user JWT, so:
```sql
select cron.schedule('daily-followups','0 7 * * *',
$$ select net.http_post(
     url:='https://<ref>.supabase.co/functions/v1/quote-followups',
     headers:=jsonb_build_object('x-cron-secret','<long random>')) $$);
```
The function's first line compares `x-cron-secret` to its env copy; mismatch → 401. Claude's role here is narrow by design: filling **locked admin-approved templates** with specifics (job summary, names), with a code-side validation fallback to plain merge-fields — tone is never model-controlled (§9.1).

### 5.6 Ops assistant (Week 5): the tool-use loop
Verify admin JWT → loop: send history + tool definitions → Claude returns `tool_use` → execute the named TypeScript function (each internally admin-scoped) → append `tool_result` → repeat (cap ~6) → final text. Reads render directly; `schedule_job` returns a *proposed action* that Bubble displays and the admin confirms before a separate gated call executes it; drafts go to an outbox, never auto-sent; everything logged to `assistant_actions` (§10).

---

## §6. GitHub ↔ Supabase (your pain point #2, concretely)

There is no magic sync — the link is **the Supabase CLI running against files in your repo**. The project uses **one monorepo**:
```
fieldquote/
  supabase/       ← migrations + edge functions (this section)
  landing/        ← Next.js app; Vercel's Root Directory setting points here, so only this folder builds/deploys
  tests/rls/
```
One-time:
```bash
npm i -g supabase
cd fieldquote && supabase init             # creates supabase/ folder
supabase login                             # browser auth
supabase link --project-ref <ref>         # from dashboard URL
```
Daily loop:
```bash
supabase migration new add_jobs_tables     # → supabase/migrations/<ts>_add_jobs_tables.sql (write SQL, commit)
supabase db push                           # applies pending migrations to the cloud DB
supabase functions deploy draft-quote      # ships one edge function
supabase secrets set STRIPE_SECRET_KEY=sk_test_...   # env for ALL functions
supabase functions serve draft-quote       # local test against real env (optional)
```
Rules that keep you sane: **never** edit schema in the dashboard editor (if you slip, `supabase db diff -f fix_drift` captures it back into a migration); migrations are append-only — a mistake gets a *new* corrective migration, not an edit to an applied one; secrets are never in Git (`.env` is gitignored; keep a valueless `.env.example`). Optional polish once comfortable: a GitHub Action running `supabase db push && supabase functions deploy` on merge to main — nice, not required for this project.

---

## §7. Every secret, and exactly where it lives

| Secret | Where it's set | Used by | Never in |
|---|---|---|---|
| Supabase anon key | Bubble API Connector (private shared header) + landing page env | Bubble calls, realtime bridge, waitlist insert | — (public-by-design; RLS protects) |
| Supabase service-role key | `supabase secrets set` | Edge functions only | Bubble, Git, browser, landing |
| Supabase URL / project ref | Bubble connector, landing env | everything | fine anywhere |
| `ANTHROPIC_API_KEY` (agency) | supabase secrets | draft-quote (when switched), followups, ops-assistant | Bubble, Git |
| `ZAI_API_KEY` (Z.AI GLM primary) | supabase secrets | draft-quote | Bubble, Git |
| `ZAI_MODEL` (default `glm-4.6v-flash`) | supabase secrets | draft-quote | Bubble, Git |
| `OPENROUTER_API_KEY` (fallback) | supabase secrets | draft-quote | Bubble, Git |
| `OPENROUTER_MODEL` (e.g. `google/gemini-2.0-flash-001`) | supabase secrets | draft-quote | Bubble, Git |
| `STRIPE_SECRET_KEY` (test) | supabase secrets | create-checkout, webhook | Bubble, Git |
| `STRIPE_WEBHOOK_SECRET` | supabase secrets (from Stripe dashboard after registering the endpoint) | stripe-webhook | anywhere else |
| Stripe publishable key | not needed (hosted Checkout via redirect URL) | — | — |
| `RESEND_API_KEY` (agency domain) | supabase secrets | every mail-sending function | Bubble, Git |
| `RESEND_FROM_EMAIL` (verified address) | supabase secrets | `from:` address; display name = `company_settings.name` | optional — defaults `dev@raftworks.co` |
| `EMAIL_ASSET_BASE_URL` / `PUBLIC_LANDING_URL` (Vercel origin, public) | supabase secrets | branded email logo (`/logos/logo-email.png`) | optional — text wordmark if unset |
| `BUBBLE_PASSWORD_SETUP_URL` | supabase secrets | invite + password-reset links | optional — defaults to Bubble test `password_setup` |
| `PUBLIC_QUOTE_PAGE_URL` | supabase secrets | send-quote customer link | optional — defaults to Bubble test `q` |
| `R2_ACCESS_KEY_ID` / `R2_SECRET` / account id / bucket | supabase secrets | r2-presign | Bubble, Git |
| `MAKE_WEBHOOK_URL` | supabase secrets | stripe-webhook (final-payment branch) | Bubble (treat as secret — anyone with it can fire your scenario) |
| `CRON_SECRET` (you invent it) | supabase secrets + the cron SQL | cron-called functions | Bubble |
| Vercel env (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) | Vercel dashboard → project → Environment Variables | landing waitlist form | Git |

Bubble holds exactly **one** sensitive-ish value (the anon key) and it's the one designed to be exposed. If you ever feel the urge to paste any other key into Bubble, that feature belongs in an edge function.

---

## §8. Vercel ↔ Bubble (your pain point #1 — the honest answer)

**In this architecture, Vercel and Bubble never talk to each other. There is no API call, no CORS setup, no shared auth token between them.** The confusion dissolves once you see the topology:

```
Landing page (Next.js on Vercel) ──"Open App" link──▶  Bubble app (separate URL)
        │
        └── waitlist form ──▶ Supabase (anon INSERT on waitlist) ──▶ Resend confirmation
```

- The landing page is a brochure. Its only dynamic behavior is the waitlist form, which talks to **Supabase**, not Bubble — a server action (or route handler) using the anon key against the insert-only `waitlist` policy, then calling the `submit-waitlist` function for the confirmation email.
- The connection to Bubble is a hyperlink. Ideally: landing at `fieldquote.com` (Vercel), app at `app.fieldquote.com` (Bubble custom domain) — two DNS records, zero integration code.
- Auth tokens never cross: nobody logs in on the landing page (no self-registration exists, §3); staff log in inside Bubble against Supabase Auth.
- **CORS appears in this project in exactly two places, neither involving Vercel:** browser → edge functions (fixed by the §5.1 header block) and browser → R2 uploads (fixed by §5.2 bucket config). If you ever hit a CORS error mentioning Vercel or Bubble domains calling each other, you've wired something the architecture doesn't ask for — stop and re-check this section.
- The only thing Vercel and Supabase share is two public env vars (table in §7), set in the Vercel dashboard, not in code.

If a *future* project ever does need Vercel code to act on app data, the pattern remains "Vercel server → Supabase (or an edge function)" — Bubble is never an API server in this stack.

---

## §9. Pin this above your desk

1. Bubble = screens. PostgREST = authenticated CRUD. Edge functions = secrets, public callers, multi-step logic. pg_cron = the clock.
2. Empty list in Bubble? → check the Authorization header *first*.
3. Money is written by the webhook, from the webhook payload, idempotently — or not at all.
4. The AI proposes matches; your code sets prices; the admin approves; RLS enforces.
5. Every migration → re-run the RLS tests. Every webhook change → re-run the replay test.
