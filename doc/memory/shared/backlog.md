# Shared — backlog (not current task)

**Security leftovers (`tasks/09`):** Dashboard signups off, deploy, item 15 connectors, deactivate toggle, password_setup typo. Then **`tasks/10`** tech dashboard UI. Snackbars (`tasks/03`) after that.

Ordered roughly by near-term admin UX → branding → later weeks.

| # | Item | Notes |
|---|------|-------|
| 1 | Admin + public error alerts | **`tasks/03-admin-snackbars.md`** — technician already invited (409), price duplicate, send/draft/assign, login, set-password, 429; never raw JSON |
| 2 | Draft with AI loading + quoted gate (Bubble) | **`tasks/04-draft-ai-loading.md`** — edge 409 already live |
| 3 | Quote popup Save (no snap-back / fewer calls) | Don’t Display whole Popup; header states; optional Patch+`quotes()` embed |
| 4 | After Send: hide Send + read-only lines in Bubble | Server already: send-quote 409 + line draft-only trigger |
| 5 | Quote popup reset on close | Clear `quote_id` / group / RG so next open doesn’t flash old quote |
| 6 | Realtime hybrid leftovers | `tasks/02-realtime-hybrid.md` — tech SessionKeeper, Price `bust`, etc. |
| 6b | **Realtime “live” indicator (§8.3)** | **`tasks/15-realtime-live-indicator.md`** — subtle Live/Offline from `bubble_fn_live`; reconnect after network loss |
| 7 | Quote Send polish / AI notes expandable | `tasks/01-quote-ai-patch-send.md` |
| 7b | **Admin Assign/Assigned/Cancel button conditions** | **Tomorrow first** — Assign still keyed only on `scheduled`; must hide Assign when `en_route` / `in_progress` (and when `technician_id` set). Cancel when not completed/cancelled. See `00-NOW.md`. |
| 8 | **Company logo + name → R2 + Bubble cache** | **`tasks/05`** + **`perform/11-dynamic-company-branding-guide.md`** — **NEXT** |
| 9 | SessionKeeper idle logout | Active refresh OK; idle N hours → force login |
| 10 | Tech panel route guards | guide auth §1.7 |
| 11 | UX: status badges, sort, search, profile popup | Snackbars tracked in #1 |
| 11b | **Loading shimmer: `q` page + Assign popup** | **`tasks/12-loading-shimmer-q-assign.md`** — data lag shows empty/false UI; shimmer until resolve / Get Job ready |
| 12 | **Admin sidebar full viewport height (Bubble)** | **`tasks/06-admin-sidebar-full-height.md`** — G: Main min `100vh`; Fill sidebar only; Space between on G: Sidebar Margin |
| 13 | Week 3 money: create-checkout + stripe-webhook | `P1-roadmap.md` Days 11–15 |
| 14 | List Payments | **In guide 14** — Payments table + Assigned/Unassigned (not a third Unassigned-jobs table) |
| 15 | **Logged-in change password (UI)** | **`tasks/07-change-password-ui.md`** — not forgot-password; admin/tech while session valid |
| 16 | **Go-live Bubble URLs** | Set secrets **without** `/version-test/` before Live deploy — see `shared/constants.md` |
| 17 | TEMP resolve-token debug fields | **Done** — removed; keep ≥20 char check + explicit `action` |
| 18 | **q-success version mismatch** | Stripe `PUBLIC_QUOTE_SUCCESS_URL` hits `version-test`; editor work was on Bubble version `53hv8`. Align later or set secret to `…/version-53hv8/q-success`. Old Checkout sessions keep old URL — new Accept after change. |
| 19 | **q-success payment copy (deposit vs final)** | **Done** — URL `kind` + `s_copy` |
| 20 | **Admin job popup status stale** | **Done** (trainee) — confirm Get Job `bust` if admin still stale |
| 21 | **Complete → final invoice email** | **Done** — Bubble JWT path |
| 22 | **Feedback Form quote stamp** | **Done** — Apps Script on Form Responses sheet |

**Updated:** 2026-08-23 — added 6b live indicator (§8.3)
