# FieldQuote — Dynamic company name + logo (branding)

**Task memory:** `doc/memory/tasks/05-company-logo-r2.md`  
**Depends on:** `r2-presign`, existing `DB - Get Company Settings` / Update Settings (guide P02), `_shared/company.ts` + `email-layout.ts`  
**Do after:** Admin Assign/Cancel visibility (done or stable)

---

## Goal

- Admin edits **company name** and uploads **logo** once.
- Logo lives in **R2**; DB stores **`logo_key` only** (§13 R9) — never Bubble file storage.
- **Admin + technician** headers show the same name + logo from a **cached** page/App load (not one API call per RG).
- Outbound emails use `company_settings.name` + logo URL (fallback to static landing logo if `logo_key` is null).

---

## Architecture (efficient)

```
Admin upload → r2-presign kind=logo (PUT) → R2
            → PATCH company_settings.logo_key (+ name)
Page load   → Get Company Brand (name, logo_key, updated_at)
            → GET presign logo → s_company_name, s_logo_url, s_brand_updated_at
Headers     → bind those states only (no refetch)
Emails      → fetchCompanyBrand + public/presigned logo URL at send time
```

**Do not** build an edge function whose job is to “save the logo into Bubble.”

---

## Steps (roadmap)

1. Extend `r2-presign` for company logo PUT/GET  
2. Env: `R2_PUBLIC_BASE_URL` (emails)  
3. Wire `brandedEmailHtml` to company logo  
4. Deploy functions  
5. Bubble: Get Brand + Patch Settings + logo upload  
6. Cache brand on SessionKeeper / page load  
7. Bind headers (admin + tech)  
8. Test  

---

## 1. Backend — `r2-presign` logo support

File: `supabase/functions/r2-presign/index.ts`

### 1.1 PUT `kind: "logo"` (admin only)

- Resolve `company_id` from the admin’s `profiles.company_id` (or sole company).
- Object key: `companies/{company_id}/logo/{uuid}.{ext}`
- Images only (`jpg` / `jpeg` / `png` / `webp`); size cap same as photo.
- Response: `{ url, objectKey, mime }` (same shape as other PUTs).

### 1.2 GET

- Keys matching `companies/.../logo/` → allow **admin + technician** (staff JWT), same as job photos pattern.
- Keep existing `requests/` GET as admin-only.
- Keep `jobs/{id}/photos/` for assigned staff.

### 1.3 Deploy

```bash
npx supabase functions deploy r2-presign --no-verify-jwt
```

(Gateway JWT off if that’s already how this function is configured; staff JWT still checked in Deno.)

---

## 2. Env — public logo base for email

Emails need a **stable HTTPS** URL (Resend / Gmail). Prefer a public R2 custom domain or CDN.

Add to `.env.example` (name only):

```
R2_PUBLIC_BASE_URL=
```

Example value (not committed): `https://assets.yourdomain.com` or R2 public bucket URL **with no trailing slash**.

Logo URL at send time:

```
{R2_PUBLIC_BASE_URL}/{logo_key}
```

If `R2_PUBLIC_BASE_URL` or `logo_key` missing → keep today’s `EMAIL_ASSET_BASE_URL` + `/logos/logo-email.png` fallback.

```bash
npx supabase secrets set R2_PUBLIC_BASE_URL=https://YOUR-PUBLIC-BASE
```

---

## 3. Backend — email layout uses company logo

Files:

- `supabase/functions/_shared/email-layout.ts` — accept optional `logoUrl` on `BrandedEmailArgs`; prefer it over `emailLogoUrl()`.
- `supabase/functions/_shared/company.ts` — already returns `name` + `logo_key`.
- Callers that already use `fetchCompanyBrand` (`send-quote`, `invite-technician`, `resend-invite`, `send-final-invoice`, deposit notify in `stripe-webhook`, etc.): build `logoUrl` from `R2_PUBLIC_BASE_URL` + `logo_key` and pass into `brandedEmailHtml`.

Redeploy every function that imports the shared layout after the change.

---

## 4. Bubble — API Connector

### 4.1 `DB - Get Company Brand` (Data) — narrow select for headers

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
| `Authorization` | `Bearer [access_token]` | No |
| `Accept` | `application/vnd.pgrst.object+json` | No |

Initialize with **admin** JWT (tech can use later if RLS allows read).

**Why not full Get Company Settings for headers:** avoids binding `labor_rate` / deposit into chrome; settings panel can keep the full call.

### 4.2 `DB - Patch Company Settings` (Action) — if not already present

| Setting | Value |
|---------|--------|
| **Name** | `DB - Patch Company Settings` |
| **Use as** | **Action** |
| **Method** | PATCH |
| **URL** | `https://chqljfdmgdtsmbbwbdyv.supabase.co/rest/v1/company_settings?company_id=eq.[company_id]` |
| **Include errors** | ON |

| Header | Value | Private |
|--------|--------|---------|
| `apikey` | anon key | Yes |
| `Authorization` | `Bearer [access_token]` | No |
| `Content-Type` | `application/json` | No |
| `Prefer` | `return=representation` | No |
| `Accept` | `application/vnd.pgrst.object+json` | No |

