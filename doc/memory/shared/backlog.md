# Shared — backlog (not current task)

**Security leftovers (`tasks/09`):** Dashboard signups off, deploy, item 15 connectors, deactivate toggle, password_setup typo. Then **`tasks/10`** tech dashboard UI. Snackbars (`tasks/03`) after that.

Ordered roughly by near-term admin UX → branding → later weeks.

| # | Item | Notes |
|---|------|-------|
| 1 | Admin + public error alerts | **`tasks/03-admin-snackbars.md`** — technician already invited (409), price duplicate, send/draft/assign, login, set-password, 429; never raw JSON |
| 2 | Draft with AI loading + quoted gate (Bubble) | **`tasks/04-draft-ai-loading.md`** — edge 409 already live |
| 3 | Quote popup Save (no snap-back / fewer calls) | **`tasks/01`** — Display Info Box not whole Popup; named Display list params; busy clear always |
| 3b | Unsaved lines + Send | **`tasks/01`** — add `s_line_dirty`; email is DB-only |
| 3c | Drop quote money page states | Bind Popup Parent Get Quote fields; keep `quote_id` / busy / bust / dirty |
| 4 | After Send: hide Send + read-only lines in Bubble | **Bug:** Send still shown when status is **`viewed`**. Server already 409. **`tasks/20`** |
| 5 | Quote popup reset on close | Clear `quote_id` / group / RG so next open doesn’t flash old quote |
| 6 | Realtime hybrid leftovers | `tasks/02-realtime-hybrid.md` — tech SessionKeeper, Price `bust`, etc. |
| 6b | **Realtime “live” indicator (§8.3)** | **`tasks/15-realtime-live-indicator.md`** — subtle Live/Offline from `bubble_fn_live`; reconnect after network loss |
| 7 | Quote Send polish / AI notes expandable | `tasks/01-quote-ai-patch-send.md` |
| 7b | **Admin Assign/Assigned/Cancel button conditions** | **Tomorrow first** — Assign still keyed only on `scheduled`; must hide Assign when `en_route` / `in_progress` (and when `technician_id` set). Cancel when not completed/cancelled. See `00-NOW.md`. |
| 8 | **Company logo + name → public RE** | **Done** — `tasks/19`; confirm Run JS without `fqSetLogoPreview` (Missing token bug) |
| 9 | SessionKeeper idle logout | Active refresh OK; idle N hours → force login |
| 10 | Tech panel route guards | guide auth §1.7 |
| 11 | UX: status badges, sort, search, profile popup | Snackbars tracked in #1 |
| 11b | **Loading shimmer: `q` page + Assign popup** | **`perform/13` §4 + §6** · `tasks/12` |
| 12 | **Admin sidebar full viewport height (Bubble)** | **`tasks/06-admin-sidebar-full-height.md`** — G: Main min `100vh`; Fill sidebar only; Space between on G: Sidebar Margin |
| 12b | **Week 4 UI polish bundle** | **`perform/13`** + **`tasks/17`** — draft loading, q, Assign, Live, tech; **pg_cron deferred** |
| 13 | Week 3 money: create-checkout + stripe-webhook | `P1-roadmap.md` Days 11–15 |
| 14 | List Payments | **In guide 14** — Payments table + Assigned/Unassigned (not a third Unassigned-jobs table) |
| 15 | **Logged-in change password (UI)** | **Done** via `tasks/19` / `07` — reset **email** from profile (not in-session PUT) |
| 16 | **Go-live Bubble URLs** | Set secrets **without** `/version-test/` before Live deploy — see `shared/constants.md` |
| 17 | TEMP resolve-token debug fields | **Done** — removed; keep ≥20 char check + explicit `action` |
| 18 | **q-success version mismatch** | Stripe `PUBLIC_QUOTE_SUCCESS_URL` hits `version-test`; editor work was on Bubble version `53hv8`. Align later or set secret to `…/version-53hv8/q-success`. Old Checkout sessions keep old URL — new Accept after change. |
| 19 | **q-success payment copy (deposit vs final)** | **Done** — URL `kind` + `s_copy` |
| 20 | **Admin job popup status stale** | **Done** (trainee) — confirm Get Job `bust` if admin still stale |
| 21 | **Complete → final invoice email** | **Done** — Bubble JWT path |
| 22 | **Feedback Form quote stamp** | **Done** — Apps Script on Form Responses sheet |

**Updated:** 2026-08-26 — logo Run JS fix; quote dirty/state cleanup; current → logo confirm → pg_cron (`tasks/18`)
