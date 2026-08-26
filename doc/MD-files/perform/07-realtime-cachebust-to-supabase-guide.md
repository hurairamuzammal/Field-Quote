# Realtime hybrid — purpose + build guide (SessionKeeper)

**What this is:** Replace the admin **Do every ~60s** cache-bust timer with **Supabase Realtime**, while **keeping** Tables + `neq.[bust]` + `s_*_ts`.

**Where it lives:** reusable **`SessionKeeper`** (on admin + tech). **Not** on public `index` / `login` / `q`.

**Related:** `P2-backend.md` §3.5 · Toolbox docs (Javascript to Bubble) · scope §8.3  
**Supabase:** `chqljfdmgdtsmbbwbdyv`  
**Migrations:**  
- `20260810180000_realtime_admin_tables.sql` — admin tables (**DONE**)  
- `20260811130000_realtime_jobs_table.sql` — jobs (tech) — run `npx supabase db push`  
- `20260813120000_realtime_payments_table.sql` — **payments** (admin list) — `npx supabase db push`

---

## Purpose (short)

```
Postgres change → Realtime (JWT+RLS) → JS in SessionKeeper
  → bubble_fn_*(…) → Bubble workflow → bump page s_*_ts → Table refetches
```

| Role | Subscribe | Bump on **Current page** |
|------|-----------|--------------------------|
| admin | requests, quotes, price_book_items, profiles, **payments**, **jobs** | `s_requests_ts`, `s_quotes_ts`, `s_pricebook_ts`, `s_techs_ts`, **`s_payments_ts`**, **`s_jobs_ts`** |
| technician | jobs | `s_jobs_ts` |

---

## Steps (roadmap)
1. Enable Realtime on Postgres  
2. Toolbox **JavaScript to Bubble** inside SessionKeeper (**read every checkbox**)  
3. HTML/JS + `start(jwt, role)`  
4. Workflows: bridge event → bump Current page state  
5. Turn off Do every 60s  
6. Re-`start` after JWT refresh  
7. Test  
8. Stuck checklist  

---

## 1. Enable Realtime on Postgres

1.1 Admin tables already published.  
1.2 Push jobs:

```bash
npx supabase db push
```

1.3 Dashboard → Database → Publications → `supabase_realtime` → confirm: `requests`, `quotes`, `price_book_items`, `profiles`, `jobs`, **`payments`**.

---

## 2. Toolbox “JavaScript to Bubble” — full Bubble settings

This is where people get stuck. Read every field.

### 2.0 How the name works

You set a **suffix** only. Toolbox creates a **global JS function**:

```
bubble_fn_ + [suffix]   →   e.g. suffix "requests"  →  bubble_fn_requests(...)
```

Your HTML **must** call exactly that name.

| In element (suffix) | JS must call |
|---------------------|--------------|
| `requests` | `bubble_fn_requests(...)` |
| `quotes` | `bubble_fn_quotes(...)` |
| `pricebook` | `bubble_fn_pricebook(...)` |
| `techs` | `bubble_fn_techs(...)` |
| `jobs` | `bubble_fn_jobs(...)` |
| `payments` | `bubble_fn_payments(...)` |
| `live` | `bubble_fn_live(...)` |

Do **not** type `bubble_fn_` into the suffix field — only the part after it.

### 2.1 Install plugin
Plugins → **Toolbox** (Misha’s) → Install.  
Elements you’ll use later: **JavaScript to Bubble**, **Run JavaScript** (action).

### 2.2 Open reusable SessionKeeper
Add **six** elements: Visual elements → **JavaScript to Bubble** (Toolbox).  
Make each ~1×1 px. They can sit in a corner.

**Critical:** the element must be **on the page / reusable that is visible** when JS runs. Do **not** put them inside a group that is hidden forever (or collapsed in a way that Bubble doesn’t mount them). SessionKeeper itself must remain on the page (even if 1×1).

### 2.3 Property panel — what each checkbox means

For **every** bridge except where noted, use this pattern:

| Property | What it is | Our setting |
|----------|------------|-------------|
| **Bubble function suffix** | Text after `bubble_fn_` | see table below (e.g. `requests`) |
| **Trigger event** | When JS calls the function, fire a Bubble workflow event | **ON** (checked) — we need a workflow |
| **Publish value** | Pass the JS argument into the element so workflows/UI can read it | **ON** for payload bridges; **ON** for live |
| **Value type** | Type of the published value | **text** for table bridges; **yes/no** for `live` |
| **Value is a list** | Expect an array | **OFF** |
| **Queue** (“Queue second and subsequent events…”) | Extra calls wait in a queue until **Dequeue** | **OFF** for us (see why below) |
| **Multiple outputs** | Send an object with several typed fields | **OFF** |

