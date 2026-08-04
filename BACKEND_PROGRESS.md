# FieldQuote backend progress

This is the running backend handover. Update the newest entry first after every backend iteration: what changed, what was verified, what is blocked, and the next exact action.

## Current position

**Phase:** Week 1, Day 2 — RLS applied; one hosted Auth setting remains before Bubble integration.

**Linked Supabase project:** `fieldquote` (`chqljfdmgdtsmbbwbdyv`).

**Database state:** initial schema migration is applied to the linked remote database, and the electrician seed data is loaded. All database structure is still represented in Git migrations; no dashboard-only schema changes have been made.

## Iteration log

### 2026-07-28 — Iteration 1: backend foundation staged

- Added the initial migration containing all Day-1 tables, constraints, indexes, timestamps, and RLS enablement.
- Added an electrician-first seed: company settings plus 28 active price-book items across call-outs, diagnosis/testing, installation, consumer units/rewires, lighting, and EV charging.
- Preserved the rule that technician records must map to real `auth.users` IDs; no fake technician profile was seeded. Technicians will be created through the invite flow after authentication/profile handling is in place.
- Verified the Supabase project is linked locally through `supabase/.temp/linked-project.json`.

### 2026-07-28 — Iteration 2: schema and seed pushed to Supabase

- Ran `supabase db push` against the linked `fieldquote` project; `20260728173000_initial_schema.sql` applied successfully.
- Ran `supabase db push --include-seed`; `supabase/seed.sql` loaded successfully.
- The only warning concerned an optional local Docker catalog cache. The remote migration and remote seed both completed.
- Current remote foundation: 16 RLS-enabled domain tables, company settings, and 28 electrician price-book items. No fake technician was inserted because technicians must have genuine Supabase Auth identities.

### 2026-07-29 — Iteration 3: RLS and profile lifecycle staged

- Added the Day-2 RLS migration for admin, technician, and anonymous waitlist access.
- Added a 1:1 Auth-user → profile trigger. Future users get a profile automatically; server-side provisioning may choose admin or technician, and the default is technician.
- Prepared backfill for the two existing real Auth users: `admin@example.com` as admin and `huraira.muzammel@gmail.com` as technician.
- Added a database guard preventing technicians from changing assignment, scheduling, quote, duration, company, or other protected job fields.
- Added the RLS negative-test script. It requires a privileged database connection and the technician UUID when run.

### 2026-07-29 — Iteration 4: RLS applied and profiles verified

- Applied `20260729124500_rls_profiles_and_auth.sql` successfully to the linked remote Supabase project.
- Verified the 1:1 backfill remotely: `admin@example.com` is active with the `admin` role; `huraira.muzammel@gmail.com` is active with the `technician` role.
- Updated the committed local Supabase config to disable email/public signup for local development.
- Remote hosted Auth still needs **Authentication → Settings → Allow new users to sign up = off**. This requires a Supabase dashboard action or a Management API personal access token; neither is available through the linked CLI. Password recovery remains available for existing users after sign-up is disabled.

## Complete

- [x] Supabase project initialized and linked.
- [x] Initial schema migration created in `supabase/migrations/`.
- [x] Electrician price-book seed created in `supabase/seed.sql`.
- [x] All domain tables have RLS enabled from creation.
- [x] Migration pushed to remote Supabase.
- [x] Electrician company settings and 28-item price book seeded remotely.
- [x] RLS/profile migration pushed to remote Supabase.
- [x] Existing admin and technician profiles backfilled and verified remotely.
- [ ] RLS negative test run with the technician UUID.
- [ ] Hosted Supabase Auth public sign-up disabled.

## Next up — in order

1. Disable public sign-up in hosted Supabase Auth; only the future admin-gated invite function may create staff users.
2. Run the RLS negative suite with Huraira's technician UUID.
3. Configure Bubble Auth/API Connector: anon key plus dynamic JWT `Authorization` header.
4. Prove login, password recovery, silent token refresh, and role routing in Bubble.
5. Build the admin-gated technician invitation edge function.
6. Configure R2 presigned uploads and the realtime bridge before public intake work.

## Guardrails to re-check on every backend change

- Migration changes only; never dashboard-only schema edits.
- RLS is the authorization boundary.
- Prices use `numeric`; historical quote values are snapshots.
- No secrets in Bubble, the landing client, or Git.
- Payments and job events remain append-only.
- AI may match a price-book item but never author a price.
