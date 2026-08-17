# Company logo — R2 upload + `company_settings` + use everywhere

**Status:** NOT STARTED  
**Guide:** `P2-backend.md` §1 (`logo_key`), §5.2 R2; `r2-presign`; emails via `_shared/email-layout.ts`  
**Last updated:** 2026-08-12

---

## Paste for new chat (5–10 lines)
- Make company logo **dynamic**: admin uploads to **Cloudflare R2**, store reference in Supabase `company_settings`, use that logo in Bubble + outbound emails (and anywhere else branded).  
- Schema already has `company_settings.logo_key` (R2 object key only — §13 R9). Do **not** put file bytes in Bubble storage or DB.  
- Today emails use static landing `/logos/logo-email.png` (`email-layout.ts` + `EMAIL_ASSET_BASE_URL`). Replace with company logo from settings.  
- Reuse `r2-presign` (PUT upload + GET view) pattern from request media.  
- Do after snackbars / quote UX polish unless branding is blocking a demo.

---

## Goal
Admin can upload/replace company logo once; that asset is stored in R2, keyed in Supabase, and shown consistently in admin UI, customer quote emails, invite emails, and other branded surfaces.

## Decisions (locked)
| Decision | Choice | Why |
|----------|--------|-----|
| Storage | Cloudflare **R2** via presigned URLs | §13 R9 — files never in Bubble/DB |
| DB column | `company_settings.logo_key` (object key) | Already in schema; historical docs stay key-based |
| Public URL | Derive at read time (CDN/public base + key) **or** short-lived GET presign for private bucket | Don’t rely on Bubble file URLs |
| Scope | One logo per company (settings row) | Matches 1-row `company_settings` |

## Done
- [x] Schema: `logo_key` on `company_settings`  
- [x] Email layout helper exists (currently **static** landing logo)  

## In progress / next
1. Confirm R2 key convention e.g. `companies/<company_id>/logo/<uuid>.png`  
2. Admin Bubble: upload → `r2-presign` PUT → PATCH `company_settings.logo_key`  
3. Admin preview: GET presign or public URL from `logo_key`  
4. Update `_shared/email-layout.ts` / senders (`send-quote`, `invite-technician`, `resend-invite`, …) to use company logo URL from settings (fallback to current static asset if `logo_key` null)  
5. Bubble header / company settings UI bind to same source  
6. Test: upload → email preview shows new logo; clear/replace logo  

## Blockers / pitfalls
| Issue | Fix |
|-------|-----|
| Storing full Bubble CDN URL in DB | Store **R2 key** only; build URL in edge/UI |
| Private bucket + raw key in `<img src>` | Need public CDN base or presigned GET |
| Email clients block some hosts | Prefer stable public HTTPS asset URL for Resend |
| Hardcoded `logo-email.png` | Replace after settings load in each email path |

## Files / migrations / functions
| Kind | Path or name | Notes |
|------|----------------|-------|
| Column | `company_settings.logo_key` | Exists |
| Edge | `r2-presign` | Upload + download |
| Shared | `supabase/functions/_shared/email-layout.ts` | `emailLogoUrl()` today static |
| Callers | `send-quote`, `invite-technician`, `resend-invite`, … | Pass logo URL into layout |

## Bubble checklist
- [ ] Company settings: file uploader + save `logo_key`  
- [ ] Preview image from R2  
- [ ] Header / branding widgets use settings logo (not hardcoded)  

## Test plan
- [ ] Upload logo → `logo_key` set in Table Editor  
- [ ] Admin UI shows new logo without refresh hacks  
- [ ] Send quote / invite email shows company logo  
- [ ] Null `logo_key` → fallback static / text wordmark  
