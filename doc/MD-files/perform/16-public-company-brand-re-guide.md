# FieldQuote — Public company brand reusable (any page, no JWT)

**Task memory:** `doc/memory/tasks/19-profile-brand-password.md`  
**Architecture:** `perform/11-dynamic-company-branding-guide.md` (R2 keys, email)  
**Profile / password / logo upload:** `perform/15-profile-password-branding-guide.md`

Chrome (logo + company name) is **not** a logged-in PostgREST call. A reusable dropped on any page calls a **public** edge function. Rates never leave the server.

---

## Why this shape

| Wrong | Why | Right |
|-------|-----|--------|
| Anon `GET /company_settings` | Row includes `labor_rate`, deposit, tax | Function selects **only** `company_id, name, logo_key` |
| `DB - Get Company Brand` + JWT | Login / `q` / `index` have no staff JWT | `FN - Get Company Brand` — **no** `Authorization` |
| `r2-presign` GET from the page | Needs staff JWT; signed URL not built in Bubble | Function returns ready `logo_url` |
| One RE instance per logo | 4 drops = 4 public calls | **One** RE per page; extra images bind that instance’s states |
| Cache `s_logo_url` on User forever | Signed GET URLs expire (~24h) | Refetch when the RE loads |

---

## Steps

1. Deploy `company-brand`
2. Add `FN - Get Company Brand`
3. Build `RE: Company Brand` (states + elements)
4. Drop once on every page and bind extra logos
5. Refresh the RE after admin logo upload
6. Test

---

## 1. Deploy `company-brand`

Public GET. Gateway JWT **off**. Service role **after** IP rate limit (60 / minute). Response never includes rates.

1.1 From the repo root:

```bash
npx supabase functions deploy company-brand --no-verify-jwt --project-ref chqljfdmgdtsmbbwbdyv
```

1.2 Confirm `config.toml` has `verify_jwt = false` for `[functions.company-brand]`.

1.3 Optional secrets (already used elsewhere):

| Secret | If set | If unset |
|--------|--------|----------|
| `R2_PUBLIC_BASE_URL` | `logo_url` = that origin + `logo_key` | Function signs a private R2 GET (~24h) |
| `EMAIL_ASSET_BASE_URL` | Fallback image when `logo_key` is empty | `logo_url` is `null` → wordmark only |

1.4 Smoke (no Bearer):

```bash
curl -sS "https://chqljfdmgdtsmbbwbdyv.supabase.co/functions/v1/company-brand" \
  -H "apikey: YOUR_ANON_KEY"
```

Expect JSON: `company_id`, `name`, `logo_key` (or `null`), `logo_url` (or `null`). **Never** `labor_rate` / `deposit_pct` / `tax_pct`.

---

## 2. Add `FN - Get Company Brand`

Do **not** reuse `DB - Get Company Brand` (PostgREST + JWT). Leave that connector unused for chrome.

### 2.1 Connector

| Setting | Value |
|---------|--------|
| **Name** | `FN - Get Company Brand` |
| **Use as** | **Data** |
| **Why Data** | Feeds the reusable’s type of content / Image without a workflow on every page |
| **Method** | GET |
| **URL** | `https://chqljfdmgdtsmbbwbdyv.supabase.co/functions/v1/company-brand` |
| **Body** | none |
| **Include errors** | **OFF** — chrome fails closed to wordmark; do not surface `body_raw_text` |

### 2.2 Headers

| Header | Value | Private | What it does |
|--------|--------|---------|--------------|
| `apikey` | same anon / publishable key as the API group | **Yes** | Supabase gateway. Never service_role. |

**Do not add `Authorization`.** No JWT, no `Bearer <empty>`. If the API group shares an Authorization header, **remove it on this call only**.

No `Accept: application/vnd.pgrst.object+json` (this is not PostgREST). No `Content-Type` required on GET.

### 2.3 Placeholders

None. No query params. Template is empty.

### 2.4 Initialize

Click **Initialize call**. No quoted UUID. Success JSON field names Bubble will show:

| Field | Meaning |
|-------|---------|
| `company_id` | Sole company UUID |
| `name` | Display name (`Your company` if DB name blank) |
| `logo_key` | R2 object key or empty |
| `logo_url` | HTTPS image URL, or empty |

