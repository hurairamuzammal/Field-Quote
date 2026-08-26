# SessionKeeper fix + cache-bust tables (trainee guide)

**Audience:** Bubble trainee  
**Export audited:** `fieldquote-26446 (3).bubble`  
**Related:** `fieldquote-auth-implementation-guide.md` Part 5–7 · `PROJECT_MEMORY.md`

---

## What is broken right now (from your export)

Reusable `**SessionKeeper**` has three workflows (all marked disabled in export — if you re-enabled them, they kick you out):


| Workflow                      | Interval / when       | Problem                                        |
| ----------------------------- | --------------------- | ---------------------------------------------- |
| **Page is loaded**            | every protected page  | Clears tokens when refresh **did not run**     |
| **Do every 90 seconds**       | interval              | Same clear-on-empty bug + too aggressive       |
| **An unhandled error occurs** | any error in reusable | Clears tokens + Log out + Go login — too broad |




### Root cause A — “clear tokens when access_token is empty”

Both Page loaded and Do every look like:

1. **Auth - Refresh Token** — *Only when* expiry is near
2. **Make changes** — save new tokens — *Only when* Result’s `access_token` is not empty
3. **Make changes** — **clear** access + refresh + expires — *Only when* Result’s `access_token` **is empty**
4. **Go to page login** — *Only when* logged out **or** refresh token empty

When the access token is **still valid**, step 1 is **skipped**.  
Bubble then treats “Result of step 1” as empty → step 3’s *is empty* is **true** → **wipes your session** → step 4 sends you to login.

**That is why you get thrown out for no reason.**

### Root cause B — login saves the wrong expiry number

Login sets page state from Login result’s `**expires_at**` (Unix timestamp, e.g. `1754…`), then:

`sb_expires_at = Current date/time + (seconds): that number`

Correct is `**expires_in**` (usually `3600`), not `expires_at`:

`sb_expires_at = Current date/time + (seconds): Result’s expires_in`

Using `expires_at` as “seconds to add” makes expiry ~50+ years in the future (or otherwise nonsense). Refresh timing becomes wrong; combined with Root cause A you still get kicked on load.

### Root cause C — Go to login on empty refresh is too eager on the same workflow

After step 3 clears refresh, step 4 always fires. Even without A, any failed refresh that clears tokens immediately redirects — OK for true auth death, but must **not** share the “empty result” path with “refresh skipped”.

---



# Part 1 — Fix SessionKeeper (do this first)

Open reusable **SessionKeeper** (not the page workflows).

## 1.1 Delete the dangerous clear step

On **Page is loaded** and **Do every …**:

- **Delete** the step: Make changes to Current User that **clears** `sb_access_token` / `sb_refresh_token` / `sb_expires_at` when Result’s access_token is empty.

Failure handling belongs only in **An unhandled error occurs** (narrowed — see 1.4).

## 1.2 Rewrite **Page is loaded** (exact)


| #   | Action                           | Only when                                                                                               | Details                                                                                                                       |
| --- | -------------------------------- | ------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Go to page** `login`           | `Current User is logged out` **or** `Current User's sb_refresh_token is empty`                          | Real “no session” — not “refresh skipped”                                                                                     |
| 2   | **Auth - Refresh Token**         | `Current User is logged in` **and** `sb_refresh_token is not empty` **and** expiry-near (see **§1.2b**) | Optional: also when `sb_expires_at is empty`                                                                                  |
| 3   | **Make changes to Current User** | Result of step 2’s `access_token` **is not empty** (or `returned an error is no`)                       | Set **all three**: `sb_access_token`, `sb_refresh_token`, `sb_expires_at = Current date/time +(seconds): Result’s expires_in` |


**Do not** add a “clear tokens if empty” step here.

Refresh body param:

`refresh_token` = `Current User's sb_refresh_token:formatted as JSON-safe`

### 1.2b Bubble UI — “+(minutes): 5” (where trainees get stuck)

You **cannot** add `+(minutes): 5` next to Current date/time on the condition row itself.  
**Plus minutes** only appears after you insert **Current date/time**, then click that **date pill**.

**Use this shape (clearest in Bubble):**

> Current User’s `sb_expires_at` **is before** Current date/time **+(minutes) 5**

**Clicks:**

1. **Only when** → build the expression.
2. **Insert dynamic data** → **Current User** → `**sb_expires_at`**
  (User field type must be **date**, not text).
