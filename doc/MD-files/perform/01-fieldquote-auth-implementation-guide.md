# FieldQuote — Auth Wiring Guide (Option A) — v2

Your calls are built. This is how to wire them into the UI: pages, elements, workflows, in build order.

**Base URL:** `https://chqljfdmgdtsmbbwbdyv.supabase.co`

---

## Part 0 — Call audit (verify before wiring anything)

Every bug you hit came from one of these settings. Run down the table once; a wrong row here surfaces as a mystery three parts later.

| Call | Use as | Method | Auth header | Body | Init value quirk |
|---|---|---|---|---|---|
| `Auth - Sign In` | **Action** | POST `/auth/v1/token?grant_type=password` | none | `{"email": <email>, "password": <password>}` | test values need **quotes**: `"a@b.com"` |
| `Auth - Refresh Token` | **Action** | POST `/auth/v1/token?grant_type=refresh_token` | none | `{"refresh_token": <refresh_token>}` | quoted test value |
| `Auth - Sign Out` | **Action** | POST `/auth/v1/logout` | `Bearer <access_token>` | empty | 204 empty response — accept the warning, or "Manually enter API response" → `{}` |
| `Auth - Get My Role` | **Action** | GET `/rest/v1/profiles?id=eq.<uid>&select=role,full_name,active` | `Bearer <access_token>` | none | also needs header `Accept: application/vnd.pgrst.object+json` |
| `DB - Get Jobs` | **Data** | GET `/rest/v1/jobs?select=...` | `Bearer <access_token>` | none | initialize with an **admin** token |
| `DB - Get Technicians` | **Data** | GET `/rest/v1/profiles?role=eq.technician&select=...` | `Bearer <access_token>` | none | initialize with an **admin** token (Part 1 first) |

**Rules that apply to all of them:**

- [ ] `apikey` lives **once** in the API group's shared headers, ticked **Private**. No per-call copies.
- [ ] `Authorization` value is typed literally as `Bearer <access_token>`, **Private unticked**. A hardcoded private token would send every user as that person.
- [ ] Body placeholders have **no quotes** in the body (`"email": <email>`) — so workflow values use `:formatted as JSON-safe`, and *initialization* values are typed with quotes.
- [ ] Header values (JWTs) are pasted **without** quotes. Quotes are a JSON-body thing only.
- [ ] "Include errors in response and allow workflow actions to continue" — **unticked** on all auth calls. Ticked, a failure passes silently and your workflow overwrites good tokens with empty ones.
- [ ] Access tokens expire in 1 hour. Re-initializing later → grab a fresh one from Sign In's raw response.

---

## Part 1 — One Supabase change before `DB - Get Technicians` works

Your current policy is "read own profile," which applies to admins too — so the technicians list would come back empty. Add an admin read path. **In a migration** (`supabase migration new admin_reads_profiles`), not the dashboard:

```sql
-- SECURITY DEFINER is required: a policy on profiles that queries profiles
-- directly causes "infinite recursion detected in policy for relation profiles"
create or replace function public.auth_role()
returns text language sql stable security definer
set search_path = public
as $$ select role from public.profiles where id = auth.uid() $$;

create policy "admin reads all profiles"
on public.profiles for select
using (public.auth_role() = 'admin');
```

`auth_role()` is the helper every future admin policy will reuse. After pushing, initialize `DB - Get Technicians` with an admin token, then confirm with a technician token that they still get only their own row — add both to `tests/rls/`.

---

## Part 2 — Bubble User fields + privacy rules

**Data → Data types → User**, add:

| Field | Type |
|---|---|
| `supabase_uid` | text |
| `sb_access_token` | text |
| `sb_refresh_token` | text |
| `sb_expires_at` | date |
| `role` | text |

**Data → Privacy → User** (do this before your first login test):

1. New rule **When `This User is Current User`** → tick *View all fields* + *Find this in searches*.
2. The **"Everyone else"** rule → untick everything.

This is what makes Option A's "tokens stay server-side" claim true. Without it, any logged-in user can pull another user's tokens through Bubble's data API.

---

## Part 3 — Pages and elements to build

| Page | Elements |
|---|---|
| `login` | `Input Email` (format: Email), `Input Password` (format: Password), `Button Log In`, `Text Error` (hidden on load) |
| `admin` | `Group Loading` (full page, visible on load), `Group Content` (everything else, **not** visible on load), `RG Jobs`, `Dropdown Technicians`, reusables: `SessionKeeper` + `HeaderBar` |
| `tech` | `Group Loading`, `Group Content`, `RG Jobs`, reusables: `SessionKeeper` + `HeaderBar` |
| `reset` | `Input New Password`, `Button Set Password`, `Text Error`, Toolbox `JavaScriptToBubble` element (Part 9) |
| `request`, `q` | public — **no** SessionKeeper, no guards, no tokens |