### 2.5 Errors (if you later turn Include errors ON)

| Status | Meaning | Fix |
|--------|---------|-----|
| 401 No API key | Missing `apikey` | Shared Private header |
| 405 | Not GET | Method GET |
| 429 | 60 / IP / minute | One RE per page; wait |
| 500 Brand unavailable | No / multiple `company_settings` rows | Seed one company |

Template rule: this call has **no** `"key": <key>` body. Shared-header `apikey` is static (not JSON-safe).

---

## 3. Build `RE: Company Brand`

New reusable. Not SessionKeeper. Not G: Brand Cache. Not G: Company.

### 3.1 Reusable shell

3.1.1 Design → **Reusable elements** → New → name **`RE: Company Brand`**.  
3.1.2 Type of content: **`FN - Get Company Brand`** (the API type from §2).  
3.1.3 Data source: **Get data from an external API** → **FN - Get Company Brand**.  
3.1.4 Layout: row, fit width/height to the logo slot (e.g. 160 × 40). Not collapse-when-hidden on the RE itself (it must mount so the Data call runs).  
3.1.5 Background transparent.

### 3.2 Custom states **on the reusable** (canonical cache)

Create these **on `RE: Company Brand`**, not on each page. Default all empty.

| State | Type | Default | Set from |
|-------|------|---------|----------|
| `s_company_id` | text | empty | Parent group’s `company_id` |
| `s_company_name` | text | empty | Parent group’s `name` |
| `s_logo_key` | text | empty | Parent group’s `logo_key` |
| `s_logo_url` | text | empty | Parent group’s `logo_url` |

Page images **outside** the RE cannot read “Parent group of the RE”. They bind **`RE: Company Brand A's s_logo_url`**.

### 3.3 Elements **inside** the RE

| Editor name | Type | Data | Visible when |
|-------------|------|------|----------------|
| `Img: Brand Logo` | Image | Dynamic image = **This reusable’s `s_logo_url`** (or Parent group’s `logo_url`) · source is a **URL**, not a Bubble file | `s_logo_url` is not empty |
| `Text: Brand Wordmark` | Text | `s_company_name` fallback `"FieldQuote"` | `s_logo_url` **is empty** |

Do not put rates, settings forms, or HTML uploaders in this RE.

### 3.4 Workflow **inside** the RE

**When this reusable is loaded** (or **Do when** Parent group’s `company_id` is not empty):

| # | Action |
|---|--------|
| 1 | Set `s_company_id` = Parent group’s `company_id` |
| 2 | Set `s_company_name` = Parent group’s `name` |
| 3 | Set `s_logo_key` = Parent group’s `logo_key` |
| 4 | Set `s_logo_url` = Parent group’s `logo_url` |

**Custom event `ce_refresh_brand`** (for logo upload):

| # | Action |
|---|--------|
| 1 | Display data in This reusable → Get data **FN - Get Company Brand** |
| 2 | Set the four states from that result (same as load) |

No login condition. No `Current User's sb_access_token`.

---

## 4. Drop once per page + bind extra logos

### 4.1 Pages (one instance named `RE: Company Brand`)

| Page | Where | Notes |
|------|--------|--------|
| `index` | Replace **Img: Logo** | Public intake |
| `login` | Header / card logo | No SessionKeeper JWT needed for brand |
| `forgot_pass_email` | Header | Public |
| `password_setup` | Header | Public (token in URL is not a staff JWT) |
| `q` | Header | Customer quote — no staff JWT |
| `q-success` | Header | Public |
| `admin_dashboard` | Sidebar logo slot | Keep **one** instance; see §4.2 |
| `technician_dashboard` | Sidebar logo slot | Same |

Do **not** drop the RE on SessionKeeper. SessionKeeper stays JWT refresh only.

### 4.2 Extra images on admin / tech (same page, same fetch)

Leave extra Image elements in place. Bind them to the **one** RE instance.