3. Click that date pill → operator **is before**
  (some versions: date *less than* — same idea).
4. **Insert dynamic data** → **Current date/time**.
5. Click the blue **Current date/time** pill (not “is before”, not `and`).
6. Date menu → **plus minutes** / `+(minutes)` → type `**5`**.

**Full Only when for Refresh should look like:**

`Current User is logged in and Current User's sb_refresh_token is not empty and Current User's sb_expires_at is before Current date/time +(minutes): 5`

**If you never see “plus minutes”:** wrong pill selected, or `sb_expires_at` isn’t a date. Start again from step 2.

**Same math, other order:** insert Current date/time → plus minutes 5 → **is after** → Current User’s `sb_expires_at`.

## 1.3 Rewrite **Do every** (optional; safer interval)



### What kind of event is this?

In Bubble this is a **time-based / recurring** workflow event.


| Bubble name you’ll see             | Meaning                                                                     |
| ---------------------------------- | --------------------------------------------------------------------------- |
| **Do every X seconds**             | Runs again and again on a timer while the page (with SessionKeeper) is open |
| In your export it was `DoInterval` | Same thing — interval event                                                 |


It is **not**:

- Page is loaded (runs once when the page opens)
- Button is clicked
- “Always” as a condition type — there is no separate “always on” event; **Do every** *is* the repeating event

**Why it exists:** Supabase access tokens last ~1 hour. If the admin leaves the dashboard open, **Page is loaded** never runs again. **Do every** wakes up periodically and refreshes the token *before* it dies, so API calls don’t start failing with 401.

**Important:** it only runs while that page is open in the browser. Close the tab → timer stops.

---



### Exactly what to do in the editor

1. Open reusable **SessionKeeper** (not the page).
2. Open the **Workflow** tab for that reusable.
3. Find the existing event that says something like **Do every 90 seconds** (your old one).
  - If missing: click **Click here to add a new event…** → under **General** / time events pick **Do every X seconds** (wording varies slightly by Bubble version).
4. Set the interval:
  - Bubble often asks for **seconds**.  
  - **50 minutes = 3000 seconds** → enter `**3000`**.  
  - Do **not** leave it at `90` (that hammers Auth every 1.5 minutes).
5. Make sure the workflow is **enabled** (not disabled / greyed out).
6. **Event-level “Only when”** (recommended — put it on the whole Do every event, top of the workflow):
  Build with your reverse date form:
   `Current User is logged in`  
   **and** `Current User's sb_refresh_token is not empty`  
   **and** `Current date/time +(minutes): 5` **is after** `Current User's sb_expires_at`
   If that whole Only when is false, **nothing runs** that tick (no refresh, no logout). That is correct.
7. **Actions inside this event — only these two** (same as Page loaded steps 2–3; **no** Go to login):


| #   | Action                                     | Only when on the step                              | Details                                                                                                                                                           |
| --- | ------------------------------------------ | -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Plugins → **Auth - Refresh Token**         | *(can leave empty if event Already has Only when)* | `refresh_token` = Current User’s `sb_refresh_token:formatted as JSON-safe`                                                                                        |
| 2   | Account → **Make changes to Current User** | Result of step 1’s `access_token` **is not empty** | `sb_access_token` = Result’s access_token · `sb_refresh_token` = Result’s refresh_token · `sb_expires_at` = Current date/time +(seconds): Result’s **expires_in** |


1. **Delete** from this Do every workflow (if still there):
  - Make changes that **clears** tokens when access_token is empty  
  - **Go to page login**  
  - **Log the user out**

Those belong on **Page is loaded** (soft no-session check) or **An unhandled error occurs** (refresh really failed) — not every 50 minutes.

---



### How Page loaded vs Do every share the work


| Event                         | When it runs                        | What it should do                                               |
| ----------------------------- | ----------------------------------- | --------------------------------------------------------------- |
| **Page is loaded**            | Once when admin/tech page opens     | Redirect if no session; refresh if expiry near; save new tokens |
| **Do every 3000 sec**         | Every ~50 min while page stays open | Only refresh + save tokens if expiry near                       |
| **An unhandled error occurs** | Refresh API throws                  | Clear tokens → Log out → Go login                               |


---



### Optional: skip Do every for now

