# FieldQuote backend progress

This is the running backend handover. Update the newest entry first after every backend iteration: what changed, what was verified, what is blocked, and the next exact action.

## Current position

**Phase:** Week 1, Day 1 complete — schema and electrician price-book foundation. Next: Day 2 RLS policies and negative tests.

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

## Complete

- [x] Supabase project initialized and linked.
- [x] Initial schema migration created in `supabase/migrations/`.
- [x] Electrician price-book seed created in `supabase/seed.sql`.
- [x] All domain tables have RLS enabled from creation.
- [x] Migration pushed to remote Supabase.
- [x] Electrician company settings and 28-item price book seeded remotely.

## Next up — in order

1. Install/use the Supabase CLI and run `supabase db push` against the linked project.
2. Inspect the remote tables and run the seed in the target environment.
3. Add Day-2 RLS policies and negative tests—admin full access; technicians limited to their jobs; anon limited to waitlist insertion.
4. Configure Supabase Auth: disable public signup, seed the admin safely, then prove Bubble login/refresh and role routing.
5. Add the Bubble API Connector with the anon key and dynamic JWT `Authorization` header.
6. Build technician invitation as an edge function; create real technician auth users and matching profiles.
7. Configure R2 presigned uploads and the realtime bridge before public intake work.

## Guardrails to re-check on every backend change

- Migration changes only; never dashboard-only schema edits.
- RLS is the authorization boundary.
- Prices use `numeric`; historical quote values are snapshots.
- No secrets in Bubble, the landing client, or Git.
- Payments and job events remain append-only.
- AI may match a price-book item but never author a price.
