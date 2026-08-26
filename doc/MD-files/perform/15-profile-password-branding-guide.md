# FieldQuote — Profile, password reset email, company brand (logo)

**Bubble export analysed:** `fieldquote-26446 (1).bubble`  
**Task memory:** `doc/memory/tasks/05-company-logo-r2.md` · `doc/memory/tasks/07-change-password-ui.md`  
**Architecture:** `perform/11-dynamic-company-branding-guide.md`  
**Password:** reuse existing **`Request Password Reset`** (same as `forgot_pass_email`) — not in-session `PUT /auth/v1/user`.

---

## What is already in the app

| Piece | Status |
|-------|--------|
| `Popup Update Profile` | UI copied from Edit Price — **not wired** |
| `G: Company` form | Bound to **`DB - Get Company Settings`**; **Update Company Settings** exists |
| `Image: Company Logo` | **Empty source** (Issue checker: fill Image Source) |
| Sidebar / inline **Image: Logo** | Static Bubble file — **not** `s_logo_url` |
| `DB - Get Company Brand` | Connector **initialized** — unused |
| `Request Password Reset` | Live on `forgot_pass_email` |
| `r2-presign` `kind=logo` | **Repo** — deploy before logo upload |
| Staff read `company_settings` + self PATCH `full_name` | **Migration** — `db push` before tech header / name save |

---

## Steps

1. Fix broken Confirm Edit Price conditions (profile popup)
2. Deploy backend (migration + `r2-presign`)
3. Add connectors (Patch My Profile, Patch Company Logo)
4. Wire profile popup (name + reset email) — admin then tech
5. Public brand RE (`perform/16`) — not JWT Get Company Brand
6. Company settings save + logo upload (then refresh the RE)
7. Test

---

## 1. Fix Confirm Edit Price (missing condition)

Bubble Issue on **`Popup Update Profile`**:  
**“Button: Confirm Edit Price — remember to fill out when we should show this conditional state”** plus **“[missing element] … was deleted”**.

You duplicated **Popup Edit Price**. Condition **#2** still points at the old **unit price** input (`bTTlK`). That input does not exist on the profile popup, so the condition is empty/red.

### 1.1 Header button on `Popup Update Profile` (label **Update Password**, editor name still Confirm Edit Price)

1.1.1 Select the header **Update Password** button.  
1.1.2 Open **Conditional**.  
1.1.3 **Delete** the condition whose tooltip is **“Unit price cannot be negative”** (broken Get element).  
1.1.4 Keep or replace the empty-name condition: this button is for **email reset**, so it must **not** key off the full-name input.  
1.1.5 Add one condition:

| When | Then |
|------|------|
| `Input edit price keywords` (email field, placeholder `example@gmail.com`) **is empty** | This element isn’t clickable · opacity 50% · title “Enter your email” |

Optional extra: `Input … 's value isn't a valid email` → same disabled style.

1.1.6 Rename the button in the editor to **`Button: Send Password Reset`**.

### 1.2 **Update Username** button (also still named Confirm Edit Price)

1.2.1 Select **Update Username**.  
1.2.2 **Delete** “Unit price cannot be negative” (same missing element).  
1.2.3 Keep **only**:

| When | Then |
|------|------|
| Full-name input **is empty** | Isn’t clickable · “Name cannot be empty!” |

1.2.4 Rename editor name to **`Button: Update Username`**.  
1.2.5 Rename the full-name input to **`Input: Full Name`**.  
1.2.6 Rename the email input to **`Input: Reset Email`**.

### 1.3 Real **Popup Edit Price** (price book)

Those conditions **alias** to `Input edit price name` and `Input edit price value`. If the editor still shows red:

| Condition | When | Then |
|-----------|------|------|
| 1 | `Input edit price name` is empty | Isn’t clickable · “Name cannot be empty!” |
| 2 | `Input edit price value` is empty **or** `:converted to number < 0` | Isn’t clickable · “Unit price cannot be empty/negative” |