If this confuses you: **disable Do every**, fix **Page is loaded** + login `expires_in` first.  
You only need Do every for people who leave the dashboard open longer than ~1 hour without navigating.

## 1.4 Fix **An unhandled error occurs**

Today it clears + logout + login on **any** error inside the reusable (including unrelated mistakes).

**Option A (simple):** leave it, but **only** keep SessionKeeper workflows that can fail on Auth refresh — no other actions in that reusable.

**Option B (better):** on unhandled error:


| #   | Action                                                                              | Only when            |
| --- | ----------------------------------------------------------------------------------- | -------------------- |
| 1   | Make changes — clear `sb_access_token`, `sb_refresh_token`, `sb_expires_at`, `role` | always on this event |
| 2   | **Log the user out**                                                                |                      |
| 3   | **Go to page** `login`                                                              |                      |


Do **not** put Display list / Patch / other API calls inside SessionKeeper, or a table error will log everyone out.

## 1.5 Enable workflows

Turn **workflow_disabled** off on Page loaded (+ Do every if you use it).  
Confirm SessionKeeper is on `**admin_dashboard**` and `**technician_panel**` only — never on `login` / `index` / public pages.

## 1.6 Fix login expiry (same day as SessionKeeper)

Wherever Login success sets the number used for `sb_expires_at`:


| Wrong                                                                | Right                                                                           |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Result’s `**expires_at**` → then `Current date/time + seconds: that` | Result’s `**expires_in**` → `Current date/time +(seconds): Result’s expires_in` |


Apply on:

- Login button → set page states  
- Custom event that **Make changes to Current User** for tokens

After fix: log out, log in once, check Data → User → `sb_expires_at` is about **1 hour from now**, not year 2070+.

## 1.7 Page route guards (block URL → dashboard / tech without login)

**Goal:** typing `/admin_dashboard` or `/technician_panel` (or your Bubble page slugs) without a real login must bounce to `**login`**. Public users only use `**index`** (intake) and `**login**`.

**Reality check:** this is **UX routing in Bubble**, not real security. Real lock is Supabase **RLS** + JWT. Still required so clients don’t see empty admin chrome.

Your export today:


| Page               | Guard status                                                                      |
| ------------------ | --------------------------------------------------------------------------------- |
| `admin_dashboard`  | Has Page loaded → Go login if logged out / no `sb_access_token`; non-admin → tech |
| `technician_panel` | **No Page loaded guard** — fix this                                               |
| `login` / `index`  | Public — **no** SessionKeeper, **no** “must be logged in”                         |


---



### A) `admin_dashboard` → Workflow → **Page is loaded**

Keep / set steps in this order:


| #   | Action                                      | Only when                                                                                               |
| --- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| 1   | **Go to page** `login`                      | `Current User is logged out` **or** `Current User's sb_access_token is empty`                           |
| 2   | **Go to page** `technician_panel`           | `Current User's role is not "admin"` *(and step 1 did not send them away — still logged in with token)* |
| 3   | (optional) Show main content / Hide loading | —                                                                                                       |


Do **not** require `role = admin` on step 1 — missing role would loop oddly; step 2 handles role.

---



### B) `technician_panel` → Workflow → **Page is loaded** (add if missing)


| #   | Action                                                   | Only when                                                                                                                                                                                                 |
| --- | -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Go to page** `login`                                   | `Current User is logged out` **or** `Current User's sb_access_token is empty`                                                                                                                             |
| 2   | (optional, stricter) **Go to page** `login` *(or admin)* | `Current User's role is not "technician"` **and** `role is not "admin"` — only if you want admins blocked from tech; usually **allow admin** to open tech, so skip this or only bounce when role is empty |
| 3   | Show content / Hide loading                              | —                                                                                                                                                                                                         |


**Recommended for FieldQuote:** tech page allows `role = technician` **or** `role = admin`. Bounce everyone else + anyone without token to login.

Example Only when for step 1 (must login):

`Current User is logged out or Current User's sb_access_token is empty`

Optional step 2 (wrong role → login):

`Current User's role is not "technician" and Current User's role is not "admin"`

---



### C) Public pages — do **nothing** that forces login


| Page                 | Rule                                                                                                   |
| -------------------- | ------------------------------------------------------------------------------------------------------ |
| `index`              | No SessionKeeper. No “Go to login if logged out”. Customers submit requests here.                      |
| `login`              | No SessionKeeper. Optional: if already logged in **with** token + role, Go to admin or tech (nice UX). |
| `q` / password pages | Public or token flows — no dashboard SessionKeeper                                                     |


