# FieldQuote — Requests Inbox → AI Draft Quote → Edit → Send

**Step-by-step build guide** for the Week 2–3 path that starts after public intake already works.

**Last updated:** 2026-08-07  
**Audience:** trainee building in Bubble + Supabase edge functions (new to API Connector → UI)  
**AI choice for now:** OpenRouter (cheap/free small model) — tell senior in writing (scope assumes Anthropic).

**How this guide is written:** every feature is **data first, UI second** — (1) edge function if needed, (2) API Connector with exact URL / headers / body `<params>` / init values / success & error shapes, (3) only then page states, elements, workflows. Admin media thumbnails reuse the same **HTML + JS** idea as the customer intake uploader (thumbs + click to open), but keys come from the DB and URLs from **presigned GET**.

---

## 0. What the docs say (email vs dashboard)


| Moment                                           | What happens                                                                                       | Email?                                                                                     | Where admin sees it                                             |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | --------------------------------------------------------------- |
| Customer clicks **GET INSTANT QUOTE** on `index` | Creates a `requests` row (+ `request_media`) — this is **not** a quote yet                         | **Yes (scope Day 7):** customer confirmation + admin notification via Resend → `email_log` | **Admin dashboard inbox in realtime** (primary UX you want now) |
| Admin clicks **Draft with AI**                   | Edge function writes `quotes` + `quote_line_items` (`status = draft`)                              | No                                                                                         | Draft review UI                                                 |
| Admin clicks **Send**                            | Edge function: validate → token → `status = sent` → email customer link `/q/<token>` → `email_log` | **Yes — this is the quote email**                                                          | Pipeline / sent state                                           |


**Answer to “mail right away or just dashboard?”**

- **Must show on admin dashboard in realtime** — that is the operational inbox (roadmap Day 7 + your requirement).
- **Intake emails** (customer “we got it” + admin “new request”) are also in the written scope for `submit-request`, but they are **not** the quote. You can ship inbox first, then add intake emails without changing the quote flow.
- **Quote email** only after admin reviews/edits and presses **Send** (`send-quote` edge function). Never auto-email a quote on intake.

```
Customer (index) → submit-request → requests (+ media)
                      ├─ [optional now / required by scope] Resend confirm + admin notify
                      └─ Realtime → Admin inbox (live)

Admin opens request → Draft with AI → draft-quote (OpenRouter + price-book guardrail)
                      → quotes + quote_line_items (draft)

Admin edits lines/totals → Send → send-quote
                      → token + status sent + Resend email with /q/<token> + email_log
```

---

## 1. Snapshot of your Bubble app (from `fieldquote-26446.bubble`)

### Pages


| Page                                                | Role                                                         |
| --------------------------------------------------- | ------------------------------------------------------------ |
| `index`                                             | Public intake — **GET INSTANT QUOTE** → `Submit Request`     |
| `login`                                             | Option A auth + `Finish Login`                               |
| `admin_dashboard`                                   | Company, Price Book, Invite, Home; **no Requests inbox yet** |
| `technician_panel`                                  | Shell only (0 workflows)                                     |
| `password_setup` / `forgot_pass_email` / `reset_pw` | Invite/reset paths                                           |


### Reusables (reminder)


| Reusable           | Notes                                                                                                                                                                                                          |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SessionKeeper`    | On protected pages (invisible ~1px). PageLoad + interval refresh; OnPageError → clear → logout → login. **Known gap:** empty refresh / logout redirect still incomplete — fix later (see `PROJECT_MEMORY.md`). |
| `RE: Header`       | **Removed** (modern design). Move **Log out** onto the new admin shell/nav — same flow: Sign Out → clear `sb_`* → Bubble log out → `login`.                                                                    |
| `RE:Alert Success` | Success toast pattern — reuse for inbox / draft / send banners later.                                                                                                                                          |


### Admin nav (`admin_panel` option set)

Existing options: **Home, Company, Price, Technician, Offers, Drafts**.

- **Offers / Drafts / Home** are the natural places to hang **Requests inbox** and **Quote drafts** (rename labels in UI if you want: Offers → Requests, Drafts → Quotes).
- Today there is **no** `DB - List Requests` call and **no** Requests RG wired — that is Phase 1 below.

### API Connector already present (relevant)

`Submit Request`, `Login`, Auth refresh/sign-out/role, `DB - Get Company Settings`, `Update Company Settings`, `DB - Get Price Book`, `Add/Update Price Book Item`, `Get R2 Upload URL`, `Invite Technician`, `DB - Get Jobs`.

**Missing for this flow:** List Requests, List Request Media, Realtime bridge, `draft-quote`, `send-quote`, R2 **GET** (download) for inbox photos.

### Index intake (already done)

- Button **GET INSTANT QUOTE** → API `Submit Request` → hide form / show thanks / reset inputs.
- Media via Toolbox JS → R2 PUT → page state; speech bridge for dictation.

Remote DB already has ~7 `requests`, 2 `request_media` keys — good test data for the inbox.

---

## 2. Non‑negotiables for AI + pricing

1. **Model never sets the price that reaches the customer.** After OpenRouter returns JSON, edge code:
  - For each line with `price_book_item_id`: load that row from `price_book_items` (active); **overwrite** `unit_price` with DB value; discard model’s number.
  - Unknown / missing id → `price_book_item_id = null`, `unit_price = null` → “needs manual pricing”.
2. **Prompt only offers the live price book** as JSON `{id, name, category, unit, unit_price, keywords}` for **active** items. Instruct: match only from this list; if nothing matches, emit null id.
3. **Send is blocked** while any line has null price (server re-check in `send-quote`, not only Bubble).
4. Secrets: `OPENROUTER_API_KEY` (and model name) in `supabase secrets` **only** — never Bubble, never `NEXT_PUBLIC_`*.
5. `draft-quote` / `send-quote` require **admin JWT**; then service role for writes.
6. Store `ai_generated = true`, `ai_model = '<openrouter/model>'`, `ai_raw = <full response>` on `quotes`.

**Senior note (write it):** “Using OpenRouter free/cheap model for draft-quote until agency Anthropic key; guardrail unchanged.”

**Suggested models (pick one that returns JSON reliably; free tiers change):**

- Prefer a small model that obeys “JSON only” (e.g. Gemini Flash-class via OpenRouter).
- Avoid tiny models that invent ids — your **code** still rejects bad ids.

---

## 3. Build phases (do in order)

**Universal rule (every phase):**  
**edge function / deploy → API Connector (plugin) Initialize → only then Bubble UI / workflows.**  
Never design Image/Table/Popup first and invent the call later. Same order you used for Login, Price Book, R2 upload.

```
Phase A  Admin Requests inbox — connector (List Requests / Media) → Table + detail popup + realtime
Phase B  Media download — deploy r2-presign GET → connector Get R2 Download URL → then Image in detail popup
Phase C  draft-quote edge function (OpenRouter + guardrail) → connector → then button
Phase D  Bubble Draft UI + edit draft lines (after Draft Quote connector works)
Phase E  send-quote edge function + connector → then Send UI / email
Phase F  (Deferred) intake emails; SessionKeeper; banners polish
```

---

# Phase A — Admin Requests inbox + realtime

### A0. Order for this phase

1. API Connector Data calls (`DB - List Requests`, `List Request with media`) — Initialize
2. Then Table / Popup / RG on `admin_dashboard`
3. Realtime last (after list works)

### A1. SQL — enable realtime

Migration (or one-shot SQL on linked project):

```sql
alter publication supabase_realtime add table requests;
-- later: quotes, jobs, payments
```

### A2. API Connector — Data calls

**Do not put** `request_media(...)` **embed on the call that feeds the Table.**  
Bubble treats nested arrays badly: Type of content + Data source becomes a **list of lists** (“list of list of … request with medias”) and the Table errors. Use **two flat calls**.

`DB - List Requests` (Use as: **Data**) — **table only, no embed**

```
GET https://chqljfdmgdtsmbbwbdyv.supabase.co/rest/v1/requests
  ?select=id,description,customer_name,customer_email,customer_phone,
          customer_address,preferred_timing,status,created_at
  &order=created_at.desc
```

- Headers: `Authorization: Bearer <access_token>` (space after Bearer!), shared `apikey`
- **Include errors: OFF** (must match Price Book — see A3.3). No `Accept: object+json`.
- Optional later: `&ts=<ts>` for cache-bust
- Initialize → flat item fields + list (`is_list`); type name like `DB - List Requests`

`List Request with media` (alias: `DB - List Request Media`) — Use as: **Data** — **detail / media strip only**

```
GET https://chqljfdmgdtsmbbwbdyv.supabase.co/rest/v1/request_media
  ?select=id,r2_key,kind,size_bytes,created_at
  &request_id=eq.<request_id>
  &order=created_at.asc
```

- URL param `request_id` = page state `s_request_id` when detail is open (not table row index — always the request UUID).
- Initialize like Price Book: Include errors **off**, no `object+json`, confirm `is_list` / flat fields (`id`, `r2_key`, `kind`, …).
- Do **not** use this call as the Requests Table data source.

If you still have an **embed** list-requests URL (`request_media(...)`): keep it unused for the Table, or delete it. Flat inbox list = `DB - List Requests` only.

### A3. Bubble — Requests panel on `admin_dashboard` (detailed UI)

Your option set `admin_panel` already has `Offers` (and `Drafts`). Use those:


| Option                        | Use for                                                                                                                 |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| **Offers**                    | Incoming **requests** inbox (customer intake)                                                                           |
| **Drafts** (label **Quotes**) | **One** quotes table (status column: draft / sent / …) + Open → Fix Pricing popup or detail/Send — **not** two sections |


Nav button that already sets `admin_panel_ = Offers` can stay; rename the **visible label** on that nav item to **“Requests”** if you want clearer copy (option value can remain `Offers`).

---

#### A3.1 Layout sketch (one panel)

**One popup only** for request detail — media (keys now, images/audio in Phase B) live **inside that same popup**. Do **not** add a second “View Media” popup.

```
┌─ Group Requests Inbox (visible when admin_panel_ = Offers) ─────────────┐
│  Title: Requests                                          [● Live]      │
│  ┌─ Table / RG Requests ─────────────────────────────────────────────┐  │
│  │ When │ Customer │ Email │ Status │ Description                      │  │
│  │ ...  │ ...      │ ...   │ new    │ I need to install new AC         │  │
│  └───────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────┘

┌─ Popup Request Detail (opened by View; closed by Close) ───────────────┐
│  Customer / contact / timing / full description                          │
│  Media (same popup): HTML thumbs [img] [img] [Audio]  ← click opens tab  │
│  [ Draft with AI ]   [ Close ]   (optional [ View media ] to reload)     │
└──────────────────────────────────────────────────────────────────────────┘
```

Use a **Popup** for detail. Media = **HTML + JS** like intake (thumbs + click to browse), after Phase B connector works. Keep **SessionKeeper** on the page (invisible). `RE: Header` **is not used** — logout belongs on the modern admin chrome.

---

#### A3.2 Page custom states (on `admin_dashboard`)

Add these (names can match your style; types matter):


| State               | Type   | Purpose                                                    |
| ------------------- | ------ | ---------------------------------------------------------- |
| `s_request_id`      | text   | Selected request UUID — drives Draft with AI + media fetch |
| `s_req_name`        | text   | customer_name                                              |
| `s_req_email`       | text   | customer_email                                             |
| `s_req_phone`       | text   | customer_phone                                             |
| `s_req_address`     | text   | customer_address                                           |
| `s_req_timing`      | text   | preferred_timing                                           |
| `s_req_description` | text   | full description                                           |
| `s_req_status`      | text   | `new` / `quoted` / `archived`                              |
| `s_req_created`     | date   | created_at (or text if easier)                             |
| `s_requests_ts`     | number | Cache-bust for list Data call (`&ts=`)                     |
| `s_media_key`       | text   | optional debug — usually HTML owns selection               |
| `s_media_kind`      | text   | optional                                                   |
| `s_media_url`       | text   | optional if using HTML-only thumbs (Phase B3)              |
| `s_media_busy`      | yes/no | Loading while `fqLoadAdminMedia` runs                      |


Clear selection: set `s_request_id` empty + **Hide** Popup/Group Request Detail; clear `s_media_`* too.

---

#### A3.3 API data sources (how the table gets rows)

**Table uses flat list only — no embed.**

**Call:** `DB - List Requests` (without `request_media(...)`)

```
https://chqljfdmgdtsmbbwbdyv.supabase.co/rest/v1/requests
  ?select=id,description,customer_name,customer_email,customer_phone,
          customer_address,preferred_timing,status,created_at
  &order=created_at.desc