#### Why Trigger event = ON
Without it, JS can set a value but **no workflow runs** → `s_*_ts` never bumps → table stays stale.

#### Why Publish value = ON
We pass `JSON.stringify(payload)` (or `true`/`false` for live). Even if the bump workflow ignores the text, Publish value keeps debugging easy (“Element’s value”). For `live`, the workflow **reads** the yes/no.

#### Why Queue = OFF
Realtime can fire several times quickly. With Queue **ON**, only the first event runs until you **Dequeue** — easy to forget → looks “broken.”  

With Queue **OFF**, each call triggers the workflow. Bumping unix timestamp many times is fine (table just refetches).

If you ever turn Queue **ON**, every bump workflow must end with element action **Dequeue** on that same JS2Bubble element — otherwise the queue sticks.

#### Why Multiple outputs = OFF
We call `bubble_fn_requests("…string…")`, not `bubble_fn_requests({ output1: … })`. Multiple outputs needs an object — leave off.

### 2.4 Exact config per element

Create **six** JavaScript to Bubble elements. Element **name** in the UI can be anything; the **suffix** is what matters for JS.

#### A) Requests (admin)

| Field | Value |
|-------|--------|
| Bubble function suffix | `requests` |
| Trigger event | **checked** |
| Publish value | **checked** |
| Value type | **text** |
| Value is a list | unchecked |
| Queue | **unchecked** |
| Multiple outputs | **unchecked** |

JS will call: `bubble_fn_requests(JSON.stringify(p))`

#### B) Quotes (admin)

| Field | Value |
|-------|--------|
| Suffix | `quotes` |
| Trigger event | ON |
| Publish value | ON |
| Value type | text |
| List / Queue / Multiple | all OFF |

→ `bubble_fn_quotes(...)`

#### C) Price book (admin)

| Field | Value |
|-------|--------|
| Suffix | `pricebook` |
| Trigger event | ON |
| Publish value | ON |
| Value type | text |
| List / Queue / Multiple | all OFF |

→ `bubble_fn_pricebook(...)`  
(Note: no underscore in suffix — matches script.)

#### D) Techs / profiles (admin)

| Field | Value |
|-------|--------|
| Suffix | `techs` |
| Trigger event | ON |
| Publish value | ON |
| Value type | text |
| List / Queue / Multiple | all OFF |

→ `bubble_fn_techs(...)`

#### E) Jobs (technician)

| Field | Value |
|-------|--------|
| Suffix | `jobs` |
| Trigger event | ON |
| Publish value | ON |
| Value type | text |
| List / Queue / Multiple | all OFF |

→ `bubble_fn_jobs(...)`

#### E2) Payments (admin)

Same checkboxes as Requests. Suffix **`payments`**. JS: `bubble_fn_payments(...)`.

#### F) Live (optional, both roles)

| Field | Value |
|-------|--------|
| Suffix | `live` |
| Trigger event | ON |
| Publish value | ON |
| Value type | **yes/no** (boolean) |
| List / Queue / Multiple | all OFF |

→ `bubble_fn_live(true)` or `bubble_fn_live(false)`  
In JS we pass `s === 'SUBSCRIBED'` (boolean) — matches yes/no.

### 2.5 Dynamic suffix — leave empty / unused
Toolbox has “dynamic suffix” for RG/reusable clones. SessionKeeper is one instance per page — use **static** suffixes above. Do not make suffix dynamic unless you know you need unique names per instance.

### 2.6 Sanity check before Part 3
In Preview → browser console (F12):

```javascript
typeof bubble_fn_requests
typeof bubble_fn_quotes
typeof bubble_fn_pricebook
typeof bubble_fn_techs
typeof bubble_fn_jobs
typeof bubble_fn_live
```

Each should print `"function"`. If `"undefined"`:

- Suffix typo  
- Element not on loaded SessionKeeper  
- SessionKeeper not on that page  
- Element inside a never-shown group  

---

## 3. HTML/JS listener in SessionKeeper

### 3.1 Add HTML element inside SessionKeeper
Paste script. Replace `YOUR_ANON_KEY` with API Connector anon / publishable key (**not** service_role).