**Optional on** `login` **Page is loaded:**


| Action                   | Only when                                                     |
| ------------------------ | ------------------------------------------------------------- |
| Go to `admin_dashboard`  | logged in **and** token not empty **and** `role = admin`      |
| Go to `technician_panel` | logged in **and** token not empty **and** `role = technician` |


---



### D) SessionKeeper placement (ties to routing)


| Page                     | SessionKeeper reusable?                                                    |
| ------------------------ | -------------------------------------------------------------------------- |
| `admin_dashboard`        | **Yes**                                                                    |
| `technician_panel`       | **Yes**                                                                    |
| `login`, `index`, public | **Never** — its “Go to login if no refresh token” would fight public pages |


---



### E) How to test routing

1. Log **out** completely (or use Incognito).
2. Paste admin URL in the browser → must land on `**login**`, not dashboard content.
3. Paste tech URL → `**login**`.
4. Open `**index**` → stays on intake (no bounce).
5. Log in as admin → admin URL works; tech URL OK if you allow admin.
6. Log in as technician → tech URL works; admin URL → sent to tech (your current step 2).



### F) Still not “secure” by itself

Even with perfect Bubble redirects, someone could call Supabase with a stolen/anon key. **RLS** must stay on. Guards = don’t show the app shell; RLS = don’t return data.

## 1.8 Test checklist

1. Log in → land on dashboard → **stay** there (no bounce).
2. Incognito → open admin/tech URL → **login** only.
3. In Data tab set `sb_expires_at` to **2 minutes ago** → reload → tokens change (refresh ran); still logged in.
4. Corrupt `sb_refresh_token` → reload → then logout + login page (true failure).
5. Leave dashboard open > 1 hour with Do every 50 min → still logged in.

---



# Part 2 — How cache-bust works (reality)

**Updated:** 2026-08-09 — do **not** use `X-Bust` or bare `&ts=`. Use `column=neq.[bust]` with Initialize `bust` = `0`.

## What Bubble does

API Connector **Data** calls (Table / RG) are cached by Bubble from the request URL + params.

If the request looks unchanged, Bubble may reuse the last response → table looks stale.

**Not true Realtime** — only refetches when a URL param changes.

## Do NOT use (broken)


| Approach                 | Error                                               |
| ------------------------ | --------------------------------------------------- |
| URL `&ts=1` / `&ts=[ts]` | PostgREST **PGRST100** `failed to parse filter (1)` |
| Header `X-Bust`          | Bubble **this header name is not correct**          |


Delete any `ts` URL param and any `X-Bust` header before continuing.

## DO use — `column=neq.[bust]`

Valid PostgREST filter: “field is not equal to this value.”

Initialize `bust` as `0`. Later bump page state to a unix timestamp. No real row has `customer_name` / `email` / `status` equal to `"1739123456"`, so you still get **all rows** — only the URL changed → Bubble refetches.

### Exact Initialize rule (every list call)


| URL param | Private | **Initialize value** | On Table / RG                                          |
| --------- | ------- | -------------------- | ------------------------------------------------------ |
| `bust`    | **OFF** | `0`                  | Current page’s matching `s_*_ts` (plain, no JSON-safe) |




### Page states (what they are)

A **custom state** is a temporary number (or text) stored **on the page** while it is open. It is **not** in Supabase. Close/reload the page → it resets unless **Page loaded** sets it again.

We use these numbers only to change the `bust` URL param so Bubble refetches.

| State | Type | Used by | Create on |
|-------|------|---------|-----------|
| `s_requests_ts` | number | Requests table | `admin_dashboard` |
| `s_techs_ts` | number | Technicians table | `admin_dashboard` |
| `s_pricebook_ts` | number | Price Book table | `admin_dashboard` |
| `s_quotes_ts` | number | Quotes table | `admin_dashboard` |
| `s_jobs_ts` | number | Jobs table | `technician_panel` (later) |

**Skip payments** — no `DB - List Payments` connector yet. Do **not** create `s_payments_ts` until you add that call.

**Create a state:** click the **page** (not a group) → Custom states → Add → name + type **number**.

### Refresh later

Set that state = `Current date/time:extract unix` (or `+ 1`).

