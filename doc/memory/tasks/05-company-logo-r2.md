# Company logo + name — R2 + `company_settings` + cache

**Status:** DONE — folded into `tasks/19`  
**Guide:** `perform/16` (chrome) · `perform/15` (upload) · legacy concepts in `perform/11`  
**Last updated:** 2026-08-26

---

## Paste for new chat

- Logo lives in R2; DB stores `company_settings.logo_key` only (§13 R9).
- UI: public `company-brand` + RE / Brand App Data. Emails: `resolveEmailLogoUrl` needs `R2_PUBLIC_BASE_URL`.
- Full story + picker/Missing-token fix: **`tasks/19`**.

## Done

- [x] Schema + r2-presign logo + public brand RE + email wiring via task 19
