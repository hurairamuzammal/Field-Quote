# Admin assign technician (Week 4)

Webhook is **live**. Deposit → `payments` row + `jobs` (`unscheduled`, `technician_id` null). Admin **tracks money** and **assigns techs** on the desktop. No auto-assign.

**Related:** `P1-roadmap.md` Day 16 · `stripe-webhook` · auth `DB - Get Technicians`  
**Supabase:** `chqljfdmgdtsmbbwbdyv`  
**Public `q` / `q-success`:** unchanged.

**UI (locked):** two tables only — **Payments** (Assigned / Unassigned) + **Jobs**. No separate “Needs assignment” / Unassigned-jobs table (that duplicated Jobs).

---

## Steps
1. What Assigned / Unassigned means
2. Admin UI (Payments + Jobs + popup)
3. Page custom states
4. Include errors (lists OFF)
5. `DB - List Payments`
6. `DB - List Jobs`
7. `DB - Get Job`
8. `DB - Get Technicians`
9. `DB - Patch Job`
10. Popup Assign + workflows
11. Test

---

## 1. When payment / job rows appear

Nothing is written while the customer is on Stripe Checkout. **Failed / abandoned cards create no row.**

| Step | What writes | `payments` | `jobs` |
|---|---|---|---|
| Quote sent | `send-quote` | — | — |
| Customer **pays deposit** (Checkout succeeds) | `stripe-webhook` | **First insert** (`kind=deposit`, `status=succeeded`) | **Created here** (`unscheduled`, tech null) in the same webhook, *before* the payment insert |
| Admin Save in Assign | `DB - Patch Job` | unchanged | **Same row updated** → tech + `scheduled` |
| Customer pays **final** (later) | webhook again | Second insert (`kind=final`) | Job already exists — not created again |

So: **Payments table first row = first successful deposit.** Pay-status is always `succeeded` on that row — **do not show it.** Show customer, amount paid, scheduled or not.

`jobs.technician_id` is a UUID. The **name** is on `profiles` — embed it on the Jobs table (§6).

Do **not** add `DB - List Jobs Unassigned` or `DB - List Payments Unassigned`.

```
Payments                     Jobs
customer + paid +            customer + job status +
scheduled / not              technician name / None
```

---

## 2. Admin UI (Payments + Jobs + popup)

`admin_dashboard` panel Jobs (or Payments + Jobs).

```
┌─ Payments ───────────────────────────────────────────┐
│  When | Customer | Kind | Paid | Scheduled? | [Assign] │
└──────────────────────────────────────────────────────┘

┌─ Jobs ───────────────────────────────────────────────┐
│  Customer | Status | Technician | Scheduled | [ Assign ] │
└──────────────────────────────────────────────────────┘

┌─ Popup Assign ───────────────────────────────────────┐
│  Customer + totals (Get Job)                           │
│  Dropdown tech + date/time + duration                  │
│  [ Save ] [ Cancel ]                                   │
└───────────────────────────────────────────────────────┘
```

| Table | Call | Schedule / tech column | Assign button |
|---|---|---|---|
| Payments | `DB - List Payments` | `jobs`’s `status` is `unscheduled` (or empty) → **Not scheduled**; else **Scheduled** | Only when not scheduled → `s_job_id` = `jobs`’s `id` (or `job_id`) |
| Jobs | `DB - List Jobs` | `technician`’s `full_name`; empty → **None** | Yes if `technician_id` empty; optional Edit if set |

**Do not build** a third “Needs assignment” table.

**Order:** Initialize GETs + Patch → then bind UI.

---

## 3. Page custom states

On `admin_dashboard` (SessionKeeper on the page).

| State | Type | Default | Purpose |
|---|---|---|---|
| `s_job_id` | text | empty | Job opened in Assign |
| `s_jobs_ts` | number | 0 | Bust Jobs list |
| `s_payments_ts` | number | 0 | Bust Payments list |
| `s_assign_busy` | yes/no | no | Disable Save |

States live on **Current page** `admin_dashboard` (same as `s_quotes_ts`). After Patch: bump **both**. See §5 / §6 table `bust` bind.

---

## 4. Include errors (lists OFF)

`[]` (no rows) is **HTTP 200**, not an error. You still see real failures: Initialize shows 401/400; empty JWT → empty table (conditional).

