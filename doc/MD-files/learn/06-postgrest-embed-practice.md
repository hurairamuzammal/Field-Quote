# Practice: PostgREST resource embedding

How one GET returns columns from **this** table **and** nested rows from **related** tables. Used by List Payments, List Jobs Unassigned, Get Job, Patch line + `quotes(needs_manual_pricing)`.

**Related:** guide 01 §3.5 · `P2-backend.md` §3.3 · guide 14 §6

Cover **§2–§3**, write answers on paper, then check **§4**.

## Steps
1. Map success shape → `select=`
2. Requirements (FK, RLS, name, direction)
3. Drills (write the query)
4. Answers

---

## 1. Map success shape → `select=`

Bubble “success shape” is the JSON after Initialize. You do **not** write SQL. You write `select=` on the **starting table**.

**Example — List Payments**

Success shape (list):

`id`, `kind`, `amount`, `currency`, `status`, `quote_id`, `job_id`, `created_at`, nested `jobs` (`id`, `status`, `technician_id`, `scheduled_at`)

Query:

```
/rest/v1/payments?select=id,kind,amount,currency,status,quote_id,job_id,created_at,jobs(id,status,technician_id,scheduled_at)
```

| Piece | Meaning |
|---|---|
| Path `/payments` | Start table (each row is a payment) |
| Bare names `id,kind,…` | Columns on **payments** |
| `jobs(...)` | Embed related table via FK |

JSON:

```json
{
  "id": "…",
  "kind": "deposit",
  "amount": 120.00,
  "jobs": {
    "id": "…",
    "status": "unscheduled",
    "technician_id": null,
    "scheduled_at": null
  }
}
```

Equivalent SQL (PostgREST writes this; you don’t):

```sql
SELECT p.id, p.kind, …,
  json_build_object('id', j.id, 'status', j.status, …) AS jobs
FROM payments p
LEFT JOIN jobs j ON j.id = p.job_id;
```

---

## 2. Requirements (FK, RLS, name, direction)

All of these must be true or the nested object is missing / `400`.

### 2.1 Real foreign key in Postgres

A UUID column with a matching name is **not** enough. Must be `REFERENCES`.

```sql
-- payments.job_id → jobs.id  (this is why `jobs(...)` works from payments)
job_id uuid references public.jobs(id)
```

No FK → `400` “Could not find a relationship between `payments` and `jobs`”.

### 2.2 Embed name = related **table** name

`jobs(...)` because the table is `jobs`. Not `job(...)`.

Alias if you want a nicer Bubble field:

```
select=id,amount,job:jobs(status,technician_id)
```

Nested key becomes `job` (same idea as `customer:requests(customer_name)`).

Ambiguous (two FKs to the same table) → hint the column:

```
jobs!job_id(id,status)
```

### 2.3 RLS on **every** embedded table

JWT must read the start table **and** each nested table. Payments OK + jobs denied → payment returns, `jobs` is null/missing. Techs have **no** payments policy — do not put List Payments on the tech page.

### 2.4 Direction = where the FK lives

| Start | Embed | FK | Nested JSON |
|---|---|---|---|
| `payments` | `jobs(...)` | `payments.job_id` | **object** (or `null` if `job_id` empty) |
| `jobs` | `payments(...)` | `payments.job_id` | **list** (0–n payments) |
| `jobs` | `quotes(...)` | `jobs.quote_id` | **object** |
| `quotes` | `requests(...)` | `quotes.request_id` | **object** |

You can hop: `jobs?select=…,quotes(…,requests(customer_name))`.

You **cannot** skip a hop. `payments?select=…,profiles(full_name)` fails — no `payments → profiles` FK. Path is `jobs(…,profiles(full_name))` because `jobs.technician_id → profiles.id`.

### 2.5 Left vs `!inner`

Default `jobs(...)` = LEFT JOIN: keep the payment even if job is missing.

`jobs!inner(...)` = INNER JOIN: drop rows whose embed does not match.

Filter on nested columns **requires** `!inner`:

```
payments?kind=eq.deposit
  &select=…,jobs!inner(id,status,technician_id)
  &jobs.technician_id=is.null
```

### 2.6 Bubble

Change `select=` → **re-Initialize**. Nested fields do not appear until then. Stay at 1–2 nest levels if Bubble cannot address deeper paths (guide 01 §3.5).

---

## 3. Drills (write the query)

Use FieldQuote FKs only. Do not look at §4 until done.

**FK map (allowed hops)**

