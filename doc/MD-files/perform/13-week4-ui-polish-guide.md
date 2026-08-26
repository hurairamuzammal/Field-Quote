# Week 4 UI polish — loading, shimmer, live, buttons

**Scope:** Finish §16 Week 4 **Bubble UX** only — **skip pg_cron** (Days 18–19).  
**Related:** `P1-roadmap.md` Days 16–17 + Day 20 UI leftovers · `tasks/04` · `tasks/12` · `tasks/15` · backlog **7b**  
**Supabase:** `chqljfdmgdtsmbbwbdyv` · **Company:** `00000000-0000-0000-0000-000000000001`

Backend for Week 4 (assign, tech complete, final invoice, Make) is **done in repo**. This guide is **Bubble-only**: no empty flashes, clear busy states, correct button visibility, subtle Live dot.

---

## Steps
1. Nebula Shimmer + busy-state pattern (start / stop rules)
2. Page custom states (one table)
3. Admin — Draft with AI loading
4. Customer `q` — resolve loading + error
5. Customer `q-success` — confirming vs paid copy
6. Admin — Popup Assign shimmer
7. Admin — Assign / Assigned / Cancel button rules
8. Admin + tech — Realtime Live indicator
9. Tech dashboard — filters + Complete busy
10. Test matrix

---

## 1. Loading pattern — Nebula Shimmer + busy state

One pattern everywhere: **start shimmer → call API → stop shimmer on every finish → show the right group.**

**Primary loader:** **Nebula Shimmer** plugin (start/stop in workflows). No custom HTML skeleton needed.

**Secondary (admin only):** `s_assign_loading` etc. on dashboard pages. **Page `q` uses no custom states** — Nebula + element conditionals on **`G: Q Resolve`** (§4).

### 1.1 Nebula setup (once per surface)

1.1.1 Install **Nebula Shimmer** plugin.  
1.1.2 On page `q`: add element **`Nebula Shimmer q`** — target = full page or **`G: Q Shell`** (card area only).  
1.1.3 On **`Popup Assign`**: add **`Nebula Shimmer Assign`** — target = popup body (header + form).  
1.1.4 Do **not** tie Nebula visibility to conditionals — you **start** and **stop** it from workflows only.

### 1.2 When to START (locked)

| Moment | Workflow action |
|--------|-----------------|
| `q` page load | **Start** Nebula only |
| Assign button clicked | **Start** Nebula **and** Set `s_assign_loading` = yes · then set `s_job_id` · Show popup |

Always start **before** the API / Get Job fetch runs.

### 1.3 When to STOP — the rule

**Stop Nebula on every terminal outcome.** Loading is over when the network call **finishes**, not when it “succeeds.”

| Outcome | Stop Nebula? | Then show |
|---------|--------------|-----------|
| Resolve returns quote (`actionable` yes) | **Yes** | `G: Q Content` (conditional on `G: Q Resolve`) |
| Resolve returns dead-end (`actionable` no) | **Yes** | Snackbar (§4.3) · Content stays hidden |
| Resolve **returned_an_error** (400 / 404 / 410 / 500) | **Yes** | Display body → Snackbar row · Stop Nebula |
| Get Job data arrived (header `id` = `s_job_id`) | **Yes** | Assign header + form (`s_assign_loading` = no) |
| Assign popup cancelled / closed | **Yes** | Hide popup; reset states |

**Never** leave Nebula running because the API “failed” — that is exactly when the user must see the error group.

**Workflow shape (always):**

```
Start Nebula
→ API call
→ Display data in G: Q Resolve (success OR error JSON body)
→ Stop Nebula   ← always, every branch
```

Content vs error groups flip via **element conditionals** on `G: Q Resolve` — no Set state.

### 1.4 Error UX — what to show (not alerts)

| Surface | Use | Do **not** use |
|---------|-----|----------------|
| Customer **`q`** | **Snackbar** title + description on dead-end / error branches (§4.3) | Extra **`G: Q Error`** group or browser alert |
| Customer **`q`** network fail | Same **`G: Q Error`**: “We couldn’t load your quote. Check your connection and refresh.” | Infinite shimmer |
| Admin **Assign** Get Job fail | Stop shimmer; small red text inside popup: “Couldn’t load job details.” | Full-page alert |
| Admin **Draft with AI** | Existing `s_draft_error` banner / text near button | Alert |

