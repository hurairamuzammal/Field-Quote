# Security hardening (improvement pass)

**Status:** BUBBLE PASS VERIFIED — code 1–9, 12–18 in repo; export `fieldquote-26446 (2).bubble` matches leftovers. **Next is `tasks/10`.** Redeploy functions if `resolve-quote-token` accepted-200 is not live yet.  
**Last updated:** 2026-08-19  
**Bubble export audited:** `fieldquote-26446 (2).bubble`

---

## Paste for new chat (5–10 lines)
- Security **code** 1–9, 12–18 in repo. **Bubble leftovers verified** in `fieldquote-26446 (2).bubble` (signups off per trainee; deactivate wired; Invite/`functions/v1` URLs; Get Technicians bust; login → `technician_dashboard`).
- **`password_setup`:** one verify (invite **or** recovery, `type` from URL); Set Password + `complete-password-setup` use that JWT; delete Bubble mirror user. Cosmetic leftover: **"did not math"** on mismatch text.
- **Next:** `tasks/10` technician Jobs UI. Page still has copied admin List Quotes / List Jobs / Get Quote — strip; bind **Get My Jobs** only.
- Item **21** snackbars later. Item **11** = `tasks/07`. Item **20** idle logout = backlog.
- Redeploy **`resolve-quote-token`** if q-success still stuck after pay (accepted must be HTTP 200).
- Admin function deploys omit `--no-verify-jwt`. Public keep `verify_jwt = false`.

---

## Goal
Staff cannot self-register or act before Set Password; public endpoints cannot be cheaply flooded (intake, reset, R2, AI, checkout); secrets stay off Bubble; RLS tests catch regressions. Done when the checklist below is ticked and the negative suite is re-run.

## Decisions (locked)
| Decision | Choice | Why |
|----------|--------|-----|
| How we work | One numbered item per chat | Each item is its own PR / Bubble change |
| Rate limits | In **edge functions**, not Bubble | Bubble is UX; attackers skip the UI. See **Rate limit policy** below. |
| Auth signups | Dashboard **off** + trigger ignores client `role` | Defense in depth |
| Invite before password | `profiles.active = false` until password set | Login page already fails (no password); invite JWT must not |
| CORS | Allowlist Bubble + landing origins, not `*` | Stops random sites from driving our functions in a browser |
| `verify_jwt` | **true** on admin-only functions; **false** only on public (intake, token, webhook, reset, r2 PUT) | Gateway rejects junk before Deno runs (cost / DDoS) |

## Rate limit policy (locked — 2026-08-18)

429 body: `{ error: "Try again later.", code: "rate_limited" }` + `Retry-After` header.

| Endpoint | Function | Limit | Notes |
|----------|----------|-------|-------|
| Forgot password | `request-password-reset` | **Email only — 3 / 24h** | No IP cap. Unknown email still `{ success: true }`. |
| Index submit | `submit-request` | **Email only — 3 / 24h** | No IP cap. Honeypot silent 200 unchanged. |
| Photo upload (PUT) | `r2-presign` | **60 / IP / 10 min** | One presign per file; form allows up to 5 photos (+ audio). Headroom for retries. |
| Draft quote | `draft-quote` | **None** | Admin JWT + `requireActiveAdmin`. |
| Invite technician | `invite-technician` | **None** | Admin action. |
| Resend invite | `resend-invite` | **None** | Admin action. |
| Send quote | `send-quote` | **None** | Already unlimited. |
| Quote page load | `resolve-quote-token` | **None** | Customer refresh is normal. |
| Accept / decline | `create-checkout` | **None** | Token validates customer; one action per quote. |

**Deploy (when ready):**

```bash
npx supabase db push
# Admin (JWT gateway ON — do not pass --no-verify-jwt):
npx supabase functions deploy invite-technician resend-invite draft-quote send-quote set-technician-active complete-password-setup --project-ref chqljfdmgdtsmbbwbdyv
# Public / mixed (JWT gateway OFF):
npx supabase functions deploy request-password-reset submit-request r2-presign resolve-quote-token create-checkout stripe-webhook --no-verify-jwt --project-ref chqljfdmgdtsmbbwbdyv
```