```
requests ← quotes.request_id
requests ← request_media.request_id
quotes   ← quote_line_items.quote_id
quotes   ← payments.quote_id
quotes   ← jobs.quote_id          (1:1)
jobs     ← payments.job_id        (nullable)
jobs     ← job_events.job_id
jobs     ← job_media.job_id
profiles ← jobs.technician_id     (nullable)
price_book_items ← quote_line_items.price_book_item_id  (nullable)
```

### 3.1 Shape → `select=`

Success shape from **payments**: `id`, `kind`, `amount`, `status`, `job_id`, nested `jobs` (`id`, `status`, `technician_id`).

Write the `select=` (starting table `payments`).

### 3.2 Two hops

From **jobs**, success shape: job `id`, `status`, nested `quotes` (`total`, `deposit_amount`), nested `quotes.requests` (`customer_name`, `customer_email`).

Write `select=`.

### 3.3 Illegal hop — fix it

Someone wrote:

```
/rest/v1/payments?select=id,amount,profiles(full_name)
```

Why `400`? Write a valid `select=` that returns payment `id`, `amount`, and technician `full_name`.

### 3.4 Object vs list

A) From **one payment**, embed the job status.  
B) From **one job**, embed all payment `kind` + `amount`.

Which nested value is an **object**? Which is a **list**? Write both `select=` fragments.

### 3.5 Filter on nested column

List **deposit** payments whose job has **no technician**.

Need `!inner` or not? Write the query params (`kind`, `select`, nested filter).

### 3.6 Alias

From **quotes**, want Bubble field `customer` (not `requests`) with `customer_name` only.

Write `select=id,total,…`

### 3.7 Line save (guide 13)

From **quote_line_items** filtered `id=eq.[line_id]`, return line `id`, `qty`, `unit_price`, `overridden`, and parent `quotes(needs_manual_pricing)`.

Write the URL path + query (placeholders OK).

### 3.8 True / false

1. A column named `job_id` is enough for `jobs(...)` even with no `REFERENCES`.  
2. Technician JWT can embed `jobs` from `payments` if they can read their own jobs.  
3. After adding `jobs(...)` to an existing connector, Bubble shows `jobs` without re-Initialize.  
4. `payments?select=…,quotes(total),jobs(status)` is valid (two FKs on payments).

---

## 4. Answers

### 4.1

```
select=id,kind,amount,status,job_id,jobs(id,status,technician_id)
```

### 4.2

```
select=id,status,quotes(total,deposit_amount,requests(customer_name,customer_email))
```

(Guide 14 List Jobs Unassigned / Get Job.)

### 4.3

No FK `payments → profiles`. Hop through jobs:

```
select=id,amount,jobs(technician_id,profiles(full_name))
```

(`jobs.technician_id → profiles.id`.) If `technician_id` is null, nested `profiles` is null.

### 4.4

| | `select=` | Nested type |
|---|---|---|
| A | `select=id,jobs(status)` | **object** (FK on payments) |
| B | `select=id,payments(kind,amount)` | **list** (FK on payments, start at jobs) |

### 4.5

Yes, `!inner`. Without it, payments with no matching job still appear.

```
kind=eq.deposit
&select=id,kind,amount,currency,status,quote_id,job_id,created_at,jobs!inner(id,status,technician_id,scheduled_at)
&jobs.technician_id=is.null
```

(Guide 14 optional `DB - List Payments Unassigned`. Main assign queue is still **jobs** `technician_id=is.null`.)

### 4.6

```
select=id,total,customer:requests(customer_name)
```

(`P2-backend.md` §3.3.)

### 4.7

```
/rest/v1/quote_line_items?id=eq.[line_id]&select=id,qty,unit_price,overridden,quotes(needs_manual_pricing)
```

(Guide 13 — trigger updates parent before PostgREST returns.)

### 4.8

1. **False** — need `REFERENCES`.  
2. **False** — RLS applies per table; no payments policy for techs → `[]` / no embed.  
3. **False** — re-Initialize or Bubble keeps the old schema.  
4. **True** — `quote_id` and `job_id` are two different FKs; both embeds are allowed.

---

## 5. Live check (optional)

Paste a `select=` into API Connector (admin JWT), Initialize, confirm nested keys exist. Then change `select=` and Initialize again.

| Call | Start | Embed to confirm |
|---|---|---|
| List Payments | `payments` | `jobs` |
| List Jobs Unassigned | `jobs` | `quotes` + `quotes.requests` |
| Get Job | `jobs` | same, plus address/description |
