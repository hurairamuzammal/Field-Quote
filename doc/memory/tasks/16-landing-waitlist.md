# Landing waitlist (§11 / Day 23)

**Status:** IMPLEMENTED in repo — deploy edge + set Vercel env  
**Last updated:** 2026-08-23  
**Scope:** FieldQuote.docx §11 · P2-backend §8

---

## Paste for new chat
- Waitlist: landing form → `POST /api/waitlist` → edge `submit-waitlist` → `waitlist` row + Resend + `email_log` (`waitlist_confirm`).
- Deploy: `npx supabase functions deploy submit-waitlist --no-verify-jwt`
- Vercel (server-only, **not** `NEXT_PUBLIC_`): `SUPABASE_URL`, `SUPABASE_ANON_KEY` (or `SUPABASE_PUBLISHABLE_KEY`)
- Honeypot `hp` + IP/email rate limits. Duplicate email → `{ ok: true, already: true }` no second email.

---

## Doc flow (as built)

```
Landing Contact form
  → Next.js /api/waitlist (server)
  → Edge submit-waitlist (validate, honeypot, rate limit)
  → INSERT waitlist (service role after checks)
  → Resend confirmation
  → email_log
```

Anon INSERT RLS on `waitlist` remains for doc compliance; landing uses the edge path (same pattern as public intake).

## Files
| Path | Role |
|------|------|
| `supabase/functions/submit-waitlist/` | Edge function |
| `landing/src/app/api/waitlist/route.ts` | Proxy |
| `landing/src/components/Contact.tsx` | Form UI |

## Test
1. Deploy function + set landing env
2. Submit email on landing → row in `waitlist` → confirmation inbox
3. Submit same email again → success message, no second Resend