```
bump s_requests_ts ──► ...&customer_name=neq.1739123456 ──► Bubble refetches
```

**Fallback:** workflow **Display list** on timer / Refresh button.

---



# Part 3 — Wire every list call (copy-paste)



## Shared headers (all calls below)

**Only these two headers are allowed:**

| Key | Private | Initialize | On Table |
|-----|---------|------------|----------|
| `apikey` | **yes** | anon / publishable key | — |
| `Authorization` | **no** | `Bearer ` + fresh **admin** JWT | `Bearer ` + Current User’s `sb_access_token` |

- Include errors = **OFF**
- Include headers in returned values = **OFF**
- No `Accept: application/vnd.pgrst.object+json`
- No bare `&ts=`

### CRITICAL — if you see: `this header name is not correct X-Bust`

Your URL / `bust` param can be correct and Initialize still fails because an old **`X-Bust` header row** is still on the call.

**Fix before clicking Initialize (do this on `DB - List Requests` and every list call):**

1. Open Plugins → API Connector → **DB - List Requests**.
2. Scroll to **Headers** (or “Shared/call headers” for this call).
3. Find any row whose key is `X-Bust` / `x-bust` / `X_Bust`.
4. **Delete that entire header row** (trash / remove) — do not leave key empty.
5. Confirm headers left are **only** `apikey` + `Authorization`.
6. Confirm URL has `customer_name=neq.[bust]` and URL param `bust` = `0` (Private OFF).
7. Click **Initialize** / Re-initialize again.

`X-Bust` is **not** part of the solution. Cache-bust is only the URL param `bust`.

---

## 3.1 `DB - List Requests` (admin inbox)

**Before Initialize:** delete `X-Bust` header if present (see CRITICAL above).

| Setting | Exact value |
|---------|-------------|
| **Name** | `DB - List Requests` |
| **Use as** | **Data** |
| **Method** | GET |
| **URL** | `https://chqljfdmgdtsmbbwbdyv.supabase.co/rest/v1/requests?select=id,description,customer_name,customer_email,customer_phone,customer_address,preferred_timing,status,created_at&order=created_at.desc&customer_name=neq.[bust]` |
| **Include errors** | **OFF** |

**URL params**

| Key | Private | **Initialize value** | On Table |
|-----|---------|----------------------|----------|
| `bust` | OFF | `0` | Current page’s `s_requests_ts` |

**Headers allowed:** `apikey` + `Authorization` only. **Zero** other headers.

Re-Initialize → flat **list** like Price Book.

| Error | Fix |
|-------|-----|
| `this header name is not correct X-Bust` | **Delete** the `X-Bust` header row, then Initialize again |
| PGRST100 filter `(1)` | Still have `&ts=` — remove it; keep only `customer_name=neq.[bust]` |
| Table red / one object | Include errors OFF + re-init |

---

## 3.2 `List Technicians` (invite table)


| Setting            | Exact value                                                                                                        |
| ------------------ | ------------------------------------------------------------------------------------------------------------------ |
| **Name**           | `List Technicians`                                                                                                 |
| **Use as**         | **Data**                                                                                                           |
| **Method**         | GET                                                                                                                |
| **URL**            | `https://chqljfdmgdtsmbbwbdyv.supabase.co/rest/v1/profiles?role=eq.[role]&select=id,full_name,email,active&order=full_name.asc&email=neq.[bust]` |
| **Include errors** | **OFF**                                                                                                            |


**URL params**


| Key    | Private | **Initialize value** | On Table                    |
| ------ | ------- | -------------------- | --------------------------- |
| `role` | OFF     | `technician`         | `technician`                |
| `bust` | OFF     | `0`                  | Current page’s `s_techs_ts` |


Keep `role=eq.[role]` — never `role=1`.

---

## 3.2b `DB - Get Price Book` (admin — near-realtime)

Same pattern as Requests. **No** `X-Bust`. **No** bare `&ts=`.

| Setting | Exact value |
|---------|-------------|
| **Name** | `DB - Get Price Book` |
| **Use as** | **Data** |
| **Method** | GET |
| **URL** | `https://chqljfdmgdtsmbbwbdyv.supabase.co/rest/v1/price_book_items?select=id,name,category,unit,unit_price,keywords,active&order=category.asc,name.asc&name=neq.[bust]` |
| **Include errors** | **OFF** |
| **Include headers** | **OFF** |