## Done
- [x] Live anon RLS sweep (tables empty; quotes insert blocked)
- [x] Token resolver rejects short/unknown; dead quotes 410
- [x] Admin JWT required for draft/send/invite; Stripe unsigned 400
- [x] Item 2 — `handle_new_user` role from `raw_app_meta_data.fieldquote_role` only (`20260817120000_…`)
- [x] Item 3 — invite `profiles.active = false` until password; trigger `on_auth_user_password_set`
- [x] Item 3b — activate on **any** password change if not banned (`20260817140000_…`) — GoTrue placeholder hash skipped the empty-password check
- [x] `complete-password-setup` — Bubble calls this after Set Password so `active` flips even if the Auth trigger misses
- [x] Item 4 — `set-technician-active` (ban + unassign future jobs); invite/resend/send require admin **and** `active`
- [x] Item 6 — rate policy coded (see table above); **deploy later**
- [x] Item 8 — CORS allowlist live (OPTIONS: Bubble origin echoed; `evil.example` gets no `*`; `stripe-webhook` still `*`)
- [x] Item 9 — no `token_hash` in `email_log` inserts; migration `20260818120000_drop_email_log_token_hash.sql`
- [x] Item 13 — `config.toml` `verify_jwt = true` on admin functions; false on public + `r2-presign` (GET still fail-fast without Bearer)
- [x] Item 14 — POST (etc.) gates, 256 KiB JSON cap (`submit-request` 32 KiB; webhook 1 MiB), 500 body is `Unexpected error` only
- [x] Item 16 — Bubble export has no `select=*`, no `quotes.token` / `ai_raw` on jobs/quotes calls (leftover: disable `bubble_synced` — item 15)
- [x] Item 17 — `tests/rls/negative.sql` expanded (nested quotes, tech cannot PATCH assignment, inactive, anon)
- [x] Item 18 — job status machine + `job_events` trigger + append-only (`20260818120100_…`)

## In progress / next
Work **top to bottom**. Stop at the end of one item unless it is a 5-minute follow-on in the same area.

### A — Auth lock (do first — account takeover)
1. ~~Disable public signups~~ **done (hosted Dashboard, trainee 2026-08-19)** — local `config.toml` already `enable_signup = false`.
2. ~~Fix `handle_new_user`~~ **done in repo** — role only from `raw_app_meta_data.fieldquote_role`.
3. ~~Invite lock~~ **done in repo** — `active = false` until password; invite JWT cannot pass `auth_role()`.
4. ~~Admin deactivate~~ **done** — `set-technician-active` + Bubble **Set Technician Active** (Bearer = Current User JWT) on team table / tiles.

### B — Rate limits & cheap DDoS (public + expensive)
5. ~~Shared limiter helper~~ **done in repo** (`_shared/rate-limit.ts` + `rate_limit_hits`). Wire in item 6.
6. ~~Apply limiter~~ **coded — deploy later** — see **Rate limit policy** table above.
7. ~~`submit-request` validation~~ **done** — email/name/address required; **phone optional** (no format check); min description; honeypot silent 200.
8. ~~CORS~~ **done in repo** — `_shared/cors.ts` echoes allowed Origin (Bubble + landing). Redeploy the 11 Bubble-facing functions. `stripe-webhook` stays `*`.

### C — Password reset / set password / Auth API
9. ~~`request-password-reset` / invite `token_hash`~~ **done in repo** — email URL only; column dropped if present. Unknown email still `{ success: true }`.
10. ~~`password_setup`~~ **verified in `(2).bubble`** — **one** Verify Invite (condition invite **or** recovery; `type` from URL). Set Password + **Auth - Complete Password Setup** use that step’s `access_token`. Cosmetic: mismatch text still **"did not math"**; snackbar copy already “Passwords don't match”.
11. Logged-in change password stays `tasks/07` — later; not this pass.
12. ~~GoTrue min length~~ **set Dashboard + `config.toml` to 8** (was 6). Optional leftover: rate-limit `/auth/v1/token` / CAPTCHA if free plan allows.

### D — API routing / endpoint gateway
13. ~~`config.toml` verify_jwt~~ **done in repo** — admin functions `true`; public + `r2-presign` `false` (GET path still requires Bearer in Deno).
14. ~~Method / body size / no stack traces~~ **done in repo** (`_shared/http.ts`).
15. ~~Bubble connectors~~ **verified `(2).bubble`** — Invite/reset/r2/checkout are `https://chqljfdmgdtsmbbwbdyv.supabase.co/functions/v1/...`. No `functions.supabase.co`. No `/rest/v1/invites`. No `select=*`. No `token` / `ai_raw` on jobs/quotes URLs. Workflows: **0 hardcoded JWTs**. Unused **Send Email test** (Resend) still in connector list — not called. Login still branches on `_api_c2_bubble_synced` (GoTrue body field, **not** a DB column) for Bubble User LogIn vs SignUp — leave it. Get Technicians has `email=neq.[bust]`.
16. ~~PostgREST `select=`~~ **audited** — no `select=*`; tech jobs calls are explicit columns (`DB - Get My Jobs` / `Get Job Detail` in `tasks/10`). No `token` / `ai_raw` on those URLs.