**Why inline error group on `q`:** expired / invalid links are **expected** customer paths — they deserve a calm, branded dead-end (icon + heading + one paragraph), not a modal interrupt. Alerts are for rare “you must know now” admin actions (save failed) — snackbars come later (`tasks/03`).

**Draft with AI** stays on **`G: Loading`** spinner (no Nebula required) — short admin wait, not a public page.

### 1.5 Rules (locked)

| Rule | Why |
|------|-----|
| Start Nebula **before** API / Get Job | Immediate feedback |
| Stop Nebula on **success, dead-end, and returned_an_error** | Stuck shimmer is the #1 bug |
| **`G: Q Content` / `G: Q Error` not visible on page load** | Nebula covers shell until Stop; Content conditional on `actionable` |
| **`G: Q Resolve` empty until workflow Display data** | No null / $0 flash on texts |
| Loading ≠ empty | Never show error copy until `G: Q Resolve` has a result |

---

## 2. Page custom states

Add on the pages below (defaults in parentheses).

| Page | State | Type | Default | Purpose |
|------|-------|------|---------|---------|
| `admin_dashboard` | `s_draft_busy` | yes/no | no | Draft with AI |
| `admin_dashboard` | `s_assign_loading` | yes/no | no | Popup Assign Get Job |
| `admin_dashboard` | `s_realtime_live` | yes/no | no | Live indicator |
| `admin_dashboard` | `s_assign_busy` | yes/no | no | Save in Assign (already in guide 09) |
| `q-success` | `s_poll_busy` | yes/no | yes | Confirming payment |
| `technician_dashboard` | `s_complete_busy` | yes/no | no | Complete PATCH in flight |
| `technician_dashboard` | `s_realtime_live` | yes/no | no | Optional Live dot |

Do **not** overload `s_media_busy` for draft — media popup already uses it (`tasks/04`).

**Page `q`:** no custom states — see §4 (`G: Q Resolve` + conditionals).

---

## 3. Admin — Draft with AI loading

**Goal:** Button + overlay while `draft-quote` runs; clear on 200, 409, or any error.

### 3.1 UI

3.1.1 On `admin_dashboard`, duplicate or reuse **`G: Loading`** inside the request/quote area (not full-page — only covers inbox + quote popup region if possible).  
3.1.2 Text: **“Generating quote…”**  
3.1.3 **Conditional visibility:** `Current page's s_draft_busy is yes` → visible; else hidden.  
3.1.4 **Button Draft with AI:** conditional **This element isn't clickable** when `s_draft_busy is yes` **or** `s_req_status is quoted`.

### 3.2 Workflow — Draft with AI (edit existing)

| # | Action |
|---|--------|
| 1 | Set state `s_draft_busy` = **yes**; clear `s_draft_error` if you have it |
| 2 | API → **`draft-quote`** (existing params) |
| 3a | *Only when* step 2 success → open quote popup / refresh lines (existing) |
| 3b | *Only when* step 2 returned error → Set `s_draft_error` from `_api_c2_error` or friendly text |
| 4 | **Always** (no condition): Set `s_draft_busy` = **no** |

Step 4 must run even when step 2 fails — use a single workflow with branches, then unconditional clear, or duplicate “set no” on each branch.

### 3.3 Test

- Throttle network → spinner within 100ms of click  
- Success → spinner gone, popup opens  
- Already quoted (409) → spinner gone, friendly message  
- Double-click blocked while busy  

---

## 4. Customer `q` — Nebula + snackbar errors (no error group)

**Goal:** Nebula covers **`G: Q Content`** until resolve finishes. Success → show quote. Dead-end / HTTP error → **Snackbar** (title + description). No **`G: Q Error`** group.

### 4.1 Elements on page `q`