If you tick Include errors on a list GET, Bubble wraps the payload as one object (`body` / `error` / `headers`). The Table wants a **list of rows** → Issue Checker red: **“evaluates to DB - List Payments”** / **List Jobs** (same bug as Requests / Quote Lines in guide 08).

| Call | Include errors | Why |
|---|---|---|
| List Payments, List Jobs, Get Technicians | **OFF** | Keep `is_list` + flat `id`, `status`, … |
| Get Job (Data) | **OFF** | Plus `Accept: object+json` so it is **one object**, not a list |
| Patch Job (Action) | **ON** | Save workflow can branch on `returned_an_error` |

Do **not** turn Include errors on to “see warnings” on tables. Use Initialize + Patch’s error branch. Snackbars = later (`tasks/03-admin-snackbars.md`).

---

## 5. `DB - List Payments`

Ledger of **successful** pays. No Pay-status column (`status` is always `succeeded`). Customer comes from `quotes → requests`. Scheduled? comes from nested `jobs.status`.

| Setting | Exact value |
|---|---|
| **Name** | `DB - List Payments` |
| **Use as** | **Data** |
| **Method** | GET |
| **URL** | `https://chqljfdmgdtsmbbwbdyv.supabase.co/rest/v1/payments?select=id,kind,amount,currency,quote_id,job_id,created_at,quotes(id,status,total,deposit_amount,requests(customer_name)),jobs(id,status,scheduled_at,technician_id)&order=created_at.desc&limit=100&status=neq.[bust]` |
| **Include errors** | **OFF** |

### Headers

| Header | Value | Private? | What it does |
|---|---|---|---|
| `apikey` | anon key (shared) | **yes** | Gateway |
| `Authorization` | `Bearer <access_token>` | **no** | Admin JWT |

### Placeholders

| Placeholder | Type | Meaning | Initialize | Workflow / Table |
|---|---|---|---|---|
| `<access_token>` | header | Admin JWT | paste JWT, **no** quotes | `Current User's sb_access_token` |
| `[bust]` | number | Refetch clock | `0` | page `s_payments_ts` |

`status=neq.[bust]` still busts on the DB column `payments.status` (always `succeeded` ≠ unix). It is **not** shown in the table.

**Re-Initialize** after this `select=` (dropped pay `status`; added `quotes` + `requests`).

### Success shape (list)

`id`, `kind` (`deposit` / `final`), `amount`, `currency`, `quote_id`, `job_id`, `created_at`, nested `quotes` (`total`, `deposit_amount`, `status`) + `quotes.requests` (`customer_name`), nested `jobs` (`id`, `status`, `scheduled_at`, `technician_id`).

Embeds: `payments.quote_id` → quotes → requests; `payments.job_id` → jobs. Practice: `learn/06-postgrest-embed-practice.md`.

Nested objects must appear after Initialize — if `quotes` / `jobs` missing, JWT / RLS / `select=` is wrong.

### Error table

| Status | Meaning | Fix |
|---|---|---|
| `[]` | No payments, or empty JWT | Pay a deposit; check SessionKeeper |
| 401 | Expired JWT | Refresh |
| 400 | Bad `select=` / embed name | Copy URL exactly |

### Table bind

| Column | Source |
|---|---|
| When | `created_at` |
| Customer | `quotes`’s `requests`’s `customer_name` |
| Kind | `kind` (`deposit` / later `final`) |
| Paid | `amount` + `currency` |
| Scheduled? | `jobs`’s `status` is `unscheduled` or `jobs` empty → **Not scheduled**; else **Scheduled** |
| Action | Only when not scheduled: **Assign** → `s_job_id` = `jobs`’s `id` (or `job_id`) |

Do **not** bind payments `status` (always succeeded).

**Table data source:** Get API → `DB - List Payments` · Bearer = access token · **`bust` = Current page’s `s_payments_ts`**.

Conditional: token empty → Data source empty.

Technicians **must not** get this call on their page (no payments policy for techs — would return `[]`).

### Table red: “evaluates to DB - List Payments”

| Check | Fix |
|---|---|
| Include errors ON | **OFF** → **Re-initialize**. Raw body starts with `[`. Fields flat on the item — **not** `body` / `error` / `headers`. |
| `Accept: object+json` on this list | **Remove it** (only on Get Job + Patch Job). |
| Data source has `:first item` | Remove it. |
| Type of content = “list of …” | Pick the **item** type (same name as the call, like Price Book). |