### E — RLS / DB machines / leftover product security
17. ~~Expand `tests/rls/negative.sql`~~ **done in repo** — re-run after `db push`.
18. ~~Job status trigger + `job_events`~~ **done in repo**. Completion photo rule when tech UI is wired.
19. Login → **`technician_dashboard`** **done**. Remaining UI (strip admin leftovers, bind Get My Jobs / Get Job Detail, status + photos) = **`tasks/10`**, not this pass.
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
| Storing invite `token_hash` in `email_log` | **Fixed (item 9)** — stop writing it; drop column |
| `q-success` stuck on “Confirming…” after pay | **Fixed in repo 2026-08-19** — `resolve-quote-token` returned **410** for `accepted`; Bubble poller has Include errors **OFF** so `_api_c2_status` never became `accepted`. Now **200** + `status: accepted`, `actionable: false`. Redeploy `resolve-quote-token`. |
| `password_setup` click does nothing | Latest export **double-calls Verify Invite** (invite consumes token twice). Set Password / snackbars only look at **first** verify step — recovery never sets password. One verify per click; recovery must use `type=recovery`. |

## Files / migrations / functions
| Kind | Path or name | Notes |
|------|----------------|-------|
| Trigger | `20260817120000_auth_lock_app_metadata_and_invite_active.sql` | items 2–3 |
| Table/RPC | `20260817130000_rate_limit_hits.sql` | item 5 |
| Helper | `supabase/functions/_shared/require-admin.ts` | admin + active |
| Helper | `supabase/functions/_shared/rate-limit.ts` | IP + route; wire in item 6 |
| Function | `set-technician-active` | item 4 |
| Functions | `invite-technician`, `resend-invite`, `send-quote` | app_metadata + requireActiveAdmin |
| Config | `supabase/config.toml` | item 13 — admin `verify_jwt = true`; public false |
| Helper | `supabase/functions/_shared/http.ts` | item 14 |
| Migration | `20260818120000_drop_email_log_token_hash.sql` | item 9 |
| Migration | `20260818120100_job_status_machine_and_events.sql` | item 18 |
| Tests | `tests/rls/negative.sql` | item 17 |
| Bubble | Invite URL, Patch Line URL, drop Resend/invites/bubble_synced | item 15 |
| Dashboard | Auth: disable signups, password policy | items 1, 12 |

## Remaining Bubble (you)

**This pass is complete.** Next = **`tasks/10`**. Item 11 = `tasks/07` later. Item 21 snackbars later.

### Item 10 — status
**Verified `(2).bubble`:** one verify on button (invite **or** recovery); Set Password + complete-password-setup; delete Bubble user; go to login. Cosmetic: **T: Password Mismatch** still says **"did not math "**.

### Item 19 — `tasks/10`
Do **not** wire `technician_panel`. Login already lands on **`technician_dashboard`**. Still strip copied admin tables / Get Quote popup; bind **Get My Jobs** (no quote embeds). **Get Job Detail** URL still embeds `quotes(requests(...))` — do not use that call on the tech page until `select=` is snapshot-only.

## Bubble checklist
- [x] Dashboard: public signups **off** (item 1) — trainee
- [ ] Deploy: confirm `db push` + function deploys including **`resolve-quote-token`**
- [x] Invite Technician `functions/v1` URL + admin JWT
- [ ] password_setup typo **"did not math"** (cosmetic)
- [x] Deactivate technician → `set-technician-active`
- [x] No `/rest/v1/invites`; Patch Quote Line `https://`
- [x] Workflow Bearer = Current User token (no hardcoded JWT)
- [x] Login: technician → **`technician_dashboard`**
- [ ] 429 toasts — **later** (`tasks/03`)
- [ ] Unused connector **Send Email test** (Resend) — disable when convenient

## Test plan
- [ ] Signups disabled: `/auth/v1/signup` → signups not allowed (not merely invalid email)
- [ ] Signup with `data.role=admin` cannot create admin profile
- [ ] Invitee password login fails until Set Password; invite JWT cannot read jobs/quotes
- [ ] After Set Password, tech login works; `active = true`
- [ ] Deactivated tech: login fails; leftover JWT gets empty RLS + 403 on admin functions
- [ ] Burst forgot / intake same email → 429 after 3 in 24h; unknown reset email still `{success:true}`
- [ ] Burst r2 PUT from one IP → 429 after 60 in 10 min
- [ ] Admin draft / invite / resend / quote accept — **never** 429 from our limiter
- [ ] Reset unknown email still `{success:true}`; no user enumeration
- [ ] Anon GET all tables still `[]`; nested quote prices as tech empty
- [ ] `tests/rls/negative.sql` green after migrations
- [ ] Illegal job jump (e.g. unscheduled → completed) rejected; `job_events` row on legal change
