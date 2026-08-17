# Resend invite — technicians table (password not set)

**When:** Admin team / invite table. Show **Resend invite** only while `profiles.setup_complete` is **no** (invite pending). Do **not** use `active` is no — disabled staff are also `active` no.  
**Server:** `resend-invite` refuses `setup_complete` yes (working or disabled). `set-technician-active` refuses Disable until they have set a password.

**Order:** `db push` (adds `setup_complete`) → deploy functions → Re-initialize **DB - List Team** → button visible when `setup_complete` is **no**.

---

## Steps
1. Push migration + deploy functions
2. Add **Resend Invite** connector
3. Update **DB - List Team** `select=`
4. Bind table + Resend / Disable / Enable
5. Test

---

## 1. Push migration + deploy functions

`setup_complete` is a new column. Pending invite = `false`. After Set Password it stays `true` even if the admin later disables them.

```bash
npx supabase db push --project-ref chqljfdmgdtsmbbwbdyv
npx supabase functions deploy resend-invite invite-technician set-technician-active complete-password-setup --no-verify-jwt --project-ref chqljfdmgdtsmbbwbdyv
```

`resend-invite` does **not** create a user. It sends a new invite only if `setup_complete` is false and they are not banned.

| Status | Meaning |
|--------|---------|
| 200 | Email sent |
| 400 | Missing email |
| 401 / 403 | Not an active admin |
| 404 | No technician with that email |
| 409 | Password already set, **or** technician is deactivated |
| 502 | Link created, email failed |

---

## 2. Add `Resend Invite` connector

Plugins → API Connector → same API as **Invite Technician** (or **Supabase**) → **Add another call**.

| Setting | Exact value |
|---------|-------------|
| **Name** | `Resend Invite` |
| **Use as** | **Action** (workflow on button click — not a table data source) |
| **Method** | POST |
| **URL** | `https://chqljfdmgdtsmbbwbdyv.supabase.co/functions/v1/resend-invite` |
| **Include errors** | **ON** (need 409 for toasts) |
| **Body type** | JSON |

### Headers

| Header | Value | Private? | What it does |
|--------|-------|----------|--------------|
| `apikey` | Bubble shared anon / publishable key (same as Invite Technician) | **yes** | Gateway |
| `Authorization` | `Bearer <access_token>` | **no** (dynamic) | Admin JWT |
| `Content-Type` | `application/json` | no | JSON body |

### Body template

Placeholders **unquoted**. Initialize uses quoted strings. Workflow uses JSON-safe.

```json
{
  "email": <email>
}
```

| Placeholder | Bubble type | Meaning | Initialize (with quotes) | Workflow |
|-------------|-------------|---------|--------------------------|----------|
| `<email>` | text | Technician email | `"tech@example.com"` | Current cell’s `email:formatted as JSON-safe` |
| `<access_token>` | header | Admin JWT | Paste a **fresh admin** JWT, **no quotes**, prefix `Bearer ` | `Bearer ` + Current User’s `sb_access_token` |

Initialize email must be a real **pending** technician (`setup_complete` = no) or you get 404/409 — that is OK for schema if HTTP still returns JSON. To get **200**, use an email that has not set a password.

### Success shape (after Initialize 200)

| Field | Type |
|-------|------|
| `success` | yes/no |
| `user_id` | text (uuid) |

### Error table

| Status | Meaning | Fix |
|--------|---------|-----|
| 401 | Missing/expired JWT | Fresh admin token; `Bearer ` + space |
| 403 | Not admin / inactive admin | Sign in as admin |
| 404 | Email not a technician | Use a row from List Technicians |
| 409 | Already set password, or deactivated | Hide button when `setup_complete` is yes; use Enable for disabled techs |
| 502 | Resend API failed | Check `RESEND_API_KEY` / domain |

---

## 3. `DB - List Team` (invite / team table)

Do **not** switch this table to **List Technicians** or **DB - Get Technicians**. Get Technicians is `active=eq.true` (Assign dropdown only).

Add `setup_complete` to `select=` (keep `active`). Then **Re-initialize**.

| Setting | Exact value |
|---------|-------------|
| **Name** | `DB - List Team` |
| **Use as** | **Data** |
| **Method** | GET |
| **URL** | `https://chqljfdmgdtsmbbwbdyv.supabase.co/rest/v1/profiles?role=eq.technician&select=id,full_name,email,active,setup_complete&order=active.desc,full_name.asc&email=neq.[bust]` |
| **Include errors** | **OFF** |

If `active` is missing from the item fields, add it to `select=` and **Re-initialize**. Raw body must start with `[`. No `Accept: object+json`.

### Headers

| Header | Value | Private? | What it does |
|--------|-------|----------|--------------|
| `apikey` | anon key | **yes** | Gateway |
| `Authorization` | `Bearer <access_token>` | **no** | Admin JWT |

### URL params

| Key | Private | Initialize | Table / workflow |
|-----|---------|------------|------------------|
| `bust` | OFF | `0` | Current page’s `s_techs_ts` |
| `<access_token>` | — | Fresh **admin** JWT, `Bearer ` + token, no extra quotes | `Bearer ` + Current User’s `sb_access_token` |

`role` is already `eq.technician` in the URL — do not add a `role` param.

**Re-initialize** after changing `select=`. Raw body must start with `[`. Item fields: `id`, `full_name`, `email`, `active` (yes/no), `setup_complete` (yes/no).

---

## 4. Bind `DB - List Team` + Resend button

4.1 Table **Type of content** = `DB - List Team`  
4.2 **Data source** = Get data from API → **DB - List Team**  
- `access_token` = Current User’s `sb_access_token`  
- `bust` = `s_techs_ts`  
4.3 Conditional on the table: when `sb_access_token` is empty → **Data source = empty**  
4.4 Columns: `full_name`, `email`  
- `setup_complete` is **no** → `Pending setup`  
- `setup_complete` is **yes** and `active` is **yes** → `Active`  
- `setup_complete` is **yes** and `active` is **no** → `Disabled`  
4.5 Button **Resend invite**  
- Visible on page load: **unchecked**  
- Condition: when Current cell’s **`setup_complete` is no** → visible  
  Do **not** use `active` is no — that is also true for disabled staff.

| Step | Action | Values |
|------|--------|--------|
| 1 | Plugins → **Resend Invite** | `email` = Current cell’s `email:formatted as JSON-safe` · `access_token` = Current User’s `sb_access_token` |
| 2 | Show **RE: Alert Success** | Only when Result of step 1’s `returned_an_error` is **no** · text `Invite resent` |
| 3 | Show **RE: Failure** | Only when Result of step 1’s `returned_an_error` is **yes** · heading `Couldn't resend` · description: if `status_code` is 409 → `Password already set or this technician is deactivated` · else Result of step 1’s `body.error` (not `body_raw_text`) |
| 4 | Set state `s_techs_ts` | Only when step 1 succeeded · value = Current date/time:extract unix |

Do **not** show Resend when `active` is yes. Those people use **Forgot password**.

---

## 5. Test

- [ ] Pending tech (`active` no): Resend visible → click → email with new link → `password_setup` works  
- [ ] After they set password: row shows Active, Resend **hidden**  
- [ ] Clicking Resend on an already-active email (if you force the API) → 409  
- [ ] Deactivated tech (`set-technician-active` false): 409, not a new invite  
- [ ] Table still cache-busts on `s_techs_ts` after a new Invite  

**Invite Technician** URL must stay  
`https://chqljfdmgdtsmbbwbdyv.supabase.co/functions/v1/invite-technician`  
(not `[ref].functions.supabase.co`).