**URL params**

| Key | Private | **Initialize value** | On Table |
|-----|---------|----------------------|----------|
| `bust` | OFF | `0` | Current page’s `s_pricebook_ts` |

**Headers:** only `apikey` (private) + `Authorization: Bearer …`  
Delete any `X-Bust` if present → Initialize again.

**Why `name=neq.[bust]`:** `bust` is a number/unix string; no real item name equals that → all rows still return.

**Page state:** `s_pricebook_ts` (number) on `admin_dashboard`.

**Table bind:** Type of content = Price Book item · Data source = this call · Bearer + `bust` = `s_pricebook_ts` · Conditional: token empty → Data source empty.

**Bump after:** Add / Update price book item success → Set `s_pricebook_ts` = `Current date/time:extract unix`.

---

## 3.2c `DB - List Quotes` (admin — near-realtime)

| Setting | Exact value |
|---------|-------------|
| **Name** | `DB - List Quotes` |
| **Use as** | **Data** |
| **Method** | GET |
| **URL** | `https://chqljfdmgdtsmbbwbdyv.supabase.co/rest/v1/quotes?select=id,request_id,status,subtotal,total,ai_generated,created_at&order=created_at.desc&status=neq.[bust]` |
| **Include errors** | **OFF** |
| **Include headers** | **OFF** |

**URL params**

| Key | Private | **Initialize value** | On Table |
|-----|---------|----------------------|----------|
| `bust` | OFF | `0` | Current page’s `s_quotes_ts` |

**Headers:** only `apikey` + `Authorization: Bearer …`

**Why `status=neq.[bust]`:** quote statuses are `draft`/`sent`/… — never equal to a unix number → all quotes still return.

**Page state:** `s_quotes_ts` (number) on `admin_dashboard`.

**Table bind:** Type of content = List Quotes item · Data source = this call · Bearer + `bust` = `s_quotes_ts` · Conditional: token empty → Data source empty.

**Bump after:** Draft Quote / Save / Send success → Set `s_quotes_ts` = `Current date/time:extract unix` (and usually `s_requests_ts` too if request status changed).

---

## 3.3 `DB - Get Jobs` (technician orders)


| Setting             | Exact value                                                                                                                                                             |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Name**            | `DB - Get Jobs`                                                                                                                                                         |
| **Use as**          | **Data**                                                                                                                                                                |
| **Method**          | GET                                                                                                                                                                     |
| **URL**             | `https://chqljfdmgdtsmbbwbdyv.supabase.co/rest/v1/jobs?select=id,status,scheduled_at,technician_id,completion_notes&order=scheduled_at.asc&limit=100&status=neq.[bust]` |
| **Include errors**  | **OFF**                                                                                                                                                                 |
| **Include headers** | **OFF**                                                                                                                                                                 |


**URL params**


| Key    | Private | **Initialize value** | On Table                   |
| ------ | ------- | -------------------- | -------------------------- |
| `bust` | OFF     | `0`                  | Current page’s `s_jobs_ts` |


Re-Initialize until flat **list**.

---



## 3.4 `DB - List Payments` — **SKIP for now**

You do **not** have this call in the API Connector yet. Skip this section. No `s_payments_ts`. Add later when payments UI exists.

---

## 3.5 Bind each Table (Bubble clicks — read this carefully)

A Bubble **Table** has two main fields (you already use these):

| Field in property editor | What it means |
|--------------------------|---------------|
| **Type of content** | What one **row** is (e.g. `DB - List Requests`) |
| **Data source** | Where the list comes from (Get data from API → that call) |

There is **no** separate “Only when” box next to Data source like on a workflow step.  
Conditions for a Table are added on the **Conditional** tab at the bottom of the same property editor.

---

### A) Set Type of content + Data source (Requests example)

1. Click your **Requests Table** on the page.
2. In the property editor find **Type of content**.
3. Set it to **`DB - List Requests`** (the API item type from Initialize — same idea as Price Book table).
4. Find **Data source**.
5. Choose **Get data from an external API** → **DB - List Requests**.
6. Fill the params Bubble shows for that call:

| Param Bubble shows | Value |
|--------------------|--------|
| Authorization | `Bearer ` + Current User’s `sb_access_token` |
| bust | Current page’s `s_requests_ts` |

