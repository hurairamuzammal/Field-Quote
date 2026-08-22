# Company logo + name — R2 + `company_settings` + cache

**Status:** NEXT (after Admin Assign/Cancel UI stable)  
**Guide:** [`doc/MD-files/perform/11-dynamic-company-branding-guide.md`](../../MD-files/perform/11-dynamic-company-branding-guide.md)  
**Last updated:** 2026-08-21

---

## Paste for new chat (5–10 lines)

- Dynamic **company name + logo**: R2 key in `company_settings.logo_key`; never Bubble file storage (§13 R9).
- Guide: `perform/11-dynamic-company-branding-guide.md` — r2-presign `kind=logo`, email `R2_PUBLIC_BASE_URL`, Bubble Get Brand + SessionKeeper cache states.
- One brand fetch per page load → `s_company_name` / `s_logo_url`; headers bind states only.
- Emails: `fetchCompanyBrand` + logo URL; fallback static `EMAIL_ASSET_BASE_URL` logo if no key.

---

## Goal

Admin uploads logo + edits name once; admin/tech chrome and Resend emails use that brand without refetching settings on every list.

## Decisions (locked)

| Decision | Choice | Why |
|----------|--------|-----|
| Storage | R2 + `logo_key` | §13 R9 |
| Cache | Bubble page/SK states | Efficient; no “save logo into Bubble” edge fn |
| Email URL | `R2_PUBLIC_BASE_URL` + key | Stable HTTPS for clients |
| Tech UI | Get Brand (no rates) | Don’t pull `labor_rate` into headers |

## Done

- [x] Schema `logo_key`, `name` on `company_settings`
- [x] `fetchCompanyBrand` + static email logo helper
- [x] Full guide written (`perform/11-…`)

## Next

1. Code: r2-presign logo PUT/GET  
2. Code: email-layout `logoUrl` + secrets `R2_PUBLIC_BASE_URL`  
3. Bubble: Get Brand, Patch, upload, cache states, headers  
4. Test checklist in guide §8  

## Test plan

See guide §8.
