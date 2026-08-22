# Admin + public error / success alerts

**Status:** LATER — 429 + remaining toasts after `tasks/09` leftovers and tech UI (`tasks/10`)  
**Guide:** reuse **RE: Alert Success** + **RE: Failure** (admin); page banners on login / password_setup / q / index  
**Last updated:** 2026-08-16

---

## Paste for new chat (5–10 lines)
- Friendly alerts, **never** `body_raw_text`. Map `status_code` + `body.error` / `body.message`.
- Edge already returns 409 `User already exists` on duplicate invite — Bubble must **Include errors ON** and toast **“This technician is already invited.”**
- Same pattern for duplicate price name, quote already sent, needs manual pricing, assign, 429 rate limit, login, set-password.
- Locked: snackbars never dump JSON. Export may lag (`fieldquote-26446 (2).bubble`).

---

## Goal
Every mutating action (and login / set-password / public quote) shows a short success or failure line the admin/customer can understand. Duplicate technician is the first proof.

## Decisions (locked)
| Decision | Choice | Why |
|----------|--------|-----|
| UI (admin) | Existing Success + Failure REs | Already in app |
| Copy | Hardcoded map first; then `error` / `message` | PostgREST JSON is ugly |
| Raw body | Never in toast | Unreadable / scary |
| Data GETs | Include errors usually OFF | Lists stay clean |
| Mutating APIs | Include errors **ON** | Need `returned_an_error` |

## Done
- [x] Plan + copy tables (this file)
- [x] Edge invite duplicate → 409 `User already exists`

## In progress / next
1. Admin: Invite (duplicate + empty email + 401/403)
2. Admin: Draft AI (409 already quoted, empty book, 429)
3. Admin: Price add/edit (duplicate name)
4. Admin: Send quote (unpriced, already sent)
5. Admin: Save line + Assign job
6. Public: login, password_setup (mismatch typo “math”), forgot **429**, q accept/decline, intake submit **429**

## Status → toast (all pages)
| Condition | Toast text |
|-----------|------------|
| 401 | Session expired — log in again |
| 403 | You don’t have permission |
| 404 | Not found |
| 409 + invite / “already exists” | This technician is already invited |
| 409 + price unique / 23505 | An item with that name already exists |
| 409 + send-quote already sent | This quote was already sent |
| 409 + checkout decline | This quote was already updated |
| 400 + needs_manual_pricing | Price every line before sending |
| 400 + no line items | Add at least one line before sending |
| 429 | Try again later. |
| ≥ 500 | Server error — try again |
| else | Something went wrong. Try again |
| Edge `body.error` if mapped | Prefer the table above over raw `error` |

## Per-action copy
| Action | Success | Failure (specific first) |
|--------|---------|--------------------------|
| Invite technician | Invite sent | Technician already invited / enter an email / couldn’t invite |
| Resend invite | Invite resent | Couldn’t resend |
| Draft AI | Quote generated (± “needs manual pricing”) | Already drafted / no price book / couldn’t generate |
| Add price | Price added | Name already exists |
| Edit price | Price updated | Couldn’t update price |
| Send quote | Quote sent | Price every line / already sent |
| Save line | optional silent | Couldn’t save line |
| Assign job | Job assigned | Pick a technician and time |
| Deactivate tech | Technician deactivated | Couldn’t update |
| Login | (navigate) | Invalid email or password |
| Set password | Password saved — sign in | Passwords don’t match / link expired / too short |
| Forgot password | If that email exists, we sent a link | 429 → Try again later. (3 / email / day). Same success if unknown email |
| Intake submit | Request sent | 429 → Try again later. (3 / email / day). Else add a description or photo |
| q Accept | (redirect Stripe) | Quote no longer available |
| q Decline | Quote declined | Quote no longer available |

## Workflow skeleton
```
API (Include errors ON)
Only when returned_an_error is no → Success text → show → pause → hide → side-effects
Only when returned_an_error is yes → Failure heading + mapped description → show → pause → hide → keep popup open
```

Invite duplicate **Only when:** `status_code is 409` **or** Result’s `body.error` contains `already`.

## Blockers / pitfalls
| Issue | Fix |
|-------|-----|
| Toast shows `{code,message}` | Don’t use `body_raw_text` |
| `returned_an_error` missing | Include errors ON + re-Initialize |
| Invite 409 never fires | Connector Include errors ON; URL must be real `functions/v1/invite-technician` (`tasks/09` item 15) |
| password_setup “did not math” | Fix copy when wiring alerts |

## Bubble checklist
- [ ] Failure + Success REs on admin
- [ ] Invite 409 → “This technician is already invited.”
- [ ] Draft / Price / Send / Assign / Save line
- [ ] login + password_setup + **forgot 429** + q + **index 429**
- [x] 429 copy: `Try again later.` (`body.error`, code `rate_limited`)

## Test plan
- [ ] Invite same email twice → friendly already-invited, no JSON
- [ ] Invite new email → “Invite sent”
- [ ] Add price with duplicate name → already exists
- [ ] Send unpriced quote → price every line
- [ ] Send twice → already sent
- [ ] Login wrong password → invalid email or password
- [ ] Set password mismatch → don’t match
- [ ] Expired invite link → link expired
```