Do **not** copy profile conditions onto this popup.

---

## 2. Backend (once)

The first push failed because **`profiles_update_own` already exists** on the remote DB. The migration now drops it first. Save the file, then:

2.1 `npx supabase db push`  
2.2 `npx supabase functions deploy r2-presign --no-verify-jwt --project-ref chqljfdmgdtsmbbwbdyv`

---

## 3. API Connector — new calls

Do **not** start UI workflows until Initialize succeeds.

### 3.1 `DB - Patch My Profile`

| Setting | Value |
|---------|--------|
| **Name** | `DB - Patch My Profile` |
| **Use as** | **Action** |
| **Method** | PATCH |
| **URL** | `https://chqljfdmgdtsmbbwbdyv.supabase.co/rest/v1/profiles?id=eq.[uid]` |
| **Include errors** | ON |

| Header | Value | Private |
|--------|--------|---------|
| `apikey` | anon key | Yes |
| `Authorization` | `Bearer [access_token]` | No |
| `Content-Type` | `application/json` | Yes |
| `Prefer` | `return=representation` | Yes |
| `Accept` | `application/vnd.pgrst.object+json` | No |

Body (unquoted placeholders):

```json
{
  "full_name": <full_name>
}
```

| Placeholder | Type | Initialize (quoted) | Workflow |
|-------------|------|---------------------|----------|
| `uid` | text (URL) | `"964e1f46-01f6-44ba-bc8c-9ca83933e24d"` (your user UUID) | `Current User's supabase_uid` |
| `full_name` | text | `"Jane Admin"` | `Input: Full Name's value:formatted as JSON-safe` |
| `access_token` | header | admin JWT | `Current User's sb_access_token` |

**Success:** one object with `id`, `full_name`, `email`, `role`.  
**Never** put another user’s id in `uid` — RLS + trigger only allow own name (admins can still change others via `admin_all`; keep the workflow on Current User).

| Status | Meaning | Fix |
|--------|---------|-----|
| 401 | Bad JWT | Token on User |
| 0 rows / 406 | Wrong `uid` or missing `Accept` | UUID = `supabase_uid`; Accept object |
| 400 exception text | Tried to change `role` / `email` | Body must be **only** `full_name` |

### 3.2 `DB - Patch Company Logo`

Separate from **Update Company Settings** so a rates save cannot wipe `logo_key`.

| Setting | Value |
|---------|--------|
| **Name** | `DB - Patch Company Logo` |
| **Use as** | **Action** |
| **Method** | PATCH |
| **URL** | `https://chqljfdmgdtsmbbwbdyv.supabase.co/rest/v1/company_settings?company_id=eq.[company_id]` |
| **Include errors** | ON |

Same headers as 3.1 (`Prefer` + `Accept` object).

```json
{
  "logo_key": <logo_key>
}
```

| Placeholder | Type | Initialize | Workflow |
|-------------|------|------------|----------|
| `company_id` | text (URL) | `"00000000-0000-0000-0000-000000000001"` | `s_company_id` or Get Brand’s `company_id` |
| `logo_key` | text | `"companies/00000000-0000-0000-0000-000000000001/logo/aaaa.png"` | Step 1 `objectKey` from Get R2 Upload URL |
| `access_token` | header | admin JWT | `Current User's sb_access_token` |

**Success:** one `company_settings` row including `logo_key`.

| Status | Meaning | Fix |
|--------|---------|-----|
| 401 / 403 | Not admin | Admin JWT |
| 0 rows | Wrong `company_id` | Use Brand / settings `company_id` |

### 3.3 `Request Password Reset` (already exists — confirm Initialize)

| Setting | Value |
|---------|--------|
| **Name** | `Request Password Reset` |
| **Use as** | **Action** |
| **Method** | POST |
| **URL** | `https://chqljfdmgdtsmbbwbdyv.supabase.co/functions/v1/request-password-reset` |
| **Include errors** | OFF |

