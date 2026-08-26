# pg_cron — quote follow-ups + daily reminders

**Scope:** §9.1–9.2 · Days 18–19 · `P2-backend.md` §5.5  
**Supabase:** `chqljfdmgdtsmbbwbdyv`  
**Company (v1):** `00000000-0000-0000-0000-000000000001`

---

## Steps

1. Deploy backend
2. Set cron secret (Vault on hosted)
3. Concepts — read before testing
4. Full test walkthrough (copy-paste)
5. **Code walkthrough — chunk by chunk (§7)**
6. **After deploy verification (§8)**
7. Bubble — pause + manual run (optional)
8. Automation activity feed (optional)

---

## 1. Deploy backend

1.1 `npx supabase db push` (migration `20260823120000_pg_cron_automations.sql`)  
1.2 Deploy functions:

```bash
npx supabase functions deploy quote-followups daily-reminders --no-verify-jwt --project-ref chqljfdmgdtsmbbwbdyv
```

1.3 Confirm edge secret exists: `npx supabase secrets list` → `**CRON_SECRET**`

1.4 Set the cron password so **Postgres** can send it when the 7am alarm fires.

**Hosted Supabase (your case) — `ALTER DATABASE` will fail:**

```text
ERROR: permission denied to set parameter "app.settings.cron_secret"
```

This is **not** a missing dashboard toggle. On hosted Supabase you are **not** a full Postgres superuser. Custom `app.settings.`* database parameters are blocked on purpose (security / multi-tenant). **No org setting unlocks this** for normal project members.

**What still works without any DB secret:**

- Manual **curl** with header `x-cron-secret: <CRON_SECRET>`
- Bubble **admin JWT** POST to the same function URLs

**What you CAN set yourself (recommended on hosted): Supabase Vault**

After `db push` includes migration `20260824120000_cron_secret_vault.sql`:

1. Supabase dashboard → **SQL Editor** (or **Database → Vault** UI)
2. Run **once** (paste the **same** value as edge secret `CRON_SECRET`):

```sql
select vault.create_secret(
  '<paste-CRON_SECRET-here>',
  'cron_secret',
  'Must match supabase secrets CRON_SECRET'
);
```

1. Verify (you should see one row; `decrypted_secret` matches):

```sql
select name, decrypted_secret
from vault.decrypted_secrets
where name = 'cron_secret';
```

1. Optional smoke test — should return a number (request id), not null:

```sql
select public.cron_post_edge('quote-followups');
```

**Self-hosted / full superuser only** (hosted: skip):

```sql
alter database postgres set app.settings.cron_secret = '<same-as-CRON_SECRET>';
select pg_reload_conf();
```

Edge function always reads `**CRON_SECRET**` from Supabase secrets. Vault (or GUC) is only so **pg_cron / triggers** know the same password when they HTTP-call the function.

---

## 2. Why two places for the same password?


| Copy lives in                                                    | Used by                                                                        |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Supabase Edge secrets → `CRON_SECRET`                            | `quote-followups`, `daily-reminders` when checking the header                  |
| Vault → name `cron_secret` **or** GUC `app.settings.cron_secret` | Postgres `cron_post_edge` / complete-job trigger when **making** the HTTP call |


Both must be the **same string**. You set Vault yourself; edge secret is set via `supabase secrets set CRON_SECRET=...`.

---

## 3. Concepts — read before testing

### 3.1 What is `invoice_nudge_exhausted` on `jobs`?

**Plain English:** After a job is **completed**, the customer gets a **final invoice email** (from `send-final-invoice`). If they still have not paid the remaining balance, the daily robot can send up to **two reminder emails** (“friendly nudge, please pay”).


| Column                    | Type    | Default | Meaning                                                                                                                  |
| ------------------------- | ------- | ------- | ------------------------------------------------------------------------------------------------------------------------ |
| `invoice_nudge_exhausted` | boolean | `false` | `false` = OK to send nudges (if other rules pass). `true` = **stop** sending `final_invoice_nudge` for this job forever. |


**When it flips to `true`:**

- After the **2nd** successful `final_invoice_nudge` row in `email_log` for that job, **or**
- On a run that finds 2 nudges already logged.

**What it does *not* do:** It does not block the original `final_invoice` email. It does not mark the job paid. It only stops **extra nag emails**.