| Element | Dynamic image | Visible when |
|---------|---------------|--------------|
| `Image: Logo` / `Img: Logo` | `RE: Company Brand's s_logo_url` | that state is not empty |
| `Img: Inline Logo` | same | same |
| `Img: Mobile Logo` / `Img: Logo Mobile` | same | same |
| `Image: Company Logo` (settings preview) | same | same |
| Wordmark next to those images | `RE: Company Brand's s_company_name` | `s_logo_url` is empty |

If the sidebar logo **is** the RE, do not also bind that same Image to the RE (double logo). Extra copies only.

### 4.3 Page custom states — map (do not recreate for chrome)

**`admin_dashboard` already has:**

| Existing page state | Keep? | Bind chrome to it? |
|---------------------|-------|---------------------|
| `s_company_id` | Yes if Company settings PATCH still uses it | Optional: on RE loaded, also set **this page’s** `s_company_id` = RE’s `s_company_id` so **Update Company Settings** URL still works |
| `s_company_name` | Optional | Prefer RE state; or sync from RE for old text bindings |
| `s_logo_key` | Optional | Admin upload PATCH can use **RE’s** `s_company_id` |
| `s_logo_url` | **Two copies exist — delete one** | **Do not** use for chrome. Bind images to the RE |
| `s_logo_url` (duplicate) | **Delete** | — |

**`technician_dashboard` already has:**

| Existing page state | Keep? |
|---------------------|-------|
| `s_logo_url` | Unused for chrome after this. Safe to leave empty or delete later |

**`login` / `index` / `q` / `q-success` / `forgot_pass_email` / `password_setup`:** add **no** brand page states. The RE holds them.

### 4.4 Optional sync workflow (admin only)

Only if **Update Company Settings** still reads `Current page's s_company_id`:

**When `RE: Company Brand` is loaded** (page workflow, not inside RE):

| # | Action | Only when |
|---|--------|-----------|
| 1 | Set page `s_company_id` = `RE: Company Brand's s_company_id` | that value not empty |
| 2 | Set page `s_company_name` = `RE: Company Brand's s_company_name` | optional |

Do **not** copy `s_logo_url` onto the page.

### 4.5 Stop using

| Call / group | For chrome? |
|--------------|-------------|
| `DB - Get Company Brand` | **No** |
| `Get R2 Download URL` for the header | **No** |
| `G: Brand Cache` | Remove if you added it |
| `G: Company` Settings Data for header logos | **No** — still used for **rates form** only. Keep collapsed if you want; logos no longer depend on it |

---

## 5. Dashboard logos + Change logo (HTML button)

Technician: **bind chrome only** — no uploader. Admin Company tab: **Bubble Image: Company Logo** for preview + HTML **Change logo** button (hidden `<input type="file">`). No HTML thumbnail. Upload uses **admin JWT** `r2-presign` `kind=logo`. JS does **not** PATCH the DB — it hands `objectKey` to Bubble.

### 5.1 Bind chrome (`admin_dashboard` + `technician_dashboard`)

Drop **one** `RE: Company Brand` on each page if not already there (sidebar). Do not collapse it.

| Element | Dynamic image (URL) | Visible when |
|---------|---------------------|--------------|
| `Image: Logo` / `Img: Logo` | `RE: Company Brand's s_logo_url` | that state is not empty |
| `Img: Inline Logo` (admin) | same | same |
| `Img: Mobile Logo` / `Img: Logo Mobile` | same | same |
| Wordmark (optional) | `RE: Company Brand's s_company_name` | `s_logo_url` is empty |

Remove the static Bubble CDN file from those Image elements.

On **technician_dashboard**: hide any Company logo uploader / HTML (tech cannot PATCH `logo_key`).

### 5.2 Admin Company tab — elements

On `G: Company Form Header` (admin only):

5.2.1 Keep **Image: Company Logo** as the preview: dynamic image = `RE: Company Brand's s_logo_url`. Do **not** add a second preview in HTML.  
5.2.2 Add **HTML** element `HTML: Logo Upload` (visible, not collapsed). Paste §5.5.  
5.2.3 Add Toolbox **Javascript to Bubble** on the **page** (same pattern as SessionKeeper):

| Field | Value |
|-------|--------|
| **Bubble function suffix** | `logo_key` (only the suffix — JS will call `bubble_fn_logo_key`) |
| **Publish value** | yes · type **text** |
| **Trigger event** | yes |

