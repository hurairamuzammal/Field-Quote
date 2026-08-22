# Technician dashboard (Jobs + Job Detail)

**Status:** IN PROGRESS — pause overnight; continue tomorrow  
**Last updated:** 2026-08-19  
**Bubble export:** `fieldquote-26446 (3).bubble`

---

## Paste for new chat (5–10 lines)
- Continue **`technician_dashboard`** (login already goes here). **Do not** wire `technician_panel`.
- Built today: Get My Jobs cards + detail **popup** (Display the **cell**, not Get Job Detail `quotes(`). Patch status with **`Bearer ` + JWT**; `job_id` = that card’s id. Photos = HTML `fq-job-*` (`fqJobPickPhotos` / `fqLoadJobMedia`).
- Tomorrow: E2E Complete + notes, Today/Upcoming/Done filters, strip leftover admin tables, Complete iff ≥1 photo.
- Sidebar **Schedule** and **Notification** = copied **admin** `os_admin_panel` chrome — **no tech feature**. Only **Jobs** is in scope. **Profile** = parked `tasks/07`.
- Do **not** reinstall Splutter / Fluid Chat.

---

## Goal
Technician sees only their jobs (RLS), no prices. List → popup. En Route → Start → Complete with ≥1 photo + notes.

## Decisions (locked)
| Decision | Choice | Why |
|----------|--------|-----|
| Jobs vs detail | **Popup** on `technician_dashboard` | Card sets `s_job_id` + Display Get My Jobs cell |
| Filters | Today / Upcoming / Done on one Get My Jobs RG | Still needs correct constraints |
| Tech vs admin jobs API | **Get My Jobs** only on this page | Admin List Jobs / Get Quote include totals |
| Get Job Detail | **Do not use** while URL has `quotes(requests(...))` | Empty nested fields / price risk |
| Photos | Index-style HTML/JS, `job_id` on r2-presign PUT | Intake PUT without `job_id` is admin-GET only |
| Auth header | **`Bearer ` + JWT** | Raw JWT → 401 |
| Sidebar Schedule / Notification | **Ignore / hide** | Copied from admin option set `os_admin_panel`. Scope Day 17 is My Jobs only. Admin calendar = Day 16. No tech notification product. |
| `technician_panel` page | **Unused** | Old shell (Jobs/New). Login → `technician_dashboard` |

## Done (2026-08-19)
- [x] Login → `technician_dashboard`
- [x] Snapshot customer fields on jobs
- [x] List cards + popup from Get My Jobs (name/address/schedule)
- [x] Patch Job Status (`Bearer`; wrong `job_id` caused `completed → en_route`)
- [x] HTML/JS upload + small thumbs (`fq-job-*`); GET sign needs deployed `r2-presign --no-verify-jwt`

## Remaining (today)
1. Phone E2E with **notes** (DB requires ≥3 chars) + photo
2. Strip leftover admin groups if still on the page
3. Filter constraints Today / Upcoming / Done
4. Admin live: SessionKeeper `jobs` → `s_jobs_ts` on List Jobs **and** Get Job / job-detail popup (`status=neq.[bust]`)
5. After Complete: `send-final-invoice` (`tasks/11`) — GUC must match `CRON_SECRET`; diagnose `email_log`

## Blockers / pitfalls
| Issue | Fix |
|-------|-----|
| 401 JWT | Header `Bearer <token>` |
| PGRST102 | Body unquoted placeholders; JSON-safe **or** quotes, not both |
| 22P02 uuid | No JSON-safe on URL `job_id`; bust on `kind=neq.[bust]` not `id=neq` |
| `completed → en_route` | PATCH hit another job (stale `s_job_id` / Private `job_id`) |
| Could not sign photo URLs | Deploy `r2-presign --no-verify-jwt`; keys must be `jobs/<id>/photos/…` |
| Get Job Detail nested customer | Empty for techs — bind Get My Jobs snapshot fields |
| Calendar color only on click | Conditional `event_color` = selected event only. Dynamic color needs **HEX field**, not `status`. Use `jobs.calendar_color` + Event color field = `calendar_color` |

## Files / migrations / functions
| Kind | Path or name | Notes |
|------|----------------|-------|
| Migration | `supabase/migrations/20260819120000_job_completion_requires_photo.sql` | Complete blocked without photo |
| Migration | `supabase/migrations/20260820140000_jobs_calendar_color.sql` | Generated HEX from status for Full Calendar |
| Function | `r2-presign` | PUT/GET `jobs/{job_id}/photos/…` with staff JWT |

## Test plan
- [ ] Card → popup name + address, no totals
- [ ] En route → start → complete blocked without photo
- [ ] Photo + Complete succeeds; thumbs persist on reopen
- [ ] Other tech cannot see this job