Body template (unquoted placeholders):

```json
{
  "name": <name>,
  "logo_key": <logo_key>
}
```

| Placeholder | Type | Initialize | Workflow |
|-------------|------|------------|----------|
| `company_id` | text (URL) | real company UUID bare | from Get Brand / fixed company id |
| `name` | text | `"Acme HVAC"` | Input name `:formatted as JSON-safe` |
| `logo_key` | text | `"companies/.../logo/….png"` | after upload, or omit key if name-only patch (use a name-only body variant if easier) |
| `access_token` | header | admin JWT | `Current User's sb_access_token` |

For **name-only** saves, either optional `logo_key` or a second call body with only `name`.

### 4.3 R2 — logo upload / view

Reuse existing r2-presign Action(s).

**Upload body (after logo kind ships):**

```json
{
  "fileName": <fileName>,
  "kind": "logo",
  "fileSize": <fileSize>
}
```

**View body:**

```json
{
  "mode": "get",
  "key": <key>
}
```

`Authorization`: `Bearer ` + admin (upload) or staff (get) JWT.

---

## 5. Bubble — page / SessionKeeper states (cache)

On `admin_dashboard` and `technician_dashboard` (or once on SessionKeeper):

| State | Type | Meaning |
|-------|------|---------|
| `s_company_name` | text | Display name |
| `s_logo_url` | text | Signed or public URL for `<img>` |
| `s_logo_key` | text | R2 key (for re-sign / save) |
| `s_brand_updated_at` | date | Skip refetch if settings not newer |
| `s_company_id` | text | For PATCH URL |

### 5.1 Load brand (once per session / page load)

**When** SessionKeeper / page is loaded (user logged in, token present):

| # | Action |
|---|--------|
| 1 | Get data / Action: **Get Company Brand** | Bearer + `sb_access_token` |
| 2 | Set `s_company_name` = result’s `name` |
| 3 | Set `s_logo_key` = result’s `logo_key` |
| 4 | Set `s_company_id` = result’s `company_id` |
| 5 | Set `s_brand_updated_at` = result’s `updated_at` |
| 6 | If `logo_key` not empty → **r2-presign GET** → set `s_logo_url` = result’s `url` |
| 7 | If `logo_key` empty → clear `s_logo_url` (show text wordmark) |

Optional later: only run step 1 if `s_brand_updated_at` empty or you know settings changed.

### 5.2 After admin saves logo/name

Update the same states from PATCH + new GET presign — **do not** refetch every table.

---

## 6. Bubble — UI

### 6.1 Headers (admin + tech)

| Element | Bind |
|---------|------|
| Brand text | `s_company_name` (fallback `"FieldQuote"` only if empty) |
| Logo image | `s_logo_url` — visible when not empty |
| Wordmark text | visible when `s_logo_url` is empty |

### 6.2 Company Settings panel (admin)

| Control | Behavior |
|---------|----------|
| Input name | Default from Get Brand / Get Settings |
| File picker + Upload | Presign `kind=logo` → PUT file to `url` → PATCH `logo_key` = `objectKey` |
| Preview | Image = `s_logo_url` |
| Save name | PATCH `name` only |
| Rates (deposit/tax/…) | Existing Get/Patch Company Settings (unchanged) |

Upload workflow sketch:

1. Get R2 upload URL (`kind=logo`, `fileName`, `fileSize`)  
2. PUT file to returned `url` (Toolbox / HTML JS same as intake photos)  
3. Patch Company Settings `logo_key` = step 1’s `objectKey`  
4. Presign GET → set `s_logo_url`  
5. Snackbar success (when snackbars exist)

---

## 7. RLS / security notes

- `logo_key` is not secret; signed GET URLs are time-limited if private bucket.
- Technicians: brand read is fine; **must not** PUT logo (admin only in `r2-presign`).
- Prefer **Get Company Brand** (`name`, `logo_key`, `updated_at` only) on tech pages so rates aren’t pulled into chrome (RLS still returns columns if they call full settings — keep tech UI on Brand call).

---

## 8. Test plan

- [ ] Admin upload → `company_settings.logo_key` set in Table Editor  
- [ ] Admin header shows new logo + name without refreshing every RG  
- [ ] Tech header shows same name/logo after login load  
- [ ] Tech cannot upload logo (403)  
- [ ] Send quote / invite email shows company name + new logo (or static fallback if null)  
- [ ] Clear `logo_key` → UI wordmark + email fallback  
- [ ] Replace logo → old key unused; new key in settings  

---

## 9. Out of scope

- Missed / reschedule workflows  
- Profile / change-password  
- Storing Bubble CDN URLs in `logo_key`  
- Per-list refetch of company settings  

---

## File checklist

| Kind | Path |
|------|------|
| Edge | `supabase/functions/r2-presign/index.ts` |
| Shared | `supabase/functions/_shared/email-layout.ts` |
| Shared | `supabase/functions/_shared/company.ts` |
| Env | `.env.example` → `R2_PUBLIC_BASE_URL` |
| Memory | `doc/memory/tasks/05-company-logo-r2.md` |
| This guide | `doc/MD-files/perform/11-dynamic-company-branding-guide.md` |