| Header | Value | Private | Why |
|--------|--------|---------|-----|
| `apikey` | anon key | Yes | Gateway |
| `Content-Type` | `application/json` | Yes | JSON body |

No user JWT. Public function.

```json
{
  "email": <email>
}
```

| Placeholder | Type | Initialize (quotes) | Workflow |
|-------------|------|---------------------|----------|
| `email` | text | `"admin@example.com"` | `Input: Reset Email's value:formatted as JSON-safe` |

**Success shape:** `success` (yes). Unknown emails still 200.

| Status | Meaning | Fix |
|--------|---------|-----|
| 400 | Empty email | Wire the input |
| 429 | 3 / email / 24h | Wait or another address |

### 3.4 `DB - Get Company Brand` (already exists — Data)

| Setting | Value |
|---------|--------|
| **Name** | `DB - Get Company Brand` |
| **Use as** | **Data** |
| **Method** | GET |
| **URL** | `https://chqljfdmgdtsmbbwbdyv.supabase.co/rest/v1/company_settings?select=company_id,name,logo_key,updated_at` |
| **Include errors** | OFF |

| Header | Value | Private |
|--------|--------|---------|
| `apikey` | anon key | Yes |
| `Authorization` | `Bearer [access_token]` | **No** |
| `Accept` | `application/vnd.pgrst.object+json` | No |

| Placeholder | Type | Initialize | Workflow / data source |
|-------------|------|------------|------------------------|
| `access_token` | header | `Bearer ` + fresh admin JWT (**no quotes**) | `Bearer ` + `Current User's sb_access_token` |

**Success shape:** `company_id`, `name`, `logo_key` (may be empty), `updated_at`. Re-Initialize after `db push` so a **technician** JWT also returns the row.

### 3.5 `Get R2 Upload URL` (reuse — Re-initialize after deploy)

| Setting | Value |
|---------|--------|
| **Name** | `Get R2 Upload URL` |
| **Use as** | **Action** |
| **Method** | POST |
| **URL** | `https://chqljfdmgdtsmbbwbdyv.supabase.co/functions/v1/r2-presign` |
| **Include errors** | ON |

| Header | Value | Private |
|--------|--------|---------|
| `apikey` | anon key | Yes |
| `Authorization` | `Bearer [access_token]` | **No** |
| `Content-Type` | `application/json` | Yes |

```json
{
  "fileName": <fileName>,
  "contentType": <contentType>,
  "fileSize": <fileSize>,
  "kind": <kind>
}
```

| Placeholder | Type | Initialize (quotes) | Workflow (logo) |
|-------------|------|---------------------|-----------------|
| `fileName` | text | `"logo.png"` | `PU: Company Logo's value's filename:formatted as JSON-safe` (or `"logo.png"`) |
| `contentType` | text | `"image/png"` | `PU: Company Logo's value's type:formatted as JSON-safe` |
| `fileSize` | number | `12345` (no quotes) | `PU: Company Logo's value's size` (number, no JSON-safe) |
| `kind` | text | `"logo"` | type **`logo`** (plain text, not photo) |
| `access_token` | header | **admin** JWT | `Current User's sb_access_token` |

**Success shape:** `url`, `objectKey`, `mime`. `objectKey` must start with `companies/` after logo kind.

| Status | Meaning | Fix |
|--------|---------|-----|
| 401 | Missing Bearer | Add Authorization, not Private |
| 403 | Not admin | Admin JWT |
| 400 `Logo must be jpg…` | Wrong ext | png/jpg/webp/svg |

### 3.6 `Get R2 Download URL` (reuse)

| Setting | Value |
|---------|--------|
| **Name** | `Get R2 Download URL` |
| **Use as** | **Action** |
| **Method** | POST |
| **URL** | `https://chqljfdmgdtsmbbwbdyv.supabase.co/functions/v1/r2-presign` |
| **Include errors** | ON |

| Header | Value | Private |
|--------|--------|---------|
| `apikey` | anon key | Yes |
| `Authorization` | `Bearer [access_token]` | **No** |
| `Content-Type` | `application/json` | Yes |