---

## 6. `DB - List Jobs`

All jobs (assigned + not). Same headers as §5 (`apikey` private, `Authorization` Bearer `<access_token>`).

| Setting | Exact value |
|---|---|
| **Name** | `DB - List Jobs` |
| **Use as** | **Data** |
| **Method** | GET |
| **URL** | `https://chqljfdmgdtsmbbwbdyv.supabase.co/rest/v1/jobs?select=id,quote_id,status,technician_id,scheduled_at,duration_min,created_at,technician:profiles(id,full_name),quotes(id,status,total,deposit_amount,requests(customer_name))&order=created_at.desc&limit=100&status=neq.[bust]` |
| **Include errors** | **OFF** |

| Placeholder | Type | Meaning | Initialize | Table |
|---|---|---|---|---|
| `<access_token>` | header | Admin JWT | JWT, no quotes | `Current User's sb_access_token` |
| `[bust]` | number | Refetch clock | `0` | Current page `s_jobs_ts` |

If you already have a thin `DB - Get Jobs`, **replace `select=`** with this URL or add this call. Never `select=*`.

Do **not** Duplicate List Payments (or any other call) to make this — **Add another call** from scratch. Duplicate shares the type → Table red.

`technician:profiles(id,full_name)` is the name embed: `jobs.technician_id` → `profiles.id`. Alias `technician` so Bubble shows a nested **technician** object, not `profiles`. Unassigned jobs: that object is **null** (job still listed).

**Re-Initialize** after this `select=` change or `technician` never appears.

### Success shape (list)

`id`, `quote_id`, `status`, `technician_id`, `scheduled_at`, `created_at`, nested `technician` (`id`, `full_name`) or null, nested `quotes` (`total`, `deposit_amount`, `status`), nested `quotes.requests` (`customer_name`).

### Table bind

| Column | Source |
|---|---|
| Customer | nested `requests` `customer_name` |
| Status | `status` |
| Technician | Assigned → name; else **None** (below) |
| When | `scheduled_at` |
| Assign | visible when `technician_id` is empty |

**Technician cell (text):**

1. Default text = Current row’s `technician`’s `full_name`
2. Conditional: when Current row’s `technician` is empty **or** `technician_id` is empty → text = `None`

Do not show the UUID. Nested `technician` is null until Assign Save; after bust it becomes the name.

Type of content **and** Data source = **`DB - List Jobs`**. Bearer = access token · **`bust` = Current page’s `s_jobs_ts`**. Conditional: token empty → Data source empty.

### Table red: “evaluates to DB - List Jobs”

Same as §5: Include errors **OFF**, no `object+json`, no `:first item`, item type not “list of …”. Raw Initialize: HTTP 200, payload `[` … `]`, flat fields — mirror `DB - Get Price Book`.

If Get Job / List Jobs collide: Get Job must have `Accept: object+json` (§7). Lists must not.

---

## 7. `DB - Get Job`

One job + customer/totals for the Assign popup header.

| Setting | Exact value |
|---|---|
| **Name** | `DB - Get Job` |
| **Use as** | **Data** (or Action if you only fetch on Open) |
| **Method** | GET |
| **URL** | `https://chqljfdmgdtsmbbwbdyv.supabase.co/rest/v1/jobs?id=eq.[job_id]&select=id,quote_id,status,technician_id,scheduled_at,duration_min,technician:profiles(id,full_name),quotes(id,status,total,deposit_amount,tax_amount,requests(customer_name,customer_email,customer_address,description))` |
| **Include errors** | **OFF** for Data |

### Headers

| Header | Value | Private? | What it does |
|---|---|---|---|
| `apikey` | anon key | **yes** | Gateway |
| `Authorization` | `Bearer <access_token>` | **no** | Admin JWT |
| `Accept` | `application/vnd.pgrst.object+json` | no | Single row |

| Placeholder | Type | Meaning | Initialize | Workflow / Group |
|---|---|---|---|---|
| `[job_id]` | text (URL) | Job UUID | a real jobs.id, **no** extra quotes in the value Bubble sends | `s_job_id` **plain** — never `:formatted as JSON-safe` |
| `<access_token>` | header | Admin JWT | JWT, no quotes | `Current User's sb_access_token` |