| Element | Setup |
|---------|--------|
| **`G: Q Resolve`** | Hidden group · **Type of content** = **`Resolve Quote Token`** · **Not visible on page load** · no data until workflow **Display data** |
| **`G: Q Content`** | Lines, totals, Accept/Decline · **Not visible on page load** |
| **Nebula Shimmer q** | Target = **`G: Q Content`** (or wrapper **`G: Q Shell`**) — shimmer sits on top until Stop |

Bind quote UI to **`G: Q Resolve's …`**.

**`G: Q Content`** conditional → visible when:

```
G: Q Resolve's actionable is yes
```

No error group. When `actionable` is no (or resolve never succeeded), Content stays hidden; user sees snackbar after shimmer stops.

### 4.2 Page is loaded workflow

| # | Action | Only when |
|---|--------|-----------|
| 1 | **Nebula → Start** | — |
| 2 | API → **`Resolve Quote Token`** · `token` = URL `token` | — |
| 3 | **Display data** in **`G: Q Resolve`** → Result of step 2 | step 2 success **or** returned_an_error *(error JSON body)* |
| 4a | *(nothing — Content appears via conditional)* | Result's `actionable` is **yes** |
| 4b–4g | **Snackbar** → title + description from §4.3 table | see §4.3 **Only when** column |
| 5 | **Nebula → Stop** | **always** (no condition) |

Run step 5 even on error — shimmer off, snackbar visible, Content still hidden.

**Connector:** Include errors **ON**. See `perform/05` §E3b.

### 4.3 Snackbar copy — condition → title + description

Add one **Snackbar** action per row (steps 4b–4g), each with **Only when** on **Result of step 2** *(after Display data, same fields on `G: Q Resolve`)*.

Check **top-to-bottom**: first matching row wins — put **Generic** last.

| Only when (Result of step 2…) | Snackbar **Title** | Snackbar **Description** |
|------------------------------|-------------------|---------------------------|
| `actionable` is **yes** | *(no snackbar)* | — |
| `status` = **`expired`** | Quote expired | This quote has expired. Contact the company for a new estimate. |
| `status` = **`declined`** | Quote declined | You declined this quote. |
| `status` = **`accepted`** | Already paid | Payment received — thank you. Check your email for next steps. |
| `error` = **`Quote not found`** | Quote not found | We couldn't find this quote. The link may be wrong or outdated. |
| `error` **contains** **`token`** *(400 bad token)* | Invalid link | This link isn't valid. Check the link in your email and try again. |
| **else** — step 2 returned_an_error **or** anything unmatched | Couldn't load quote | Something went wrong. Please refresh the page or contact the company. |

**Optional:** for `declined`, append `Result of step 2's declined_reason` to Description when it is not empty.

**410 / 404:** usually **returned_an_error** — step 3 still **Display data** so `status` / `error` exist → matching snackbar row fires.

**Do not** put raw JSON, HTTP codes, or `_api_c2_error` in Description.

### 4.4 Test

- Valid token → Nebula → quote visible, no snackbar  
- Expired → Stop → snackbar **Quote expired** / body copy; Content hidden  
- Bad token → **Invalid link** or **Quote not found**  
- Declined → **Quote declined**  
- Already paid → **Already paid**  
- Broken server → **Couldn't load quote** (generic)  

---

## 5. Customer `q-success` — confirming vs paid copy

**Goal:** No stuck “Confirming…”; deposit vs final wording correct (`tasks/13`).

### 5.1 URL param

Checkout success URLs append `kind=deposit` or `kind=final` (repo already deployed).  
On `q-success`: **Get data from page URL** → `kind`.

### 5.2 Groups / texts

| Element | When visible / text |
|---------|---------------------|
| `G: Success Loading` | `s_poll_busy is yes` — “Confirming your payment…” |
| `G: Success Deposit` | `s_poll_busy is no` **and** URL `kind` = deposit (or empty for old links) |
| `G: Success Final` | `s_poll_busy is no` **and** URL `kind` = final |

**Deposit body (example):** payment received; we’ll assign your technician and confirm by email.  
**Final body (example):** thank you — your balance is paid. **Do not** say “technician will be assigned shortly.”