5.2.4 Do **not** use a PictureUploader for this path.

### 5.3 Run JavaScript — bind uploader (when Company panel is shown)

**When** `G: Company` is visible (Workflow A). Also run when `s_logo_url` **is changed** (Workflow B) so the JWT stays current.

Toolbox **Run JavaScript** — **only** this (no `fqSetLogoPreview`):

```javascript
fqInitLogoUploader({
  accessToken: "TOKEN_PILL",
  apikey: "PASTE_SAME_ANON_OR_PUBLISHABLE_KEY_AS_API_CONNECTOR",
  presignUrl: "https://chqljfdmgdtsmbbwbdyv.supabase.co/functions/v1/r2-presign"
});
```

**Delete any `fqSetLogoPreview(...)` line.** The HTML no longer defines that function. If it stays first, the script throws and **`fqInitLogoUploader` never runs** → status **Missing token or apikey** even though the token pills look correct.

Build the token as: type `"`, **Insert dynamic data** (blue pill only), type `"`.  
**Do not type `<<<` or `>>>`.** Those were placeholders. If they stay, the JWT becomes `<<<eyJ…>>>` and `r2-presign` returns **Invalid session**.

| Piece | Insert (blue pill only) |
|-------|-------------------------|
| `accessToken` | `Current User's sb_access_token` — **not** `:formatted as JSON-safe`, **not** `Bearer ` (JS adds Bearer) |

Turn **Asynchronous OFF** on this Run JavaScript.

If `fqInitLogoUploader is not defined`: HTML is hidden or not on this page. Run this **after** the Company tab is visible so the HTML script has already defined the function.

The picker itself does **not** wait for this Run JS. Tokens do — pick a file before init and you will see “Missing token or apikey”.

### 5.4 After JS upload — Bubble workflow

**When** Javascript to Bubble `logo_key` is triggered:

| # | Action | Only when |
|---|--------|-----------|
| 1 | **DB - Patch Company Logo** · `logo_key` = `logo_key's value:formatted as JSON-safe` · `company_id` = `RE: Company Brand's s_company_id` · Bearer = `sb_access_token` | value starts with `companies/` |
| 2 | Trigger custom event **`ce_refresh_brand`** on **RE: Company Brand** | step 1 did not error |
| 3 | Success snackbar | step 1 ok |
| 4 | Failure snackbar | step 1 `returned_an_error` |

Do **not** save a Bubble CDN URL. After refresh, **Image: Company Logo** updates from `s_logo_url`.

### 5.5 HTML to paste (`HTML: Logo Upload`)

The file picker must be the thing you click. Do **not** hide the input with `display:none` and then `input.click()` — browsers (and Bubble) block that. The input sits on top of the button (`opacity:0`).