### Success shape

One object: job fields + nested `technician` (`id`, `full_name`) or null + `quotes` + `quotes.requests` (`customer_name`, `email`, `address`, `description`).

Popup texts bind to this call with `job_id = s_job_id` **only when** `s_job_id` is not empty.

If Get Job **evaluates to List Jobs** (a list): the `Accept: object+json` header is missing, or Include errors is ON. Add Accept, Include errors OFF, Initialize with **one** real `job_id`. Raw body must be `{` … `}` not `[` … `]`. Do **not** use `:first item` as the permanent fix.

### HTTP 406 `PGRST116` (“result contains 0 rows”)

`Accept: object+json` means PostgREST must return **exactly one** row. **0 rows** → 406. The header is still correct — the **filter matched nothing**. Seeing a job in Supabase and a value in `s_job_id` does **not** mean the failing request used that jobs id.

**Do not use `:formatted as JSON-safe` on `job_id`.** That is for JSON **bodies**. On a URL it sends `id=eq."uuid"` → invalid / 0 rows (the “uuid error”). Leave `job_id` = plain `s_job_id`.

| Cause | Fix |
|---|---|
| **Hidden popup still fetches on page load** | `Popup Assign` is hidden, but **G: Assign Header** still runs Get Job with empty `s_job_id` → 406 toast. Then you click Assign and the state looks fine. **G: Assign Header → Conditional tab** (not a workflow Only when): when `s_job_id` is empty → **Data source = empty**. |
| `s_job_id` is the **payment** id (or quote id) | Payments table Current row’s `id` = `payments.id`. Get Job queries **`jobs.id`**. Set `s_job_id` = Current row’s **`jobs`’s `id`** (or `job_id`). Compare the state to Table Editor → `jobs` → `id`. |
| JSON-safe / extra quotes | Plain `s_job_id` only. |
| Open order | Set `s_job_id` **first**, then Show popup. |

**Check the failing URL** (Bubble debugger / Network): `.../jobs?id=eq=` (empty) or `id=eq.<payments-uuid>` (wrong table) or `id=eq."..."` (JSON-safe). It must be `id=eq.<jobs.id>` with no quotes.

Do **not** remove `Accept: object+json` to “fix” 406 — that turns Get Job into a list again.

---

## 8. `DB - Get Technicians`

| Setting | Exact value |
|---|---|
| **Name** | `DB - Get Technicians` |
| **Use as** | **Data** |
| **Method** | GET |
| **URL** | `https://chqljfdmgdtsmbbwbdyv.supabase.co/rest/v1/profiles?role=eq.technician&active=eq.true&select=id,full_name,email,active&order=full_name.asc` |
| **Include errors** | **OFF** |

### Headers

| Header | Value | Private? | What it does |
|---|---|---|---|
| `apikey` | anon key | **yes** | Gateway |
| `Authorization` | `Bearer <access_token>` | **no** | Admin JWT |

| Placeholder | Type | Meaning | Initialize | Workflow |
|---|---|---|---|---|
| `<access_token>` | header | **admin** JWT | JWT, no quotes | `Current User's sb_access_token` |

### Success shape (list)

A JSON **array**: `id`, `full_name`, `email`, `active`. Raw Initialize must start with `[` not `{`.

If you already have this call from the auth guide, **reuse it** — do not add a second Get Technicians (and do not copy Get Job’s `Accept` header onto it).

### Dropdown (Assign popup)

- Dynamic choices · type `DB - Get Technicians`  
- Source: that call · Bearer = `Current User's sb_access_token`  
- Caption: `Current option's full_name`  
- Saved value: `Dropdown Technicians's value's id`

`[]` as admin → no techs, or profiles admin-read policy missing (auth guide Part 1).

### Initialize returns one technician, not a list

Same class of bug as List Jobs / Quote Lines. Dropdown needs a **list of items**; Bubble typed **one object**.

Check in order:

| Check | Fix |
|---|---|
| Header `Accept: application/vnd.pgrst.object+json` | **Delete it.** That header is Get Job / Get My Role / Patch only. With one matching row it returns `{...}` instead of `[{...}]` — Bubble will never make a list. |
| Include errors ON | **OFF** → Re-initialize. |
| JWT is a **technician** token | Techs may only read **their own** profile (RLS). Initialize with an **admin** JWT (Sign In as admin, paste that `access_token`, no quotes). |
| Raw body is `{` … `}` | After removing `object+json`, Initialize again. Must be `[` `{…}` `]`. |
| Raw body is `[` `{…}` `]` but Bubble still shows one object | One-row arrays often fail `is_list`. **Manually enter API response** (two items), Save, then use the real call. Do not re-Initialize with a 1-row payload or Bubble may revert. |
| Only one technician in Supabase | Invite a second tech (or the 2-item manual response above) so Initialize has two objects inside `[ ]`. |

**Manual response** (forces `is_list` — then bind the dropdown):

```json
[
  {"id": "00000000-0000-0000-0000-000000000011", "full_name": "Tech A", "email": "a@example.com", "active": true},
  {"id": "00000000-0000-0000-0000-000000000012", "full_name": "Tech B", "email": "b@example.com", "active": true}
]
```

**Raw Initialize check:** HTTP 200, payload starts with `[`, Returned values = flat `id` / `full_name` on the **item** — like `DB - Get Price Book`, not like Get Job.

---

## 9. `DB - Patch Job`

| Setting | Exact value |
|---|---|
| **Name** | `DB - Patch Job` |
| **Use as** | **Action** |
| **Method** | PATCH |
| **URL** | `https://chqljfdmgdtsmbbwbdyv.supabase.co/rest/v1/jobs?id=eq.[job_id]` |
| **Include errors** | **ON** |

### Headers

| Header | Value | Private? | What it does |
|---|---|---|---|
| `apikey` | anon key | **yes** | Gateway |
| `Authorization` | `Bearer <access_token>` | **no** | Admin JWT |
| `Content-Type` | `application/json` | no | Body |
| `Prefer` | `return=representation` | no | Return row |
| `Accept` | `application/vnd.pgrst.object+json` | no | One object |

### Body template

Hardcode `status` in the template. Bubble **cannot** JSON-safe a typed word; putting `"scheduled"` in the workflow box doubles quotes → PGRST102.

```json
{
  "technician_id": <technician_id>,
  "scheduled_at": <scheduled_at>,
  "duration_min": <duration_min>,
  "status": "scheduled"
}
```

Placeholders **unquoted**. `"status": "scheduled"` is literal — no `<status>` param.

| Placeholder | Type | Meaning | Initialize | Workflow |
|---|---|---|---|---|
| `[job_id]` | text (URL) | Job UUID | `"real-job-uuid"` | `s_job_id` |
| `<access_token>` | header | Admin JWT | JWT, no quotes | `Current User's sb_access_token` |
| `<technician_id>` | text | `profiles.id` | `"tech-uuid"` | Dropdown’s `id` `:formatted as JSON-safe` — **required** or body is invalid JSON |
| `<scheduled_at>` | **date** (not text) | timestamptz | pick a date/time in Initialize | Date/Time Picker’s value — **no** JSON-safe |
| `<duration_min>` | number | Minutes | `60` | Duration input — **no** JSON-safe |

**No `<status>` row** — it lives in the body template. After this change, **Re-initialize** Patch Job.

Date/Time Picker is fine **only if** `scheduled_at` is type **date** in the connector. Type **text** → picker dumps `Aug 13, 2026 12:00` unquoted → PGRST102.

### Success

`id`, `status=scheduled`, `technician_id`, `scheduled_at`, `duration_min`

### Errors

| Status | Meaning | Fix |
|---|---|---|
| 400 | Bad JSON / date | JSON-safe on tech id; `scheduled_at` type **date** |
| **406 PGRST116 0 rows** | PATCH matched **no** `jobs` row (`Accept: object+json` needs exactly one). JSON body is OK now. | `job_id` URL = **`s_job_id`** plain (not payment id, not JSON-safe, not hardcoded). Debugger: `id=eq.<jobs.id>`. Admin JWT. |
| 401 | JWT | SessionKeeper |
| 403 | Not admin | Admin role |
| CHECK | Illegal status | `unscheduled` → `scheduled` |

Techs cannot PATCH `technician_id` / `scheduled_at` (`guard_technician_job_update`).