```html
<script type="module">
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const SUPABASE_URL = 'https://chqljfdmgdtsmbbwbdyv.supabase.co';
const ANON_KEY = 'YOUR_ANON_KEY';

window.__fqRealtime = window.__fqRealtime || {};

window.__fqRealtime.start = function (jwt, role) {
  if (!jwt) return;
  const r = (role || '').toLowerCase();

  if (window.__fqRealtime.sb && window.__fqRealtime.channel) {
    try {
      window.__fqRealtime.sb.removeChannel(window.__fqRealtime.channel);
    } catch (e) {}
  }

  const sb = createClient(SUPABASE_URL, ANON_KEY);
  sb.realtime.setAuth(jwt);

  let ch = sb.channel('staff-ops-' + r);

  if (r === 'admin') {
    ch = ch
      .on('postgres_changes', { event: '*', schema: 'public', table: 'requests' },
        (p) => { if (typeof bubble_fn_requests === 'function') bubble_fn_requests(JSON.stringify(p)); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'quotes' },
        (p) => { if (typeof bubble_fn_quotes === 'function') bubble_fn_quotes(JSON.stringify(p)); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'price_book_items' },
        (p) => { if (typeof bubble_fn_pricebook === 'function') bubble_fn_pricebook(JSON.stringify(p)); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' },
        (p) => { if (typeof bubble_fn_techs === 'function') bubble_fn_techs(JSON.stringify(p)); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' },
        (p) => { if (typeof bubble_fn_payments === 'function') bubble_fn_payments(JSON.stringify(p)); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs' },
        (p) => { if (typeof bubble_fn_jobs === 'function') bubble_fn_jobs(JSON.stringify(p)); });
  } else if (r === 'technician') {
    ch = ch
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs' },
        (p) => { if (typeof bubble_fn_jobs === 'function') bubble_fn_jobs(JSON.stringify(p)); });
  } else {
    window.__fqRealtime.sb = sb;
    window.__fqRealtime.channel = null;
    return;
  }

  ch.subscribe((s) => {
    if (typeof bubble_fn_live === 'function') bubble_fn_live(s === 'SUBSCRIBED');
  });

  window.__fqRealtime.channel = ch;
  window.__fqRealtime.sb = sb;
};
</script>
```

### 3.2 Start with Run JavaScript (not “paste in HTML only”)
HTML defines `window.__fqRealtime.start`. Something must **call** it with the token.

In SessionKeeper workflow (on load / when token ready):

| # | Action | Detail |
|---|--------|--------|
| 1 | Only when | Current User’s `sb_access_token` is not empty |
| 2 | **Plugins → Run JavaScript** (Toolbox action) | see script below |

**Run JavaScript** body (use Insert dynamic data — do **not** wrap the inserts in extra quotes):

```javascript
window.__fqRealtime && window.__fqRealtime.start('A', 'B');
```

| Letter | Insert |
|--------|--------|
| `A` | Current User’s `sb_access_token` |
| `B` | Current User’s `role` |

Resulting idea: `start('eyJhbG…', 'admin')`.

#### Common Run JavaScript mistakes
| Mistake | Result |
|---------|--------|
| Extra quotes around dynamic token | Broken JWT string |
| Calling `start` before HTML module loads | `__fqRealtime` undefined — add short Pause (250–500 ms) before Run JS, or run on a later step |
| Role empty / wrong casing | No subscriptions (`r` not admin/technician) — login must set `role` |
| Using **Expression** element instead of Run JS | Wrong tool for calling `start` |

### 3.3 Module load timing
`<script type="module">` is deferred. If Page loaded fires immediately:

1. Optional: Pause 300 ms  
2. Then Run JavaScript `start(...)`  
Or Run JavaScript that retries:

```javascript
(function tryStart(n){
  if (window.__fqRealtime && window.__fqRealtime.start) {
    window.__fqRealtime.start('TOKEN', 'ROLE');
  } else if (n < 20) {
    setTimeout(function(){ tryStart(n+1); }, 200);
  }
})(0);
```

(Still insert TOKEN / ROLE dynamically.)

---

## 4. Workflows: bridge event → bump Current page state

### 4.1 Where the event appears
Workflow tab → **Click here to add an event…** → under **Elements** / Toolbox you should see something like:

**“A Javascript to Bubble event”** / **“JavascriptToBubble … is triggered”**

Pick the event for **that** element (the one whose suffix is `requests`, etc.).

If you don’t see it: **Trigger event** was left unchecked on that element → go back to §2.3.

### 4.2 Set state target = Current **page**
States `s_requests_ts` etc. live on `admin_dashboard` / `technician_panel`, **not** on SessionKeeper.

| Action | Element | State | Value |
|--------|---------|-------|--------|
| Set state | **Current page** | `s_requests_ts` (etc.) | Current date/time → **extract** → **UNIX** |

Do **not** set a state on SessionKeeper unless you also moved the bust states there (you did not).

### 4.3 Only when (role)

| Workflow for | Only when |
|--------------|-----------|
| requests / quotes / pricebook / techs / **payments** | Current User’s `role` is `admin` |
| jobs | Current User’s `role` is `admin` **or** `technician` |
| live | (optional) always, or both roles |

