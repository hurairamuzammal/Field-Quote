# Send final invoice after job complete

**Status:** IN PROGRESS — Bubble JWT path live; hosted GUC N/A  
**Last updated:** 2026-08-22  
**Guide:** roadmap Day 20; `P2-backend.md` §4; Make setup: `doc/MD-files/perform/12-make-com-review-loop-guide.md`

---

## Paste for new chat (5–10 lines)
- Job `completed` (notes ≥3 chars + ≥1 photo) → `send-final-invoice` (Stripe Checkout `kind=final`, email customer).
- Money still only via `stripe-webhook`. Final pay → fire-and-forget `MAKE_WEBHOOK_URL`.
- Deploy: `send-final-invoice --no-verify-jwt` and `stripe-webhook --no-verify-jwt`. Set `app.settings.cron_secret` = `CRON_SECRET` or call the function from Complete with staff JWT.
- Do not write payment rows from Bubble.

---

## Goal
Technician completes a job → customer gets a final-balance Stripe link. Paying it records `payments.kind=final` and pings Make. Completing without notes or photo is rejected in Postgres.

## Decisions (locked)
| Decision | Choice | Why |
|----------|--------|-----|
| Who fires invoice | DB trigger (`x-cron-secret`) + optional Bubble POST after Complete | Trigger is the source of truth; JWT backup if GUC unset |
| Amount | `quotes.total − deposit_amount` | Snapshot on quote, not live price book |
| Cap | One `email_log` `final_invoice` sent per job | No spam; unpaid follow-ups later (cron, cap 2) |
| Make | After webhook records final payment only | Make must not block money |
| Feedback UX | Google Form (prefilled quote_id + name) + separate Jobs Done sheet | Demo: personalized link; Form Responses sheet auto-stores ratings |

## Done
- [x] Notes required on complete (`20260820120000`)
- [x] `send-final-invoice` function
- [x] pg_net dispatch trigger (`20260820120100`)
- [x] stripe-webhook Make on `kind=final`
- [x] jobs `REPLICA IDENTITY FULL` for live admin

## Remaining
- [x] Bubble `Send Final Invoice` after Complete (staff JWT — live path on hosted Supabase)
- [ ] Admin Get Job popup `bust` (backlog #20)
- [ ] Stripe test pay + Make on fresh job when retesting full loop
