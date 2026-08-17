# Supabase + Bubble via API Connector — FieldQuote Auth Guide

**Adapted for FieldQuote from the general hands-on guide.** What changed: **sign-up is removed** (FieldQuote is invite-only — the seeded admin and the `invite-technician` edge function create every account; §2.1 explains why the absence is a security feature), the session-storage decision is **made** (Option A — mirror Bubble account, §2.5, with the reasoning), a new **§2.8** walks the login page wiring end-to-end (your form → the button → the API call → stored session → role redirect → reuse on other pages), the database examples use FieldQuote's `price_book_items`, §4 uses the real `profiles` shape (`admin` / `technician`, invite-metadata trigger, as a migration), and §5 redirects target FieldQuote's `admin` / `tech` pages with a note on the public `request` / `q` pages.

**Scope:** Auth (sign in / refresh / sign out — no sign-up), Database (PostgREST + RLS), roles, and role-based redirects — all through Bubble's native API Connector plugin, no third-party Supabase plugin required.

**Assumes:** You know Bubble's editor; the FieldQuote Supabase project exists with the schema from `backend.md` §1.

---

## 1. API Connector Setup Basics

### 1.1 Get your Supabase credentials

1. In Supabase: **Project Settings → API** (or **Settings → API Keys** on newer dashboards).
2. Copy three things:
   - **Project URL** — `https://YOUR-PROJECT-REF.supabase.co`
   - **anon / publishable key** — safe-ish for client-facing use; RLS still applies to every request made with it. (Newer projects show `sb_publishable_...` keys instead of the legacy `anon` JWT — they behave the same way in these calls; use whichever your dashboard shows.)
   - **service_role / secret key** — **bypasses RLS entirely.** Treat it like a database password.

**anon vs service_role — the rule:**