**Why it exists:** Scope says invoice nudges at +3 and +7 days, **never more** — then admin handles it manually.

---

### 3.2 How `CRON_SECRET` keeps this secure

pg_cron has **no user login**. Anyone who could hit your function URL could theoretically trigger automations. So we use a **shared secret** (a long random string only the server knows).

**Two places store the same password:**


| Where                 | Name                                                      | Who reads it                                               |
| --------------------- | --------------------------------------------------------- | ---------------------------------------------------------- |
| Supabase Edge secrets | `CRON_SECRET`                                             | TypeScript in `quote-followups` / `daily-reminders`        |
| Postgres              | Vault `cron_secret` **or** GUC `app.settings.cron_secret` | `cron_post_edge` when pg_cron runs (hosted: use **Vault**) |


**What happens on each request:**

```
Request arrives at edge function
    ↓
Header x-cron-secret present?
    ↓
Compare to CRON_SECRET (character-by-character, timing-safe)
    ↓
Match → allowed (service role, full DB access after this gate)
No match → try admin JWT instead; else 401
```

**Why this is enough for cron:**

- URL is public, but **password is not** in Bubble, Git, or browser.
- Wrong password → function exits before reading quotes/jobs or sending mail.
- `--no-verify-jwt` on deploy only means Supabase gateway does not require a Supabase JWT — **your code still requires cron secret or admin JWT**.

**What cron secret does *not* protect:** If someone steals `CRON_SECRET`, they could trigger runs. Treat it like a password — same tier as `CRON_SECRET` in `.env.example`, never in Bubble.

---

### 3.3 How pg_cron + pg_net call the edge function (full chain)

**We do not call other edge functions** for these automations. One cron job → **one** edge function → that function talks to **Postgres + Resend** directly.

```
┌─────────────────────────────────────────────────────────────┐
│  pg_cron (alarm clock inside Postgres)                       │
│  Job: quote-followups-daily @ 07:00 UTC every day             │
└──────────────────────────┬──────────────────────────────────┘
                           │ runs SQL:
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  public.cron_post_edge('quote-followups')                    │
│  • reads app.settings.cron_secret                            │
│  • if missing → WARNING in logs, no HTTP (safe no-op)        │
└──────────────────────────┬──────────────────────────────────┘
                           │ pg_net:
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  net.http_post(                                              │
│    url = .../functions/v1/quote-followups,                   │
│    headers = { x-cron-secret: <secret>, content-type: json },│
│    body = { "source": "pg_cron" }                            │
│  )                                                           │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTPS POST
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  Edge: quote-followups/index.ts                              │
│  1. cronSecretOk(req)  ← compares header vs CRON_SECRET      │
│  2. service-role Supabase client                             │
│  3. query quotes / jobs                                      │
│  4. sendAndLogEmail → Resend API                             │
│  5. insert email_log                                         │
│  6. update quotes.status / jobs.invoice_nudge_exhausted      │
│  • Does NOT call send-quote, send-final-invoice, etc.        │
└─────────────────────────────────────────────────────────────┘
```

**Second job (07:15 UTC):** same pattern, path `daily-reminders`.

**Manual test:** You replace pg_cron with **curl** — same URL, same `x-cron-secret` header. Optional body `{"now":"..."}` to fake the date.

**Admin manual test:** POST with `Authorization: Bearer <admin JWT>` instead of cron secret — function runs for **your company only**.

---

### 3.4 “Mail opened” vs “quote page opened” — important

**We do NOT track whether the customer opened the email** (no open pixel, no Resend open webhook in this build).

For quote follow-ups we track whether they **opened the quote web page** (`/q?token=...`):


| What we measure                | Where it comes from                                                      | Used for                         |
| ------------------------------ | ------------------------------------------------------------------------ | -------------------------------- |
| Quote email sent               | `quotes.status = sent` after admin Send                                  | Start 48h timer                  |
| Customer opened **quote page** | `resolve-quote-token` sets `viewed_at` + `status = viewed` on first load | “Viewed but not accepted” branch |
| Customer paid / declined       | `accepted` / `declined` status                                           | No more follow-ups               |


**Flow:**

