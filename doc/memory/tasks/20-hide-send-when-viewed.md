# Hide Send when quote is already sent/viewed

**Status:** NOT STARTED  
**Guide:** `doc/MD-files/perform/08-quote-request-ai-patch-send-guide.md` (Send UX)  
**Last updated:** 2026-08-25

---

## Paste for new chat (5–10 lines)
- **Bug:** Quote popup still lets admin **Send to customer** after status is `viewed` (also likely `sent` / later).
- Edge `send-quote` already **409** if status is not `draft` (including `viewed`). Do not re-send; follow-ups are cron.
- Fix is **Bubble:** hide/disable Send unless `status = draft` (and priced). Lines read-only after send.

---

## Goal
Admin cannot send the same quote again once it left `draft`. Done when Send is hidden/disabled for `sent`, `viewed`, `accepted`, `declined`, `expired`, and a `viewed` quote cannot fire Send Quote.

## Decisions (locked)
| Decision | Choice | Why |
|----------|--------|-----|
| Re-send | Never via Send Quote | One token/email path; later pings = `quote-followups` |
| Server | Keep 409 on non-draft | RLS/UX is not enough |

## Done
- [x] `send-quote` 409 for `viewed` (and other non-draft)

## In progress / next
1. Quote popup: Send only if Get Quote `status` is `draft` (and `needs_manual_pricing` is no)
2. After Send / on open: bind condition to live status, not a stale page state
3. Optional snackbar if 409 still fires: “Quote already sent”

## Blockers / pitfalls
| Issue | Fix |
|-------|-----|
| Button uses `s_needs_manual_pricing` only | Also require `status = draft` |
| Popup group is stale after customer views | Bust Get Quote / Display data on open |

## Files / migrations / functions
| Kind | Path or name | Notes |
|------|----------------|-------|
| Edge | `supabase/functions/send-quote/index.ts` | Already blocks non-draft |
| Bubble | Quote popup Send | Condition + hide after send |

## Bubble checklist
- [ ] Send visible only when quote `status` is `draft`
- [ ] Hide Send for `viewed` (and `sent` / accepted / declined / expired)
- [ ] Re-open a viewed quote: Send stays hidden

## Test plan
- [ ] Draft + priced → Send works once
- [ ] After send: Send hidden
- [ ] Customer opens `/q` → status `viewed` → reopen popup → Send still hidden; no second email