| Key | RLS applies? | Where it's OK to use |
|---|---|---|
| `anon` / publishable | ✅ Yes | All normal API Connector calls (auth + data) |
| `service_role` / secret | ❌ Bypasses RLS | **Only** in Bubble **backend workflows** for admin operations (e.g., an admin changing another user's role). Never in a call that a page workflow can trigger with user-supplied parameters. |

> **Important nuance:** Bubble's API Connector calls execute from Bubble's servers, not the user's browser, so a key marked "Private" isn't visible in the browser's network tab. But that is *not* a reason to relax: any call defined with the `service_role` key can be triggered by any workflow that references it — with whatever parameters the user's browser sends. If that call can touch arbitrary rows, a curious user can too. Keep `service_role` calls in backend workflows only, behind your own server-side condition checks.

### 1.2 Create the API in API Connector

1. Install the **API Connector** plugin (Plugins → Add plugins).
2. Plugins → API Connector → **Add another API**.
3. **API Name:** `Supabase`
4. **Authentication:** `None or self-handled` (we'll manage headers manually).
5. Add one **shared header** (applies to every call in this API):
   - Key: `apikey`
   - Value: *(paste your anon/publishable key)*
   - ✅ **Private** checked.
6. Do **not** add a shared `Authorization` header — it differs per call (explained next), so you'll set it per call.

### 1.3 Auth calls vs Database calls — two different sub-APIs, one base URL

Supabase exposes both services on the same domain but different paths and header expectations:

| | Auth (GoTrue) | Database (PostgREST) |
|---|---|---|
| Path prefix | `/auth/v1/...` | `/rest/v1/<table_name>` |
| `apikey` header | Required | Required |
| `Authorization` header | Not needed for login. Needed (`Bearer <user access_token>`) for logout / get-user | `Bearer <token>` — **which token you send decides whose RLS rules apply** (anon key = anonymous; user's access_token = that user) |
| Body | JSON (`Content-Type: application/json`) | JSON for writes; none for reads |
| Returns | Session + user objects | Rows as a JSON **array** (by default) |

Keep them straight by prefixing call names inside the API Connector, e.g. `Auth - Sign In`, `DB - Get Price Book Items`.

### 1.4 Common setup mistakes that cause silent (or confusing) failures

1. **Missing `apikey` header** → `401 {"message":"No API key found in request"}`. Every single call needs it, even ones that also send `Authorization`.
2. **Sending only `Authorization` and no `apikey`** — same 401. They are *both* required on data calls.
3. **Header name typos** — it's literally `apikey` (one word, lowercase), not `api-key`, `api_key`, or `x-api-key`.
4. **Missing `Content-Type: application/json` on POST/PATCH** → 400 errors or "empty body" complaints from PostgREST.
5. **Using the anon key as the Bearer token on data calls and wondering why results are empty** — RLS is doing its job. Empty `[]` with a 200 status is the classic symptom. No error is thrown; this is the #1 "silent failure."
6. **Wrong path casing** — `/rest/v1/Tasks` ≠ `/rest/v1/tasks`. Postgres table names are case-sensitive in the URL (lowercase unless you quoted them at creation).
7. **Breaking the JSON body with user input** — if your body is `{"email": "<email>"}` and someone's input contains a quote character, the JSON breaks. Fix: write the body as `{"email": <email>}` (no surrounding quotes) and, in the workflow, pass the value as `Input Email's value:formatted as JSON-safe` — that operator adds the quotes *and* escapes the content. Use this pattern for every text parameter.
8. **Initializing a call and never re-initializing after changing it** — Bubble locks the response structure at initialization. If you later add fields to `select=`, re-initialize or Bubble won't see them.

---

## 2. Auth via API Connector

All auth endpoints live under `https://YOUR-PROJECT-REF.supabase.co/auth/v1/`.

> **Before you start:** FieldQuote staff set their passwords through the **invite email link** (sent by `invite-technician` via Resend) — there is no email-confirmation dance to configure. Two settings to check instead: (1) Supabase → Authentication → Sign In / Up → **Allow new users to sign up: OFF** (admin-API invites still work; this closes the public signup endpoint), and (2) Authentication → **URL Configuration** — whitelist your Bubble app's reset page URL so invite/recovery links redirect correctly.

### 2.1 No Sign-Up call in FieldQuote (deliberately)

The original guide starts with `/auth/v1/signup`. **Do not create that call.** FieldQuote has no self-registration (scope §3): the admin account is seeded, and technicians are created by the `invite-technician` edge function (service role + role metadata + a Resend set-password link). If a signup call existed in the Bubble app, anyone could mint themselves a staff account — the absence is a security feature, not a gap. Pair it with the server-side switch from the note above (**Allow new users to sign up: OFF**). Everything sign-up would have done — the auth user, the `profiles` row with the right role — is handled by the invite flow plus the §4.1 trigger reading the invite's metadata.

### 2.2 Call: `Auth - Sign In`

1. **Use as:** Action  **Method:** POST
2. **URL:** `https://YOUR-PROJECT-REF.supabase.co/auth/v1/token?grant_type=password`
   (the `?grant_type=password` querystring is part of the URL — don't move it to the body)
3. **Headers:** `Content-Type` = `application/json`
4. **Body:**
   ```json
   {
     "email": <email>,
     "password": <password>
   }
   ```
5. Initialize with your test user. The response contains everything your session logic needs:

| JSON field | What it is | Capture as |
|---|---|---|
| `access_token` | JWT proving who the user is — sent as `Bearer` on every data call | text |
| `refresh_token` | One-time-use token to mint a new access token | text |
| `expires_in` | Lifetime in **seconds** (default `3600` = 1 hour) | number |
| `expires_at` | Unix timestamp of expiry | number (or date — see step 6) |
| `token_type` | Always `bearer` | ignore |
| `user` → `id` | The Supabase user UUID (`auth.uid()` in RLS) | text — **you'll use this constantly** |
| `user` → `email` | Email | text |

6. In the initialization popup, Bubble flattens nested JSON: you'll see `user id`, `user email`, etc. as separate fields — that flattening *is* how you "capture each piece separately." Set sensible types in the same popup (e.g., make `expires_at` a number; you'll convert to a Bubble date in the workflow via `:extract from Unix`... or simpler, ignore it and compute expiry yourself: `Current date/time +(seconds): expires_in`).

### 2.3 Call: `Auth - Refresh Token`

1. **Use as:** Action  **Method:** POST
2. **URL:** `https://YOUR-PROJECT-REF.supabase.co/auth/v1/token?grant_type=refresh_token`
3. **Headers:** `Content-Type` = `application/json`
4. **Body:**
   ```json
   {
     "refresh_token": <refresh_token>
   }
   ```
5. Returns the **same shape** as Sign In — a brand-new `access_token` *and* a brand-new `refresh_token`. **Refresh tokens are single-use** (rotation): after a successful refresh, the old one is dead. Always overwrite both stored tokens in the same workflow, or your next refresh will fail with `400 Invalid Refresh Token`.

### 2.4 Call: `Auth - Sign Out`

1. **Use as:** Action  **Method:** POST
2. **URL:** `https://YOUR-PROJECT-REF.supabase.co/auth/v1/logout`
3. **Headers:** `Content-Type` = `application/json`, plus `Authorization` = `Bearer <access_token>` (make `<access_token>` a non-private parameter).
4. Returns **204 No Content** — an empty body. Bubble may warn during initialization that the response is empty; that's fine, the call works. In your logout workflow, call this *and then* clear your locally stored tokens (and log out the Bubble user if you use the mirror-account pattern below).

### 2.5 Storing the session so the user stays recognized

This is the part Bubble doesn't do for you. The general guide offers three options; **for FieldQuote the answer is Option A — the mirror Bubble account.** Here's the decision, then the setup.

**Why Option A over Option B, specifically for this project:**

- **Multi-page app, zero plumbing.** FieldQuote spans `login`, `admin`, `tech` (and more screens inside each). Option A hangs the tokens on the Bubble **User** record, and Bubble's own cookie session keeps `Current User` alive across every navigation and refresh — so any page can read `Current User's sb_access_token` with no setup. Option B (localStorage plugin) forces a "read storage → hydrate custom states" workflow on *every* page, forever, and one forgotten page = mystery empty lists.
- **Technicians are on phones in the field.** Option B parks tokens in localStorage, readable by any script on the page and invisible to Bubble privacy rules. Option A keeps them server-side behind a privacy rule.
- **Role caching for free.** `role` on the User record makes `Current User's role` usable in any conditional or "Only when" — §4–5's redirect logic becomes three one-line conditions.
- **The cost of A:** the mirror Bubble account's password must track the Supabase password. The §2.8 error ladder handles both cases where they diverge (first login, and login after a Supabase password reset) automatically — you accept a slightly hairier login workflow once, and never think about it again.

**Option B remains legitimate** only if you refuse to create Bubble accounts at all (fully headless front end): store `access_token` / `refresh_token` / `uid` / `expires_at` via a localStorage plugin, hydrate states on every page load, re-fetch the role per page. Not recommended here. (Option C — custom states only — dies on refresh; prototype toy, skip.)

**Set up Option A:**

1. On the **User** data type, add fields:
   - `supabase_uid` (text)
   - `sb_access_token` (text)
   - `sb_refresh_token` (text)
   - `sb_expires_at` (date)
   - `role` (text)
2. **Privacy rule on User** (Data → Privacy): *When `This User is Current User`* → allow view of these fields; everyone else sees nothing. Without this, tokens leak via Bubble's data API/searches.
3. **There is no sign-up workflow** (accounts are provisioned in Supabase). The mirror Bubble account is created *lazily on first login* by the error ladder in §2.8 — which also re-syncs it after a Supabase password reset. All token-saving happens in that one login workflow.

### 2.6 Keeping the token fresh

The access token dies after ~1 hour. The pattern:

1. Create a reusable workflow (or repeat on each page): **When Page is loaded**, *only when* `Current User's sb_expires_at < Current date/time +(minutes): 5` **and** `Current User's sb_refresh_token is not empty`:
   - Step 1: `Auth - Refresh Token` with `Current User's sb_refresh_token`
   - Step 2: Make changes to Current User → overwrite `sb_access_token`, `sb_refresh_token`, `sb_expires_at` (new values from step 1). Overwrite **both** tokens — rotation.
2. Optional belt-and-braces: a **Do every 50 minutes** recurring event on long-lived pages (dashboards people leave open) doing the same refresh.
3. **Handle refresh failure** (revoked/expired refresh token, e.g., user logged out elsewhere or token already used): if the refresh call errors, clear the token fields, log the Bubble user out, and send them to the login page. (Error handling how-to in section 6.)
4. Solo project shortcut: you can also just refresh unconditionally on every page load — one extra API call per page load, dead simple. For a production app with many users, prefer the conditional version to stay well under auth rate limits.

### 2.7 Security checklist for this section

- `service_role` key: never in any call reachable from a page workflow. Backend workflows only.
- `anon` key and any static keys: **Private** checked in API Connector.
- Tokens live on the User record behind a privacy rule (Option A) — not in URL parameters, not in page titles, not in unprotected fields.
- Don't log tokens: avoid dropping them into "Alert" elements, database text fields other than the User's own, or third-party analytics events.
- Every *real* protection is server-side (RLS + Supabase auth). Everything you do in Bubble's UI (redirects, hidden groups) is UX, not security.

### 2.8 Wiring the FieldQuote login page end-to-end (form → button → call → stored session → redirect)

This answers "how do I feed the login form into the call, map the button, and then use the session on other pages" concretely.

**Elements on the `login` page:** `Input Email` (content format: Email), `Input Password` (content format: Password), `Button Log In`, `Text Error` (hidden by default).

**The workflow — When `Button Log In` is clicked:**

| Step | Action | Details |
|---|---|---|
| 1 | Plugins → **`Supabase - Auth - Sign In`** | It appears as a workflow action because the call is saved as "Use as: Action" (§2.2). Fill its parameters: `(body) email` = `Input Email's value:formatted as JSON-safe` · `(body) password` = `Input Password's value:formatted as JSON-safe`. (The call's body is written `{"email": <email>}` *without* quotes around the tags — JSON-safe adds the quotes and escapes the content. This is the form→call feed.) |
| 2 | Account → **Log the user in** | Same `Input Email's value` / `Input Password's value`. This wakes the mirror Bubble cookie session that keeps `Current User` alive on every other page. (Error ladder below covers first logins and post-reset logins.) |
| 3 | Account → **Make changes to Current User** | `supabase_uid = Result of step 1's user id` · `sb_access_token = Result of step 1's access_token` · `sb_refresh_token = Result of step 1's refresh_token` · `sb_expires_at = Current date/time +(seconds): Result of step 1's expires_in` |
| 4 | Plugins → **`Auth - Get My Role`** | `uid = Result of step 1's user id`, `access_token = Result of step 1's access_token`. Use **step 1's results**, not `Current User's ...` — reading step 3's database write in the same workflow tick isn't guaranteed. |
| 5 | Account → **Make changes to Current User** | `role = Result of step 4's role` |
| 6 | Navigation → **Go to page `admin`** | *Only when* `Result of step 4's role is "admin"` |
| 7 | Navigation → **Go to page `tech`** | *Only when* `Result of step 4's role is "technician"` |
| 8 | Element → **Show `Text Error`** ("Account not set up — contact the office") | *Only when* `Result of step 4's role is empty` |

Order matters: navigation ends the workflow, so the specific conditions (6, 7) come before the fallback (8).

**The error ladder** (per-action error handling / "an unhandled error occurs"):

- **Step 1 errors** → Supabase rejected the credentials (`400 invalid_grant`). Show "Invalid email or password." Stop — nothing else should run.
- **Step 2 errors while step 1 succeeded** → the Supabase password is right but the Bubble mirror disagrees. Two possible reasons, handled as rungs:
  1. *First login on this app* (no mirror account yet): handler runs **Sign the user up** (Bubble's built-in, same email + password), then continues with steps 3–8.
  2. *That also errors with "email already in use"* → the mirror exists but its password is stale (the user reset their password through Supabase's recover flow): schedule a backend workflow that runs **Assign a temp password** for that email and returns it → **Log the user in** with the temp password → **Update the user's credentials** to the typed password → continue with steps 3–8. Only post-reset logins ever reach this rung.

**Using the session on every other page (the "different pages" answer):**

- **Where it's stored:** on the Bubble User record — server-side, behind the privacy rule. Bubble's login cookie keeps `Current User` pointing at that record across navigation, refreshes, and returning tomorrow. You never pass tokens between pages, never put them in URLs, never re-login per page.
- **How you read it:** any DB call's `access_token` parameter = `Current User's sb_access_token`; any role check = `Current User's role`; the Supabase uid (for URL filters where you want intent explicit) = `Current User's supabase_uid`.
- **How it stays valid:** put the §2.6 conditional-refresh in a reusable element and drop it on `admin` and `tech` (and every future protected page). Page-load guards + role redirects: §5.2.
- **The exceptions:** the public pages `request` and `q` use none of this — no tokens, no guards (see §5.4).

---

## 3. Database via API Connector (PostgREST)

All table endpoints live under `https://YOUR-PROJECT-REF.supabase.co/rest/v1/<table_name>`.

> **Prerequisite:** RLS should be **enabled** on every table you expose, with policies written. A table with RLS enabled and *no* policies returns `[]` for everyone — remember that when debugging.

### 3.1 The header pattern for every DB call

| Header | Value | Notes |
|---|---|---|
| `apikey` | anon key | Shared header, already set |
| `Authorization` | `Bearer <access_token>` | Make `<access_token>` a **non-private dynamic parameter** and pass `Current User's sb_access_token` from the workflow/expression. This is what makes RLS evaluate `auth.uid()` as *this* user. |
| `Content-Type` | `application/json` | Writes only |
| `Prefer` | `return=representation` | Writes only — without it, inserts/updates return an empty body and Bubble can't initialize or read the result |

Setting up the dynamic Authorization header: in the call's header value, literally type `Bearer <access_token>` — the `<access_token>` part becomes a parameter. Untick Private. During initialization, paste a real token (log in via your `Auth - Sign In` call's raw response, or grab one from a test in Postman). Tokens expire hourly — if initialization suddenly 401s (`JWT expired`), fetch a fresh one.

### 3.2 Call: `DB - Get <table>` (read rows)

Example with FieldQuote's `price_book_items` table — the first table you wire (roadmap Day 3):

1. **Use as:** Data  **Method:** GET
2. **URL:**
   ```
   https://YOUR-PROJECT-REF.supabase.co/rest/v1/price_book_items?select=id,name,category,unit,unit_price,active&order=category.asc&limit=100
   ```
3. Headers: the `Authorization: Bearer <access_token>` dynamic header. No body.
4. Initialize → Bubble shows the array and creates an **external data type** (`Supabase - DB - Get Price Book Items`). Set field types in the popup (dates as date, numbers as number).
5. **Use it in a Repeating Group:**
   - RG → Type of content: `DB - Get Price Book Items` (the external type)
   - Data source: `Get data from an external API` → pick the call → fill `access_token` = `Current User's sb_access_token`
   - Inside the cell: `Current cell's DB - Get Price Book Items's name`, `...'s unit_price`, etc.
6. **Filtering happens in the URL, not in Bubble.** PostgREST operators go in the querystring:
   - `?status=eq.open` (equals) `?amount=gt.100` (greater than) `?title=ilike.*invoice*` (case-insensitive contains)
   - `?order=created_at.desc` `?limit=25&offset=25` (pagination)
   - Make filter values dynamic parameters too (e.g., `?status=eq.<status>`). Don't `:filtered` a 1,000-row response in Bubble when the database can filter it for you.
7. You generally do **not** need `?user_id=eq.<uid>` if RLS already restricts rows to the owner — but adding it anyway is harmless and makes intent explicit.

### 3.3 Call: `DB - Create <table row>` (insert)

1. **Use as:** Action  **Method:** POST
2. **URL:** `https://YOUR-PROJECT-REF.supabase.co/rest/v1/price_book_items`
3. Headers: `Authorization: Bearer <access_token>`, `Content-Type: application/json`, `Prefer: return=representation`
4. **Body:**
   ```json
   {
     "name": <name>,
     "category": <category>,
     "unit": <unit>,
     "unit_price": <unit_price>
   }
   ```
   `:formatted as JSON-safe` on every **text** param (`name`, `category`, `unit`); numeric params like `unit_price` are passed bare — wrapping a number in quotes makes PostgREST reject the type. Note this call only succeeds with an **admin** JWT: `price_book_items` has no technician policy, so a tech's token gets an RLS refusal (`42501`) — which is exactly the intended behavior.
5. With the `Prefer` header, the response is the created row (as a one-item array) — usable as `Result of step X's ... :first item's id` for chaining.

### 3.4 Update and delete

- **Update:** Method **PATCH**, URL `.../rest/v1/price_book_items?id=eq.<item_id>`, same headers as insert, body containing only the fields to change. **Never ship a PATCH/DELETE without a filter in the URL** — an unfiltered PATCH updates every row your token can see.
- **Delete:** Method **DELETE**, URL `.../rest/v1/price_book_items?id=eq.<item_id>`, `Authorization` header, no body. (In FieldQuote you'll rarely DELETE price book rows — deactivate with `PATCH {"active": false}` so old quote lines keep their reference.) Returns 204 (empty) unless you add `Prefer: return=representation`.

### 3.5 Making returned data Bubble-friendly (nested JSON)

1. **Arrays initialize as lists automatically** — a top-level JSON array becomes a Bubble list you can loop in RGs. Nothing to configure.
2. **One level of nesting is fine.** PostgREST embedding, e.g.
   ```
   ?select=id,title,profiles(full_name,role)
   ```
   returns each task with a nested `profiles` object; Bubble flattens it into fields like `profiles full_name`. Usable, if slightly ugly.
3. **Deep nesting gets painful.** Bubble's API Connector struggles past 1–2 levels (fields become inaccessible or lists-of-lists you can't address). Two clean fixes on the Supabase side:
   - **Create a database view** that pre-joins/flattens exactly what the page needs (`create view tasks_with_owner as select t.*, p.full_name ...`), then call `/rest/v1/tasks_with_owner`. Views are queried like tables. (Define views with `security_invoker = on` so RLS of the underlying tables still applies.)
   - **Create an RPC function** (`/rest/v1/rpc/your_function`, POST) that returns exactly the flat JSON shape you want.
   Flattening server-side is almost always better than fighting Bubble's JSON handling.
4. **Single-object responses:** add header `Accept: application/vnd.pgrst.object+json` to make PostgREST return `{...}` instead of `[{...}]` when you expect exactly one row (errors if 0 or 2+ rows match). Great for "get my profile" calls — no `:first item` needed.
5. **Re-initialization discipline:** any time you change `select=`, re-initialize and re-check field types. Bubble silently keeps the old schema otherwise.

---

## 4. Fetching and Using User Roles

### 4.1 Where the role should live: a `profiles` table (not user_metadata)

Store roles in a **`public.profiles` table keyed to `auth.users.id`**. Why not the alternatives:

- **`user_metadata` (on the auth user)** — editable by the user themselves via the update-user endpoint. A user could promote themselves to admin. Never put authorization data there.
- **`app_metadata`** — *is* tamper-proof and even rides inside the JWT (more advanced/most secure option; you edit it via the Admin API with the service_role key). Perfectly valid for production, but reading it from Bubble means decoding a JWT — clunky. The profiles table gives you the same security (RLS-protected, user can't update it) with a trivially easy read.
- **Random column on some business table** — scattered, hard to secure.

**In FieldQuote this lives in a migration, not a dashboard edit** (`supabase migration new profiles_and_trigger` → paste → `supabase db push` — CLAUDE.md rule 10):

```sql
-- 1. Profiles table linked 1:1 to auth users (staff only: admin + technicians)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  company_id uuid,
  full_name text,
  email text,
  phone text,
  role text not null default 'technician' check (role in ('admin','technician')),
  active boolean not null default true,
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;

-- 2. Staff can read ONLY their own profile
create policy "read own profile"
on public.profiles for select
using (auth.uid() = id);

-- 3. Deliberately NO insert/update policy for users:
--    profiles are created by the trigger below; role changes only via
--    service_role (i.e., inside edge functions you control)

-- 4. Auto-create a profile whenever an auth user is created — which in
--    FieldQuote only happens via the seeded admin or the invite-technician
--    edge function. Name and role ride in on the invite's user_metadata.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'role', 'technician')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();
```

Because users have **no update policy**, the role can only be changed with the `service_role` key — i.e., from a Bubble **backend workflow** you control, or manually in the Supabase dashboard.

### 4.2 Call: `Auth - Get My Role`

1. **Use as:** Action (Action is easier to chain right after login; you can duplicate it as a Data call too)  **Method:** GET
2. **URL:**
   ```
   https://YOUR-PROJECT-REF.supabase.co/rest/v1/profiles?id=eq.<uid>&select=role
   ```
3. **Headers:**
   - `Authorization` = `Bearer <access_token>` (dynamic, non-private)
   - `Accept` = `application/vnd.pgrst.object+json` (single object — response is just `{"role":"admin"}`)
4. Initialize with a real uid + fresh token. Response field: `role` (text). Done.
5. Note the security shape here: the user's own token + RLS means this call can *only ever* return their own role. Even if someone tampers with the `<uid>` parameter, RLS returns nothing for other users' rows.

### 4.3 Fetch it at the right moments, store it once

1. **In the login workflow**, immediately after saving tokens:
   - Step: `Auth - Get My Role` (`uid` = `Result of Sign In's user id`, `access_token` = `Result of Sign In's access_token`)
   - Step: **Make changes to Current User** → `role = Result of step X's role`
2. Now `Current User's role` is checkable **everywhere** — conditionals, workflow "Only when" clauses, element visibility — with zero extra API calls. That's your cache.
3. **When to re-fetch** (the cached copy can go stale if an admin changes someone's role mid-session):
   - Cheap + usually enough: re-fetch on login only (roles rarely change).
   - Stricter: also re-fetch on page load of *sensitive* pages (admin dashboard) — one small API call.
   - Production app with many users and changing permissions: re-fetch on load of any gated page, and remember the cached role is **UX only** — actual data access is enforced by RLS regardless of what Bubble thinks the role is. If you also gate *data* by role, write RLS policies that check the profiles table, e.g.:
     ```sql
     using (exists (select 1 from public.profiles
                    where id = auth.uid() and role = 'admin'))
     ```
   - If you use Option B (browser storage) instead of a Bubble user: store the role in a custom state hydrated on page load, and re-fetch on every page load, since you have no persistent server-side cache.

---

## 5. Role-Based Redirect Logic

### 5.1 Redirect right after login

In your login page's workflow, after tokens + role are saved:

1. **Navigation → Go to page `admin`** — *Only when* `Result of step X's role is "admin"`
2. **Go to page `tech`** — *Only when* `Result of step X's role is "technician"`
3. **Show an "Account not set up — contact the office" message** (stay on `login`) — *Only when* `Result of step X's role is empty` or the role call errored. (A deactivated technician normally fails at Sign In itself, since deactivation bans the auth user — this fallback mostly catches half-provisioned accounts.)

Order matters: Bubble runs actions top-down and navigation ends the workflow, so put the most specific condition first and the fallback last. Use the **step result's** role (not `Current User's role`) in these conditions — the database write from the previous step may not be readable in the same workflow tick.

### 5.2 Redirect on page load (every gated page)

On each protected page, **When Page is loaded**:

1. *(If using token refresh)* Step 1: conditional refresh (section 2.6).
2. Step 2: **Go to page `login`** — *Only when* `Current User is logged out` **or** `Current User's sb_access_token is empty`.
3. Step 3 (the `admin` page): **Go to page `tech`** — *Only when* `Current User's role is not "admin"`. (No mirror check needed on `tech` — an admin opening the tech view is harmless.)
4. Stricter variant for sensitive pages: instead of trusting the cached role, Step 2.5 runs `Auth - Get My Role` and Step 3's condition uses the step result. This also catches revoked users: if the token is dead, the call fails → treat as logged out.

### 5.3 Preventing the flash of the wrong page

Redirects fire a beat after render, so unguarded content flashes. The standard fix:

1. Put **all page content inside one Group** (`Group Content`), unticked **"This element is visible on page load."**
2. Add a full-page **Group Loading** (spinner/blank, visible on page load).
3. Page-load workflow, *after* the auth/role checks pass: **Show Group Content**, **Hide Group Loading**. Because the redirect actions come first, unauthorized users navigate away before content ever shows.
4. Alternative (condition-based, no workflow actions): set a page custom state `auth_checked` (yes/no, default no); content group has condition *When `auth_checked` is yes → visible*; the workflow sets the state after checks pass. Same effect, some people find it tidier.
5. Solo project shortcut: for low-stakes pages, a simple conditional on the content group (*visible when `Current User's role is "admin"`*) is fine and skips the state machinery.

### 5.4 Protecting pages against direct URL access

Someone typing `/admin_dashboard` directly must still bounce. Three layers:

1. **The page-load redirect (5.2) runs on direct navigation too** — that's your first line. Bubble has no true server-side route guard on regular plans, so this check must exist on *every* protected page (make it a habit; on newer Bubble versions you can also gate at the page level with page conditionals).
2. **Accept that the page *shell* is never secret.** A determined user can read any Bubble page's element structure before the redirect fires. So the rule is: nothing sensitive is *baked into* the page — all sensitive content is **data**, and the data only arrives via API calls that carry the user's token.
3. **RLS is the actual lock.** If a non-admin lands on the admin page and its RG calls `/rest/v1/all_users_report`, their token fails the RLS policy and they get `[]`. They see an empty dashboard skeleton — annoying for them, harmless for you. This is why section 4's "admin-only" RLS policies matter: the redirect is UX, RLS is security. Same for admin *actions*: run them in backend workflows that re-verify the caller's role server-side (fetch the role with the caller's token first, or use an RPC that checks `auth.uid()`'s role internally) before any service_role call executes. (In FieldQuote, prefer the project's standing rule: anything needing service-role power is a Supabase **edge function**, not a Bubble backend workflow — backend.md §3.6.)
4. **FieldQuote's public pages (`request` and `q`) are exempt from all of this** — no auth checks, no redirects, no tokens on the page. They serve strangers by design; their data flows through edge functions (`submit-request`, `resolve-quote-token`) that do their own validation server-side. Adding auth machinery to them would just break the funnel.

---

## 6. Tips, Tricks, and Pitfalls

### 6.1 Common bugs and edge cases

1. **Empty `[]` with status 200** — not an error; RLS filtered everything out. Causes, in order of likelihood: you sent the anon key as the Bearer token instead of the user's access token; the token belongs to a different user than the rows; RLS is enabled with no (or wrong) SELECT policy; the `using` clause references `auth.uid()` but the row's user column holds a different uuid.
2. **`401 JWT expired`** — access token older than an hour. In workflows this means your refresh logic didn't run; during API Connector initialization it just means your pasted test token is stale — grab a fresh one.
3. **`400 Invalid Refresh Token`** — you refreshed but saved only the new access token, then tried to reuse the old (now-burned) refresh token. Always save both. Also happens legitimately when the user signed out elsewhere → route to login.
4. **Insert "succeeds" but Bubble sees nothing / initialization fails on POST** — missing `Prefer: return=representation`. PostgREST returned `201` with an empty body.
5. **JSON body breaks on certain inputs** — quotes, backslashes, or line breaks in a text field. Use the `{"field": <param>}` + `:formatted as JSON-safe` pattern everywhere; never hand-wrap params in quotes *and* JSON-safe them (you'll get double quotes).
6. **`400 Email not confirmed` on sign-in** — email confirmation is on and the test user never clicked the link. Toggle it in Auth settings or confirm the user manually in the dashboard.
7. **`422 Signups not allowed`** — public sign-up is disabled (correct for FieldQuote). Accounts can only come from the seeded admin or `invite-technician`. If you ever see this error, something is calling a signup endpoint that shouldn't exist in this app.
8. **Changed the `select=`, page broke** — response schema is frozen at initialization. Re-initialize after any change, then re-check every expression that referenced the call (Bubble marks broken ones in red in the Issue Checker).
9. **Numbers/dates come through as text** — you accepted Bubble's guesses during initialization. Re-initialize and set types in the "returned values" popup; fixing it later means touching every dependent expression.
10. **Logout call "fails" during initialization** — it's a 204 empty response. Ignore the warning.
11. **Data call results seem cached/stale** — Bubble caches `Get data from an external API` results with identical parameters within a page session. To force a re-fetch after a write, either display the write's returned row, or add a dummy parameter you bump (e.g., `&ts=<timestamp>` with `Current date/time:extract UNIX`).
12. **PATCH/DELETE without a URL filter** — updates or deletes *every row the token can reach*. RLS limits the blast radius to the user's own rows, which is still a disaster. Filters are not optional.
13. **Timestamps and timezones** — Supabase returns UTC ISO strings (`2026-07-29T09:30:00+00:00`); initialize as **date** and Bubble displays in the viewer's timezone automatically. Don't initialize as text and parse manually.

### 6.2 Debugging failed calls — a workflow

1. **Reproduce inside the API Connector first.** "Reinitialize call" with hardcoded known-good values isolates *call definition* problems from *dynamic value* problems. If it works there but not in the app, the bug is in what your workflow passes (usually an empty token or an un-JSON-safe string).
2. **Read the raw body.** During initialization, click **"show raw data"** — Supabase errors are descriptive JSON: `{"code":"42501","message":"new row violates row-level security policy"}` tells you exactly which layer said no. PostgREST error `code`s are Postgres error codes — searchable.
3. **In workflows, add error handling.** Use the **"An unhandled error occurs"** workflow event (Element trigger) — or the per-action error handling on recent Bubble versions — to catch failures and show `error message` in an alert while developing. Silent failures are almost always a call erroring inside a workflow with no handler.
4. **Check Supabase's logs — this is the killer tool.** Dashboard → **Logs** → *API* / *Auth*. Every request appears with status, path, and error detail. If your call isn't in the log at all, Bubble never sent it (condition failed, empty dynamic value collapsed the call). If it's there with a 4xx, the response body tells you why.
5. **Bubble's server logs** (Logs tab → Server logs, tick "workflow errors") show outbound API failures with the response body — useful in production where you can't reproduce.
6. **Bypass both tools when confused.** Recreate the exact call in Postman/curl with the same headers. If it works there and not in Bubble, diff the headers character by character — it's nearly always a header.
7. Remember: API Connector calls are **server-side**, so the browser's Network tab won't show them. Don't waste time looking there.

### 6.3 Performance and rate limits

1. **PostgREST caps responses at 1,000 rows by default.** You won't get an error — just truncation. Paginate with `limit`/`offset` (or the `Range` header) and design RGs around pages, not "load everything."
2. **`select=` only what you render.** `select=*` on wide tables with JSON columns inflates payloads and slows RG rendering. Listing columns also keeps the frozen Bubble schema deliberate.
3. **Auth endpoints are rate-limited per IP** — and API Connector traffic originates from **Bubble's shared server IPs**, not each user's. A burst of logins/refreshes can hit limits sooner than the raw numbers suggest. Mitigations: refresh conditionally (not on every page load), don't put sign-in calls in loops, and on a production app raise the limits in Supabase → Auth → Rate Limits (paid plans) or front auth-heavy flows with backend workflows you can queue.
4. **One roundtrip beats three.** Each API Connector call is a full HTTP roundtrip from Bubble's servers. Use PostgREST embedding, views, or RPCs to fetch a screen's data in one call rather than chaining `get user → get profile → get orders`.
5. **Indexes matter once tables grow.** Filtering `?status=eq.open` on 200k rows without an index on `status` is slow regardless of Bubble. Add indexes for every column you filter/order by (Supabase → Database → Indexes).
6. **Solo/small project:** none of the above will bite you under a few thousand rows and a handful of users — get it working first. **Production:** budget a pass for pagination, per-page `select` lists, conditional refresh, indexes, and moving multi-step reads into views/RPCs before launch.
7. **Free-tier note:** Supabase free projects pause after ~1 week of inactivity — a "dead" client demo that worked last month is usually just a paused project. Restore it from the dashboard.

---

## Quick Reference Card

| Call | Method | URL (after base) | Special headers |
|---|---|---|---|
| Sign in | POST | `/auth/v1/token?grant_type=password` | `Content-Type: application/json` |
| Refresh | POST | `/auth/v1/token?grant_type=refresh_token` | `Content-Type: application/json` |
| Sign out | POST | `/auth/v1/logout` | `Authorization: Bearer <access_token>` |
| Read rows | GET | `/rest/v1/<table>?select=...` | `Authorization: Bearer <access_token>` |
| Insert | POST | `/rest/v1/<table>` | + `Content-Type`, `Prefer: return=representation` |
| Update | PATCH | `/rest/v1/<table>?id=eq.<id>` | + `Content-Type`, `Prefer: return=representation` |
| Delete | DELETE | `/rest/v1/<table>?id=eq.<id>` | `Authorization: Bearer <access_token>` |
| Get my role | GET | `/rest/v1/profiles?id=eq.<uid>&select=role` | + `Accept: application/vnd.pgrst.object+json` |

**Every call also needs the shared `apikey` header. Every text body param gets `:formatted as JSON-safe`. `service_role` never leaves backend workflows.**