```
Customer gets email with link → /q?token=abc...
    ↓
Bubble page loads → calls resolve-quote-token
    ↓
First time: quotes.viewed_at = now, status = viewed
    ↓
quote-followups uses viewed_at (NOT email tracking)
```

So:

- `**quote_followup_sent**` = “quote still `sent`, `viewed_at` empty, 48h since send” → we assume they have **not** opened the **page**.
- `**quote_followup_viewed**` = “status `viewed`, `viewed_at` 3+ days ago” → they **did** open the page but did not accept.

If they open the email but never click the link, we still treat them as “unviewed” and send the first follow-up. That matches scope (sent-unviewed), not email-analytics.

---

### 3.5 Email caps (how we avoid spam)

Every send writes `**email_log**`. Before sending, we **count** rows:


| Automation           | Cap                                  | Templates counted                                             |
| -------------------- | ------------------------------------ | ------------------------------------------------------------- |
| Quote follow-ups     | **2 total per quote**                | `quote_followup_sent`, `quote_followup_viewed`                |
| Final invoice nudges | **2 per job**                        | `final_invoice_nudge` → then `invoice_nudge_exhausted = true` |
| Appointment reminder | **1 per customer email per UTC day** | `appointment_reminder`                                        |
| Tech digest          | **1 per tech email per UTC day**     | `tech_daily_digest`                                           |


---

## 4. Full test walkthrough (copy-paste)

**Replace `YOUR_CRON_SECRET`** with your real secret (from Supabase secrets — do not commit it).

**Base URLs:**


| Function         | URL                                                                     |
| ---------------- | ----------------------------------------------------------------------- |
| Quote follow-ups | `https://chqljfdmgdtsmbbwbdyv.supabase.co/functions/v1/quote-followups` |
| Daily reminders  | `https://chqljfdmgdtsmbbwbdyv.supabase.co/functions/v1/daily-reminders` |


After every test, check:

- **Supabase → `email_log`** (template, `to_email`, `status`)
- **Function JSON response** (`expired`, `sent_reminders`, `invoice_nudges`, etc.)

---

### 4.1 Test A — Security: wrong secret fails

```bash
curl -sS -X POST 'https://chqljfdmgdtsmbbwbdyv.supabase.co/functions/v1/quote-followups' \
  -H 'Content-Type: application/json' \
  -H 'x-cron-secret: wrong-password' \
  -d '{}'
```

**Expect:** HTTP **401**, body like `{"error":"Not allowed"}` or admin-required message. **No** new `email_log` rows.

---

### 4.2 Test B — Expire an overdue quote

**Setup (Table Editor → `quotes`):**


| Column        | Value                             |
| ------------- | --------------------------------- |
| `status`      | `sent`                            |
| `valid_until` | yesterday (any time in the past)  |
| `token`       | at least 20 chars (keep existing) |


**Run:**

```bash
curl -sS -X POST 'https://chqljfdmgdtsmbbwbdyv.supabase.co/functions/v1/quote-followups' \
  -H 'Content-Type: application/json' \
  -H 'x-cron-secret: YOUR_CRON_SECRET' \78e81307-0664-478e-9ba8-8af020585903
  -d '{"now":"2026-08-25T12:00:00.000Z"}'
```

**Expect:**

- Response: `"expired": 1` (or more if multiple rows match)
- Quote row: `status` → `**expired**`
- Opening `/q?token=...` should show dead-end (resolve returns not actionable)

---

### 4.3 Test C — 48h “has not opened quote page” follow-up

**Setup (`quotes` + linked `requests` must have real `customer_email`):**


| Column        | Value                                     |
| ------------- | ----------------------------------------- |
| `status`      | `sent`                                    |
| `viewed_at`   | **NULL**                                  |
| `updated_at`  | at least **49 hours ago** (edit manually) |
| `valid_until` | **future** date                           |
| `token`       | valid token                               |


**Run:** same curl as Test B.

**Expect:**

- Response: `"sent_reminders": 1`
- `email_log`: new row, `template` = `**quote_followup_sent**`, `status` = `**sent**`
- Customer inbox: reminder with link to quote page

**Prove “open” tracking:** Open `/q?token=...` once → `viewed_at` fills, `status` → `**viewed`**. Re-run follow-ups → should **not** send another `quote_followup_sent` (same template already sent).

