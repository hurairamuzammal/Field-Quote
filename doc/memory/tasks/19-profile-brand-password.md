# Profile name + password reset email + company brand

**Status:** DONE (logo HTML picker + Run JS polish 2026-08-26)  
**Guide:** `doc/MD-files/perform/16-public-company-brand-re-guide.md` (chrome) · `perform/15` (profile + upload)  
**Last updated:** 2026-08-26  
**Bubble export:** `fieldquote-26446 (3).bubble`

---

## Paste for new chat (5–10 lines)

- **Done:** public `company-brand` + RE:Brand; admin logo upload (`r2-presign` `kind=logo` → Patch `logo_key` from JS2B); App Data `brand` singleton; profile name + password via `request-password-reset`.
- Emails: `resolveEmailLogoUrl(logo_key)` = `R2_PUBLIC_BASE_URL` + key (not signed URLs; else static/wordmark).
- Keep secret `R2_PUBLIC_BASE_URL` set if inboxes must show the real company logo.
- **Logo upload HTML (2026-08-26):** no HTML thumbnail — Bubble Image only. File picker = `<label>` + `opacity:0` input (never `display:none` + `input.click()`). Run JS must **only** call `fqInitLogoUploader({…})` — leftover `fqSetLogoPreview` throws and skips init → **Missing token or apikey**. Login/`sb_access_token` wiring is fine.

---

## Goal

Logged-in admin/tech can change display name and request a password email; admin uploads one R2 logo; every page shows brand via public `company-brand`; Resend emails use DB logo.

## Decisions (locked)

| Decision | Choice | Why |
|----------|--------|-----|
| Password | Existing `request-password-reset` | Same as forgot |
| Logo chrome | Public `company-brand` + RE | Login-agnostic; rates never exposed |
| Logo upload | R2 `logo_key` + admin JWT | §13 R9 |
| Brand cache | App Data type `brand` singleton | Shared across admin/tech/public |
| Email logo | `R2_PUBLIC_BASE_URL` + `logo_key` | Signed URLs expire in inboxes |

## Done

- [x] `r2-presign` `kind=logo` PUT + staff GET
- [x] Migration staff brand read + own `full_name` PATCH
- [x] Guides `perform/15` + `perform/16` + `company-brand` function
- [x] Bubble: RE, Brand type, Patch from JS2B `objectKey`, profile/password
- [x] Emails: all branded senders pass `resolveEmailLogoUrl` (invite, reset, quote, stripe, invoice, checkout decline, waitlist, followups, daily-reminders)

## Pitfalls (keep)

| Issue | Fix |
|-------|------|
| Patch wrote RE `s_logo_key` (stale) | Use JS2B `logo_key` value JSON-safe |
| Create Brand empty fields | Put name/logo_key/logo_url on Create |
| RE Img: Brand Logo visible | Hide; bind sidebar to Brand Search |
| Tech Live admin-only | Remove role gate on `bubble_fn_live` |
| Email shows static PNG | Set `R2_PUBLIC_BASE_URL` secret |
| Change logo does not open picker | Do not `display:none` + `input.click()`; overlay opaque-0 file input on label |
| **Missing token or apikey** after pick | Run JS still calls `fqSetLogoPreview` (removed from HTML) → crash before `fqInitLogoUploader`. Delete that line. Confirm `__fqLogoOpts` in console |
| SVG upload | `accept` includes `.svg` / `image/svg+xml`; empty `file.type` → send `image/svg+xml` |

## Bubble checklist (logo upload)

- [ ] HTML: Logo Upload = label + opacity-0 file input (guide §5.5); SVG in accept
- [ ] Run JS when Company visible: **only** `fqInitLogoUploader` (token + apikey + presignUrl); no `fqSetLogoPreview`
- [ ] JS2B `logo_key` → Patch → `ce_refresh_brand`
- [ ] Preview = Bubble **Image: Company Logo** (`RE s_logo_url`), not HTML `<img>`

## Files / migrations / functions

| Kind | Path | Notes |
|------|------|-------|
| Migration | `20260824150000_profile_name_and_staff_brand.sql` | |
| Edge | `company-brand/` | Public GET, no JWT |
| Edge | `r2-presign` | Admin logo PUT |
| Shared | `_shared/company.ts` `resolveEmailLogoUrl` | Email + public base |
| Shared | `_shared/email-layout.ts` | `logoUrl` on branded HTML |