(Do **not** put a condition inside those param boxes.)

---

### B) Block the API call when access token is empty

**Do this next (same Table still selected):**

1. At the **bottom** of the Table’s property editor, open the **Conditional** tab  
   (button often labeled **Conditional** / “Define another condition”).
2. Click **Define another condition**.
3. **When** =  
   `Current User's sb_access_token is empty`  
   (Insert dynamic data → Current User → `sb_access_token` → **is empty**).
4. Click **Select a property to change** (or “Click here to define another property”).
5. Choose **Data source**.
6. Leave **Data source** **empty** / blank for this condition  
   (do not pick the API call here).

**Meaning:**  
- Token empty → Data source becomes empty → **no** Get data from API call.  
- Token present → condition false → normal Data source (the API call) runs.

Optional extra condition (same Conditional tab):

| When | Property | Value |
|------|----------|--------|
| `sb_access_token is empty` | This element is visible | **unchecked** |

Helps hide the empty table while the page sends the user to login.

---

### C) Technicians table (same pattern)

1. **Type of content** → `List Technicians` (item type).
2. **Data source** → Get data from API → **List Technicians**.
3. Params:

| Param | Value |
|-------|--------|
| Authorization | `Bearer ` + Current User’s `sb_access_token` |
| role | `technician` |
| bust | Current page’s `s_techs_ts` |

4. **Conditional** tab → When `sb_access_token is empty` → **Data source** = empty.

---

### D) Jobs table on tech panel (later)

Same as Requests: Type of content = `DB - Get Jobs` item, Data source = that call, Authorization + `bust` = `s_jobs_ts`, Conditional → token empty → Data source empty.

---

### E) If your Bubble build has no “Data source” under Conditional

Use this instead (still valid):

1. Put the Table inside a **Group**.
2. Select the **Group**.
3. **Conditional**: When `sb_access_token is empty` → **This element is visible** = no.  
   Turn on **Collapse height when hidden** on the Group.
4. Or use workflow only: clear Table data source; on **Page loaded** / Refresh, **Only when** token not empty → **Display list** in Table → same API call.

**Display list** Only when is a real workflow condition (easier to see than Table Conditional).

---

### F) Checklist — Requests table done when

- [ ] Type of content = `DB - List Requests`  
- [ ] Data source = API `DB - List Requests` + Bearer + `bust` = `s_requests_ts`  
- [ ] Conditional: when token **empty** → Data source **empty**  
- [ ] No `X-Bust` header on the connector  

---

## 3.6 How custom states get updated (bump `s_*_ts`)

These are **workflow** steps (here “Only when” exists on the action — different from the Table).

### What “matching state” means

Which page number you change depends on **which table** you want to refresh:

| You just finished… | Bump this state (the “matching” one) | Table that refetches |
|--------------------|--------------------------------------|----------------------|
| Invite technician (success) | `s_techs_ts` | Technicians list |
| Draft Quote / Send Quote / new request / archive | `s_requests_ts` (+ `s_quotes_ts` after Draft/Send) | Requests (+ Quotes) |
| Add / Update price book item | `s_pricebook_ts` | Price Book table |
| Something about jobs (tech panel) | `s_jobs_ts` | Jobs table |

“Matching” = the state bound to that table’s **`bust`** param. Wrong state → wrong table stays stale.

### What “unix now” means

A **number**: seconds since 1970 (e.g. `1739123456`). It changes every second, so it’s a simple new value for `bust`.

**In Bubble, do not type the words “unix now”.** Build:

`Current date/time:extract unix`  
(or in some editors: Current date/time → extract → **UNIX** / **seconds since epoch**)

That expression **is** “unix now.”

You can also use `s_requests_ts + 1` instead — any **new number** works.

---

### When to bump

| When | Workflow |
|------|----------|
| **Page is loaded** (admin) | **Set state** `s_requests_ts`, `s_techs_ts`, `s_pricebook_ts`, `s_quotes_ts` = `0` or `Current date/time:extract unix`. **Only when** `sb_access_token is not empty`. |
| **Page is loaded** (tech) | Set `s_jobs_ts` the same way — Only when token not empty. |
| **After Invite succeeds** | **Set state** `s_techs_ts` = `Current date/time:extract unix` |
| **After Draft / Send / archive request** | **Set state** `s_requests_ts` (+ `s_quotes_ts` after Draft/Send) = `Current date/time:extract unix` |
| **After Add / Update price book** | **Set state** `s_pricebook_ts` = `Current date/time:extract unix` |
| **Do every 30–60 sec** | **Do this if you have no Refresh button** — see **§3.6b**. One timer bumps **every** table state on the page. |
| **Refresh button** | Optional only — not required. |