---

### 4.4 Test D — 3d “opened page but did not accept” follow-up

**Setup:**


| Column        | Value          |
| ------------- | -------------- |
| `status`      | `viewed`       |
| `viewed_at`   | **4 days ago** |
| `valid_until` | future         |
| `token`       | valid          |


Ensure `email_log` has **fewer than 2** follow-up templates for this quote id.

**Run:** same curl as Test B.

**Expect:**

- `"viewed_nudges": 1`
- `email_log`: `template` = `**quote_followup_viewed**`

---

### 4.5 Test E — Cap: no third follow-up email

**Setup:** For one `quote.id`, insert **two** rows in `email_log`:


| template                | related_id      | status |
| ----------------------- | --------------- | ------ |
| `quote_followup_sent`   | that quote uuid | `sent` |
| `quote_followup_viewed` | same uuid       | `sent` |


**Run:** quote-followups curl again.

**Expect:** `"skipped"` increases, **no** third email.

---

### 4.6 Test F — Tomorrow appointment reminder (T-1)

**Setup (`jobs`):**


| Column           | Value                                                     |
| ---------------- | --------------------------------------------------------- |
| `status`         | `scheduled`                                               |
| `scheduled_at`   | **tomorrow** 10:00 UTC (pick date relative to your `now`) |
| `customer_email` | your test inbox                                           |


**Run** (set `now` to **today** UTC midday):

```bash
curl -sS -X POST 'https://chqljfdmgdtsmbbwbdyv.supabase.co/functions/v1/daily-reminders' \
  -H 'Content-Type: application/json' \
  -H 'x-cron-secret: YOUR_CRON_SECRET' \
  -d '{"now":"2026-08-24T12:00:00.000Z"}'
```

(Adjust `now` and `scheduled_at` so “tomorrow” lines up.)

**Expect:**

- `"appointment_reminders": 1`
- `email_log`: `**appointment_reminder**`

---

### 4.7 Test G — Tech morning digest

**Setup:** Two+ jobs **same** `technician_id`, `status` = `scheduled`, `scheduled_at` = **today** UTC, tech has email on `**profiles`**.

**Run:** daily-reminders curl with `now` = today.

**Expect:**

- `"tech_digests": 1`
- One email to tech with bullet list of jobs

---

### 4.8 Test H — Final invoice nudge + `invoice_nudge_exhausted`

**Setup:**

1. `**jobs`:** `status` = `**completed`**, `invoice_nudge_exhausted` = `**false**`
2. `**payments`:** no row with `kind` = `**final`** and `status` = `**succeeded**` for that quote
3. `**email_log`:** one row with `template` = `**final_invoice`**, `related_id` = **job id**, `sent_at` = **4 days ago**

**Run:**

```bash
curl -sS -X POST 'https://chqljfdmgdtsmbbwbdyv.supabase.co/functions/v1/daily-reminders' \
  -H 'Content-Type: application/json' \
  -H 'x-cron-secret: YOUR_CRON_SECRET' \
  -d '{"now":"2026-08-28T12:00:00.000Z"}'
```

(Pick `now` so it is ≥ 3 days after `final_invoice.sent_at`.)

**Expect (first nudge):**

- `"invoice_nudges": 1`
- `email_log`: `**final_invoice_nudge**`
- Job: `invoice_nudge_exhausted` still `**false**`

**Second nudge:** Change `final_invoice.sent_at` to **8 days ago**, ensure one nudge already in log, run again with `now` ≥ 7 days after invoice sent.

**Expect (second nudge):**

- Another `final_invoice_nudge`
- Job: `**invoice_nudge_exhausted**` → `**true**`

**Third run:** Same job → skipped, **no** email.

---

### 4.9 Test I — Pause automations

**Setup:** `company_settings.automations_paused` = `**true`**

**Run:** either function with valid secret.

**Expect:** mostly `"skipped"`, no new emails.

Reset to `**false**` when done.

---

### 4.10 Test J — Verify pg_cron jobs exist (SQL)

```sql
select jobid, jobname, schedule, command
from cron.job
where jobname in ('quote-followups-daily', 'daily-reminders-daily');
```

**Expect:** two rows, schedules `0 7 * * `* and `15 7 * * *`.

---

