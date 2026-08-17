# Security hardening (improvement pass)

**Status:** IN PROGRESS — items 2–5 in repo; item 1 is Dashboard (hosted)  
**Guide:** this file + `FieldQuote.docx` §3.2 / §13; RLS in `supabase/migrations/20260729124500_rls_profiles_and_auth.sql`  
**Last updated:** 2026-08-17  
**Bubble export audited:** `fieldquote-26446 (2).bubble`

---

## Paste for new chat (5–10 lines)
- Security items **2–5 coded** (not deployed until `db push` + function deploys). **Item 1** still Dashboard: disable hosted signups.
- Next: **item 6** — wire `assertRateLimit` into submit-request, reset, r2 PUT, resolve-token, checkout, draft-quote, invite/resend.
- Do not mix UX polish (snackbars, logo, sidebar).
- Deploy: `npx supabase db push` then deploy `invite-technician`, `resend-invite`, `send-quote`, `set-technician-active` (`--no-verify-jwt` until item 13).

---

## Goal
Staff cannot self-register or act before Set Password; public endpoints cannot be cheaply flooded (intake, reset, R2, AI, checkout); secrets stay off Bubble; RLS tests catch regressions. Done when the checklist below is ticked and the negative suite is re-run.

## Decisions (locked)
| Decision | Choice | Why |
|----------|--------|-----|
| How we work | One numbered item per chat | Each item is its own PR / Bubble change |
| Rate limits | In **edge functions** (IP + optional email key), not Bubble | Bubble is UX; attackers skip the UI |
| Auth signups | Dashboard **off** + trigger ignores client `role` | Defense in depth |
| Invite before password | `profiles.active = false` until password set | Login page already fails (no password); invite JWT must not |
| CORS | Allowlist Bubble + landing origins, not `*` | Stops random sites from driving our functions in a browser |
| `verify_jwt` | **true** on admin-only functions; **false** only on public (intake, token, webhook, reset, r2 PUT) | Gateway rejects junk before Deno runs (cost / DDoS) |

## Done
- [x] Live anon RLS sweep (tables empty; quotes insert blocked)
- [x] Token resolver rejects short/unknown; dead quotes 410
- [x] Admin JWT required for draft/send/invite; Stripe unsigned 400
- [x] Item 2 — `handle_new_user` role from `raw_app_meta_data.fieldquote_role` only (`20260817120000_…`)
- [x] Item 3 — invite `profiles.active = false` until password; trigger `on_auth_user_password_set`
- [x] Item 3b — activate on **any** password change if not banned (`20260817140000_…`) — GoTrue placeholder hash skipped the empty-password check
- [x] `complete-password-setup` — Bubble calls this after Set Password so `active` flips even if the Auth trigger misses
- [x] Item 4 — `set-technician-active` (ban + unassign future jobs); invite/resend/send require admin **and** `active`
- [x] Item 5 — `rate_limit_hits` + `hit_rate_limit` RPC + `_shared/rate-limit.ts` (not wired yet)

## In progress / next
Work **top to bottom**. Stop at the end of one item unless it is a 5-minute follow-on in the same area.

### A — Auth lock (do first — account takeover)
1. Disable public signups in Supabase Dashboard (Authentication → Providers → Email → **Confirm signups / disable new signups**). Also: disable anonymous sign-in (already off); enable leaked-password protection if free-plan allows. *(local `config.toml` already `enable_signup = false` — hosted Dashboard still required)*
2. ~~Fix `handle_new_user`~~ **done in repo** — role only from `raw_app_meta_data.fieldquote_role`.
3. ~~Invite lock~~ **done in repo** — `active = false` until password; invite JWT cannot pass `auth_role()`.
4. ~~Admin deactivate~~ **done in repo** — `set-technician-active`; Bubble toggle still to wire (checklist).

### B — Rate limits & cheap DDoS (public + expensive)
5. ~~Shared limiter helper~~ **done in repo** (`_shared/rate-limit.ts` + `rate_limit_hits`). Wire in item 6.
6. ~~Apply limiter~~ **submit-request** (5/10 min IP + 3/10 min email) and **r2-presign PUT** (15/10 min IP) wired. Still to wire: reset, token, checkout, draft, invite.
7. ~~`submit-request` validation~~ **done** — email/name/address required; **phone optional** (no format check); min description; honeypot silent 200.
8. CORS: replace `Access-Control-Allow-Origin: *` with allowlist (`*.bubbleapps.io`, landing origin). OPTIONS must echo the allowed origin.

### C — Password reset / set password / Auth API
9. `request-password-reset`: keep identical success for unknown emails; rate limit (item 6); do **not** put `token_hash` in `email_log` (schema drift — stop writing it; new migration drop column or restrict).
10. `password_setup` (Bubble): Verify Invite/Recovery **only** with matching `type`; Set Password only with that session; min length; mismatch copy; after success go to `login` and **do not** leave a logged-in tech session from the invite JWT. Confirm `type=invite` vs `type=recovery` not mixed.
11. Logged-in change password stays `tasks/07` — separate UI; still needs current JWT + password policy.
12. GoTrue: confirm **min password length ≥ 8** (Dashboard). Optional: rate-limit `/auth/v1/token` via Supabase Auth settings / CAPTCHA if available on free plan.