### 5.3 Poller workflow (page load)

| # | Action |
|---|--------|
| 1 | `s_poll_busy` = yes |
| 2 | Schedule API **`Resolve Quote Token`** every 2s (or existing poller) until `status` = `accepted` **or** max attempts |
| 3 | On `accepted` → `s_poll_busy` = no |
| 4 | On timeout → `s_poll_busy` = no; show neutral “Payment received — refresh if this page looks stuck.” |

Title/badge: only one state at a time — not “Confirming…” and “Confirmed” together.

---

## 6. Admin — Popup Assign shimmer

**Goal:** Opening Assign never flashes empty customer / $0 totals / **previous job’s** Get Job row.

Use **Nebula Shimmer Assign** the same way as `q`: start on open, stop when Get Job matches `s_job_id` or on cancel.

### 6.1 Inside `Popup Assign`

| Piece | Visible / behavior |
|-------|---------------------|
| **Nebula Shimmer Assign** | Started/stopped by workflow — covers popup body |
| **`G: Assign Header`** | `s_assign_loading is no` — Get Job bindings (guide 09 §10.2) |
| Form (dropdown, date, Save) | `s_assign_loading is no` |
| **`Text Assign Load Error`** (optional) | `s_assign_loading is no` **and** `s_assign_load_error is not empty` — red one-liner |

Keep **`G: Assign Header`** conditional: when `s_job_id` is empty → Data source = empty (avoids 406 on dashboard load).

Optional state: `s_assign_load_error` (text) — set empty on open; set only if Get Job never arrives (timeout branch).

### 6.2 Open Assign (Payments or Jobs Assign button)

Edit existing open workflow:

| # | Action |
|---|--------|
| 1 | Reset inputs (existing); `s_assign_load_error` = empty |
| 2 | `s_job_id` = row’s job id |
| 3 | Set `s_assign_loading` = **yes** |
| 4 | **Nebula Shimmer Assign → Start** |
| 5 | Show **Popup Assign** |

**Stop shimmer** — workflow on **`G: Assign Header`** · **When** Parent group's data source changed:

| # | Action | Only when |
|---|--------|-----------|
| 1 | **Nebula Shimmer Assign → Stop** | Parent group's `id` = Current page's `s_job_id` |
| 2 | Set `s_assign_loading` = **no** | same |

On **Button Assign Cancel** / popup closed:

| # | Action |
|---|--------|
| 1 | **Nebula Shimmer Assign → Stop** (safe even if already stopped) |
| 2 | Hide popup; `s_job_id` = empty; `s_assign_loading` = no |

If Get Job fails (empty after ~10s): optional **Do every 0.5s** loop → on max attempts: **Stop Nebula**, `s_assign_loading` = no, `s_assign_load_error` = “Couldn’t load job details.” — **not** an alert.

### 6.3 Test

- Slow network → Nebula → name + totals populate together (no prior job flash)  
- Cancel popup → Nebula stopped; loading resets  
- No false “Scheduled” on Payments while header still loading  

---

## 7. Admin — Assign / Assigned / Cancel button rules

**Backlog 7b** — fix visibility beyond `status = scheduled` only.

### 7.1 Payments table — **Assign** button

**Show** only when **all** true:

- Row’s `jobs` exists  
- `jobs`'s `status` = **`unscheduled`**  
- `jobs`'s `technician_id` is empty  

**Hide** when job already scheduled / en route / in progress / completed.

### 7.2 Jobs table — **Assign** vs **Assigned**

| Button | Show when |
|--------|-----------|
| **Assign** | `technician_id` is empty **and** `status` is **`unscheduled`** |
| **Assigned** (label/disabled) | `technician_id` is not empty **or** `status` is in **`scheduled`, `en_route`, `in_progress`** |

Use Bubble conditionals on the button element — not a single `status = scheduled` check.

### 7.3 Jobs table — **Cancel**

**Show** when `status` is **not** `completed` **and** **not** `cancelled`.  
Wire to **`DB - Patch Job`** `status=cancelled` (admin JWT) if not already; bump `s_jobs_ts` + `s_payments_ts`.