## 5. Bubble — pause + manual run (optional)

### 5.1 Pause automations

Patch `**company_settings.automations_paused**` (boolean) from Settings toggle.

### 5.2 Manual run buttons (admin)


| Name                  | URL                                                                     |
| --------------------- | ----------------------------------------------------------------------- |
| `Run Quote Followups` | `https://chqljfdmgdtsmbbwbdyv.supabase.co/functions/v1/quote-followups` |
| `Run Daily Reminders` | `https://chqljfdmgdtsmbbwbdyv.supabase.co/functions/v1/daily-reminders` |



| Setting        | Value                                                                  |
| -------------- | ---------------------------------------------------------------------- |
| Method         | POST                                                                   |
| Body           | `{}` or `{"now":"<ISO>"}`                                              |
| Headers        | `Authorization: Bearer <admin JWT>` · `Content-Type: application/json` |
| Include errors | ON                                                                     |


---

## 6. Automation activity feed (optional)

List `**email_log**` where `template` in:

`quote_followup_sent`, `quote_followup_viewed`, `appointment_reminder`, `tech_daily_digest`, `final_invoice_nudge`

Sort `sent_at` desc.

---

## Schedule (UTC)


| Job                     | Time  | Edge function     | Calls other functions?    |
| ----------------------- | ----- | ----------------- | ------------------------- |
| `quote-followups-daily` | 07:00 | `quote-followups` | **No** — Resend + DB only |
| `daily-reminders-daily` | 07:15 | `daily-reminders` | **No** — Resend + DB only |


---

## Files in repo


| Path                                                         | Role                                              |
| ------------------------------------------------------------ | ------------------------------------------------- |
| `supabase/migrations/20260823120000_pg_cron_automations.sql` | pg_cron schedules + columns                       |
| `supabase/migrations/20260824120000_cron_secret_vault.sql`   | Vault fallback for hosted (no ALTER DATABASE)     |
| `supabase/functions/quote-followups/index.ts`                | Quote expire + follow-ups                         |
| `supabase/functions/daily-reminders/index.ts`                | Appointments, digest, invoice nudges              |
| `supabase/functions/_shared/cron-auth.ts`                    | Secret + admin gate                               |
| `supabase/functions/_shared/send-email.ts`                   | Resend + `email_log`                              |
| `supabase/functions/resolve-quote-token/index.ts`            | Sets `viewed_at` (quote **page** open, not email) |


---

## 7. Code walkthrough — whole cycle, chunk by chunk

Read this top-to-bottom once. Order = **what runs first in real life**.

### 7.0 Big picture (one sentence per step)

```
07:00 UTC  →  pg_cron wakes up
           →  cron_post_edge reads Vault secret
           →  pg_net HTTP POST to quote-followups
           →  edge checks x-cron-secret vs CRON_SECRET
           →  edge reads quotes table, maybe sends Resend email
           →  edge writes email_log
           →  returns JSON stats
```

No other edge function is called in the middle. Resend is called **directly** from TypeScript.

---

### 7.1 Migration — schedule the alarm (`20260823120000_pg_cron_automations.sql`)

**Chunk A — turn on extensions**

```sql
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;
```


| Line      | What it does                                                   |
| --------- | -------------------------------------------------------------- |
| `pg_cron` | Alarm clock inside Postgres (“run this SQL every day at 7:00”) |
| `pg_net`  | Lets Postgres make HTTP calls out to your edge function URL    |


**Chunk B — new columns**

```sql
alter table company_settings add column automations_paused boolean default false;
alter table jobs add column invoice_nudge_exhausted boolean default false;
```


| Column                    | Plain English                         |
| ------------------------- | ------------------------------------- |
| `automations_paused`      | Master off switch per company         |
| `invoice_nudge_exhausted` | Stop invoice nag emails after 2 sends |


**Chunk C — register two daily jobs**

```sql
select cron.schedule('quote-followups-daily', '0 7 * * *',
  $$ select public.cron_post_edge('quote-followups'); $$);

select cron.schedule('daily-reminders-daily', '15 7 * * *',
  $$ select public.cron_post_edge('daily-reminders'); $$);
```