**Set state clicks:** Add action → **Set states** → Element = **current page** → Custom state → value = `Current date/time:extract unix`.

Bump changes `bust` → Table URL changes → refetch (unless Conditional cleared Data source because token empty).

---

### 3.6b Do every — refresh all tables on this page (no Refresh button)

You do **not** need a Refresh button. Add a timer on **`admin_dashboard`**.

**Why all tables update:** each Table uses its own state for `bust`. In **one** Do every workflow you Set state on **all four** (`s_requests_ts`, `s_techs_ts`, `s_pricebook_ts`, `s_quotes_ts`). All URLs change → all tables refetch.

#### Clicks on `admin_dashboard`

1. Workflow tab → **Do every X seconds**.
2. Interval = **`60`** (or `30` if you want faster).
3. On the **event**, Only when: `Current User's sb_access_token is not empty`.
4. Action 1: **Set states** → page → `s_requests_ts` = `Current date/time:extract unix`.
5. Action 2: **Set states** → page → `s_techs_ts` = `Current date/time:extract unix`.
6. Action 3: **Set states** → page → `s_pricebook_ts` = `Current date/time:extract unix`.
7. Action 4: **Set states** → page → `s_quotes_ts` = `Current date/time:extract unix`.

That covers **Requests + Technicians + Price Book + Quotes** on this page.  
**Skip** payments.

#### Tech panel later

Do every 60s → Only when token not empty → Set `s_jobs_ts` = unix extract.

#### Still bump after Invite / Draft (recommended)

Timer waits up to 60s. After Invite also set `s_techs_ts` right away; after Draft/Send set `s_requests_ts` + `s_quotes_ts`; after price book save set `s_pricebook_ts`.

---

## 3.7 How to test (do this)

**No Refresh button needed** if you added §3.6b.

1. Log in → stay on admin dashboard.
2. Confirm Do every 60s sets all four: `s_requests_ts`, `s_techs_ts`, `s_pricebook_ts`, `s_quotes_ts`.
3. In another tab, add/change a request in Supabase (or submit intake).
4. Wait up to ~60 seconds on admin — Requests table should update **without** leaving the page.
5. Invite a tech / edit price book / draft a quote → wait for timer or bump the matching `s_*_ts` for instant update.

If nothing refetches: Table `bust` bound to the right state? Connector URL still has `…=neq.[bust]`? Token not empty? Do every Only when passing?

---

## 3.8 Display list vs cache-bust

| Pattern | When |
|---------|------|
| `column=neq.[bust]` + bump state | Standing tables (Requests, Technicians, Price Book, Quotes, Jobs) |
| **Display list** in workflow | Popup Quote; or if the table still looks stale after a bump |

---

# Part 4 — TODO order

1. SessionKeeper + login `expires_in` — Part 1  
2. Cache-bust **Requests + Technicians + Price Book + Quotes** (`neq.[bust]`, Init `bust` = `0`) — Part 3; **skip Payments**  
3. Jobs cache-bust on tech panel when ready  
4. Quote Save — Patch Line → Totals → Display list  
5. Optional Realtime later (can bump `s_requests_ts`)

---

## Done when

- [ ] `DB - List Requests` Initialize OK — `customer_name=neq.[bust]`, `bust` = `0`, no `X-Bust`  
- [ ] `List Technicians` Initialize OK — `email=neq.[bust]`, `bust` = `0`  
- [ ] `DB - Get Price Book` Initialize OK — `name=neq.[bust]`, `bust` = `0`  
- [ ] `DB - List Quotes` Initialize OK — `status=neq.[bust]`, `bust` = `0`  
- [ ] Tables: Type of content + Data source set; Conditional when token empty → Data source empty  
- [ ] Page states `s_requests_ts` + `s_techs_ts` + `s_pricebook_ts` + `s_quotes_ts` exist; Tables bind `bust` to them  
- [ ] Do every 60s bumps all four states  
- [ ] Payments skipped until connector exists  
- [ ] Logged-in reload stays logged in  
