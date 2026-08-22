# Admin assign technician

**Status:** IN PROGRESS  
**Guide:** `doc/MD-files/perform/09-admin-assign-technician-guide.md`  
**Last updated:** 2026-08-13

---

## Paste for new chat (5–10 lines)
- Week 4: admin assigns tech + slot on **desktop** after deposit creates a `jobs` row.
- **UI locked:** two tables — Payments (customer, paid, scheduled/not — no pay-status) + Jobs (tech name / None).
- Deposit webhook inserts **payment + job** together. Assign = PATCH. List Payments embeds `quotes(requests)` + `jobs`. List Jobs embeds `technician:profiles(full_name)`.
- Connectors: List Payments, List Jobs, Get Job, Get Technicians, Patch Job. Skip List Jobs Unassigned.
- Guide: `doc/MD-files/perform/09-admin-assign-technician-guide.md`

---

## Goal
Admin sees Payments (customer, amount, scheduled/not) + Jobs (tech name / None), picks technician + datetime, PATCH sets `scheduled`. Tech JWT sees only their job.

## Decisions (locked)
| Decision | Choice | Why |
|----------|--------|-----|
| Who assigns | Admin only, manual | Scope Day 16 |
| Write path | PostgREST PATCH, no edge fn | RLS is the boundary |
| Email on pay | Webhook later | Don’t block Assign popup |
| Customer booked email | Later | Don’t block Assign popup |
| Dashboard tables | Payments + Jobs only | Drop Unassigned-jobs table (redundant) |

## Done
- [x] Guide 14 written  
- [x] TEMP quote-token debug fields removed  

## In progress / next
1. Confirm `jobs` row exists after test pay  
2. Initialize List Payments + List Jobs / Get Technicians / Patch Job  
3. Payments table (Assigned/Unassigned) + Jobs table + Assign popup  
4. Hide/delete Unassigned-jobs table if already built  
5. **Tomorrow:** Fix Assign / Assigned / Cancel visibility — do **not** key only on `status = scheduled`. Hide Assign when `technician_id` set **or** status in `scheduled|en_route|in_progress`. Show Cancel when not `completed`/`cancelled`. Wire `DB - Admin Cancel Job` if missing.  
6. **Later (backlog 11b):** Assign popup loading shimmer while Get Job loads — see `tasks/12-loading-shimmer-q-assign.md` (also customer `q` page).  

## Blockers / pitfalls
| Issue | Fix |
|-------|-----|
| Assign still shows after tech started | Condition only checked `scheduled`; include `en_route` / `in_progress` + `technician_id` |
| No jobs to assign | Webhook never inserted — check `jobs` / `payments` |
| Technicians dropdown empty | Admin JWT + active technicians; profiles admin-read policy |
| PATCH 400 on date | ISO timestamptz + JSON-safe |
| List table red “evaluates to List Payments/Jobs” | Include errors **OFF**; don’t Duplicate calls; Type of content = that same call. Guide 14 §4–§6 |
| Get Job types as a list | `Accept: object+json` + Include errors OFF |
| Get Job HTTP 406 PGRST116 (0 rows) | Empty/`JSON-safe` `job_id`. Conditional: empty `s_job_id` → no call. Set state **then** Show popup. Guide 14 §7 |
| Get Technicians is one object, not a list | Remove `object+json`; admin JWT; Include errors OFF; 1-row array → Manually enter 2-item JSON. Guide 14 §8 |

## Files / migrations / functions
| Kind | Path | Notes |
|------|------|-------|
| Guide | `doc/MD-files/perform/09-admin-assign-technician-guide.md` | Source of truth |
| Tables | `jobs`, `profiles` | Existing |