**Reusables to create:** `SessionKeeper` (1×1 px, invisible — Part 5) and `HeaderBar` (nav + `Button Log Out` — Part 6).

**Page custom states on `login`** (hold the session for a split second between steps): `s_access` (text), `s_refresh` (text), `s_expires` (number), `s_uid` (text).

---

## Part 4 — Login wiring

### 4.1 Custom event `Finish Login` (on the `login` page)

Workflow → Add a custom event → name it `Finish Login`. Written once, called from two places.

| # | Action | Details |
|---|---|---|
| 1 | Account → **Make changes to Current User** | `supabase_uid = login's s_uid` · `sb_access_token = login's s_access` · `sb_refresh_token = login's s_refresh` · `sb_expires_at = Current date/time +(seconds): login's s_expires` |
| 2 | Plugins → **`Auth - Get My Role`** | `uid = login's s_uid` · `access_token = login's s_access` |
| 3 | Account → **Make changes to Current User** | `role = Result of step 2's role` |
| 4 | Navigation → **Go to page `admin`** | *Only when* `Result of step 2's role is "admin"` |
| 5 | Navigation → **Go to page `tech`** | *Only when* `Result of step 2's role is "technician"` |
| 6 | Element → **Show `Text Error`** ("Account not set up — contact the office") | *Only when* `Result of step 2's role is empty` |

> Steps 4–5 branch on **`Result of step 2's role`**, never `Current User's role` — step 3's database write isn't reliably readable in the same workflow tick.

### 4.2 When `Button Log In` is clicked

