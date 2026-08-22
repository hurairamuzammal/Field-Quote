# q-success payment copy

**Status:** IN PROGRESS — success URL now appends `kind=deposit|final`; Bubble conditionals next  
**Last updated:** 2026-08-22

---

## Paste for new chat (5–10 lines)
- `q-success` must branch on Get data from page URL → `kind`.
- Code: create-checkout → `?kind=deposit`; send-final-invoice → `?kind=final` (redeploy both).
- Deposit body: assign/notify OK. Final body: thank-you only — no “technician will be assigned”.
- Old Checkout links keep old URLs until a **new** pay session.

---

## Goal
Customer landing on `/q-success` after Stripe sees accurate, non-misleading confirmation copy (deposit vs final if distinguishable; no stuck “Confirming…”). Done when: body/title/badge match paid state; final payment does not promise a new tech assignment.

## Decisions (locked)
| Decision | Choice | Why |
|----------|--------|-----|
| Surface | Bubble page **`q-success` only** | Static Text elements today |
| Deposit vs final | Prefer different copy if poller/session can tell kind; else neutral “payment received” | Final invoice must not say “technician will be assigned shortly” |
| Poller | Keep resolve-token poll until `accepted` (already HTTP 200) | Don’t regress `tasks/09` fix |

## Done
- (none)

## In progress / next
1. Open `q-success` in Bubble; select body text (`T: Body` / hardcoded string above).
2. Rewrite for **deposit** (assign-soon OK) vs **final** (job already done / thank-you only) — use conditional groups if Checkout/success can pass kind or resolve returns enough.
3. Align title/badge with poller: loading = Confirming…; success = confirmed (not both at once).
4. Optional: company name from branding (`tasks/05`) on footer “Contact support”.
5. Retest deposit Checkout → `q-success` and final Checkout → `q-success`.

## Blockers / pitfalls
| Issue | Fix |
|-------|-----|
| One success URL for both Checkouts | Conditional copy from resolve payload / URL param / payment kind if available; else neutral wording |
| Editor on version `53hv8`, Stripe hits `version-test` | Backlog #18 — align `PUBLIC_QUOTE_SUCCESS_URL` or edit the version Stripe uses |
| Old Checkout sessions | Keep old success URL until new Accept |

## Files / migrations / functions
| Kind | Path or name | Notes |
|------|----------------|-------|
| Bubble | page `q-success` | Body / title / badge texts |
| Secret | `PUBLIC_QUOTE_SUCCESS_URL` | Must match the Bubble version you edit |
| Edge | `resolve-quote-token` | Poller status `accepted` |

## Bubble checklist
- [ ] Body copy fixed (no wrong “assign shortly” on final)
- [ ] Title/badge match loading vs paid
- [ ] Deposit path still makes sense
- [ ] Final path thank-you only
- [ ] Tested on the same version Stripe redirects to

## Test plan
- [ ] Pay **deposit** → success page: payment received + assign/notify language OK
- [ ] Pay **final** → success page: no “technician will be assigned shortly”
- [ ] Slow webhook: Confirming… then confirmed (not stuck)
- [ ] Hard refresh on success URL still coherent