| Part                                | Meaning                        |
| ----------------------------------- | ------------------------------ |
| `'0 7 * * *'`                       | Every day at 07:00 UTC         |
| `'15 7 * * *'`                      | Every day at 07:15 UTC         |
| `cron_post_edge('quote-followups')` | The SQL that runs at that time |


---

### 7.2 Migration — Vault secret reader (`20260824120000_cron_secret_vault.sql`)

**Chunk A — `get_cron_secret()`**

```sql
select coalesce(
  (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret'),
  current_setting('app.settings.cron_secret', true)
);
```


| Line                   | What it does                                               |
| ---------------------- | ---------------------------------------------------------- |
| First subquery         | Read password from **Vault** (what you added in dashboard) |
| `current_setting(...)` | Fallback for self-hosted only (`ALTER DATABASE`)           |
| `coalesce`             | Use Vault first; if empty, try GUC                         |


**Chunk B — `cron_post_edge(path)` (updated version)**

```sql
secret := public.get_cron_secret();
if secret is null then return null; end if;

net.http_post(
  url := 'https://.../functions/v1/' || path,
  headers := jsonb_build_object('x-cron-secret', secret),
  body := '{"source":"pg_cron"}'
);
```


| Line                     | What it does                                                |
| ------------------------ | ----------------------------------------------------------- |
| `get_cron_secret()`      | Load password from Vault                                    |
| `return null` if missing | Safe no-op — cron “runs” but sends nothing                  |
| `net.http_post`          | Fire-and-forget HTTP POST (does not wait for response body) |
| `x-cron-secret` header   | Same password edge function expects                         |
| `return req_id`          | pg_net request id (for debugging)                           |


**Important:** This function does **not** call `quote-followups` logic in SQL. It only **HTTP-calls** the TypeScript function.

---

### 7.3 Shared — gatekeeper (`_shared/cron-auth.ts`)

**Chunk A — `cronSecretOk(req)`**

```typescript
const expected = Deno.env.get('CRON_SECRET')
const got = req.headers.get('x-cron-secret')
// compare character-by-character (timing-safe)
```


| Line            | What it does                                              |
| --------------- | --------------------------------------------------------- |
| `CRON_SECRET`   | Password stored in Supabase **Edge secrets** (not in Git) |
| `x-cron-secret` | Password Postgres sent in HTTP header                     |
| Compare loop    | Match → allowed. Wrong → rejected.                        |


**Chunk B — `requireCronOrAdmin(req)`**

```typescript
if (cronSecretOk(req)) {
  return serviceRoleClient  // full DB access for automation
}
const gate = await requireActiveAdmin(req)
if (gate.ok) return gate.caller.admin  // admin manual test, one company
return 401
```


| Path           | Who                     | Scope            |
| -------------- | ----------------------- | ---------------- |
| Cron secret OK | pg_cron / your curl     | All companies    |
| Admin JWT OK   | Bubble “Run now” button | One company only |
| Neither        | —                       | 401 Not allowed  |


---

### 7.4 Shared — send email + log (`_shared/send-email.ts`)

**Chunk A — `sendAndLogEmail(...)`**

```typescript
await fetch('https://api.resend.com/emails', { ... html, to, subject })
await admin.from('email_log').insert({ template, related_id, status: 'sent'|'failed' })
```


| Step               | What it does                                                 |
| ------------------ | ------------------------------------------------------------ |
| Resend API         | Actually delivers email                                      |
| `email_log` insert | **Always** logs attempt (scope rule: every send is recorded) |


**Chunk B — `countSentEmails(relatedId, templates)`**

```typescript
count from email_log where related_id = quote/job id AND template in (...) AND status = 'sent'
```


| Purpose                  | Plain English                                    |
| ------------------------ | ------------------------------------------------ |
| Before sending follow-up | “How many nudges already sent?” — if ≥ cap, skip |


---

### 7.5 Edge function — `quote-followups/index.ts`

**Chunk A — entry point**

```typescript
Deno.serve(async (req) => {
  const auth = await requireCronOrAdmin(req)   // 1. password check
  const now = parseNow(body.now)               // 2. fake clock for tests
  stats.expired = await expireQuotes(...)      // 3. mark overdue quotes expired
  // loop sent quotes → maybe email
  // loop viewed quotes → maybe email
  return { ok: true, ...stats }
})
```

**Chunk B — `expireQuotes`**