---

## 10. Popup Assign + workflows

Do **not** set Type of content on the Popup itself (avoids Display-data snap-back). Header group fetches Get Job; inputs are siblings.

```
┌─ Popup Assign (no type of content) ──────────────────┐
│  G: Assign Header  ← DB - Get Job (read-only texts)    │
│  Dropdown Technicians                                  │
│  Input Assign When (date/time)                         │
│  Input Assign Duration (number, default 60)            │
│  [ Button Assign Save ]  [ Button Assign Cancel ]      │
└────────────────────────────────────────────────────────┘
```

### 10.1 Elements

| Name | Type | Notes |
|---|---|---|
| `Popup Assign` | Popup | Not visible on page load |
| `G: Assign Header` | Group | Type of content = **`DB - Get Job`**. Holds customer/money texts only |
| `Text Assign Name` | Text | inside header |
| `Text Assign Email` | Text | inside header |
| `Text Assign Address` | Text | inside header |
| `Text Assign Job` | Text | inside header — job description |
| `Text Assign Deposit` | Text | inside header |
| `Text Assign Total` | Text | inside header |
| `Dropdown Technicians` | Dropdown | **sibling** of header, not inside it |
| `Input Assign When` | **Date/Time Picker** (not Date only) | sibling |
| `Input Assign Duration` | Input, content format **integer** | sibling; placeholder `60` |
| `Button Assign Save` | Button | sibling |
| `Button Assign Cancel` | Button | sibling |

### 10.2 Header data (Get Job)

**G: Assign Header**

| Setting | Value |
|---|---|
| Type of content | `DB - Get Job` |
| Data source | Get data from an external API → **`DB - Get Job`** |
| `job_id` | `s_job_id` — **plain text, no JSON-safe** |
| `Authorization` | `Bearer ` + `Current User's sb_access_token` |

**Conditional** on the group (same pattern as tables): when `s_job_id` is empty → Data source = empty. Without this, page load calls `id=eq.` → HTTP **406 PGRST116** (§7).

Texts inside the header use **Parent group's** fields (paths as Initialize named them):

| Element | Text |
|---|---|
| `Text Assign Name` | Parent group's `quotes`’s `requests`’s `customer_name` |
| `Text Assign Email` | Parent group's `quotes`’s `requests`’s `customer_email` |
| `Text Assign Address` | Parent group's `quotes`’s `requests`’s `customer_address` |
| `Text Assign Job` | Parent group's `quotes`’s `requests`’s `description` |
| `Text Assign Deposit` | Parent group's `quotes`’s `deposit_amount` (currency format) |
| `Text Assign Total` | Parent group's `quotes`’s `total` (currency format) |

If a nested path is missing, Re-initialize Get Job with `object+json` (§7).

### 10.3 Dropdown + inputs

**Dropdown Technicians**

| Setting | Value |
|---|---|
| Choices style | Dynamic |
| Type of choices | `DB - Get Technicians` (the **item** type — must be a list, §8) |
| Choices source | Get data from API → **`DB - Get Technicians`** |
| `Authorization` | `Bearer ` + `Current User's sb_access_token` |
| Option caption | `Current option's full_name` |
| Placeholder | `Choose technician` |

**Input Assign When** — Date/Time Picker. No default (user must pick).

**Input Assign Duration** — integer. Initial content = `60`.

**Button Assign Save** — disabled when `s_assign_busy` is yes (conditional).

### 10.4 Open (from Payments or Jobs)

**Payments** Assign (only when Scheduled? is Not scheduled):

1. Reset relevant inputs (`Dropdown Technicians`, `Input Assign When`; Duration = `60`)  
2. `s_job_id` = Current row’s `jobs`’s `id` (or `job_id` if that is the field)  
3. Show **Popup Assign**

**Jobs** Assign (only when `technician_id` is empty):

1. Same reset  
2. `s_job_id` = Current row’s `id`  
3. Show **Popup Assign**

Header group refetches Get Job when `s_job_id` is set. Do **not** Display data on the whole Popup.

### 10.5 Save (`ASSIGN TECHNICIAN`)

Workflow **Button ASSIGN TECHNICIAN is clicked**. `DB - Patch Job` must already be **Use as: Action** and Initialized (§9).

**Only when** (on the workflow, not on the API call alone):

