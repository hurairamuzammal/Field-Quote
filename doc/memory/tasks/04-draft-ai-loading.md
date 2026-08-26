# Draft with AI — loading indicator

**Status:** IN PROGRESS — see **`perform/13-week4-ui-polish-guide.md` §3**  
**Last updated:** 2026-08-11

---

## Paste for new chat (5–10 lines)
- Admin **Draft with AI** hits `draft-quote` but feels hung — no spinner.  
- Export already sets page `s_media_busy = yes` at draft start (**never clears**) and has **G: Loading** — not wired for draft.  
- Prefer new page state **`s_draft_busy`** (yes/no): show loader, disable button, clear on success **and** error.  
- Do snackbars later (`tasks/03-admin-snackbars.md`).  
- Bubble: `fieldquote-26446 (7).bubble`.

---

## Goal
While Draft with AI runs, admin sees a clear loading state (overlay/spinner + disabled button). Loader clears when the edge call finishes (success or failure).

## Decisions (locked)
| Decision | Choice | Why |
|----------|--------|-----|
| State | New `s_draft_busy` (don’t overload `s_media_busy`) | Media popup already uses busy |
| Clear busy | Always after API (both branches) | Stuck spinner if only on success |
| Double-submit | Disable Draft button when busy | Avoid duplicate drafts |

## Done
- [x] Diagnosed: busy set true on draft, never false; G: Loading unused for draft  
- [x] Edge guard: `draft-quote` returns **409** if `requests.status !== 'new'` (no AI call)

## In progress / next
1. Add `s_draft_busy` on `admin_dashboard`  
2. Show **G: Loading** (or draft floating group) when busy; text “Generating quote…”  
3. Draft WF: set busy yes → call → … → set busy **no** (unconditional / both paths)  
4. Button disabled when `s_draft_busy is yes` **or** `s_req_status is quoted`  
5. Deploy `draft-quote` if not yet on remote  
6. Test long AI latency + error path + already-quoted 409  

## Blockers / pitfalls
| Issue | Fix |
|-------|-----|
| Spinner never hides | Missing Set state no after API |
| Reusing `s_media_busy` | Conflicts with media flows — use `s_draft_busy` |
| Draft still runs on quoted | Edge **409** `Request already quoted` — deploy `draft-quote`; hide button in Bubble too |

## Bubble checklist
- [ ] `s_draft_busy` created  
- [ ] Loader visible only when yes  
- [ ] Draft WF clears busy always  
- [ ] Button not clickable while busy  

## Test plan
- [ ] Click Draft → spinner immediately  
- [ ] Success → spinner gone → quote popup  
- [ ] Force error → spinner gone → can retry  