### 4.4 Per-bridge workflows

**When** `… suffix requests` is triggered →  
Only when role is admin →  
Set Current page `s_requests_ts` = Current date/time:extract UNIX

Repeat for `quotes` → `s_quotes_ts`, `pricebook` → `s_pricebook_ts`, `techs` → `s_techs_ts`, **`payments` → `s_payments_ts`**.

**When** `… suffix jobs` is triggered →  
Only when role is admin **or** technician →  
Set Current page `s_jobs_ts` = UNIX  

(Admin dashboard **and** tech page both need `s_jobs_ts`. Payments table `bust` = `s_payments_ts`.)

**When** `… suffix live` is triggered →  
Set Current page `s_realtime_live` (yes/no) = **This Javascript to Bubble’s value**  
(or the element’s published value — pick the live element).

### 4.5 Do we use the published text?
For bump-only: **no** — ignore JSON. Publish value is still ON for debugging.  
Optional later: show last event in a debug text = Element’s value.

### 4.6 If you enabled Queue by mistake
Last step of each bump workflow:

**Element actions → Dequeue** on **that same** Javascript to Bubble element.

Prefer Queue **OFF** so you never need this.

---

## 5. Turn off Do every 60s (admin)

5.1 Find **Do every ~60 seconds** that bumps `s_requests_ts` / `s_techs_ts` / …  
5.2 Disable or delete.  
5.3 Keep SessionKeeper’s **~50 min** auth refresh.  
5.4 Optional: still bump after Invite / Draft / Send locally.

---

## 6. Re-start after JWT refresh

In SessionKeeper, **after** refresh success + new token saved on Current User:

**Run JavaScript** (same as §3.2):

```javascript
window.__fqRealtime && window.__fqRealtime.start('NEW_TOKEN', 'ROLE');
```

Without this, Realtime dies ~1h while Bubble still looks logged in.

---

## 7. Test

7.1 Admin login → console: `typeof bubble_fn_requests === 'function'`.  
7.2 Optional: `s_realtime_live` yes.  
7.3 Other tab: new request → Requests table updates ≤2s.  
7.4 Tech login → only jobs channel; job change refreshes tech list.  
7.5 Public pages: no SessionKeeper.

---

## 8. Stuck checklist (read when it “does nothing”)

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| `typeof bubble_fn_requests` is `undefined` | Wrong suffix / element not mounted | Suffix = `requests` only; element visible on SessionKeeper; SessionKeeper on page |
| JS runs but table never updates | **Trigger event** OFF | Turn ON; add “is triggered” workflow |
| Workflow never listed | Trigger event OFF | Same |
| Event fires once then stops | **Queue** ON without Dequeue | Uncheck Queue **or** add Dequeue step |
| `Multiple outputs` errors in console | Multiple ON but JS sends a string | Multiple OFF |
| `__fqRealtime` undefined | Module HTML not loaded yet | Pause / retry loop §3.3 |
| Subscribed but no events | Table not in publication / wrong JWT | `db push`; `setAuth(jwt)`; role admin/technician |
| Tech sees nothing / admin empty | Role string mismatch | Login must set `role` to exact `admin` or `technician` |
| Bump runs but wrong page | Set state on SessionKeeper | Set state on **Current page** |
| Live stays no | Value type not yes/no / not passing boolean | `live` value type yes/no; `bubble_fn_live(s === 'SUBSCRIBED')` |
| Works then dies after ~1h | No re-start after refresh | §6 |
| 60s still hammering API | Old Do every still on | §5 |

---

## Mental model

```
SessionKeeper
  [JS2Bubble suffix=requests Trigger+Publish text]
  [JS2Bubble suffix=live Trigger+Publish yes/no]
  [HTML module __fqRealtime.start]
       │
       Run JS: start(token, role)
       │
       ├─ admin → bubble_fn_requests|quotes|pricebook|techs
       └─ tech  → bubble_fn_jobs
              │
       Workflow "JS2Bubble is triggered"
              │
       Set Current page s_*_ts = unix
              │
       Table bust → refetch
```

---

## Done checklist
- [x] Admin tables published  
- [ ] `jobs` published (`db push`)  
- [ ] Six JS2Bubble elements: suffix / Trigger ON / Publish ON / types / Queue OFF / Multiple OFF  
- [ ] Console shows all `bubble_fn_*` as functions  
- [ ] HTML + `start(jwt, role)` with load timing handled  
- [ ] Triggered workflows bump **Current page** states  
- [ ] Admin 60s timer off; refresh re-`start`  
- [ ] Admin + tech tests pass  

---

**Updated:** 2026-08-11 — full Toolbox property guide (suffix, trigger, publish, queue, multiple, value type, stuck checklist).