### 7.4 Test

- After assign + save → Assign hidden, Assigned or tech name shown  
- En route job → no Assign on Payments  
- Completed job → Cancel hidden  

---

## 8. Realtime Live indicator

**Goal:** Subtle Live / Offline from SessionKeeper (`tasks/15`, `perform/07` §2.4 F).

### 8.1 SessionKeeper (if not done)

8.1.1 JavaScript to Bubble element suffix **`live`** · Trigger ON · Publish ON · Value type **yes/no**.  
8.1.2 In SessionKeeper HTML, inside `subscribe` callback:

```javascript
if (typeof bubble_fn_live === 'function') bubble_fn_live(s === 'SUBSCRIBED');
```

### 8.2 `admin_dashboard` workflow

**When** `live` element’s value changed:

| # | Action |
|---|--------|
| 1 | Set `s_realtime_live` = This JavaScript to Bubble's value |

### 8.3 Header UI

Small text or dot in **HeaderBar**:

| Visual | Condition |
|--------|-----------|
| Green dot + **Live** | `s_realtime_live is yes` |
| Gray dot + **Offline** | `s_realtime_live is no` |

Optional: same on `technician_dashboard`.

### 8.4 Test

- Login → Live within a few seconds  
- DevTools → Offline → Offline  
- Online again → Live returns; list still busts on events  

---

## 9. Tech dashboard — filters + Complete busy

**Goal:** Day 17 polish without new backend (`tasks/10`).

### 9.1 Filters (Today / Upcoming / Done)

On **Get My Jobs** RG, add tabs or buttons setting page state `s_job_filter` = `today` | `upcoming` | `done`.

| Filter | RG constraint (on `scheduled_at` or `status`) |
|--------|-----------------------------------------------|
| Today | `scheduled_at` ≥ start of today **and** < start of tomorrow |
| Upcoming | `scheduled_at` ≥ start of tomorrow **and** `status` ≠ `completed` |
| Done | `status` = `completed` |

Use **Additional constraint** on the RG data source — do not client-filter in repeating group only.

### 9.2 Complete button busy

| # | When Complete clicked |
|---|------------------------|
| 1 | `s_complete_busy` = yes; disable button |
| 2 | PATCH status `completed` (existing) |
| 3 | **Always** `s_complete_busy` = no |

If PATCH fails (no photo / no notes), show short error text — don’t leave button disabled forever.

### 9.3 Strip admin chrome

Hide **Schedule** / **Notification** sidebar items copied from admin (`tasks/10`) — scope is **Jobs** only.

---

## 10. Test matrix (Week 4 UX gate)

Run on **375px** width for tech, desktop for admin.

| # | Surface | Pass criteria |
|---|---------|---------------|
| 1 | Draft with AI | Spinner; no double submit; clears on error |
| 2 | `/q?token=…` | Shimmer → quote; bad token → error |
| 3 | `q-success` deposit | Confirming → deposit copy |
| 4 | `q-success` final | Confirming → thank-you, no assign promise |
| 5 | Assign popup | Shimmer → customer + totals |
| 6 | Jobs/Payments buttons | Assign/Cancel rules match §7 |
| 7 | Live dot | Live / Offline tracks network |
| 8 | Tech Complete | Busy state; photo-less blocked with message |
| 9 | Tech filters | Today / Upcoming / Done correct |

**Explicitly out of scope here:** pg_cron follow-ups, daily-reminders, automations feed (Days 18–19).

---

## Memory / task links

| Task file | Covered in part |
|-----------|-----------------|
| `tasks/04-draft-ai-loading.md` | §3 |
| `tasks/12-loading-shimmer-q-assign.md` | §4, §6 |
| `tasks/13-q-success-copy.md` | §5 |
| `tasks/15-realtime-live-indicator.md` | §8 |
| `tasks/08-admin-assign-technician.md` | §6–7 |
| `tasks/10-technician-dashboard.md` | §9 |

When all §10 rows pass, mark Week 4 Bubble UX **done** (pg_cron deferred).
