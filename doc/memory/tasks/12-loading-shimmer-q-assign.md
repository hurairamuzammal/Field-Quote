# Loading shimmer — `q` page + Assign popup

**Status:** IN PROGRESS — see **`perform/13-week4-ui-polish-guide.md` §4 + §6**  
**Last updated:** 2026-08-21

---

## Paste for new chat (5–10 lines)
- UX debt: while API data is still loading, **`q`** (customer quote) and **Popup Assign** flash empty / false / blank UI.
- Fix: **Nebula Shimmer** start before fetch, **stop on every finish** (success + error); then show content or **`G: Q Error`** inline — not alerts.
- Same idea as page “Group Loading” in auth guides — applied to quote page + assign popup.
- Backlog: `shared/backlog.md` item **loading shimmer**.
- Do **after** current branding / tech polish unless empty flash is blocking demos.

---

## Goal
Customer on `/q` and admin on Assign popup never see a misleading empty or “false” state while `resolve-quote-token` / `Get Job` (and related) are still in flight. Done when: loading UI → content appears once; no empty flash on slow networks.

## Decisions (locked)
| Decision | Choice | Why |
|----------|--------|-----|
| Surfaces | Customer **`q`** page + admin **Popup Assign** | Both have noticeable fetch delay |
| Pattern | **Nebula Shimmer** start/stop + `s_q_busy` / `s_assign_loading` for group visibility | Empty RG + false conditionals look broken |
| Errors on `q` | **Snackbar** title + description per §4.3 (workflow **Only when**) | Error group or raw JSON in toast |
| Security | Unchanged — still RLS / token resolve | This is UX only |

## Done
- (none)

## In progress / next
1. **`q` page:** Nebula Start → Resolve → **Display data** in `G: Q Resolve` → Stop; Content/Error via **conditionals** (§4).
2. **Popup Assign:** Nebula **Start** on open → **Stop** when Get Job `id` = `s_job_id` (or cancel / timeout error text).
3. Optional: same pattern later for Quote popup / Request detail if they flash empty too.

## Blockers / pitfalls
| Issue | Fix |
|-------|-----|
| Shimmer never hides | **Stop Nebula** on **returned_an_error** too — Display error body then Stop |
| Assign 406 on page load | Still: empty `s_job_id` → no Get Job (guide 09); shimmer is only after Assign click with id set |
| Treating loading as “no job” | Don’t show Unassigned / empty customer until fetch completed |

## Files / migrations / functions
| Kind | Path or name | Notes |
|------|----------------|-------|
| Bubble | page `q` | Customer token resolve |
| Bubble | `Popup Assign` | Admin Jobs / Payments |
| Memory | `tasks/08-admin-assign-technician.md` | Assign popup context |

## Bubble checklist
- [ ] `q`: Nebula on Content; Stop always; snackbar rows §4.3 on dead-end/error
- [ ] Assign: Nebula Start on open → Stop when Get Job matches `s_job_id`
- [ ] Assign: no false scheduled / blank name flash

## Test plan
- [ ] Slow network (or throttle): open `/q?token=…` → shimmer then quote (not blank)
- [ ] Invalid token → loading ends → proper error (not infinite shimmer)
- [ ] Click Assign → shimmer then customer/totals/dropdown (not empty then pop-in)
- [ ] Fast network still looks fine (brief or no flicker)