```json
{
  "mode": <mode>,
  "key": <key>
}
```

| Placeholder | Type | Initialize (quotes) | Workflow |
|-------------|------|---------------------|----------|
| `mode` | text | `"get"` | `"get"` |
| `key` | text | `"requests/photos/bdc1fff9-a1c6-47c5-b42a-641df59989be.jpg"` (any key you already have) | `s_logo_key:formatted as JSON-safe` or step 1 `objectKey` |
| `access_token` | header | staff JWT | `Current User's sb_access_token` |

**Success shape:** `url`, `key`.

### 3.7 `Upload File to R2` (reuse)

| Setting | Value |
|---------|--------|
| **Name** | `Upload File to R2` |
| **Use as** | **Action** |
| **Method** | PUT |
| **URL** | keep the dummy R2 URL from Initialize — **workflow overwrites URL** |
| **Body type** | File |
| **Include errors** | ON |

Workflow: **URL** = `Result of step 1 (Get R2 Upload URL)'s url` · **Body** = `PU: Company Logo's value`.

### 3.8 Template vs Initialize vs workflow

`"key": <key>` unquoted in the template. Initialize `"uuid-or-path-here"`. Workflow JSON-safe for text. Header `Authorization` is never JSON-quoted.

---

## 4. User field + profile popup workflows

### 4.1 Data tab — User

4.1.1 Add field **`full_name`** (text).  
4.1.2 Privacy: User’s own data can view/modify it (same as `role`).

### 4.2 Login (existing Get My Role step)

4.2.1 After **Auth - Get My Role**, **Make changes to Current User**: `full_name` = that call’s `full_name`.  
4.2.2 Same on `technician_dashboard` login path if it is a separate workflow.

### 4.3 `Popup Update Profile` — rename leftover Edit Price labels

| Element | New editor name / text |
|---------|------------------------|
| Title | Update Profile (already) |
| Full name label | FULL NAME |
| Email label | RESET PASSWORD |
| `Input: Full Name` | Initial content = `Current User's full_name` (not `s_edit_name`) |
| `Input: Reset Email` | Initial content = `Current User's email`; placeholder email |

### 4.4 Open popup

**Button: Edit Profile** is clicked (admin menu **and** tech menu):

4.4.1 Show **Popup Update Profile**.  
4.4.2 Optional: reset the two inputs.

Copy the popup onto **`technician_dashboard`** if it is not already there (tech page already has **Edit Profile**).

### 4.5 Update Username clicked

| # | Action | Only when |
|---|--------|-----------|
| 1 | `DB - Patch My Profile` — `uid` = `Current User's supabase_uid`, `full_name` = input JSON-safe, Bearer = `sb_access_token` | Input not empty |
| 2 | Make changes to Current User: `full_name` = input | Step 1 did not return an error |
| 3 | Success snackbar | Step 1 ok |
| 4 | Failure snackbar from `_api_c2_error` | Step 1 `returned_an_error` |

### 4.6 Send Password Reset clicked

Same call as forgot-password. **Do not** call `Auth - Set new user password`.

| # | Action |
|---|--------|
| 1 | Plugins → **Request Password Reset** · `email` = `Input: Reset Email's value:formatted as JSON-safe` |
| 2 | Show “If that email exists, we sent a reset link” (always — API returns `{ success: true }` even for unknown emails) |
| 3 | Hide popup (optional) |

Rate limit: **3 / email / 24h** on the function. User then uses existing **`password_setup`** (`type=recovery`) like forgot password.

Works for **admin and technician** — no role branch.

---

## 5. Company brand on every page (including logged out)

Do **not** use `DB - Get Company Brand` + `Get R2 Download URL` for headers. That path needs a staff JWT and cannot run on `index` / `login` / `q`.

Full connector + reusable + state map: **`perform/16-public-company-brand-re-guide.md`**.