```html
<div id="fq-logo-root" style="width:100%;display:flex;flex-direction:column;gap:8px;align-items:flex-start;">
  <label id="fq-logo-btn" for="fq-logo-file"
    style="position:relative;display:inline-block;cursor:pointer;border:0;border-radius:8px;padding:10px 16px;background:#0B1D2C;color:#fff;font-size:14px;line-height:1.2;">
    Change logo
    <input id="fq-logo-file" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml,.png,.jpg,.jpeg,.webp,.svg"
      style="position:absolute;left:0;top:0;width:100%;height:100%;opacity:0;cursor:pointer;font-size:0;" />
  </label>
  <div id="fq-logo-status" style="font-size:13px;color:#5B6B7A;"></div>
</div>
<script>
/* no-op: old Run JS may still call this; preview is Bubble Image only */
window.fqSetLogoPreview = function () {};

(function () {
  if (window.__fqLogoChangeBound) return;
  window.__fqLogoChangeBound = true;
  document.addEventListener('change', function (e) {
    var input = e.target;
    if (!input || input.id !== 'fq-logo-file') return;
    var file = input.files && input.files[0];
    input.value = '';
    if (!file) return;
    window.fqUploadCompanyLogo(window.__fqLogoOpts || {}, file, document.getElementById('fq-logo-status'));
  }, true);
})();

window.fqInitLogoUploader = function (opts) {
  window.__fqLogoOpts = opts || {};
};

window.fqUploadCompanyLogo = async function (opts, file, statusEl) {
  var setStatus = function (t, ok) {
    if (!statusEl) return;
    statusEl.style.color = ok === false ? '#c0392b' : '#5B6B7A';
    statusEl.textContent = t || '';
  };
  opts = opts || window.__fqLogoOpts || {};
  var token = String(opts.accessToken || '').trim();
  if (token.toLowerCase().indexOf('bearer ') === 0) token = token.slice(7).trim();
  if (!token || !opts.apikey || !opts.presignUrl) {
    setStatus('Missing token or apikey', false);
    return;
  }
  if (token.indexOf('eyJ') !== 0) {
    setStatus('Invalid session — use Current User\'s sb_access_token (not apikey, not JSON-safe)', false);
    return;
  }
  var name = String(file.name || 'logo.png');
  var ext = (name.split('.').pop() || '').toLowerCase();
  if (['jpg', 'jpeg', 'png', 'webp', 'svg'].indexOf(ext) < 0) {
    setStatus('Use jpg, png, webp, or svg', false);
    return;
  }
  setStatus('Uploading…');
  try {
    var presign = await fetch(opts.presignUrl, {
      method: 'POST',
      headers: {
        apikey: opts.apikey,
        Authorization: 'Bearer ' + token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        fileName: name,
        contentType: file.type || (ext === 'svg' ? 'image/svg+xml' : 'image/png'),
        fileSize: file.size,
        kind: 'logo'
      })
    });
    var body = await presign.json().catch(function () { return {}; });
    if (!presign.ok) {
      setStatus(body.error || 'Upload not allowed', false);
      return;
    }
    var put = await fetch(body.url, {
      method: 'PUT',
      headers: { 'Content-Type': body.mime || file.type || (ext === 'svg' ? 'image/svg+xml' : 'image/png') },
      body: file
    });
    if (!put.ok) {
      setStatus('Could not store file', false);
      return;
    }
    if (typeof bubble_fn_logo_key === 'function') bubble_fn_logo_key(body.objectKey);
    else setStatus('Uploaded but bubble_fn_logo_key missing — Patch did not run', false);
    setStatus('Saved');
  } catch (e) {
    setStatus('Try again later', false);
  }
};
</script>
```

Keep the HTML **visible** on the Company tab (same rule as admin media HTML). Click **Change logo** — the invisible file input is on top of the label, so the OS picker opens without extra JS. There is no PictureUploader. Do not stack another Bubble group on top of this HTML (it would steal the click).

---

## 6. Test

- [ ] Logged **out**: `index`, `login`, `forgot_pass_email`, `q` show name/logo  
- [ ] Logged **in** admin + tech: same chrome as public  
- [ ] Network: one `company-brand` GET per page load (not one per image)  
- [ ] Response has no `labor_rate` / `deposit_pct` / `tax_pct`  
- [ ] Empty `logo_key`: wordmark, no broken image  
- [ ] Admin uploads logo → headers update without reload (custom event)  
- [ ] Duplicate `s_logo_url` on admin deleted  

---

## Connector cheat sheet (chrome vs admin)

| Name | Auth | Use |
|------|------|-----|
| **FN - Get Company Brand** | apikey only | RE on every page |
| `DB - Get Company Settings` | staff JWT | Admin rates form only |
| `DB - Get Company Brand` | staff JWT | **Unused** for chrome |
| `Get R2 Upload URL` `kind=logo` | **admin** JWT | Upload only |
| `DB - Patch Company Logo` | **admin** JWT | Persist `logo_key` only (never a Bubble CDN URL) |

`"key": <key>` unquoted in PATCH templates. Initialize with a quoted example key. Workflow `:formatted as JSON-safe`. `Authorization` on those admin calls is **not** Private.

---

## Files

| Kind | Path |
|------|------|
| Edge | `supabase/functions/company-brand/index.ts` |
| Config | `supabase/config.toml` `[functions.company-brand]` |
| This guide | `doc/MD-files/perform/16-public-company-brand-re-guide.md` |