### D — API routing / endpoint gateway
13. `config.toml`: `verify_jwt = true` on **admin** functions (`invite-technician`, `resend-invite`, `draft-quote`, `send-quote`, `r2-presign` GET path still needs JWT — split PUT/GET or keep function false but **fail fast** if GET without Bearer). Keep `verify_jwt = false` on: `submit-request`, `resolve-quote-token`, `create-checkout`, `stripe-webhook`, `request-password-reset`, r2 **PUT**.
14. Reject wrong methods (already some); cap JSON body size; no stack traces in 500 bodies.
15. Bubble connectors: **Invite Technician** URL must be `https://chqljfdmgdtsmbbwbdyv.supabase.co/functions/v1/invite-technician` (not `[ref].functions.supabase.co`). Same for reset + r2 if still placeholders. **Patch Quote Line** fix `https:/` → `https://`. Delete/disable **Resend** connector and **Create Invite disabled** (`/rest/v1/invites`). Remove **bubble_synced** calls (column does not exist). Every data call: dynamic `Authorization: Bearer` + current JWT (never leftover Initialize token).
16. PostgREST: keep explicit `select=` (no `*`); tech only `DB - Get Jobs` columns; never select `quotes.token` / `ai_raw` on customer-facing calls.

### E — RLS / DB machines / leftover product security
17. Expand `tests/rls/negative.sql`: quotes/payments/price book/settings/other jobs (existing); plus `active = false` sees nothing; nested `jobs?select=quotes(total,token)` empty; tech cannot PATCH `technician_id`/`scheduled_at`; anon signup/profile not admin. Re-run after every migration.
18. Job status trigger (`unscheduled→scheduled→en_route→in_progress→completed`) + append `job_events`. Completion photo rule when tech UI is wired.
19. Wire `technician_panel` to **DB - Get Jobs** only (no price embeds). Route guard if token empty.
20. SessionKeeper idle logout — already backlog #9; do after auth lock.

### F — Friendly error alerts (improvement, not raw JSON)
21. **`tasks/03-admin-snackbars.md`** — map every mutating call to Success/Failure REs. Must include: **technician already invited** (invite 409 `User already exists`), duplicate price name, quote already sent, needs manual pricing, assign job, **429** (after rate limits), login, password_setup (fix “did not math”), public q / intake. Never toast `body_raw_text`. Needs Invite connector Include errors ON + real `functions/v1` URL (item 15).

### G — Do not build (out of scope / already OK / paid WAF)
- Cloudflare WAF in front of `*.supabase.co` — not possible without custom domain; skip.
- GraphQL — already disabled.
- Supabase Storage public buckets — empty; files stay R2.
- Stripe unsigned writes — already blocked.
- Customer accounts / MFA — out of v1 scope.

## Blockers / pitfalls
| Issue | Fix |
|-------|-----|
| Signups “off” in Dashboard but trigger still trusts metadata | Item 2 done — still disable hosted signups (item 1) |
| Activating profile from Bubble after password | Tech has no UPDATE on `profiles` — must be trigger or edge fn |
| Rate limit table needs RLS | Service-role writes only inside functions after IP parse |
| `verify_jwt = true` on public intake | Breaks honeypot page — do not |
| Turning on JWT verify without Bubble sending `Authorization` | 401 empty lists — check header first |
| Storing invite `token_hash` in `email_log` | Anyone with admin JWT can finish someone else’s invite |

## Files / migrations / functions
| Kind | Path or name | Notes |
|------|----------------|-------|
| Trigger | `20260817120000_auth_lock_app_metadata_and_invite_active.sql` | items 2–3 |
| Table/RPC | `20260817130000_rate_limit_hits.sql` | item 5 |
| Helper | `supabase/functions/_shared/require-admin.ts` | admin + active |
| Helper | `supabase/functions/_shared/rate-limit.ts` | IP + route; wire in item 6 |
| Function | `set-technician-active` | item 4 |
| Functions | `invite-technician`, `resend-invite`, `send-quote` | app_metadata + requireActiveAdmin |
| Config | `supabase/config.toml` `[functions.set-technician-active]` | verify_jwt still false until item 13 |
| Tests | `tests/rls/negative.sql` | item 17 |
| Bubble | Invite URL, Patch Line URL, drop Resend/invites/bubble_synced | item 15 |
| Dashboard | Auth: disable signups, password policy | items 1, 12 |

## Bubble checklist
- [ ] Invite Technician full URL + admin JWT
- [ ] password_setup: type-safe verify → set password → login (no lingering invite session)
- [ ] Deactivate technician toggle (item 4)
- [ ] Remove Resend + `/rest/v1/invites` + `bubble_synced`
- [ ] Patch Quote Line `https://`
- [ ] Tech panel: Get Jobs only
- [ ] All REST calls: Bearer = Current User token

## Test plan
- [ ] Signups disabled: `/auth/v1/signup` → signups not allowed (not merely invalid email)
- [ ] Signup with `data.role=admin` cannot create admin profile
- [ ] Invitee password login fails until Set Password; invite JWT cannot read jobs/quotes
- [ ] After Set Password, tech login works; `active = true`
- [ ] Deactivated tech: login fails; leftover JWT gets empty RLS + 403 on admin functions
- [ ] Burst `submit-request` / `request-password-reset` / r2 PUT → 429
- [ ] Reset unknown email still `{success:true}`; no user enumeration
- [ ] Anon GET all tables still `[]`; nested quote prices as tech empty
- [ ] `tests/rls/negative.sql` green after migrations
```