Short version: deploy `company-brand` → Data call **FN - Get Company Brand** (apikey only, no Authorization) → reusable **RE: Company Brand** with states `s_company_id` / `s_company_name` / `s_logo_key` / `s_logo_url` → drop **once** per page → extra images bind that RE’s `s_logo_url`.

---

## 6. Company settings + logo upload (admin only)

### 6.1 Rates / name — existing **Update Company Settings**

6.1.1 Confirm workflow is on **Button: Update Company** (aliased from old `bTIHr`).  
6.1.2 `company_id` URL param = `s_company_id` or Parent group’s `company_id` (private hardcoded UUID is OK for v1).  
6.1.3 `name` = `Input company name:formatted as JSON-safe`.  
6.1.4 Numbers: deposit, tax, validity, labor — **no** JSON-safe.  
6.1.5 Add **`working_hours`** to the connector body if the hours input should persist:

```json
{
  "name": <name>,
  "deposit_pct": <deposit_pct>,
  "tax_pct": <tax_pct>,
  "quote_validity_days": <quote_validity_days>,
  "labor_rate": <labor_rate>,
  "working_hours": <working_hours>
}
```

Re-Initialize after adding the key. `working_hours` is text (JSON-safe).  
6.1.6 After success: Trigger custom event **`ce_refresh_brand`** on **RE: Company Brand** (headers pick up the new name). Optional: also set page `s_company_name` if anything else still reads it.

Hide **Update Company** on the technician page (they have a copied form — tech must **not** PATCH settings).

### 6.2 Logo uploader

6.2.1 On `G: Company Form Header`, add **PictureUploader** `PU: Company Logo` (jpg/png/webp).  
6.2.2 Keep **Image: Company Logo** as preview: dynamic image = `RE: Company Brand's s_logo_url`.

**When PU’s value is changed** (admin):

| # | Action |
|---|--------|
| 1 | **Get R2 Upload URL** · `fileName` = PU’s filename JSON-safe · `fileSize` = PU’s file size · `kind` = `logo` (plain text) · `contentType` = PU’s type · Bearer admin JWT |
| 2 | **Upload File to R2** · file = PU’s value · URL = step 1’s `url` |
| 3 | **DB - Patch Company Logo** · `logo_key` = step 1’s `objectKey` JSON-safe · `company_id` = `RE: Company Brand's s_company_id` (or page `s_company_id` if you synced it) |
| 4 | Trigger custom event **`ce_refresh_brand`** on **RE: Company Brand** |
| 5 | Snackbar success |

Do **not** save the Bubble CDN URL into `logo_key`. Do **not** call **Get R2 Download URL** for the header — the public function returns `logo_url`.

---

## 7. Test

- [ ] Profile popup: Issue checker clean on the two buttons (no missing element)
- [ ] Update Username → Table Editor `profiles.full_name` changes; menu still shows new name after refresh
- [ ] Tech can change **own** name; cannot PATCH another id
- [ ] Send reset → same email as forgot password → `password_setup` works; login with new password
- [ ] Unknown email still shows success (no account-enumeration)
- [ ] Admin upload logo → `company_settings.logo_key` starts with `companies/…/logo/`
- [ ] Admin + tech headers show the same logo via **RE: Company Brand** (one `company-brand` GET per page)
- [ ] Tech Get Brand 200; tech Patch Company Logo 403
- [ ] Update Company still saves rates; logo unchanged
- [ ] `tests/rls/negative.sql` still passes (tech **reads** one settings row, **cannot** update it)

---

## File checklist

| Kind | Path |
|------|------|
| Migration | `supabase/migrations/20260824150000_profile_name_and_staff_brand.sql` |
| Edge | `supabase/functions/r2-presign/index.ts` + `company-brand/index.ts` |
| Shared | `supabase/functions/_shared/company.ts` (`companyLogoPublicUrl`) |
| Env | `.env.example` → `R2_PUBLIC_BASE_URL` |
| This guide | `doc/MD-files/perform/15-profile-password-branding-guide.md` |
| Brand RE | `doc/MD-files/perform/16-public-company-brand-re-guide.md` |