```typescript
quotes where status in ('sent','viewed') and valid_until < now
→ update status to 'expired'
```

Customer link dies on next `resolve-quote-token` call.

**Chunk C — 48h branch (loop over `status = sent`)**

```typescript
skip if: automations_paused
skip if: viewed_at is set (customer opened quote PAGE)
skip if: valid_until passed
skip if: updated_at less than 48 hours ago
skip if: email_log count >= 2 follow-ups
skip if: quote_followup_sent already sent for this quote
→ sendAndLogEmail template 'quote_followup_sent'
```

**Chunk D — 3d branch (loop over `status = viewed`)**

```typescript
skip if: viewed_at older than 3 days check fails
→ sendAndLogEmail template 'quote_followup_viewed'
```

**“Opened” tracking:** We do **not** read email open events. `viewed_at` is set by `**resolve-quote-token`** when customer loads `/q?token=...`.

---

### 7.6 Edge function — `daily-reminders/index.ts`

Same entry pattern (`requireCronOrAdmin` → `now` → work → JSON stats).

**Three separate loops:**


| Loop          | Finds                                                  | Sends                                   |
| ------------- | ------------------------------------------------------ | --------------------------------------- |
| T-1           | Jobs `scheduled` tomorrow                              | `appointment_reminder` to customer      |
| Digest        | Jobs today per tech                                    | `tech_daily_digest` to tech email       |
| Invoice nudge | Jobs `completed`, final invoice sent, no final payment | `final_invoice_nudge` at +3 and +7 days |


After 2 invoice nudges → `jobs.invoice_nudge_exhausted = true`.

---

### 7.7 End-to-end diagram (automatic path)

```
┌─────────────────────────────────────────────────────────────┐
│ LAYER 1: Postgres (runs inside Supabase database)            │
├─────────────────────────────────────────────────────────────┤
│ cron.job @ 07:00                                             │
│   → cron_post_edge('quote-followups')                        │
│       → get_cron_secret()  ← Vault name 'cron_secret'        │
│       → net.http_post(url, headers: x-cron-secret)           │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTPS
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ LAYER 2: Edge function (Deno on Supabase)                  │
├─────────────────────────────────────────────────────────────┤
│ quote-followups/index.ts                                     │
│   → cronSecretOk()  ← Deno.env CRON_SECRET                   │
│   → service role client                                      │
│   → SELECT/UPDATE quotes                                     │
│   → sendAndLogEmail → Resend API                             │
│   → INSERT email_log                                         │
│   → return { expired, sent_reminders, ... }                  │
└─────────────────────────────────────────────────────────────┘
```

**Two copies of the password must match:**


| Stored in                 | Read by                           |
| ------------------------- | --------------------------------- |
| Vault `cron_secret`       | `get_cron_secret()` → HTTP header |
| Edge secret `CRON_SECRET` | `cronSecretOk()` in TypeScript    |


---

## 8. After deploy — how to check everything works

Do these **in order**. Stop if a step fails.

### 8.1 Deploy checklist

```bash
npx supabase db push
npx supabase functions deploy quote-followups daily-reminders --no-verify-jwt --project-ref chqljfdmgdtsmbbwbdyv
```

Confirm edge secret exists (dashboard → Edge Functions → Secrets): `**CRON_SECRET**`

Confirm Vault (SQL editor):

```sql
select name from vault.decrypted_secrets where name = 'cron_secret';
-- must return 1 row
```

---

### 8.2 Layer 1 checks (Postgres only)

**Check A — secret readable**

```sql
select public.get_cron_secret() is not null as has_secret;
```


| Result  | Meaning                                           |
| ------- | ------------------------------------------------- |
| `true`  | Vault wired OK                                    |
| `false` | Fix Vault name or run `vault.create_secret` again |


**Check B — HTTP caller works**

```sql
select public.cron_post_edge('quote-followups') as request_id;
```


| Result      | Meaning                      |
| ----------- | ---------------------------- |
| Big integer | pg_net accepted the call     |
| `null`      | Secret missing — see Check A |


**Check C — cron jobs registered**

```sql
select jobname, schedule from cron.job
where jobname like '%followups%' or jobname like '%reminders%';
```

Expect **2 rows** (07:00 and 07:15 UTC).