```

##### Bubble Table — Type of content vs Data source (read this if you see a red error)

Bubble separates:


| Field               | Must be                               | Meaning                           |
| ------------------- | ------------------------------------- | --------------------------------- |
| **Type of content** | **One row** (a single request object) | “What is each line of the table?” |
| **Data source**     | A **list of** those rows              | “Where does the list come from?”  |


PostgREST returns a JSON **array** `[{...},{...}]`. After **Initialize**, Bubble creates an external type (often named like the call, e.g. `DB - List Requests`). That name is misleading: it is usually the **item** type (one request), and  
`Get data from an external API → DB - List Requests` returns a **list of** that item type.

**Correct setup**

1. Type of content → `DB - List Requests` (or whatever Initialize named the **request row** type).
2. Data source → **Get data from an external API** → pick `DB - List Requests`.
3. Fill `access_token` = `Current User's sb_access_token`.
4. Do **not** add `:first item`, `:format as text`, or nest another “list of …”.
5. Do **not** set Type of content to “list of DB - List Requests” if that option appears — pick the **singular** request type.

**If the Issue Checker says the data source “evaluates to DB - List Requests” (and paints it red)**

That almost always means Bubble thinks the data source is a **single** object, but the Table needs a **list**. Check in order:


| Check                                                          | Fix                                                                                                                                                                                                                                                                                                                                                                                                      |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Include errors` **/** `wrap_error` **is ON** on the list call | **Turn it OFF**, then **Re-initialize**. With Include errors on, Bubble types the call as a wrapper (`body` / `error` / `headers`) — `Get data from API` returns **one object**, and the rows hide under `.body`. Working list calls (`DB - Get Price Book`, `List Request with media`) have Include errors **off** and `is_list = true` with **flat** fields (`id`, `name`, …) on the call type itself. |
| Call has header `Accept: application/vnd.pgrst.object+json`    | **Remove it** from the **list** call. That header forces one object → 406 `PGRST116` when multiple rows exist. (object+json is only for Get Company Settings / Get one row.)                                                                                                                                                                                                                             |
| Data source used `:first item`                                 | Remove it — Table needs the full list.                                                                                                                                                                                                                                                                                                                                                                   |
| Type of content accidentally set to a **list** type            | Set Type of content to the **item** type from Initialize (same name as the call is OK if that’s how Bubble named the item).                                                                                                                                                                                                                                                                              |
| Temporary workaround (if you leave Include errors on)          | Type of content = `DB - List Requests body`; Data source = Get API → `DB - List Requests`**'s body**. Prefer the Price Book–style re-init instead.                                                                                                                                                                                                                                                       |
| Still confused after changing the URL                          | Create a **new** API call `DB - List Requests`, Initialize fresh (raw response must start with `[`), wire Table to the new call only.                                                                                                                                                                                                                                                                    |
| Prefer Repeating Group to test                                 | RG Type of content = same item type; Data source = same Get API list. If RG works and Table doesn’t, it’s Table config — same rules apply.                                                                                                                                                                                                                                                               |


**Raw Initialize check (list call):**

- HTTP status **200**, raw payload starts with `[` … `]`.
- After Initialize, the call type must show **flat row fields** (`id`, `customer_name`, …) — **not** only `body` / `error` / `headers`.
- Mirror `DB - Get Price Book`: Use as Data, no `object+json`, Include errors **off**.

**Why embed caused “list of list”:**  
`request_media(...)` nests arrays inside each row. Don’t use embed on the Table call. Media = separate `List Request with media` / `DB - List Request Media` in the detail panel with `request_id = s_request_id`.

**Media count column:** skip for v1 (no embed).

---

#### A3.4 Table (or Repeating Group) — columns

**Prefer Table** (you already use `Table Price`). Same patterns as price book.


| Column header | Cell expression              | Format / notes                                                                             |
| ------------- | ---------------------------- | ------------------------------------------------------------------------------------------ |
| **When**      | `Current row's … created_at` | `:formatted as` → date/time short                                                          |
| **Customer**  | `… customer_name`            | text                                                                                       |
| **Email**     | `… customer_email`           | text                                                                                       |
| **Status**    | `… status`                   | text; conditional: if `status is new` → bold / accent background on cell or badge          |
| **Summary**   | `… description`              | `:truncated to 60` (or 80) + `...`                                                         |
| **Media**     | optional                     | Icon or count: `Current row's request_media:count` (if embedded) — e.g. “2” or camera icon |
| **Open**      | Button **View**              | Triggers the row-select workflow (more reliable than “row click” on some Tables)           |


**Empty state:** Text visible when `Table Requests's list of … :count is 0` → “No requests yet.”

**Highlight** `new`**:** On the Status cell (or whole row group), condition:

- When `Current row's … status is "new"` → background tint / font weight.

**Do not** put Draft with AI in every row — keep it on the detail panel so the admin reads the request first.

---

#### A3.5 Selecting a row → fill states → show detail (+ media key)

**Do not key media off table row index.** Use the selected request’s `id` **(UUID)** in `s_request_id`. Indexes reshuffle when the list refreshes; UUIDs do not.

**Trigger:** `Button View` (in row) **or** Table row clicked (if your Bubble version supports it).

**Workflow steps (in order):**


| #   | Action                                                                  |
| --- | ----------------------------------------------------------------------- |
| 1   | Set `s_request_id` = `Current row's … id` *(UUID — drives media fetch)* |
| 2   | Set `s_req_name` = `… customer_name`                                    |
| 3   | Set `s_req_email` = `… customer_email`                                  |
| 4   | Set `s_req_phone` = `… customer_phone`                                  |
| 5   | Set `s_req_address` = `… customer_address`                              |
| 6   | Set `s_req_timing` = `… preferred_timing`                               |
| 7   | Set `s_req_description` = `… description`                               |
| 8   | Set `s_req_status` = `… status`                                         |
| 9   | Set `s_req_created` = `… created_at`                                    |
| 10  | **Show** `Popup Request Detail` (same popup that contains media)        |
| 11  | Optional: clear prior `s_media_*` so an old preview does not linger     |


Use **row context** (`Current row's …` / Parent group of the View button). Same pattern as price-book Edit → states → popup.

If the Table will not expose “Current row”, wrap each row’s actions in a **Group** typed to `DB - List Requests` with data = that row; then use `Parent group's … id`.

**Media auto-refetch:** once `s_request_id` is set, the media RG inside the detail popup (`request_id = s_request_id`) re-runs. Close clears `s_request_id` → strip empties.

---

#### A3.6 Popup Request Detail — what it shows

**One popup** for contact + description + media. No second media popup.

**Visibility:** shown by workflow when View is clicked; hide on Close (and/or when `s_request_id is empty`).

**Layout (top → bottom):**

1. **Header row**
  - Title: `Request from {s_req_name}`
  - Badge: `s_req_status` (style `new` differently)
  - Text: `s_req_created` formatted
  - Button **Close** → clear `s_request_id` + `s_media_`* + Hide popup
2. **Contact block** (labels + text, not inputs — read-only)
  - Name → `s_req_name`
  - Email → `s_req_email` (optional: `mailto:` link)
  - Phone → `s_req_phone`
  - Address → `s_req_address`
  - Preferred timing → `s_req_timing`
3. **Description**
  - Multiline text bound to `s_req_description` (full text, not truncated)
4. **Media** — RG + optional focused preview **in this same popup** (A3.7–A3.8)
5. **Actions row**
  - **Draft with AI** — primary button (Phase C)
  - Optional later: Archive (PATCH status)

**Draft with AI — conditions**


| Property             | Value                                                                                                                                                                                      |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Disabled when        | `s_request_id is empty` **or** `s_draft_busy is yes`                                                                                                                                       |
| Clickable when       | `s_request_id is not empty`                                                                                                                                                                |
| Workflow (Phase C/D) | Call `Draft Quote` → set `s_quote_id` + `s_needs_manual_pricing` → if yes, **Show Popup Fix Pricing**; else banner. Quotes live in **one** Quotes table (status column), not two sections. |


Until Phase C exists: button can **Show** text “AI drafting coming next” or stay disabled with tooltip.

---

#### A3.7 Media inside Request Detail popup (UX target)

**Same idea as customer intake:** an HTML box shows **thumbnails**; **click** opens/browses the file (new tab).  
Difference: intake used local `URL.createObjectURL(file)` after upload. Admin only has **R2 keys** in DB → must **presign GET** first (Phase B), then set `img.src` / open that URL.

**No second “View Media” popup.** Everything lives in **Popup Request Detail**.

**Triggers (either is fine):**


| Trigger                                            | When                                       |
| -------------------------------------------------- | ------------------------------------------ |
| Popup opens after **View** on a request row        | Auto-load thumbs for `s_request_id`        |
| Optional button **Load / View media** in the popup | Same JS load if you want an explicit click |


**Build order (do not skip):**

1. **Phase B2** — API Connector `Get R2 Download URL` Initialize (prove one key → one `url`)
2. **Phase B2b** — Data call `List Request with media` already works for that `request_id`
3. **Phase B3** — HTML gallery + Run JavaScript on popup open (fetch all → thumbs → click opens)

Until Phase B3 is done, you may show a temporary RG of keys only (optional). Prefer going straight to HTML thumbs once the download connector is green.

---

#### A3.8 (moved) — see Phase B3 for HTML thumbs

Checklist items for media UI are under Phase B. A3 only needs: popup open sets `s_request_id` + contact states; Close clears them.

---

#### A3.9 Wire checklist (copy into Bubble)

1. [ ] Nav → Offers (label “Requests”) sets `admin_panel_ = Offers`
2. [ ] Group Requests Inbox visible only for Offers
3. [ ] `DB - List Requests` initialized; Include errors **off**; Table bound + Bearer
4. [ ] Columns: When, Customer, Email, Status, Summary
5. [ ] Status `new` conditional style
6. [ ] View → set-states → **Show Popup Request Detail**
7. [ ] Detail shows contact + full description from states
8. [ ] **Phase B2** `Get R2 Download URL` connector Initialize (before thumbs UI)
9. [ ] **Phase B3** HTML media strip in same popup; load on open (or View media button)
10. [ ] Click thumb → opens image/audio URL in new tab
11. [ ] Draft with AI disabled until `s_request_id` set
12. [ ] Close clears `s_request_id` (+ media busy flags) + hides popup
13. [ ] SessionKeeper still on page

---

#### A3.10 Done when (UI only)

- Offers/Requests panel lists remote requests.
- View opens **one** detail popup with contact + description.
- Media: thumbnails in that popup (Phase B); click browses the file. No second popup.
- Draft with AI enabled only with a selection.

### A4. Realtime bridge (Toolbox + HTML)

Reuse pattern from `backend.md` §3.5:

1. Reusable or HTML on `admin_dashboard` (must stay visible ~1px — not inside a hidden group).
2. Toolbox **JavaScript to Bubble** suffixes: `request` (text), `live` (yes/no).
3. Script: `createClient(url, anon)` → `realtime.setAuth(Current User JWT)` — pass JWT via Bubble→JS on page load / SessionKeeper after refresh.
4. Subscribe `postgres_changes` INSERT on `requests` → `bubble_fn_request(JSON.stringify(payload.new))`.
5. Bubble workflow on JS bridge: parse or append to a custom state list **or** bump `s_requests_ts` so the Data call refetches.
6. Show “Live” indicator from `bubble_fn_live`.

**Done when:** submit from `index` (or SQL insert) → open admin Requests panel updates within ~2s without full page reload.

**SessionKeeper reminder:** keep `SessionKeeper` on `admin_dashboard` so the JWT Realtime uses stays fresh. `RE: Header` **removed** — do not re-add for this design; wire Log out on the new UI instead.

---

# Phase B — Admin media thumbs (data → connector → HTML/JS UI)

**Goal (same feel as customer intake):** when **Popup Request Detail** opens (or admin presses **View media**), fetch that request’s photos/audio, show **thumbnails** in an HTML box, **click a thumb → browse/open** the file in a new tab. One popup only.

**Why not** `createObjectURL` **like intake?** Intake had the raw file in the browser. Admin only has `r2_key` in Postgres → call **presigned GET** → use that `url` as `img.src` and as the click target.

```
Order (always):
  B1  Edge function already deployed (r2-presign GET)
  B2  API Connector Get R2 Download URL — Initialize one key (prove contract)
  B2b Confirm List Request with media Data call (list of keys for a request)
  B3  ONLY THEN: HTML strip + Run JavaScript on popup open / View media
```

---

### B1. Edge function (already deployed)

```bash
npx supabase functions deploy r2-presign --no-verify-jwt --project-ref chqljfdmgdtsmbbwbdyv
```

**Endpoint (this is “the link”):**

```
POST https://chqljfdmgdtsmbbwbdyv.supabase.co/functions/v1/r2-presign
```


| Mode            | When                   | Body fields                    | Who may call             | Success JSON                                                   |
| --------------- | ---------------------- | ------------------------------ | ------------------------ | -------------------------------------------------------------- |
| `put` (default) | Customer intake upload | `fileName`, `kind`, `fileSize` | public + `apikey`        | `{ url, objectKey, mime }` — upload **to** this `url` with PUT |
| `get`           | Admin preview          | `mode`, `key`                  | **admin** JWT + `apikey` | `{ url, key }` — browser **loads** this `url` (GET)            |


GET allowlist: `key` must start with `requests/photos/` or `requests/audio/`.

---

### B2. API Connector first — `Get R2 Download URL` (trainee detail)

**Do not build HTML thumbs until this Initialize succeeds.**

#### B2.1 Create the call

Plugins → API Connector → add call under your Supabase API group (same place as `Get R2 Upload URL`).


| Setting            | Exact value                                                        | Why                                                                      |
| ------------------ | ------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| **Name**           | `Get R2 Download URL`                                              | Clear in workflows                                                       |
| **Use as**         | **Action**                                                         | You call it from a workflow / you Initialize it; not a Table data source |
| **Data type**      | JSON                                                               | Response is JSON                                                         |
| **Method**         | POST                                                               | Edge function expects POST + JSON body                                   |
| **URL**            | `https://chqljfdmgdtsmbbwbdyv.supabase.co/functions/v1/r2-presign` | Must include `/functions/v1/`                                            |
| **Body type**      | JSON                                                               |                                                                          |
| **Include errors** | **unticked** for v1                                                | Keeps response type simple (`url`, `key`) — not a body/error wrapper     |


#### B2.2 Headers (each value explained)


| Header key      | Value in connector                                                       | Private?         | What it does                                                                                           |
| --------------- | ------------------------------------------------------------------------ | ---------------- | ------------------------------------------------------------------------------------------------------ |
| `Content-Type`  | `application/json`                                                       | can be Private   | Tells the function the body is JSON                                                                    |
| `apikey`        | your Supabase **anon / publishable** key (same as Login / List Requests) | **yes Private**  | Supabase gateway requires it; never put service_role here                                              |
| `Authorization` | `Bearer <access_token>`                                                  | **no** (dynamic) | **Must** have a space after `Bearer`. `<access_token>` = admin JWT; for Initialize paste a fresh token |


Shared headers on the API group are fine for `apikey` + `Content-Type`.

#### B2.3 Body template — dynamic `< >`

In the **JSON body** box type exactly (placeholders **unquoted**):

```json
{
  "mode": <mode>,
  "key": <key>
}
```


| Placeholder      | Bubble param type | Meaning                                        | Initialize value (quotes **required** here)             | Later in workflow / JS                   |
| ---------------- | ----------------- | ---------------------------------------------- | ------------------------------------------------------- | ---------------------------------------- |
| `<mode>`         | text              | `"get"` = download                             | `"get"`                                                 | text `get`                               |
| `<key>`          | text              | Full R2 object key from `request_media.r2_key` | `"requests/photos/abcd-….jpg"` (copy from Table Editor) | the key string (JSON-safe if via Action) |
| `<access_token>` | text (in header)  | Admin session JWT                              | paste from User’s `sb_access_token`                     | `Current User's sb_access_token`         |


**Rule:** template uses bare `<name>`; Initialize fields wrap strings in `"..."`; workflows use `:formatted as JSON-safe` when calling the Action from Bubble.

#### B2.4 Success response (what Bubble should show after Initialize)

HTTP **200**. Fields:


| Field | Type | Example                                                              | You use it for                            |
| ----- | ---- | -------------------------------------------------------------------- | ----------------------------------------- |
| `url` | text | `https://….r2.cloudflarestorage.com/…/requests/photos/….jpg?X-Amz-…` | `img.src`, or `window.open(url)` on click |
| `key` | text | `requests/photos/….jpg`                                              | debug / echo                              |


Open `url` in a browser tab — photo/audio should load. That proves signing **before** any thumbs UI.

#### B2.5 Errors (what you will see + fix)


| Status / body                   | Meaning                            | Fix                                                     |
| ------------------------------- | ---------------------------------- | ------------------------------------------------------- |
| **401** missing/invalid session | No/expired JWT                     | Log in as admin; paste new access token                 |
| **403** `Admin only`            | Not an admin profile               | Use admin user                                          |
| **400** `key not allowed`       | Key outside allowlist              | Must start with `requests/photos/` or `requests/audio/` |
| **400** `key is required`       | Empty key                          | Set Initialize value                                    |
| **404**                         | Wrong URL                          | Must include `/functions/v1/r2-presign`                 |
| Bubble `bad_json`               | Quoted `<key>` in the **template** | Use `"key": <key>` not `"key": "<key>"`                 |


**Stop here until Initialize returns** `url`**.** No HTML yet.

---

### B2b. Data call — list of keys for one request (already in app)

**Name:** `List Request with media` · Use as: **Data**


| Piece                 | Value                                                                                                                                                        |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Method                | GET                                                                                                                                                          |
| URL                   | `https://chqljfdmgdtsmbbwbdyv.supabase.co/rest/v1/request_media?select=id,r2_key,kind,size_bytes,created_at&request_id=eq.[request_id]&order=created_at.asc` |
| Param `request_id`    | UUID (`s_request_id`)                                                                                                                                        |
| `Authorization`       | `Bearer <access_token>` (space after Bearer)                                                                                                                 |
| `apikey`              | shared Private anon                                                                                                                                          |
| Include errors        | **off**                                                                                                                                                      |
| `Accept: object+json` | **absent**                                                                                                                                                   |


**Success:** JSON **array**:

```json
[
  { "id": "…", "r2_key": "requests/photos/….jpg", "kind": "photo", "size_bytes": 12345, "created_at": "…" }
]
```

Initialize with a request that has rows in `request_media`.

---

### B3. UI last — small thumbs + larger preview in the same popup

**Only after B2 Initialize returns `url`.**

**UX:** row of **small** photo/audio thumbs → **click** → **larger** preview below (still in Popup Request Detail). Optional “Open full size” link. No second popup.

---

#### B3.1 Elements inside Popup Request Detail


| Element                        | Role                                                                       |
| ------------------------------ | -------------------------------------------------------------------------- |
| Group / section **Media**      | Holds the HTML (inside the detail popup)                                   |
| `HTML Admin Media`             | Paste the HTML+script from B3.5 (must stay **visible** when popup is open) |
| Optional Button **View media** | Same Run JavaScript if you don’t auto-run on popup show                    |
| Optional Text                  | Visible when `s_media_busy is yes` → “Loading media…”                      |


You do **not** need Bubble Image elements for each file — HTML draws thumbs + large preview.

---

#### B3.2 States


| State          | Type   | Purpose               |
| -------------- | ------ | --------------------- |
| `s_request_id` | text   | Set by View (already) |
| `s_media_busy` | yes/no | Optional loading flag |


---

#### B3.3 How to pass args in Bubble **Run JavaScript** (important)

Toolbox action: **Run JavaScript** (same action type you use for `fqPickPhotos();`).

The script field is **one text**. Bubble builds it from static typing + **Insert dynamic data**. You are **not** filling five separate Bubble “parameter” fields for this call — you write one JS function call and splice dynamics into the quotes.

##### Workflow order


| #   | Action                                                          |
| --- | --------------------------------------------------------------- |
| 1   | Set states from row + **Show** Popup Request Detail             |
| 2   | Set `s_media_busy` = yes (optional)                             |
| 3   | **Run JavaScript** → `fqLoadAdminMedia({...})` (build as below) |
| 4   | Set `s_media_busy` = no (optional)                              |


Fire this at the **end of View** (auto-load), and/or on Button **View media**.

##### Click-by-click: build the Run JavaScript text

In the Run JavaScript box, assemble this (dynamics via Insert dynamic data):

```javascript
fqLoadAdminMedia({
  requestId: "<<<s_request_id>>>",
  accessToken: "<<<sb_access_token>>>",
  apikey: "PASTE_SAME_ANON_OR_PUBLISHABLE_KEY_AS_API_CONNECTOR",
  restUrl: "https://chqljfdmgdtsmbbwbdyv.supabase.co/rest/v1",
  presignUrl: "https://chqljfdmgdtsmbbwbdyv.supabase.co/functions/v1/r2-presign"
});
```


| Piece you type / insert                                                          | What to do                                                          |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `fqLoadAdminMedia({`                                                             | type static                                                         |
| `requestId: "`                                                                   | type static (opening quote)                                         |
| **Insert dynamic data** → Current page’s `s_request_id`                          | do **not** add extra quotes around the insert                       |
| `",`                                                                             | type static (close quote + comma)                                   |
| `accessToken: "`                                                                 | type static                                                         |
| **Insert dynamic data** → Current User’s `sb_access_token`                       | raw JWT only — JS adds `Bearer`                                     |
| `",`                                                                             | type static                                                         |
| `apikey: "sb_publishable_…",`                                                    | type static — **same** client key as API Connector Private `apikey` |
| `restUrl: "https://chqljfdmgdtsmbbwbdyv.supabase.co/rest/v1",`                   | type static                                                         |
| `presignUrl: "https://chqljfdmgdtsmbbwbdyv.supabase.co/functions/v1/r2-presign"` | type static — **same URL as Get R2 Download URL**                   |
| `});`                                                                            | type static                                                         |


##### Arg meanings


| JS arg        | Value                                                              | Notes                                  |
| ------------- | ------------------------------------------------------------------ | -------------------------------------- |
| `requestId`   | Dynamic: page `s_request_id`                                       | Selected request UUID                  |
| `accessToken` | Dynamic: `Current User's sb_access_token`                          | Never hardcode JWT in the HTML element |
| `apikey`      | Static anon/publishable key                                        | Client-safe; same as connector         |
| `restUrl`     | `https://chqljfdmgdtsmbbwbdyv.supabase.co/rest/v1`                 | Lists `request_media`                  |
| `presignUrl`  | `https://chqljfdmgdtsmbbwbdyv.supabase.co/functions/v1/r2-presign` | Signs each key                         |


**If nothing runs:** browser console says `fqLoadAdminMedia is not defined` → HTML element missing/hidden. Keep HTML **visible** inside the open popup.

---

#### B3.4 What the JS does

1. Show “Loading…” in the thumb strip
2. **GET** `{restUrl}/request_media?request_id=eq.{requestId}&select=…` (same as List Request with media)
3. Empty → “No photos or audio”
4. For each row **POST** `{presignUrl}` with `{ mode: "get", key: r2_key }` and `Authorization: Bearer {accessToken}` (same as Get R2 Download URL)
5. Draw **small** thumbs (photo = mini image; audio = mini “Audio” card)
6. **Click thumb** → update **large** area below (big image, or `<audio controls>`)
7. “Open full size” link → opens signed URL in a new tab

First item auto-selects large preview after load.

---

#### B3.5 HTML to paste (`HTML Admin Media`)

```html
<div id="fq-admin-media-root" style="width:100%;">
  <div id="fq-admin-media-thumbs" style="display:flex;flex-wrap:wrap;gap:8px;min-height:48px;align-items:center;"></div>
  <div id="fq-admin-media-large" style="margin-top:12px;min-height:120px;"></div>
</div>
<script>
window.fqShowAdminMediaLarge = function (item) {
  const large = document.getElementById('fq-admin-media-large');
  if (!large || !item || !item.url) return;
  large.innerHTML = '';
  if (item.kind === 'photo') {
    const img = document.createElement('img');
    img.src = item.url;
    img.alt = 'preview';
    img.style.cssText = 'max-width:100%;max-height:360px;border-radius:8px;display:block;';
    large.appendChild(img);
  } else {
    const wrap = document.createElement('div');
    wrap.innerHTML = '<div style="font-size:13px;margin-bottom:6px;">Audio</div>';
    const audio = document.createElement('audio');
    audio.controls = true;
    audio.src = item.url;
    audio.style.cssText = 'width:100%;max-width:420px;';
    wrap.appendChild(audio);
    large.appendChild(wrap);
  }
  const open = document.createElement('a');
  open.href = item.url;
  open.target = '_blank';
  open.rel = 'noopener';
  open.textContent = 'Open full size';
  open.style.cssText = 'display:inline-block;margin-top:8px;font-size:13px;';
  large.appendChild(open);
};

window.fqLoadAdminMedia = async function (opts) {
  const thumbs = document.getElementById('fq-admin-media-thumbs');
  const large = document.getElementById('fq-admin-media-large');
  if (!thumbs || !large) return;
  thumbs.innerHTML = '<span style="font-size:13px;opacity:.7">Loading media…</span>';
  large.innerHTML = '';

  if (!opts.requestId || !opts.accessToken || !opts.apikey) {
    thumbs.innerHTML = '<span style="color:#c0392b;font-size:13px">Missing requestId, token, or apikey</span>';
    return;
  }

  const authHeaders = {
    apikey: opts.apikey,
    Authorization: 'Bearer ' + String(opts.accessToken).trim(),
  };
  const jsonHeaders = Object.assign({}, authHeaders, { 'Content-Type': 'application/json' });

  try {
    const listUrl = opts.restUrl + '/request_media?select=id,r2_key,kind,size_bytes&request_id=eq.' +
      encodeURIComponent(opts.requestId) + '&order=created_at.asc';
    const listRes = await fetch(listUrl, { headers: authHeaders });
    if (!listRes.ok) throw new Error('list ' + listRes.status);
    const rows = await listRes.json();
    if (!rows.length) {
      thumbs.innerHTML = '<span style="font-size:13px">No photos or audio on this request.</span>';
      return;
    }

    thumbs.innerHTML = '';
    const items = [];
    for (const row of rows) {
      const signRes = await fetch(opts.presignUrl, {
        method: 'POST',
        headers: jsonHeaders,
        body: JSON.stringify({ mode: 'get', key: row.r2_key }),
      });
      if (!signRes.ok) continue;
      const data = await signRes.json();
      if (!data.url) continue;
      items.push({ kind: row.kind, url: data.url, key: row.r2_key });
    }

    if (!items.length) {
      thumbs.innerHTML = '<span style="color:#c0392b;font-size:13px">Could not sign media URLs</span>';
      return;
    }

    items.forEach(function (item, idx) {
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.style.cssText = 'padding:0;border:2px solid transparent;border-radius:8px;background:#f3f4f6;cursor:pointer;overflow:hidden;width:72px;height:72px;';
      cell.title = item.kind === 'photo' ? 'Show photo larger' : 'Show audio player';

      if (item.kind === 'photo') {
        const img = document.createElement('img');
        img.src = item.url;
        img.alt = 'photo';
        img.style.cssText = 'width:72px;height:72px;object-fit:cover;display:block;pointer-events:none;';
        cell.appendChild(img);
      } else {
        cell.textContent = 'Audio';
        cell.style.fontSize = '12px';
      }

      cell.onclick = function () {
        Array.prototype.forEach.call(thumbs.querySelectorAll('button'), function (b) {
          b.style.borderColor = 'transparent';
        });
        cell.style.borderColor = '#2563eb';
        window.fqShowAdminMediaLarge(item);
      };
      thumbs.appendChild(cell);

      if (idx === 0) {
        cell.style.borderColor = '#2563eb';
        window.fqShowAdminMediaLarge(item);
      }
    });
  } catch (e) {
    thumbs.innerHTML = '<span style="color:#c0392b;font-size:13px">Could not load media</span>';
    console.error(e);
  }
};
</script>
```

---

#### B3.6 Close popup

Clear `s_request_id`, `s_media_busy` = no. Optional Run JS:

```javascript
(function(){ var t=document.getElementById('fq-admin-media-thumbs'); var l=document.getElementById('fq-admin-media-large'); if(t) t.innerHTML=''; if(l) l.innerHTML=''; })();
```

---

#### B3.7 Done when

- Request with media → **small** thumbs; first item shows **large** below.  
- Click another thumb → large area updates (photo or audio player).  
- “Open full size” opens signed URL in a new tab.  
- No media → empty message.  
- No second media popup.

**Security:** short-lived URLs in the DOM only. Anon key in Run JS is OK; never service_role; never hardcode JWT in the HTML element.

---

# Phase C — `draft-quote` edge function (OpenRouter)

### C0. Order

1. Secrets + deploy `draft-quote`
2. API Connector `Draft Quote` (Action) Initialize with curl/admin token
3. **Then** Draft with AI button + draft UI (Phase D)

### C1. Secrets

```bash
supabase secrets set OPENROUTER_API_KEY=sk-or-...
supabase secrets set OPENROUTER_MODEL=google/gemini-2.0-flash-001
# optional fallback name stored on quote
```

Add names only to `.env.example` (no values).

### C2. Function contract

**URL:** `POST /functions/v1/draft-quote`  
**Auth:** `Authorization: Bearer <admin access_token>` (+ `apikey`)  
**Verify JWT** (do **not** deploy with `--no-verify-jwt` unless you manually verify).

**Body:**

```json
{ "request_id": "<uuid>" }
```

**Steps inside function:**

1. CORS + OPTIONS.
2. Create user-scoped client from JWT → load `profiles` → must be `role = admin` and `active`.
3. Service-role client: load `requests` by id (company scope).
4. Load `price_book_items` where `active = true` (select id, name, category, unit, unit_price, keywords).
5. Call OpenRouter Chat Completions:
  - System: electrician quote assistant; **only** match ids from provided price book; return **only** JSON; schema:
  - User: request description (+ later photos); **price book JSON array** (compact).
  - `response_format` / strong “JSON only” instruction; **one retry** if parse fails.
6. **Guardrail loop** (mandatory):
  - Parse JSON.
  - For each line: if id present and found active → set `unit_price` from DB, `label` can stay model or use book name; if not found → null id + null price.
  - Discard any model-supplied price field entirely.
7. Load `company_settings` for tax/deposit % snapshots.
8. Insert `quotes` (`status=draft`, `ai_generated=true`, `ai_model`, `ai_raw`, snapshot pcts, totals computed from priced lines only or 0 until edit).
9. Insert `quote_line_items`.
10. Optionally set `requests.status = 'quoted'` when first draft exists (or leave `new` until send — pick one rule and stick to it; scope often leaves request until quoted/sent).
11. Return `{ quote_id, line_items, assumptions, clarifying_questions, confidence, needs_manual_pricing: bool }`.

### C3. Deploy (done in repo)

```bash
npx supabase functions deploy draft-quote --no-verify-jwt --project-ref chqljfdmgdtsmbbwbdyv
```

JWT is verified **inside** the function (admin only), same pattern as invite / r2 GET.

**Secrets (you said these are set):** `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`.

**curl smoke** (fresh admin access token + real request UUID):

```bash
curl -sS -X POST \
  'https://chqljfdmgdtsmbbwbdyv.supabase.co/functions/v1/draft-quote' \
  -H "apikey: $ANON_KEY" \
  -H "Authorization: Bearer $ADMIN_ACCESS_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"request_id":"217cc8be-0e33-404c-94d4-a13e07854ccc"}'
```

Expect `quote_id`, `line_items`, `needs_manual_pricing`, totals. Check Table Editor: new `quotes` (status `draft`, `ai_generated=true`) + `quote_line_items`; request may flip to `quoted`.

**Guardrail:** model prices are discarded; `unit_price` comes only from `price_book_items`. Unknown ids → `price_book_item_id` + `unit_price` null.

**Done when:** real `request_id` creates one quote + N lines; unmatched work → `needs_manual_pricing: true`.

---

# Phase D — Bubble: Draft with AI → fix pricing popup (if needed) → one Quotes table → Send

**UX rule (keep it simple):**

- **One** Quotes table (nav **Drafts** / label **Quotes**) — **not** two sections (“draft” vs “ready draft”).
- Status is a **column** on that table (`draft` / `sent` / …). After Send, the same row shows `sent`.
- If AI returns `needs_manual_pricing = yes` → open **Popup Fix Pricing** immediately (bound to `s_quote_id`). Admin can also open any quote from the Quotes table later.

```
D1  Connector: Draft Quote — Initialize
D2  Draft with AI → set s_quote_id + s_needs_manual_pricing
    → if needs pricing: Show Popup Fix Pricing
    → else: optional banner; quote already on Quotes table
D3  Connectors: Get Quote, Get Quote Lines, List Quotes (one list)
D4  One Quotes table + optional inline detail / same Fix Pricing popup on Open
D5  Edit lines in Fix Pricing popup (or detail) until all priced
D6  Send (disabled until priced) → Phase E
```

---

### D0. Page states (`admin_dashboard`)


| State                    | Type   | Purpose                 |
| ------------------------ | ------ | ----------------------- |
| `s_request_id`           | text   | Selected request        |
| `s_quote_id`             | text   | New/selected quote UUID |
| `s_draft_busy`           | yes/no | AI in progress          |
| `s_draft_error`          | text   | Failure text            |
| `s_needs_manual_pricing` | yes/no | From Draft Quote result |


---

### D1. API Connector — `Draft Quote` (before the button)

**Do not wire the Draft with AI button until Initialize succeeds.**

#### D1.1 Create the call


| Setting            | Exact value                                                         | Why                           |
| ------------------ | ------------------------------------------------------------------- | ----------------------------- |
| **Name**           | `Draft Quote`                                                       |                               |
| **Use as**         | **Action**                                                          |                               |
| **Data type**      | JSON                                                                |                               |
| **Method**         | POST                                                                |                               |
| **URL**            | `https://chqljfdmgdtsmbbwbdyv.supabase.co/functions/v1/draft-quote` | Must include `/functions/v1/` |
| **Body type**      | JSON                                                                |                               |
| **Include errors** | **ticked**                                                          | Banners can read `error`      |


#### D1.2 Headers


| Header key      | Value                   | Private?        | What it does                  |
| --------------- | ----------------------- | --------------- | ----------------------------- |
| `Content-Type`  | `application/json`      | can be Private  |                               |
| `apikey`        | anon / publishable key  | **yes Private** | Gateway                       |
| `Authorization` | `Bearer <access_token>` | **no**          | Space after Bearer; admin JWT |


#### D1.3 Body template

```json
{
  "request_id": <request_id>
}
```


| Placeholder      | Init (quotes required)                                     | Workflow                              |
| ---------------- | ---------------------------------------------------------- | ------------------------------------- |
| `<request_id>`   | `"bbbbbbbb-….request-uuid"` from Table Editor → `requests` | `s_request_id:formatted as JSON-safe` |
| `<access_token>` | paste admin `sb_access_token`                              | `Current User's sb_access_token`      |


Bubble sends **only** `request_id` + Bearer.

#### D1.4 Success fields after Initialize

`quote_id`, `needs_manual_pricing`, `line_items`, `subtotal`, `tax_amount`, `total`, `deposit_amount`, `ai_model`, …


| Error                     | Fix                                 |
| ------------------------- | ----------------------------------- |
| 401/403                   | Fresh admin JWT                     |
| 400 no price book / empty | Seed HVAC items; check `company_id` |
| bad_json                  | Template uses bare `<request_id>`   |


---

### D2. Wire **Draft with AI** + branch on `s_needs_manual_pricing`

**Button:** disabled when `s_request_id is empty` or `s_draft_busy is yes`.

**Workflow**


| #   | Action                                                                                                                                              |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Terminate if `s_request_id` empty                                                                                                                   |
| 2   | `s_draft_busy` = yes; clear `s_draft_error`                                                                                                         |
| 3   | Call **Draft Quote** (`request_id` = `s_request_id:formatted as JSON-safe`, Bearer = Current User token)                                            |
| 4   | On success: `s_quote_id` = Result’s `quote_id`                                                                                                      |
| 5   | `s_needs_manual_pricing` = Result’s `needs_manual_pricing` (yes/no)                                                                                 |
| 6   | `s_draft_busy` = no                                                                                                                                 |
| 7   | **Only when** `s_needs_manual_pricing is yes` → **Show Popup Fix Pricing** (bound to `s_quote_id`)                                                  |
| 8   | **Only when** `s_needs_manual_pricing is no` → success banner (“Draft ready”) — quote appears on the **Quotes** table; admin can Open there to Send |
| 9   | On API error: busy = no; failure banner                                                                                                             |


Do **not** jump to a separate “ready drafts” area. Do **not** split the nav into two quote sections.

---

### D3. Connectors (data before UI)

**Do not build the Quotes table / Fix Pricing popup until these three Initialize cleanly.**

#### D3.1 `DB - Get Quote` (Data) — single row


| Setting            | Exact value                                                                                                                                                                                                         |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Name**           | `DB - Get Quote`                                                                                                                                                                                                    |
| **Use as**         | **Data**                                                                                                                                                                                                            |
| **Data type**      | JSON                                                                                                                                                                                                                |
| **Method**         | GET                                                                                                                                                                                                                 |
| **URL**            | `https://chqljfdmgdtsmbbwbdyv.supabase.co/rest/v1/quotes?id=eq.[quote_id]&select=id,status,subtotal,tax_amount,total,deposit_amount,deposit_pct,tax_pct,ai_generated,ai_model,internal_notes,request_id,created_at` |
| **Include errors** | **OFF**                                                                                                                                                                                                             |


**URL param**


| Param      | Type | Initialize (quotes required)                                                            | Workflow                    |
| ---------- | ---- | --------------------------------------------------------------------------------------- | --------------------------- |
| `quote_id` | text | `"aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"` (real quote UUID from Table Editor → `quotes`) | Current page’s `s_quote_id` |


**Headers**


| Header          | Value                               | Private?       | Why                                                              |
| --------------- | ----------------------------------- | -------------- | ---------------------------------------------------------------- |
| `apikey`        | anon / publishable key              | **yes**        | Gateway                                                          |
| `Authorization` | `Bearer <access_token>`             | **no**         | Space after Bearer; admin JWT                                    |
| `Accept`        | `application/vnd.pgrst.object+json` | can be Private | **Single object** (not a list) — required or Bubble types a list |


**Initialize success fields:** `id`, `status`, `subtotal`, `tax_amount`, `total`, `deposit_amount`, `deposit_pct`, `tax_pct`, `ai_generated`, `ai_model`, `internal_notes`, `request_id`, `created_at`.


| Error        | Meaning                        | Fix                                |
| ------------ | ------------------------------ | ---------------------------------- |
| 406 PGRST116 | Accept missing / multiple rows | Keep `id=eq.` + object+json Accept |
| Empty / 401  | Bad token                      | Fresh admin `sb_access_token`      |
| 42501        | RLS                            | Must be admin                      |


---

#### D3.2 `DB - Get Quote Lines` (Data) — list


| Setting            | Exact value                                                                                                                                                                  |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Name**           | `DB - Get Quote Lines`                                                                                                                                                       |
| **Use as**         | **Data**                                                                                                                                                                     |
| **Method**         | GET                                                                                                                                                                          |
| **URL**            | `https://chqljfdmgdtsmbbwbdyv.supabase.co/rest/v1/quote_line_items?quote_id=eq.[quote_id]&select=id,price_book_item_id,label,qty,unit_price,overridden&order=created_at.asc` |
| **Include errors** | **OFF** (like Price Book / List Requests)                                                                                                                                    |


**URL param:** same `quote_id` as D3.1 (Initialize with quoted UUID; workflow = `s_quote_id`).

**Headers**


| Header          | Value                   | Private? |
| --------------- | ----------------------- | -------- |
| `apikey`        | anon key                | **yes**  |
| `Authorization` | `Bearer <access_token>` | **no**   |


**Do not** add `Accept: object+json` — this is a **list**.

**Initialize:** confirm `is_list` + flat fields `id`, `label`, `qty`, `unit_price`, `overridden`, `price_book_item_id`.

Used inside **Popup Fix Pricing** and when opening a row from the Quotes table.


| Error                    | Meaning               | Fix                       |
| ------------------------ | --------------------- | ------------------------- |
| Table red / wrapper type | Include errors was ON | OFF → re-Initialize       |
| 406                      | object+json on a list | Remove Accept object+json |

---

#### D3.2b Repeating Group — “evaluates to DB - Get Quote Lines” (connector OK, RG red)

**Symptom:** Initialize on the API Connector page shows a JSON **array** and looks fine.  
On **RepeatingGroup B**, Type of content + Get data from external API → red error: data source **evaluates to** `DB - Get Quote Lines` (same class of bug as Requests Table §A3.3).

**Cause:** Bubble thinks the call returns **one object**, but the RG needs a **list of items**. Price Book works because its call has `is_list = true` in the export; Get Quote Lines often does not until you re-init correctly.

##### Fix A — Re-initialize until Bubble types it as a **list** (do this first)

1. API Connector → `DB - Get Quote Lines`  
2. Include errors = **OFF**  
3. No `Accept: object+json`  
4. URL param **`quote_id`**: key = `quote_id`, Private = **OFF**, init value = `"real-uuid-with-lines"`  
5. Authorization = `Bearer <fresh admin JWT>`  
6. **Initialize** → raw data must start with `[` … `{ "id": …, "label": … }` … `]`  
7. On **Returned values** screen: confirm fields are **flat on the item** (`id`, `label`, `qty`, …) — **not** nested under `body`  
8. Save  

Compare to **DB - Get Price Book** (working RG on your app): that call has `is_list: true`. Get Quote Lines must match.

##### Fix B — RG settings (exact, like Price Book RG)

| RG setting | Value |
|------------|--------|
| **Type of content** | `DB - Get Quote Lines` — the **row/item** type from Initialize (same name as Price Book pattern) |
| **Not** | “list of DB - Get Quote Lines” as a separate nested list type |
| **Data source** | Get data from an external API → **DB - Get Quote Lines** |
| **`quote_id`** | Current page’s **`s_quote_id`** — plain text, **no** `:formatted as JSON-safe` |
| **`Authorization`** | `Bearer ` + Current User’s **`sb_access_token`** |
| **Only when** (recommended) | `s_quote_id` is not empty |

Inside cells: `Current cell's label`, `Current cell's qty`, `Current cell's unit_price` — **not** `Current cell's DB - Get Quote Lines's label` unless Bubble named it that way on your app (use whatever Initialize created; Price Book uses `Current cell's name` when type is the item).

##### Fix C — If RG data source stays red (dynamic `quote_id` quirk)

Price Book has **no URL params** — easy to bind on the RG. Get Quote Lines needs `quote_id`, and Bubble sometimes refuses a static RG data source even when Initialize is correct.

**Use workflow instead of (or in addition to) RG data source:**

| # | Action |
|---|--------|
| 1 | Set `s_quote_id` |
| 2 | Show Popup Quote |
| 3 | **Display list in** RepeatingGroup B → **DB - Get Quote Lines** |
| 4 | On that action: `quote_id` = `s_quote_id`, Authorization = Bearer + token |

Leave RG **Type of content** = `DB - Get Quote Lines`; data source can be empty or cleared. The **Display list** step is what fetches — and it **will** show in step-by-step.

Run again after Open / Draft with AI.

##### Fix D — Do not nest data sources

- **Popup header Group** → Get Quote (**single object**)  
- **RG sibling** → Get Quote Lines (**list**)  

Do **not** set the RG’s data source to “Parent group’s … Get Quote Lines” — there is no such field on the quote header. The RG calls **Get Quote Lines** directly with `quote_id = s_quote_id`.

##### Quick compare

| | Price Book RG (works) | Quote Lines RG |
|--|----------------------|----------------|
| Params | none | **`quote_id` required** |
| `is_list` | true | must be true after re-init |
| Fetch | RG data source OK | RG data source **or** Display list in WF |

**Done when:** RG shows rows with labels/qty/prices for a quote that has lines in Table Editor, and step-by-step shows **Display list** (or Network tab shows GET `quote_line_items?quote_id=eq.…`).

---

#### D3.3 `DB - List Quotes` (Data) — **one** table for everything

**Not** “list drafts only”. One list; **status** tells the story.


| Setting            | Exact value                                                                                                                                        |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Name**           | `DB - List Quotes`                                                                                                                                 |
| **Use as**         | **Data**                                                                                                                                           |
| **Method**         | GET                                                                                                                                                |
| **URL**            | `https://chqljfdmgdtsmbbwbdyv.supabase.co/rest/v1/quotes?select=id,request_id,status,subtotal,total,ai_generated,created_at&order=created_at.desc` |
| **Include errors** | **OFF**                                                                                                                                            |


Optional later: add `&status=in.(draft,sent)` to hide expired/declined.

**Headers:** `apikey` (Private) + `Authorization: Bearer <access_token>` (dynamic). **No** object+json.

**Initialize:** admin JWT → list of quotes; type = item; Table Data source = this call + Bearer = Current User’s `sb_access_token`.


| Error                | Meaning           | Fix                           |
| -------------------- | ----------------- | ----------------------------- |
| Table red one object | Include errors ON | OFF + re-init like Price Book |
| Empty 200            | Bad/empty Bearer  | Check token                   |


---

#### D3.4 (optional now) `DB - Patch Quote Line` + `DB - Patch Quote Totals` (Action)

**Patch line**


| Setting            | Exact value                                                                         |
| ------------------ | ----------------------------------------------------------------------------------- |
| **Name**           | `DB - Patch Quote Line`                                                             |
| **Use as**         | **Action**                                                                          |
| **Method**         | PATCH                                                                               |
| **URL**            | `https://chqljfdmgdtsmbbwbdyv.supabase.co/rest/v1/quote_line_items?id=eq.[line_id]` |
| **Include errors** | ticked                                                                              |


Body template (placeholders unquoted):

```json
{
  "qty": <qty>,
  "unit_price": <unit_price>,
  "overridden": true
}
```


| Placeholder     | Init example             | Workflow                         |
| --------------- | ------------------------ | -------------------------------- |
| `line_id` (URL) | `"ffffffff-….line-uuid"` | Current cell’s line `id`         |
| `qty`           | `1`                      | number input                     |
| `unit_price`    | `150.00`                 | number input                     |
| `access_token`  | paste JWT                | Current User’s `sb_access_token` |


Headers (all required for Initialize to return a row, not `[]`):

| Header | Value | Private? |
|--------|-------|----------|
| `apikey` | anon key | **yes** |
| `Authorization` | `Bearer <access_token>` | **no** |
| `Content-Type` | `application/json` | yes OK |
| `Prefer` | `return=representation` | yes OK |

**If Returned values raw data is `[]`:** zero rows updated — wrong UUID, missing Prefer, or bad JWT. Fix Initialize with a **real** id from Table Editor, then re-run. Optional: Edit raw data paste a sample `[{...}]` only to type fields, then re-Initialize for real.

**Patch quote totals**


| Setting    | Exact value                                                                |
| ---------- | -------------------------------------------------------------------------- |
| **Name**   | `DB - Patch Quote Totals`                                                  |
| **Use as** | **Action**                                                                 |
| **Method** | PATCH                                                                      |
| **URL**    | `https://chqljfdmgdtsmbbwbdyv.supabase.co/rest/v1/quotes?id=eq.[quote_id]` |


Body:

```json
{
  "subtotal": <subtotal>,
  "tax_amount": <tax_amount>,
  "total": <total>,
  "deposit_amount": <deposit_amount>
}
```

| Placeholder | Initialize example | Workflow |
|-------------|-------------------|----------|
| `quote_id` | `"a1b2c3d4-…"` from Table Editor → `quotes.id` | `s_quote_id` |
| `subtotal` | `150` | computed sum of lines |
| `tax_amount` | `30` | subtotal × tax_pct/100 |
| `total` | `180` | subtotal + tax |
| `deposit_amount` | `54` | total × deposit_pct/100 |
| `access_token` | paste admin `eyJ…` | Current User’s `sb_access_token` |

Same headers as Patch Line including **`Prefer: return=representation`**. Success raw data looks like `[{ "id": "…", "total": 180, … }]` (array of 1) — **not** `[]`.

After every line has `unit_price`, set `s_needs_manual_pricing` = no.

---

### D3.5 Schema cheat sheet — `quotes` vs `quote_line_items`

**One quote = one commercial document. Many lines = the work rows inside it.**

```
quotes (1 header)
   └── quote_line_items (many lines)   each has quote_id → that quote
```

#### Table `quotes` — what each field means (show most on Quotes table / popup header)

| Field | Meaning | Admin sees? |
|-------|---------|-------------|
| `id` | Quote UUID | Internal / Open sets `s_quote_id` |
| `company_id` | Tenant | No (auto) |
| `request_id` | Which customer request this quote came from | Optional link back |
| `status` | `draft` → `sent` → `viewed` → `accepted` / `declined` / `expired` | **Yes — Status column** |
| `token` | Secret link for customer (`/q?token=…`) — set on Send | No in UI (never put raw quote id in customer URL) |
| `subtotal` | Sum of (qty × unit_price) for priced lines | Yes |
| `tax_pct` / `tax_amount` | Tax rate snapshot + amount | Yes |
| `total` | subtotal + tax | **Yes — Total column** |
| `deposit_pct` / `deposit_amount` | Deposit rate snapshot + amount due to accept | Yes in popup |
| `ai_generated` / `ai_model` | Draft came from AI | Optional “AI?” column |
| `ai_raw` | Full model JSON (debug) | No in Bubble UI |
| `internal_notes` | Admin-only notes / AI assumptions | Popup only, not customer |
| `valid_until` | Expiry after Send | After sent |
| `viewed_at` | Customer opened link | Later |
| `declined_reason` | If customer declines | Later |
| `created_at` | When drafted | **Yes — When column** |

#### Table `quote_line_items` — what each field means (show only inside the quote popup RG)

| Field | Meaning | Admin sees? |
|-------|---------|-------------|
| `id` | Line UUID | Used for Patch Line `line_id` |
| `quote_id` | Parent quote | Filter only |
| `price_book_item_id` | Matched price-book row (or **null** if unmatched) | Optional |
| `label` | What the customer sees for this work | **Yes — line label** |
| `qty` | Quantity | **Yes — editable** |
| `unit_price` | £ per unit (**null** = needs manual pricing — **blocks Send**) | **Yes — editable** |
| `overridden` | Admin changed price vs book | Badge optional |

**Quotes table columns:** When | Total | Status | Open — **not** line fields.  
**Popup RG:** label | qty | unit_price | Needs pricing if `unit_price` empty.

---

### D4. UI — **one** Popup Quote + one Quotes table

**There is only one quote popup** (name it `Popup Quote`). Two doors into it:

1. Requests → Draft with AI → set `s_quote_id` → Show Popup Quote (especially if `needs_manual_pricing`)  
2. Quotes table → Open → set `s_quote_id` → Show Popup Quote  

Do **not** build two different quote popups.

---

#### D4.1 Complete plan — Popup Quote

##### A. Page states (on `admin_dashboard`)

| State | Type | Set by | Used for |
|-------|------|--------|----------|
| `s_quote_id` | text | Draft Quote success / Quotes Open | Binds Get Quote + Get Quote Lines |
| `s_needs_manual_pricing` | yes/no | Draft Quote result; clear after Save when all priced | Banner + disable Send |
| `s_send_busy` | yes/no | Send workflow | Disable Send while in flight |
| `s_send_error` | text | Send failure | Error text |
| `s_save_busy` | yes/no | Save prices workflow | Disable Save while in flight |
| `s_save_error` | text | Save failure | Error text |
| `s_quote_banner` | text | optional success messages | “Saved” / “Sent to …” |

(You already have `s_request_id` for the request popup — leave it separate.)

##### B. Data sources inside the popup (when open)

| Call | Param | Feeds |
|------|-------|--------|
| `DB - Get Quote` | `quote_id` = `s_quote_id` | Header: status, totals, notes, tax/deposit % |
| `DB - Get Quote Lines` | `quote_id` = `s_quote_id` | Repeating Group of lines |

Both only run / display when `s_quote_id is not empty`. Bearer = Current User’s `sb_access_token`.

##### C. Layout (build top → bottom)

```
┌─ Popup Quote ──────────────────────────────────────────────────────────┐
│  [1] HEADER                                                            │
│      Title: Quote                                                      │
│      Badge: status (draft / sent / …)                                  │
│      Small text: Created · AI? (ai_generated) · model (optional)       │
│                                                                        │
│  [2] BANNER (conditional)                                              │
│      Red if s_needs_manual_pricing: “Some lines need a price”          │
│      Red if s_save_error / s_send_error not empty                      │
│      Green if s_quote_banner not empty                                 │
│                                                                        │
│  [3] TOTALS (read from Get Quote — refresh after Save)                 │
│      Subtotal £…   Tax (tax_pct%) £…   Total £…   Deposit (pct%) £…    │
│                                                                        │
│  [4] LINE ITEMS — Repeating Group                                      │
│      Data: DB - Get Quote Lines                                        │
│      Each row:                                                         │
│        • Text label (read-only)                                        │
│        • Input qty          (enabled only if status = draft)           │
│        • Input unit_price   (enabled only if status = draft)           │
│        • Text “Needs pricing” IF Current cell’s unit_price is empty   │
│        • (optional) line total = qty × unit_price                      │
│                                                                        │
│  [5] INTERNAL NOTES (optional)                                         │
│      Multiline text from Get Quote’s internal_notes (read-only for v1) │
│                                                                        │
│  [6] ACTIONS                                                           │
│      [ Save prices ]     visible/enabled if status = draft             │
│      [ Send to customer ] visible/enabled if status = draft            │
│                           AND NOT s_needs_manual_pricing               │
│                           AND no line has empty unit_price             │
│                           AND NOT s_send_busy                          │
│      [ Close ]           always                                        │
└────────────────────────────────────────────────────────────────────────┘
```

##### D. What each block shows (fields)

| Block | Element | Source field | Notes |
|-------|---------|--------------|-------|
| Header | Status badge | Get Quote’s `status` | Color optional: draft=grey, sent=blue |
| Header | Created | `created_at` | formatted date |
| Header | AI | `ai_generated` | “AI draft” if yes |
| Totals | 4 texts | `subtotal`, `tax_amount`, `total`, `deposit_amount` | Also show `tax_pct` / `deposit_pct` as labels |
| RG | Label | Current cell’s `label` | Never empty |
| RG | Qty input | default = Current cell’s `qty` | number |
| RG | Price input | default = Current cell’s `unit_price` | number; empty if null |
| RG | Needs pricing | condition on empty `unit_price` | red small text |
| Notes | text | `internal_notes` | Hide group if empty |
| — | Do **not** show | `token`, `ai_raw`, `company_id` | Secrets / debug |

##### E. Conditions (important)

| Element | Only when |
|---------|-----------|
| Whole popup content | `s_quote_id is not empty` |
| “Needs pricing” on a row | That cell’s `unit_price` is empty |
| Banner “needs pricing” | `s_needs_manual_pricing is yes` |
| Qty / price **Inputs** enabled | Get Quote’s `status` is `draft` |
| **Save prices** visible | `status` is `draft` |
| **Send** visible | `status` is `draft` |
| **Send** enabled | draft + every line has unit_price + not busy + not needs_manual_pricing (or recompute: no empty prices in RG) |
| After `sent` / `viewed` / … | Inputs disabled; Save + Send hidden; only Close (+ read-only lines) |

##### F. Workflows

**F1 — Open from Quotes table**

| # | Action |
|---|--------|
| 1 | `s_quote_id` = Current row’s `id` |
| 2 | Clear `s_send_error`, `s_save_error`, `s_quote_banner` |
| 3 | Optional: set `s_needs_manual_pricing` = yes if any line will be empty (or leave until Save checks) |
| 4 | Show Popup Quote |

**F2 — Open after Draft with AI** (already in D2)

| # | Action |
|---|--------|
| … | On success: `s_quote_id` = Result’s `quote_id` |
| … | `s_needs_manual_pricing` = Result’s `needs_manual_pricing` |
| … | Show Popup Quote (always OK; or only when needs pricing — your choice; **recommend always open** so admin can Send from same place) |

**F3 — Save prices** (button)

For **each** RG row (or “current row Save” per line — easiest for trainee: **one Save on the row** OR loop):

*Simple trainee pattern — Save on each row:*

Per line button **Save line** (or one global Save that runs a custom event per cell):

| # | Action |
|---|--------|
| 1 | `s_save_busy` = yes |
| 2 | Call **DB - Patch Quote Line**: `line_id` = Current cell’s `id`, `qty` = Input qty’s value, `unit_price` = Input price’s value, Bearer = token |
| 3 | After all lines patched (or after last): compute  
    `subtotal` = sum over RG of (qty × unit_price)  
    `tax_amount` = subtotal × (Get Quote’s `tax_pct` / 100)  
    `total` = subtotal + tax_amount  
    `deposit_amount` = total × (Get Quote’s `deposit_pct` / 100) |
| 4 | Call **DB - Patch Quote Totals** with those four numbers + `quote_id` = `s_quote_id` |
| 5 | If every line now has unit_price → `s_needs_manual_pricing` = no |
| 6 | `s_quote_banner` = “Prices saved”; `s_save_busy` = no |
| 7 | Display data in group / refresh so Get Quote + Get Quote Lines re-run (Bubble: “Display data” or bump `&ts=` if you added cache-bust) |

*Even simpler first version:* only **Save line** on each RG row (Patch Line only). Add a second button **Update totals** that runs Patch Totals once. Then merge into one Save later.

**F4 — Send to customer**

| # | Action |
|---|--------|
| 1 | Terminate if `s_quote_id` empty OR any visible line price empty OR status ≠ draft |
| 2 | `s_send_busy` = yes; clear `s_send_error` |
| 3 | Call **Send Quote** (`quote_id` = `s_quote_id:formatted as JSON-safe`) |
| 4 | Success: `s_quote_banner` = “Sent to ” + Result’s `customer_email`; refresh List Quotes |
| 5 | Error: `s_send_error` = Result’s `error` |
| 6 | `s_send_busy` = no |

**F5 — Close**

| # | Action |
|---|--------|
| 1 | Hide Popup Quote |
| 2 | Optional: clear `s_quote_id` (or keep it — either works) |
| 3 | Do **not** delete the quote |

##### G. Quotes table (outside popup — for context)

| Column | Data |
|--------|------|
| When | `created_at` |
| Total | `total` |
| Status | `status` |
| AI? | `ai_generated` (optional) |
| Open | workflow F1 |

##### H. Build order (do in this sequence)

1. Connectors D3.1–D3.3 Initialize OK  
2. Quotes table + Open → sets `s_quote_id` + shows empty popup shell  
3. Bind Get Quote header + Get Quote Lines RG (read-only first)  
4. Make qty/price inputs + Save (D3.4)  
5. Wire Send (E3)  
6. Wire Draft with AI → same popup  

##### I. Done when

- [ ] Open from Quotes shows correct status + lines for `s_quote_id`  
- [ ] Empty `unit_price` shows “Needs pricing”; Send disabled  
- [ ] Save writes line + updates totals; banner “Prices saved”  
- [ ] Send on fully priced draft → email + status becomes `sent` on table  
- [ ] Close leaves quote on table; re-Open works  
- [ ] After sent: read-only, no Save/Send  

---

#### D4.1b Wire workflows NOW (from Bubble export `fieldquote-26446 (2).bubble`)

**Audit (2026-08-08):** APIs are ready and you said Initialize/Send tests passed. Popup UI exists (`Popup E` / **Popup Quote**). What’s missing is **binding + workflows** — not new connectors.

##### Already in the app (do not recreate)

| Call | Use as | Status |
|------|--------|--------|
| `Draft Quote` | Action | Wired on request → Draft with AI (`bTJFd`) |
| `DB - List Quotes` | Data | Quotes **Table E** data source + Bearer |
| `DB - Get Quote` | Data | Initialized — **not yet bound in popup** |
| `DB - Get Quote Lines` | Data | Initialized — **RG not bound yet** |
| `DB - Patch Quote Line` | Action | Ready for Save |
| `DB - Patch Quote Totals` | Action | Ready for Save |
| `Send Quote` | Action | Ready for Send button |

| UI | Notes |
|----|--------|
| **Group Quotes** + **Table E** | Lists quotes |
| **Popup Quote** (`Popup E`) | Layout ready; still showing **request** states (`s_req_*`) in places |
| Draft with AI WF | Calls Draft Quote → sets `s_needs_manual_pricing` → toast → **Show Popup Quote** |
| PopupOpened on Quote | **Exists but empty** — add fetch binding here or bind Data sources statically |
| Close button | Only **Hide** popup today |

##### Gaps to fix (do in order)

**1. Add page state `s_quote_id` (text)** on `admin_dashboard`  
You have `s_request_id`, `s_needs_manual_pricing`, etc. — **no `s_quote_id` yet**. Optional: `s_send_busy` (yes/no), `s_send_error` (text).

**2. Fix Draft with AI workflow** (after successful `Draft Quote`)

Insert **before** Show Popup Quote:

| # | Action |
|---|--------|
| … | Result of Draft Quote is OK |
| **NEW** | Set custom state `s_quote_id` = Result of step Draft Quote’s `quote_id` (body) |
| … | (already) Set `s_needs_manual_pricing` from Result’s `needs_manual_pricing` |
| … | (already) Show **Popup Quote** |

Without `s_quote_id`, Get Quote / Get Quote Lines have nothing to load.

**3. Bind popup header → `DB - Get Quote`**

On **Popup Quote** (or an inner Group “Quote header”):

| Setting | Value |
|---------|--------|
| Type of content | `DB - Get Quote` (API data type) |
| Data source | Get data from API → **DB - Get Quote** |
| `quote_id` | Current page’s `s_quote_id` |
| `Authorization` / access_token | `Bearer ` + Current User’s `sb_access_token` |

Then replace request fields in the popup with Get Quote fields:

| Show | Expression |
|------|------------|
| Status | Parent group’s `status` |
| Subtotal | Parent’s `subtotal` |
| Tax | Parent’s `tax_amount` (label with `tax_pct`) |
| Total | Parent’s `total` |
| Deposit | Parent’s `deposit_amount` |
| Notes | Parent’s `internal_notes` (optional) |

Remove / stop using `s_req_name`, `s_req_email`, … inside **this** popup (those belong to Request popup only).

**4. Bind lines RG → `DB - Get Quote Lines`**

On **RepeatingGroup B** inside Popup Quote:

| Setting | Value |
|---------|--------|
| Type of content | `DB - Get Quote Lines` item |
| Data source | Get data from API → **DB - Get Quote Lines** |
| `quote_id` | Current page’s `s_quote_id` |
| Bearer | same as above |

| Cell | Binding |
|------|---------|
| Label | Current cell’s `label` |
| Qty input | Initial content = Current cell’s `qty` |
| Price input | Initial content = Current cell’s `unit_price` |
| “Needs pricing” | Visible when Current cell’s `unit_price` is empty |

**Connector check:** `DB - Get Quote Lines` must be a **list** (Include errors **OFF**, `is_list`). URL param `quote_id` must **not** be Private empty — same pattern as Get Quote’s `quote_id`.

**5. Quotes table → Open → same popup**

Add button/icon in Table E row (or use cell click):

| # | Action |
|---|--------|
| 1 | Set `s_quote_id` = Current row’s `id` |
| 2 | Clear send/save error states if any |
| 3 | Show **Popup Quote** |

(Get Quote + Get Quote Lines re-run because `s_quote_id` changed.)

**6. Save prices** (button in popup — wire when ready)

For each line (or per-row Save):

1. **DB - Patch Quote Line** — `line_id` = Current cell’s `id`, `qty` / `unit_price` from inputs, Bearer = token  
2. After lines saved: compute totals → **DB - Patch Quote Totals** (`quote_id` = `s_quote_id`)  
3. If no empty prices left → `s_needs_manual_pricing` = no  

**7. Send to customer** (Button “SEND TO CUSTOMER”)

| # | Action |
|---|--------|
| 1 | Only when `s_quote_id` not empty and not needs_manual_pricing |
| 2 | **Send Quote** — `quote_id` = `s_quote_id:formatted as JSON-safe`, Bearer = token |
| 3 | Success banner; refresh List Quotes (display data / navigate) |
| 4 | Optional: Hide popup |

**8. PopupOpened (optional)**  
Workflow on Popup Quote is empty — you can leave it empty if Data sources use `s_quote_id` (they auto-refresh). Or use it only to clear banners.

##### Minimal path to “see data in popup”

1. Add `s_quote_id`  
2. Draft with AI → set `s_quote_id` from Result’s `quote_id`  
3. Bind Get Quote + Get Quote Lines to `s_quote_id`  
4. Preview: Draft with AI → popup shows status/totals/lines  

Then add Open from table + Save + Send.

---

#### D4.1c Debug — state updates but **no API call** / table looks empty

This matches the current Bubble export. Fix these in order.

##### Bug 1 — `DB - Get Quote Lines` URL param is broken

In the export, `url_params` for Get Quote Lines is only `{ private: true }` — **no `key: quote_id`**.  
Then `[quote_id]` in the URL never gets your `s_quote_id`, so Bubble may skip the call or hit a bad URL.

**Fix in API Connector → `DB - Get Quote Lines`:**

1. Open the call → URL params  
2. Param name must be exactly **`quote_id`** (matches `[quote_id]` in URL)  
3. Private = **OFF**  
4. Re-Initialize with a real quoted UUID + admin Bearer  
5. Confirm `is_list` / Include errors **OFF**

##### Bug 2 — Data source missing **Authorization** (most common “no call” / empty)

Initialize pasted a JWT into the header. That token **expires**.  
When the **popup / RG / Table** uses Get data from API, you must fill **Authorization again** on **that element**:

```
Bearer [Current User's sb_access_token]
```

(space after `Bearer`)

| Element | Must pass |
|---------|-----------|
| Popup / Group (Get Quote) | `quote_id` = `s_quote_id` **and** Authorization = Bearer + token |
| RG (Get Quote Lines) | same |
| Quotes Table (List Quotes) | Authorization = Bearer + token (no quote_id) |

If Authorization is empty on the element, Bubble often **does not fetch** (or gets 401 and shows blank).

##### Bug 3 — `DB - Get Quote` needs single-object Accept

Add header (can be Private):

`Accept` = `application/vnd.pgrst.object+json`

Without it, PostgREST returns `[{...}]` (list of 1). Bubble then won’t expose fields as a single object on the popup group.

**Do not** put that Accept on Get Quote Lines or List Quotes.

##### Bug 4 — Quotes table columns not bound (export had empty cells)

Table E’s data source is List Quotes, but column Texts had **no** Current cell bindings → looks empty/meaningless.

Bind each column:

| Column | Text = Current cell’s … |
|--------|-------------------------|
| When | `created_at` (format as date/time) |
| Total | `total` |
| Status | `status` |
| AI? | `ai_generated` |
| (hidden) | keep `id` available for Open → `s_quote_id` |

##### Bug 5 — Open order

| # | Action |
|---|--------|
| 1 | Set `s_quote_id` = Current row’s `id` |
| 2 | **Then** Show Popup Quote |

If you Show before Set, the first paint may call with empty id (no fetch).

##### Checklist (2 minutes)

- [ ] Network/Bubble logs: when Open popup, do you see GET `.../quotes?id=eq.<uuid>`?  
- [ ] Same for `.../quote_line_items?quote_id=eq.<uuid>`  
- [ ] If **no request** → Authorization and/or `quote_id` param missing on the element  
- [ ] If **401** → refresh login; re-bind Bearer to Current User token (not Initialize paste)  
- [ ] If **406** → Accept object+json missing on Get Quote, or wrongly on a list call  
- [ ] Table shows rows but blank cells → bind column Texts to Current cell fields  

##### Bug 6 — Step-by-step shows nothing (this is normal for Data sources)

**Bubble step-by-step only runs Workflow Actions.**  
`Get data from API` on a Group/RG is **not** a workflow step — it will **never** appear in step-by-step, even when it works.

To see the call while debugging, **fetch in a workflow (Action)** after you set `s_quote_id`:

**Recommended pattern (trainee-friendly)**

1. Keep connectors as **Data** for the Table / optional binds.  
2. Also ensure you can call them from workflows — if Bubble only offers Data, duplicate as **Action** copies:
   - `DB - Get Quote (Action)` — same URL/headers as Get Quote  
   - `DB - Get Quote Lines (Action)` — same as Get Quote Lines  
   Or: use **Display data in group** after a plugin Action if your Bubble version supports retrieving Data calls in WF.

**Simplest reliable Open workflow**

| # | Action | Detail |
|---|--------|--------|
| 1 | Set custom state | `s_quote_id` = Current row’s `id` |
| 2 | Show Popup Quote | |
| 3 | **Display data** in Group “Quote header” | Data source = **DB - Get Quote** with `quote_id` = `s_quote_id`, Authorization = `Bearer ` + Current User’s `sb_access_token` |
| 4 | **Display list** in RG (or Display data if needed) | **DB - Get Quote Lines**, same `quote_id` + Bearer |

Now step-by-step **will** show steps 1–4. If step 3/4 errors, you’ll see the status/body.

**PopupOpened alternative** (element = Popup Quote):

| # | Action |
|---|--------|
| 1 | Only when `s_quote_id` is not empty |
| 2 | Display data → Get Quote (`quote_id` = `s_quote_id`, Bearer = token) |
| 3 | Display list → Get Quote Lines (same) |

**Still required on the connector**

- Get Quote Lines URL param key = `quote_id` (not Private blank)  
- Get Quote: header `Accept: application/vnd.pgrst.object+json`  
- Every call: live Bearer, not Initialize JWT  

**Browser check (proves a call happened)**

Chrome DevTools → Network → filter `quotes` → click Open.  
You should see `rest/v1/quotes?id=eq.…`. If still zero requests after Display data in WF, Authorization/`quote_id` params on that Action are empty.

---

#### D4.2 One Quotes panel (`admin_panel_` = Drafts, label **Quotes**)

```
┌─ Group Quotes ──────────────────────────────────────────────────┐
│  Table: When | Total | Status | AI? | [Open] → Popup Quote        │
└─────────────────────────────────────────────────────────────────┘
```

---

### D5. Edit prices (Popup Fix Pricing / detail)

Use **D3.4** PATCH calls:


| Action              | Call                      |
| ------------------- | ------------------------- |
| Change qty / price  | `DB - Patch Quote Line`   |
| Update quote totals | `DB - Patch Quote Totals` |


After all lines have `unit_price`, set `s_needs_manual_pricing` = no.

**Send disabled** while any line has empty `unit_price`.

---

### D6. Send → Phase E

One **Send to customer** control (on priced detail / popup — not a second “ready” inbox):

1. Disabled if unpriced or no `s_quote_id`
2. Action **Send Quote** — full connector in **§E3** below
3. Edge: validate → token → `sent` → Resend → `email_log`
4. Refresh Quotes table — same row now shows **Status = sent**

---

### D7. Checklist

- [ ] Draft Quote Initialize OK  
- [ ] Draft with AI → `s_quote_id` + `s_needs_manual_pricing`  
- [ ] If needs pricing → **Popup Fix Pricing** opens (not a second nav section)  
- [ ] **One** Quotes table with Status column (draft / sent / …)  
- [ ] No “ready drafts” separate area  
- [ ] Send only when all priced → Phase E  

---

# Phase E — `send-quote` + customer email (after Phase D UI works)

**Order:** deploy `send-quote` (+ `resolve-quote-token`) → API Connector Initialize → wire **Send** on the quote popup.  
Email is **only** sent inside the edge function (Resend + `email_log`). Bubble never holds `RESEND_API_KEY`.

### E0. What is built / what is NOT


| Piece                   | Status                                            | Role                                                                                |
| ----------------------- | ------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `send-quote`            | **Deployed**                                      | Admin JWT → validate priced lines → token → `status=sent` → Resend → `email_log`    |
| `resolve-quote-token`   | **Deployed**                                      | Public (no JWT) → customer opens link → safe quote JSON; first open stamps `viewed` |
| Accept → Stripe deposit | **Week 3** (`create-checkout` + `stripe-webhook`) | Customer pays → webhook sets `quotes.status=accepted` + creates `jobs`              |
| Decline                 | **Week 3**                                        | Sets `quotes.status=declined` + `declined_reason` (not `email_log`)                 |


**Accept / reject is NOT inside `send-quote`.** Send only emails the link. Customer response is logged on the `**quotes` row** (`status`, `viewed_at`, `declined_reason`). The **email** of the quote is logged in `**email_log`** (`template = quote_sent`).

```
Admin Send → send-quote → email_log (quote_sent) + quotes.status=sent + token
Customer opens link → resolve-quote-token → quotes.status=viewed (first time)
Customer Accept → create-checkout → Stripe → webhook → quotes.status=accepted + jobs row + email_log confirmations
Customer Decline → quotes.status=declined + declined_reason (+ optional admin notify email_log later)
```

### E1. Deploy

```bash
npx supabase functions deploy send-quote --no-verify-jwt --project-ref chqljfdmgdtsmbbwbdyv
npx supabase functions deploy resolve-quote-token --no-verify-jwt --project-ref chqljfdmgdtsmbbwbdyv
npx supabase secrets set PUBLIC_QUOTE_PAGE_URL=https://fieldquote-26446.bubbleapps.io/version-test/q --project-ref chqljfdmgdtsmbbwbdyv
```

Confirm `RESEND_API_KEY` is already set (same as invites).

---

### E3. API Connector — `Send Quote` (trainee detail — like §B2)

**Do not wire the Send button until Initialize returns `ok: true`.**

#### E3.1 Create the call

Plugins → API Connector → same Supabase API group as `Draft Quote`.


| Setting            | Exact value                                                        | Why                                 |
| ------------------ | ------------------------------------------------------------------ | ----------------------------------- |
| **Name**           | `Send Quote`                                                       | Clear in workflows                  |
| **Use as**         | **Action**                                                         | Called from Send button workflow    |
| **Data type**      | JSON                                                               |                                     |
| **Method**         | POST                                                               |                                     |
| **URL**            | `https://chqljfdmgdtsmbbwbdyv.supabase.co/functions/v1/send-quote` | Must include `/functions/v1/`       |
| **Body type**      | JSON                                                               |                                     |
| **Include errors** | **ticked**                                                         | So failure banners can read `error` |


#### E3.2 Headers


| Header key      | Value in connector                                  | Private?         | What it does                      |
| --------------- | --------------------------------------------------- | ---------------- | --------------------------------- |
| `Content-Type`  | `application/json`                                  | can be Private   | Body is JSON                      |
| `apikey`        | Supabase **anon / publishable** key (same as Login) | **yes Private**  | Gateway; never service_role       |
| `Authorization` | `Bearer <access_token>`                             | **no** (dynamic) | **Space after Bearer.** Admin JWT |


Shared API-group headers for `apikey` + `Content-Type` are fine.

#### E3.3 Body template — dynamic `< >`

In the **JSON body** box type exactly (placeholders **unquoted**):

```json
{
  "quote_id": <quote_id>
}
```


| Placeholder      | Bubble param type | Meaning                                                                         | Initialize value (quotes **required**)                                                            | Later in workflow                                  |
| ---------------- | ----------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| `<quote_id>`     | text              | UUID of a **draft** quote that is **fully priced** (no null `unit_price` lines) | `"aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"` — copy from Table Editor → `quotes` where `status=draft` | Current page’s `s_quote_id:formatted as JSON-safe` |
| `<access_token>` | text (header)     | Admin session JWT                                                               | paste Current User’s `sb_access_token` (fresh login)                                              | `Current User's sb_access_token`                   |


**Rule:** template `"quote_id": <quote_id>` bare; Initialize wraps the UUID in `"..."`; workflow uses JSON-safe (no extra quotes around the dynamic).

Bubble sends **only** `quote_id` + Bearer. Email is entirely server-side.

#### E3.4 Success response (after Initialize)

HTTP **200**. Fields Bubble should show:


| Field            | Type             | Example                                                         | Use                             |
| ---------------- | ---------------- | --------------------------------------------------------------- | ------------------------------- |
| `ok`             | yes/no / boolean | `true`                                                          | success branch                  |
| `quote_id`       | text             | uuid                                                            | confirm                         |
| `status`         | text             | `sent`                                                          |                                 |
| `token`          | text             | 32-hex                                                          | debug only — customer uses link |
| `quote_url`      | text             | `https://fieldquote-26446.bubbleapps.io/version-test/q?token=…` | optional copy for admin         |
| `valid_until`    | text             | ISO date                                                        |                                 |
| `email_status`   | text             | `sent`                                                          | banner                          |
| `customer_email` | text             | `customer@…`                                                    | banner “Sent to …”              |
| `resend_id`      | text             |                                                                 |                                 |
| `totals`         | object           | subtotal / tax_amount / total / deposit_amount                  | optional display                |


**Stop here until Initialize returns `ok: true` and you see the email in the inbox / Resend dashboard.** Also check Table Editor: `quotes.status=sent`, `token` set; `email_log` row `template=quote_sent`.

#### E3.5 Errors (what you will see + fix)


| Status / body                                 | Meaning                                   | Fix                                                         |
| --------------------------------------------- | ----------------------------------------- | ----------------------------------------------------------- |
| **401** Missing/invalid session               | No/expired JWT                            | Log in as admin; paste new access token                     |
| **403** Admin access required                 | Not admin                                 | Use admin user                                              |
| **400** `quote_id is required`                | Empty body / bad placeholder              | Init value with quotes; template unquoted `<quote_id>`      |
| **400** `Cannot send: … needs manual pricing` | A line has null `unit_price`              | **See §E3.6 below** — price lines first, then re-Initialize |
| **400** `Quote is not a draft`                | Already sent/viewed/…                     | Pick a draft row                                            |
| **404** Quote not found                       | Wrong UUID / other company                | Copy id from Table Editor                                   |
| **502** `email_status: failed`                | Resend error; quote may already be `sent` | Check `RESEND_API_KEY`; do not re-send same draft blindly   |
| Bubble `bad_json`                             | Quoted `<quote_id>` in **template**       | Use `"quote_id": <quote_id>` not `"quote_id": "<quote_id>"` |


#### E3.6 Initialize Send Quote failed: `needs_manual_pricing` (your case)

Example error:

```json
{
  "error": "Cannot send: one or more lines need manual pricing",
  "unpriced_line_ids": [
    "ad56e417-8d95-43e4-a09a-871076e4cefb",
    "a794b880-4df7-40bf-b7d6-37966c68977a"
  ],
  "needs_manual_pricing": true
}
```

**Meaning:** the quote header exists, but those two rows in **`quote_line_items`** have `unit_price = null`. The AI matched a label but not a price-book price (or unmatched work). **Send is blocked on purpose** (§13 — AI never invents a price).

**Do this before Initialize succeeds:**

1. Supabase → Table Editor → **`quote_line_items`**.
2. Open each id from `unpriced_line_ids` (e.g. `ad56e417-…` and `a794b880-…`).
3. Set a real **`unit_price`** (number, e.g. `150`) — either:
   - **Quick test:** edit the cell in Table Editor and Save, **or**
   - **Product path:** Initialize **`DB - Patch Quote Line`** twice:

| Param | Initialize value (example) |
|-------|----------------------------|
| `line_id` | `"ad56e417-8d95-43e4-a09a-871076e4cefb"` |
| `qty` | `1` |
| `unit_price` | `150` |
| `access_token` | admin `eyJ…` |

Repeat for `"a794b880-4df7-40bf-b7d6-37966c68977a"`.

4. Recompute totals → Initialize **`DB - Patch Quote Totals`** for that quote’s `id` (parent in `quotes`), e.g. subtotal / tax / total / deposit from the new prices.  
5. Confirm in Table Editor: **both** lines have non-null `unit_price`.  
6. Re-Initialize **Send Quote** with the **same** `quote_id` (still `status=draft`) + fresh admin JWT.

**Only then** expect HTTP 200 with `ok: true`, `email_status: sent`.

**Do not** try to Initialize Send on a quote that still has null line prices — the 400 is correct behavior.

### E3b. API Connector — `Resolve Quote Token` (public page later)

**For admin Send you do not need this yet.** Add when building public page `q`.


| Setting            | Exact value                                                                 |
| ------------------ | --------------------------------------------------------------------------- |
| **Name**           | `Resolve Quote Token`                                                       |
| **Use as**         | **Action**                                                                  |
| **Method**         | POST                                                                        |
| **URL**            | `https://chqljfdmgdtsmbbwbdyv.supabase.co/functions/v1/resolve-quote-token` |
| **Include errors** | ticked                                                                      |


**Headers**


| Header          | Value                                                                                                                      | Private?       |
| --------------- | -------------------------------------------------------------------------------------------------------------------------- | -------------- |
| `Content-Type`  | `application/json`                                                                                                         | can be Private |
| `apikey`        | anon key                                                                                                                   | **yes**        |
| `Authorization` | `Bearer <anon_or_empty>` — for public page you can omit Authorization **or** send `Bearer` + **anon key** (not a user JWT) | —              |


Body:

```json
{
  "token": <token>
}
```


| Placeholder | Initialize                                                  | Workflow                       |
| ----------- | ----------------------------------------------------------- | ------------------------------ |
| `<token>`   | `"abc…"` 32-hex from `quotes.token` after a successful Send | Get data from page URL `token` |


**Success (actionable):** `actionable`, `status`, `company_name`, `line_items`, totals, `next_actions`.  
**410:** expired / declined / accepted — show dead-end message.

---

### E4. Bubble UI — what to show

#### Quotes table (admin_panel = Drafts / label **Quotes**) — header only


| Column | Source                                                                       |
| ------ | ---------------------------------------------------------------------------- |
| When   | `created_at`                                                                 |
| Total  | `total`                                                                      |
| Status | `status` (`draft` / `sent` / `viewed` / `accepted` / `declined` / `expired`) |
| AI?    | `ai_generated` (optional)                                                    |
| Open   | set `s_quote_id` → open **same** quote popup                                 |


Do **not** list line items as table columns. One row = one `quotes` document.

#### Quote popup (shared: after Draft with AI *or* Quotes → Open)

```
┌─ Popup Quote ───────────────────────────────────────────────────┐
│  Status badge: draft | sent | viewed | …                          │
│  Customer (from request) · totals: subtotal / tax / total / deposit│
│                                                                   │
│  RG lines (quote_line_items):                                     │
│    label | qty | unit_price (edit if draft) | Needs pricing?      │
│                                                                   │
│  If draft + any null price:  [ Save prices ]                      │
│  If draft + all priced:      [ Send to customer ]                 │
│  If already sent+:           read-only lines + status (no Send)   │
│  [ Close ]                                                        │
└───────────────────────────────────────────────────────────────────┘
```

**Page states (add if missing)**


| State                    | Type   | Purpose        |
| ------------------------ | ------ | -------------- |
| `s_quote_id`             | text   | Selected quote |
| `s_send_busy`            | yes/no | Send in flight |
| `s_send_error`           | text   | Failure text   |
| `s_needs_manual_pricing` | yes/no | Blocks Send    |


**Send workflow** (only after §E3.4 Initialize OK)


| #   | Action                                                                                                                    |
| --- | ------------------------------------------------------------------------------------------------------------------------- |
| 1   | Terminate if `s_quote_id` empty or `s_needs_manual_pricing is yes`                                                        |
| 2   | `s_send_busy` = yes; clear `s_send_error`                                                                                 |
| 3   | Call **Send Quote** — `quote_id` = `s_quote_id:formatted as JSON-safe`, `access_token` = Current User’s `sb_access_token` |
| 4   | On success: success banner (“Sent to ” + Result’s `customer_email`); refresh `DB - List Quotes`; optionally close popup   |
| 5   | On error: `s_send_error` = Result’s `error`; failure banner                                                               |
| 6   | `s_send_busy` = no                                                                                                        |


Disable Send when any line has empty `unit_price`, or Get Quote’s `status` ≠ `draft`, or `s_send_busy is yes`.

---

### E5. Customer page (minimal now / full Week 3)

1. Create public Bubble page `q` (no login).
2. On page load: read `token` from URL → call **Resolve Quote Token** (§E3b) → show lines + totals.
3. Buttons **Accept** / **Decline** = placeholders until `create-checkout` (Week 3).
4. Admin sees outcome via Quotes table **Status** (`viewed` / `accepted` / `declined`).

**Done when:** Send → customer email + `email_log.template=quote_sent` + `quotes.status=sent` + token set; unpriced quote returns 400; opening link via `resolve-quote-token` flips to `viewed`.

---

# Phase F — Deferred (do not block A–E)


| Item                                                        | Note                                                                                                                           |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Intake emails in `submit-request`                           | Customer + admin notify + `email_log` (scope Day 7)                                                                            |
| Reconcile repo `submit-request` body (`media` / `honeypot`) | Match Bubble                                                                                                                   |
| SessionKeeper redirect / empty refresh                      | `PROJECT_MEMORY.md` backlog                                                                                                    |
| URL route guards                                            | Harden page-load                                                                                                               |
| Invite / pricing / send / **all API** banners               | Success + failure everywhere; some screens already have banners — audit & complete gaps (inbox, media, draft, invite, pricing) |
| RLS negative suite                                          | Before eval                                                                                                                    |
| Photos in AI prompt                                         | Day 9 — fetch R2 inside `draft-quote` as base64                                                                                |
| Quote status trigger                                        | `draft→sent→…` migration Day 10                                                                                                |


---

## 4. Suggested Bubble admin IA (minimal churn)


| `admin_panel` value          | Show                                                                            |
| ---------------------------- | ------------------------------------------------------------------------------- |
| Home                         | Summary counts (optional)                                                       |
| **Offers → rename Requests** | Inbox + detail + Draft with AI → Fix Pricing popup if needed                    |
| **Drafts → Quotes**          | **One** table (status draft/sent/…); Open to price or Send — no “ready” section |
| Company / Price / Technician | Existing                                                                        |


Keep **SessionKeeper** on the page for all panels. Logout on modern nav (Header reusable retired).

---

## 5. Test checklist (end-to-end)

- [ ] Public submit → new row in `requests` (and media if attached)
- [ ] Admin inbox shows row **without refresh** (realtime or ts bump ≤2s)
- [ ] Detail popup shows description + contact + media list; photo/audio via GET **in same popup** when Phase B done
- [ ] Draft with AI → `quotes` + lines; `ai_model` shows OpenRouter model id
- [ ] Fake / unmatched work → null price line; Send disabled
- [ ] Admin sets price → Send enabled
- [ ] Send → email + `email_log` + `status=sent` + token set
- [ ] Technician JWT cannot call `draft-quote` / cannot list all requests (RLS)
- [ ] Anon cannot `GET /rest/v1/quotes`

---

## 6. File / deploy map


| Piece                | Where                                                             |
| -------------------- | ----------------------------------------------------------------- |
| Realtime publication | `supabase/migrations/..._realtime_requests.sql`                   |
| `draft-quote`        | `supabase/functions/draft-quote/index.ts`                         |
| `send-quote`         | `supabase/functions/send-quote/index.ts`                          |
| R2 GET mode          | `r2-presign` or new function                                      |
| Shared email helper  | `supabase/functions/_lib/send-email.ts` (when you add Resend)     |
| Bubble               | `admin_dashboard` Requests + Drafts panels; API Connector Actions |
| Handoff              | Update `PROJECT_MEMORY.md` Progress after each phase              |


---

## 7. Order to start tomorrow

**Always:** deploy/edge (if needed) → **API Connector Initialize** (know success + error shapes) → UI (HTML/JS or elements).

1. **A2** — List Requests + List Request Media connectors → **then** Table / detail popup.
2. **B2–B3** — download connector + HTML thumbs (as needed).
3. **D1–D2** — `**Draft Quote`** connector + Draft with AI (`request_id` only).
4. **D2–D4** — Draft with AI → Fix Pricing popup if needed → **one** Quotes table.
5. **E** — `send-quote` → Send (same table row becomes `sent`).
6. **A1 + A4** — Realtime when list is stable.

This matches the docs: **dashboard for requests first**; **quote mail only on Send**; AI admin-triggered and **price-book-bound in code**; **plugin before UI**.