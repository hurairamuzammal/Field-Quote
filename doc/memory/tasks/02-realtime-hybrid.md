# Realtime hybrid — SessionKeeper + cache-bust

**Status:** IN PROGRESS  
**Guide:** `doc/MD-files/perform/07-realtime-cachebust-to-supabase-guide.md`  
**Last updated:** 2026-08-11

---

## Paste for new chat (5–10 lines)
- **NOW task.** Replace admin Do every ~60s with Supabase Realtime; keep Table `neq.[bust]`.  
- Put HTML + Toolbox JS2Bubble **inside SessionKeeper**; `start(jwt, role)` — admin vs technician subscriptions.  
- **Bust states live on SessionKeeper** (not page). Tables + Draft/Send/Invite bumps all use `SessionKeeper's s_*_ts`.  
- Guide §2 = full Toolbox fields (suffix, Trigger ON, Publish ON, Queue OFF, Multiple OFF).  
- Part 1 SQL admin tables **DONE**; jobs migration `20260811130000_…` — `db push` if needed.  
- Next: finish bridges/HTML/Part 4 bumps → retarget Table bust → kill 60s timer → re-start after JWT refresh.

---

## Goal
Admin (and later tech) lists update ≤2s on Postgres changes without polling every table every 60s. Public `index`/`login`/`q` unchanged.

## Decisions (locked)
| Decision | Choice | Why |
|----------|--------|-----|
| Architecture | Hybrid: Realtime → bump bust → Table refetch | Bubble RG/API Connector won’t merge WS rows |
| Where UI lives | **SessionKeeper** reusable | Shared admin+tech; JWT refresh already here |
| Role split | admin: requests/quotes/pricebook/profiles; tech: **jobs only** | Don’t leak admin channels to tech |
| Bust state owner | **SessionKeeper** custom states | Reusable can’t easily set outer page states; one clock for Tables + local bumps + Realtime |
| JS2Bubble | Trigger ON, Publish ON, Queue **OFF**, Multiple OFF | Queue without Dequeue looks broken |
| Public pages | No SessionKeeper / no Realtime | Intake + token page stay one-shot |

## Done
- [x] Purpose + full Toolbox guide in `perform/07-realtime-…md`  
- [x] Migration admin publication: `20260810180000_realtime_admin_tables.sql` (**pushed**)  
- [x] Migration jobs file: `20260811130000_realtime_jobs_table.sql` (push if not applied)  
- [x] Agreed SessionKeeper-owned bust states pattern (chat 2026-08-11)

## In progress / next
1. Confirm `jobs` + **`payments`** in `supabase_realtime` (`npx supabase db push` — `20260813120000_realtime_payments_table.sql`)  
2. SessionKeeper: JS2Bubble suffixes `requests|quotes|pricebook|techs|jobs|payments|live`  
3. Admin HTML also `.on(… table: 'payments')` + `jobs`; bump `s_payments_ts` / `s_jobs_ts`  
3. HTML module + Run JS `start(token, role)` with retry/pause for module load  
4. Part 4: each trigger → Set state **This SessionKeeper** `s_*_ts` = UNIX (role Only when)  
5. Admin Tables: `bust` = SessionKeeper’s matching state (leave page duplicates unused or delete)  
6. Retarget Invite/Draft/Send/line-Save bumps → SessionKeeper  
7. Disable admin Do every ~60s; keep ~50 min auth refresh  
8. After Auth Refresh success → Run JS `start` again  
9. Test admin intake appear ≤2s; tech jobs later  

## Blockers / pitfalls
| Issue | Fix |
|-------|-----|
| `bubble_fn_*` undefined | Suffix only (no `bubble_fn_` in field); element mounted; SK on page |
| No workflow event | Trigger event must be ON |
| Events stop after first | Queue OFF (or Dequeue every time) |
| Set state on wrong element | Use **SessionKeeper** states; Tables bind to same instance |
| Race: `__fqRealtime` undefined | Pause 300ms or retry loop in Run JS |
| Realtime dies ~1h | Re-`start` after SessionKeeper refresh |
| `updated_at` bust on quotes | Use text column `status=neq.[bust]` (quote Get Quote — separate task) |

## Files / migrations / functions
| Kind | Path or name | Notes |
|------|----------------|-------|
| Guide | `perform/07-realtime-cachebust-to-supabase-guide.md` | Source of truth for Bubble clicks |
| Migration | `20260810180000_realtime_admin_tables.sql` | Applied |
| Migration | `20260811130000_realtime_jobs_table.sql` | Push if pending |
| Cheat | `learn/05-cachebust-initialize-cheatsheet.md` | Bust URL pattern |

## Bubble checklist
- [ ] SK states: `s_requests_ts`, `s_quotes_ts`, `s_pricebook_ts`, `s_techs_ts`, `s_jobs_ts` (+ optional live)  
- [ ] JS2Bubble ×6 configured per guide §2.4  
- [ ] Console: all `typeof bubble_fn_* === "function"`  
- [ ] HTML + `start(jwt, role)` on load + after refresh  
- [ ] Bridge WFs bump **This SessionKeeper**  
- [ ] Admin Table bust → SessionKeeper  
- [ ] Local action bumps → SessionKeeper  
- [ ] Do every 60s off  

## Test plan
- [ ] Admin: new intake elsewhere → Requests table updates without reload  
- [ ] Admin: draft/send → Quotes updates (Realtime and/or local bump)  
- [ ] Tech: job change → list updates via `s_jobs_ts`  
- [ ] After ~token refresh: still receiving events  
- [ ] `index` has no Realtime script  
