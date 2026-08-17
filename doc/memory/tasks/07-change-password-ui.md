# Logged-in user — change password from UI

**Status:** NOT STARTED (do later)  
**Guide:** reuse `Auth - Set new user password` (`PUT /auth/v1/user`) already on `password_setup`  
**Last updated:** 2026-08-13

---

## Paste for new chat (5–10 lines)
- **Forgot password already works:** `request-password-reset` → email → `password_setup`. Do not rebuild that.
- **New:** logged-in admin/tech can change password from their own page (profile / settings), while session is valid.
- Reuse existing connector `Auth - Set new user password` (JWT in `Authorization`). No Bubble DB. No new edge function unless we want extra validation.
- Distinct from invite/reset (`type=invite` / `type=recovery` on `password_setup`).
- Snackbars: same `Show API failure` pattern as admin writes.

---

## Goal
A signed-in user (admin on `admin_dashboard`, technician on `technician_panel`) can open a change-password UI, submit current-session `PUT /auth/v1/user` with the new password, see success/failure, stay logged in. Forgot-password email path is unchanged.

## Decisions (locked)
| Decision | Choice | Why |
|----------|--------|-----|
| When | Later (not current task) | Draft loading / snackbars first |
| Who | Admin + technician | Both have a logged-in page |
| vs forgot | Separate UI; keep `request-password-reset` | Forgot is for no-session |
| Storage | No Bubble Thing | Tokens already on User / SessionKeeper |
| API | Existing `Auth - Set new user password` | Already initialized |

## Done
- [x] Noted: forgot-password path already live

## In progress / next
1. Profile / account popup (or Company-adjacent) with new + confirm password inputs
2. Wire `Auth - Set new user password` with `Current User's sb_access_token`
3. Success + failure toasts (same map as snackbars)
4. Mirror on technician_panel if admin lands first

## Blockers / pitfalls
| Issue | Fix |
|-------|-----|
| Confusing with `password_setup` | That page is invite/recovery only; this is in-session |
| Include errors on auth | Login/refresh stay OFF; this mutating call can follow snackbar Include-errors pattern |
| Weak password / mismatch | Bubble Only-when on confirm match before API |

## Files / migrations / functions
| Kind | Path or name | Notes |
|------|----------------|-------|
| Connector | `Auth - Set new user password` | `PUT …/auth/v1/user` |
| Edge | none required | Forgot uses `request-password-reset` |

## Bubble checklist
- [ ] Change-password UI on admin (then tech)
- [ ] Call wired; no Bubble DB write
- [ ] Forgot flow still works

## Test plan
- [ ] Logged-in change → can log in with new password
- [ ] Mismatch / short password → friendly error, no JSON dump
- [ ] Forgot email path still reaches `password_setup`