- `Dropdown D's value` is not empty  
- Date input is not empty **and** Time input is not empty  
- Duration’s value > `0`  
- `s_assign_busy` is no  
- `s_job_id` is not empty  

| # | Action | Only when |
|---|---|---|
| 1 | Set state `s_assign_busy` = yes | (none) |
| 2 | Plugins → **`DB - Patch Job`** | (none — params below) |
| 3 | Hide popup; bump bust; clear `s_job_id` | Result of step 2’s `status` is `scheduled` |
| 4 | Set state `s_assign_busy` = no | **never skip** |

Step 3 detail: Hide **Popup Assign**; `s_jobs_ts` = Current date/time:formatted as UNIX (SessionKeeper if that owns it); `s_payments_ts` = same unix; `s_job_id` = empty.

**Step 2 — Patch Job params** (match connector names)

| Param | Value | JSON-safe? |
|---|---|---|
| `job_id` (URL) | `s_job_id` | **no** |
| `Authorization` | `Bearer ` + `Current User's sb_access_token` | no |
| `technician_id` | `Dropdown D's value's id` | **yes** |
| `scheduled_at` | Date/Time Picker’s value | **no** (connector type must be **date**) |
| `duration_min` | Duration input’s value | **no** (number) |
| `status` | *(removed — hardcoded in body)* | — |

**Date + Time → one datetime** (your popup has two fields):

`scheduled_at` = Date input’s value **:change hours to** Time input’s value:extract hours **:change minutes to** Time input’s value:extract minutes

If you later use one Date/Time Picker, pass that picker’s value instead.

Button **ASSIGN TECHNICIAN** conditional: when `s_assign_busy` is yes → not clickable.

Payments row flips **Not scheduled → Scheduled**. Jobs row shows technician name.

### 10.6 Cancel

**Button Assign Cancel is clicked:** Hide Popup Assign; `s_job_id` = empty. No PATCH.

### 10.7 Datetime 400

Body must be ISO (`2026-08-20T09:00:00.000Z`), not `20/08/2026 9:00 AM`.

1. Prefer API Connector param type **date** + Date/Time Picker’s value (Bubble sends ISO).  
2. If the param is **text** and Patch returns 400: Arbitrary text `Input Assign When's value:formatted as yyyy-mm-ddThh:MM:ss.000Z` then `:formatted as JSON-safe`.  
3. Duration must stay a **number** (quoted `"60"` → 400).

---

## 11. Test

11.1 Deposit webhook → `payments` row **and** `jobs` row (`unscheduled`) in that same step.  
11.2 Initialize Payments → customer name, amount; `jobs.status` = `unscheduled` → **Not scheduled**. No pay-status column.  
11.3 Initialize List Jobs → same job; nested `technician` null → **None**.  
11.4 Assign → Save → Payments **Scheduled**; Jobs `scheduled` + technician name.  
11.5 That technician’s JWT sees the job; another tech does not.

### Done when

- [ ] List Payments Initialize (nested `quotes.requests` + `jobs`; no pay-status column)  
- [ ] List Jobs Initialize (`is_list`; Include errors OFF; Table type = this call)  
- [ ] Get Job Initialize (nested quote/request + `object+json`)  
- [ ] Get Technicians Initialize  
- [ ] Patch Job Initialize → `scheduled`  
- [ ] Assign Save bumps `s_jobs_ts` + `s_payments_ts`  
- [ ] Dashboard has **two** tables only (no Unassigned-jobs table)  
- [ ] No `select=*`  

### Order

**Initialize every connector in §5–§9 → then tables / popup.**

If you already created `DB - List Jobs Unassigned`: do not bind it. Hide/delete that table.

---

## Connector cheat sheet

| Call | Use as | For |
|---|---|---|
| `DB - List Payments` | Data | Customer + paid + scheduled / not |
| `DB - List Jobs` | Data | Work board |
| `DB - Get Job` | Data | Popup customer/totals |
| `DB - Get Technicians` | Data | Dropdown |
| `DB - Patch Job` | Action | Write assign |

**Skip:** `DB - List Jobs Unassigned`, `DB - List Payments Unassigned`.

**Rule:** template `"key": <key>` unquoted; Initialize `"uuid-here"`; workflow JSON-safe on text.