**Check D — recent cron runs (after waiting or manual trigger)**

```sql
select jobid, status, return_message, start_time
from cron.job_run_details
order by start_time desc
limit 10;
```

Look for `succeeded` on your job names.

---

### 8.3 Layer 2 checks (edge function)

**Check E — wrong password rejected**

```bash
curl -sS -w '\nHTTP %{http_code}\n' -X POST 'https://chqljfdmgdtsmbbwbdyv.supabase.co/functions/v1/quote-followups' \
  -H 'Content-Type: application/json' \
  -H 'x-cron-secret: wrong-password' \
  -d '{}'
```

Expect **401** and `{"error":"Invalid x-cron-secret"}` (after redeploy with latest `cron-auth.ts`).

If you see `Missing Authorization Bearer token` instead, the deployed function is **old** — redeploy `quote-followups`. If you see `CRON_SECRET not set on edge function`, set the secret (§8.1).

**Check F — right password accepted**

```bash
curl -sS -X POST 'https://chqljfdmgdtsmbbwbdyv.supabase.co/functions/v1/quote-followups' \
  -H 'Content-Type: application/json' \
  -H 'x-cron-secret: YOUR_CRON_SECRET' \
  -d '{"now":"2026-08-25T12:00:00.000Z"}'
```

Expect **200** JSON like:

```json
{
  "ok": true,
  "now": "2026-08-25T12:00:00.000Z",
  "expired": 0,
  "sent_reminders": 0,
  "viewed_nudges": 0,
  "skipped": 5,
  "failed": 0
}
```

Numbers depend on your data. `**ok: true**` = function ran end-to-end.

**Check G — edge logs**

Supabase dashboard → **Edge Functions** → `quote-followups` → **Logs**  
Look for invocations at the time you ran curl or `cron_post_edge`.

---

### 8.4 Layer 3 checks (did it actually do something?)

**Check H — email_log**

```sql
select template, to_email, status, sent_at
from email_log
where template in (
  'quote_followup_sent',
  'quote_followup_viewed',
  'appointment_reminder',
  'tech_daily_digest',
  'final_invoice_nudge'
)
order by sent_at desc
limit 20;
```

New rows after a test = emails attempted. `status = sent` = Resend accepted.

**Check I — one real scenario (expire test)**

1. Set a test quote: `status = sent`, `valid_until` = yesterday
2. Run curl Check F
3. Confirm quote `status` → `**expired**`

**Check J — daily-reminders**

Same curl pattern but URL `/daily-reminders` after setting up a job scheduled for tomorrow (see §4.6).

---

### 8.5 “All green” summary


| #   | Check                 | Pass when                         |
| --- | --------------------- | --------------------------------- |
| 1   | `get_cron_secret()`   | not null                          |
| 2   | `cron_post_edge(...)` | returns request id                |
| 3   | `cron.job`            | 2 scheduled jobs                  |
| 4   | curl wrong secret     | 401                               |
| 5   | curl right secret     | 200, `"ok":true`                  |
| 6   | Edge logs             | invocation visible                |
| 7   | `email_log`           | rows when test data matches rules |
| 8   | Expire test           | quote → expired                   |


When all pass, automatic 07:00 / 07:15 UTC runs will use the same path as your successful curl / `cron_post_edge` test.

---

## 9. Quick reference — files ↔ runtime layer


| File                                     | Runs where | When                                   |
| ---------------------------------------- | ---------- | -------------------------------------- |
| `20260823120000_pg_cron_automations.sql` | Postgres   | Once at migrate — registers schedule   |
| `20260824120000_cron_secret_vault.sql`   | Postgres   | Once at migrate — Vault reader         |
| `cron_post_edge` (SQL function)          | Postgres   | Every cron fire + manual SQL test      |
| `quote-followups/index.ts`               | Edge       | After HTTP POST lands                  |
| `daily-reminders/index.ts`               | Edge       | After HTTP POST lands                  |
| `cron-auth.ts`                           | Edge       | First line of every automation handler |
| `send-email.ts`                          | Edge       | Every email send inside handlers       |
| Vault `cron_secret`                      | Postgres   | Read by `get_cron_secret`              |
| `CRON_SECRET` (edge secret)              | Edge       | Read by `cronSecretOk`                 |


