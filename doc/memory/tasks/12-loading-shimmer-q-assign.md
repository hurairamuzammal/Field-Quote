# Loading shimmer — `q` page + Assign popup

**Status:** NOT STARTED  
**Guide:** (Bubble UX — no perform guide yet; patterns in auth guide loading group + assign guide §7)  
**Last updated:** 2026-08-21

---

## Paste for new chat (5–10 lines)
- UX debt: while API data is still loading, **`q`** (customer quote) and **Popup Assign** flash empty / false / blank UI.
- Fix: show a **loading shimmer (or skeleton)** until the Data call / resolve finishes; then reveal real content.
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
| Pattern | Shimmer / skeleton (or full-group loading) until data ready | Empty RG + false conditionals look broken |
| Security | Unchanged — still RLS / token resolve | This is UX only |

## Done
- (none)

## In progress / next
1. **`q` page:** visible-on-load shimmer/loading group; hide when Resolve Quote Token (or bound data) has returned success/error; show empty only for real “invalid/expired” outcomes.
2. **Popup Assign:** on Show, keep header/body behind shimmer (or hide fields) until `Get Job` (and dropdown list if needed) has data; avoid binding “false” yes/no or blank customer while `s_job_id` fetch is pending.
3. Optional: same pattern later for Quote popup / Request detail if they flash empty too.

## Blockers / pitfalls
| Issue | Fix |
|-------|-----|
| Shimmer never hides | Clear busy when call finishes **and** on error path |
| Assign 406 on page load | Still: empty `s_job_id` → no Get Job (guide 09); shimmer is only after Assign click with id set |
| Treating loading as “no job” | Don’t show Unassigned / empty customer until fetch completed |

## Files / migrations / functions
| Kind | Path or name | Notes |
|------|----------------|-------|
| Bubble | page `q` | Customer token resolve |
| Bubble | `Popup Assign` | Admin Jobs / Payments |
| Memory | `tasks/08-admin-assign-technician.md` | Assign popup context |

## Bubble checklist
- [ ] `q`: loading group visible until resolve done
- [ ] `q`: error/expired state distinct from loading
- [ ] Assign: shimmer/skeleton until Get Job has row
- [ ] Assign: no false scheduled / blank name flash

## Test plan
- [ ] Slow network (or throttle): open `/q?token=…` → shimmer then quote (not blank)
- [ ] Invalid token → loading ends → proper error (not infinite shimmer)
- [ ] Click Assign → shimmer then customer/totals/dropdown (not empty then pop-in)
- [ ] Fast network still looks fine (brief or no flicker)