| # | Action | Details |
|---|---|---|
| 1 | Plugins → **`Auth - Sign In`** | `email = Input Email's value:formatted as JSON-safe` · `password = Input Password's value:formatted as JSON-safe` |
| 2 | Element → **Set state** (on `login`) | `s_access = Result of step 1's access_token` · `s_refresh = Result of step 1's refresh_token` · `s_expires = Result of step 1's expires_in` · `s_uid = Result of step 1's user id` |
| 3 | Account → **Log the user in** | `email = Input Email's value` · `password = Input Password's value` (no JSON-safe — this is Bubble's own action, not an API call) |
| 4 | **Trigger custom event `Finish Login`** | — |

**That's your form → call wiring:** the inputs feed step 1's parameters; the button runs it. The API Connector's saved values are only initialization defaults — the workflow overrides them at runtime.

### 4.3 First-ever login (mirror account doesn't exist yet)

FieldQuote has no signup, so each person's Bubble account is created lazily on first login. Step 3 above errors for them and the workflow stops.

Add **Workflow → General → "An unhandled error occurs"** on the `login` page:

| # | Action | Condition |
|---|---|---|
| 1 | Account → **Sign the user up** (`email = Input Email's value`, `password = Input Password's value`) | *Only when* `login's s_access is not empty` **and** `Current User is logged out` |
| 2 | **Trigger custom event `Finish Login`** | same condition |
| 3 | Element → **Show `Text Error`** ("Invalid email or password") | *Only when* `login's s_access is empty` |

The logic: `s_access` is only populated if **Supabase already accepted the credentials**, so creating a Bubble account with the same ones is safe. Empty `s_access` = Supabase rejected them = show the error.

### 4.4 Housekeeping

On `login`'s **Page is loaded**: *Reset relevant inputs* and set all four states to empty — stops a stale `s_access` from triggering the recovery branch.

---

## Part 5 — `SessionKeeper` reusable (refresh)

Build once, drop on every protected page.

**When Page is loaded** (inside the reusable):

| # | Action | Condition / Details |
|---|---|---|
| 1 | Navigation → **Go to page `login`** | *Only when* `Current User is logged out` **or** `Current User's sb_refresh_token is empty` |
| 2 | Plugins → **`Auth - Refresh Token`** | *Only when* `Current User's sb_expires_at < Current date/time +(minutes): 5` · `refresh_token = Current User's sb_refresh_token:formatted as JSON-safe` |
| 3 | Account → **Make changes to Current User** | *Only when* step 2 ran · `sb_access_token = Result of step 2's access_token` · `sb_refresh_token = Result of step 2's refresh_token` · `sb_expires_at = Current date/time +(seconds): Result of step 2's expires_in` |

> **Save both tokens in step 3, every time.** Refresh tokens rotate — the old one dies the instant it's used. Saving only the access token works today and fails tomorrow with `400 Invalid Refresh Token`.

**An unhandled error occurs** (inside the reusable) — the refresh-failed path:

| # | Action |
|---|---|
| 1 | Make changes to Current User → clear `sb_access_token`, `sb_refresh_token`, `sb_expires_at`, `role` |
| 2 | Account → **Log the user out** |
| 3 | Navigation → **Go to page `login`** |

**Optional** for dashboards left open all day: a **Do every 50 minutes** recurring event running steps 2–3.

**Placement:** `admin` and `tech` only. Never on `login`, `request`, or `q` — step 1 would bounce your customers to a login page.

---

## Part 6 — `HeaderBar` reusable + logout

Put nav and `Button Log Out` here so it exists on every protected page.

**When `Button Log Out` is clicked:**

| # | Action | Details |
|---|---|---|
| 1 | Plugins → **`Auth - Sign Out`** | `access_token = Current User's sb_access_token` |
| 2 | Account → **Make changes to Current User** | clear `sb_access_token`, `sb_refresh_token`, `sb_expires_at`, `role` (keep `supabase_uid` — harmless, saves a lookup) |
| 3 | Account → **Log the user out** | — |
| 4 | Navigation → **Go to page `login`** | — |

Order matters — step 1 needs the token before step 2 wipes it. Step 1 is what actually revokes the session **at Supabase**; without it, logout is cosmetic and the refresh token stays live.

> Never delete the Bubble User record on logout. It revokes nothing and forces the mirror-creation path on every login. Clearing four fields *is* the logout.

---

## Part 7 — Page guards and redirects

**`admin` → Page is loaded:**

| # | Action | Condition |
|---|---|---|
| 1 | **Go to page `login`** | *Only when* `Current User is logged out` **or** `Current User's sb_access_token is empty` |
| 2 | **Go to page `tech`** | *Only when* `Current User's role is not "admin"` |
| 3 | Element → **Show `Group Content`** | — |
| 4 | Element → **Hide `Group Loading`** | — |

**`tech`:** steps 1, 3, 4 only (an admin opening the tech view is harmless).

Steps 3–4 are the no-flash pattern: content stays hidden until the guards pass, so unauthorized users navigate away before anything renders.

**What these guards are:** UX, not security. Someone who types `/admin` and beats the redirect sees an empty shell — every piece of data arrives through a call carrying *their* token, and RLS gives them nothing. That's the design working.

---

## Part 8 — Wiring data to the UI (role-aware, without branching)

### 8.1 `RG Jobs` — the same call serves both roles

- RG → **Type of content:** `DB - Get Jobs` (the external type Bubble created)
- **Data source:** *Get data from an external API* → `DB - Get Jobs` → `access_token = Current User's sb_access_token`
- Inside the cell: `Current cell's DB - Get Jobs's status`, `...'s scheduled_at`, etc.

Put this identical RG on **both** pages. RLS does the filtering:

| Token attached | Rows returned |
|---|---|
| Admin's | **All** jobs |
| Technician's | **Only their own** jobs |

No role conditions, no duplicate calls, and a technician can't get admin results by editing anything in the browser — the filter runs in Postgres.

### 8.2 `Dropdown Technicians` (admin page — job assignment)

- Dropdown → **Choices style:** Dynamic choices
- **Type of choices:** `DB - Get Technicians`
- **Choices source:** *Get data from an external API* → `DB - Get Technicians` → `access_token = Current User's sb_access_token`
- **Option caption:** `Current option's full_name`

The value you save to `jobs.technician_id` later is `Dropdown Technicians's value's id`.

### 8.3 When you *do* branch on role

| Situation | What to do |
|---|---|
| Tables a technician can't see (`quotes`, `payments`, `price_book_items`, `requests`) | Their token returns `[]` — already safe. Just don't put those RGs on the tech page (UX) |
| Admin-only section on a shared page | Condition on the group: *visible when `Current User's role is "admin"`* — cosmetic; RLS protects the data regardless |
| Different filters per role | Make the filter a URL parameter (`?status=eq.<status>`) and pass a different value per page — still one call definition |
| Admin-only writes | Just make the call. A technician's token gets a `42501` RLS refusal from Postgres — the correct outcome |

---

## Part 9 — Invite / set-password page (needed before technicians can log in at all)

Invite links land on `reset` with the session in the **URL fragment** (`#access_token=...&type=invite`), which Bubble can't read natively.

**One more call — `Auth - Set Password`:** Action · **PUT** `/auth/v1/user` · header `Authorization: Bearer <access_token>` · body `{"password": <password>}`.

**On the `reset` page:**

1. Toolbox **Run JavaScript** on page load:
   ```js
   var h = new URLSearchParams(window.location.hash.substring(1));
   bubble_fn_token(h.get('access_token') || '');
   ```
   with a **JavaScript to Bubble** element named `bubble_fn_token` (publish value, type text).
2. **When `Button Set Password` is clicked:** `Auth - Set Password` with `access_token = JavaScriptToBubble_token's value` and `password = Input New Password's value:formatted as JSON-safe` → **Go to page `login`**.
3. *Only when* the token element is empty → show "This link has expired — ask the office for a new invite."

New technicians then log in normally and Part 4.3 creates their mirror account.

**Edge case — a returning user resets their password:** their Supabase password is new, their Bubble mirror password is old, so both login paths fail. Fix for a 6-person team: **delete that person's Bubble User record** (Data tab) — the next login recreates it via 4.3. The record holds only session plumbing, so nothing is lost. This is the *only* place deleting a mirror record is correct.

---

## Part 10 — Build order and test checklist

**Order:** Part 1 migration → Part 2 fields + privacy → Part 3 pages/elements → Part 4 login → test login → Part 5 SessionKeeper → Part 6 logout → Part 7 guards → Part 8 data → Part 9 invites.

- [ ] Admin logs in → lands on `admin`; technician → lands on `tech`
- [ ] A newly invited technician's first login works (mirror auto-created)
- [ ] Wrong password → "Invalid email or password", **no** Bubble account created
- [ ] `Current User's role` populated after login (check with a temp text element)
- [ ] `RG Jobs` shows **all** jobs for admin, **only own** for technician — same call
- [ ] `Dropdown Technicians` populated for admin; a technician's token returns only themselves
- [ ] Set `sb_expires_at` to a past date in the Data tab → reload → tokens change (refresh ran)
- [ ] Corrupt `sb_refresh_token` → reload → logged out, back at `login`
- [ ] Logout → fields cleared, and re-using the old refresh token in the API Connector returns `400` (revoked at Supabase)
- [ ] Technician types `/admin` → bounced to `tech`, no content flash
- [ ] As a technician, check the Data tab → **no** other user's tokens visible (privacy rules)
- [ ] Page left open 65 minutes → still works

---

## Part 11 — Troubleshooting

| Error / symptom | Cause | Fix |
|---|---|---|
| `401 No API key found in request` | Missing `apikey` header on that call | Put it in the API group's **shared** headers, Private |
| `403 bad_jwt: token contains an invalid number of segments` | Not a JWT — usually the **refresh_token** pasted into the Authorization header | A JWT has exactly 2 dots and is ~800+ chars. Copy `access_token` from Sign In's raw response |
| `401 PGRST301: Expected 3 parts in JWT; got 1` | Same cause, PostgREST's wording | Same fix |
| `400` on initialization with a valid-looking body | Init test value missing quotes: `{"email": a@b.com}` | Type test values **with** quotes; workflow values use `:formatted as JSON-safe` |
| `400 Invalid Refresh Token` | Saved only the access token last refresh, or two tabs refreshed at once | Save **both** tokens in SessionKeeper step 3 |
| `401 JWT expired` in the app | Refresh didn't run | Is `SessionKeeper` on that page? Is step 2's condition correct? |
| RG empty, status **200**, `[]` | RLS filtered everything — usually the anon key or an empty value in the Bearer slot | Confirm `access_token = Current User's sb_access_token` in the data source |
| Technicians list empty for admin | Part 1 policy not applied | Push the migration, re-initialize the call with an admin token |
| `infinite recursion detected in policy for relation profiles` | A profiles policy queries profiles directly | Use the `SECURITY DEFINER` `auth_role()` helper (Part 1) |
| Login works, role empty | `profiles` row missing (trigger didn't fire) or `active = false` | Check `handle_new_user` and the row in Supabase |
| `422 Signups not allowed` | Something is calling `/auth/v1/signup` | You shouldn't have that call — FieldQuote is invite-only |
| Data stale after a write | Bubble caches external API calls with identical parameters | Display the write's returned row, or add `&ts=<timestamp>` as a dummy parameter |
| Can't find the failure at all | — | Supabase → **Logs → API / Auth**: every request with status and error body. Not listed = Bubble never sent it (a condition failed or a dynamic value was empty) |

> API Connector calls run from **Bubble's servers**, not the browser — the browser Network tab will never show them. Use Bubble's server logs and Supabase's logs.
