# agent.md — FieldQuote

Agent + contributor guide for the `fieldquote` monorepo. Scope doc section references (§) point to the FieldQuote scope document. Read `backend.md` for the schema and connection patterns; read `roadmap.md` for build sequence.

## Repo layout

```
fieldquote/
  supabase/
    migrations/       ← all schema changes (CLI, numbered SQL)
    functions/        ← edge functions (Deno/TypeScript)
  landing/            ← Next.js App Router; Vercel Root Directory = landing
  tests/rls/          ← RLS negative tests (SQL)
  .env.example        ← env contract, no values
```

The Bubble app is NOT in this repo. Bubble changes are documented in PR descriptions (screenshots + workflow notes) alongside the server code they pair with.

## Non-negotiable rules

1. **RLS is the security boundary, not Bubble.** A technician sees only their jobs because of a Postgres policy (`technician_id = auth.uid()`), not because Bubble filtered a list. Every table has RLS on. Hiding a button in Bubble is UX, not security. (§13 R6)
2. **Money state changes only via the signature-verified, idempotent Stripe webhook.** Never from redirect/success URLs, never from Bubble workflows, never from any other function. `payments.stripe_event_id` is UNIQUE — replays must be no-ops that still return 200. If you touch `stripe-webhook`, re-run the replay test before opening the PR. (§13 R3)
3. **No card fields anywhere.** All payment collection is Stripe-hosted Checkout via redirect. (§13 R4)
4. **The AI never invents a price.** Every priced line references a live `price_book_item_id` and the stored price is re-attached in code after parsing — the model's number is always discarded. Unmatched work → `price_book_item_id = null` → "needs manual pricing" → blocks sending. The guardrail lives in `draft-quote`'s validation pass, not in the prompt. (§13 R1–2)
5. **Customers exist only through tokenized links.** ≥20-char random tokens, resolved server-side (`resolve-quote-token`); the `quotes` table is never anon-readable; expired/declined quotes stop resolving to actionable pages. Never put a raw quote id in a customer-facing URL. (§13 R5)
6. **Secrets are server-only.** `ANTHROPIC_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY`, R2 keys, `SUPABASE_SERVICE_ROLE_KEY`, `MAKE_WEBHOOK_URL`, `CRON_SECRET` live in `supabase secrets` (or Vercel env for the landing) — never in Bubble, never committed, never `NEXT_PUBLIC_*`. The only key Bubble holds is the anon key. (§13 R7)
7. **Service role only after independent validation.** Public-facing functions (`submit-request`, `resolve-quote-token`, `create-checkout`, `stripe-webhook`, cron targets) validate first (honeypot/rate-limit, token match, Stripe signature, `x-cron-secret`) and only then use the service-role client.
8. **Every outbound email is logged to `email_log`; follow-ups are capped** (2 per quote, 2 per invoice) and the cap is enforced by counting `email_log`, not by trusting the code path. The system never spams. (§13 R8)
9. **Files live in R2 via presigned URLs**; the DB stores object keys only. Nothing in Bubble file storage, no public buckets. (§13 R9)
10. **Schema changes go through migrations** (Supabase CLI, checked into `supabase/migrations`) so they're code-reviewed like everything else. No dashboard-only schema edits; if drift happens, capture it with `supabase db diff -f <name>` immediately. Applied migrations are never edited — mistakes get a new corrective migration.
11. **Append-only tables stay append-only.** `payments` and `job_events` get inserts, never updates/deletes. Status flows on `quotes` and `jobs` are enforced by DB triggers — don't bypass them with service-role writes.
12. **Free tiers only** (Supabase, Make, R2, Vercel hobby, Stripe test mode). Agency-provided keys: Claude + Resend. Don't add paid services. (§13 R10)

## Conventions

- TypeScript everywhere (Deno for edge functions, Next.js for landing).
- Money columns are `numeric`, never float. Amounts snapshot onto quotes/lines at draft/send time; live tables (price book, settings) are pointed at, historical documents copy. (backend.md §1.1)
- One shared `send-email` helper for all Resend sends; every send writes `email_log`. Don't scatter raw Resend calls.
- Keep the Stripe client, R2 signing, and Claude calls each in one module per function folder (or a shared `_lib/`); don't duplicate integrations across functions.
- PostgREST calls from Bubble list explicit `select=` columns — never `select=*` (tech-visible calls must be physically unable to request price fields).
- Don't add a dependency for something a few lines of stdlib/Deno/Supabase already do.
- Copy the env contract from `.env.example`; if you add an env var, add it there too (name only, no value) and to the secrets table in `backend.md` §7.
- Anything not in the scope doc's acceptance criteria is out of scope without approval; [ASSUMPTION] / [NEEDS CLIENT INPUT] items go to the supervising senior, never silently reinterpreted.

## Testing gates (run before every PR)

- `tests/rls/` negative suite — after ANY migration.
- Webhook replay script (trigger → replay same event → assert exactly one payment + one job; tampered body → 400, zero writes) — after ANY change to `stripe-webhook`, `create-checkout`, or payment-adjacent code.
- Cron functions accept a `now` override param — test time-based branches with simulated dates, don't wait for real time.

## Git / PR workflow

- Branch from `main`: `feat/<area>-<slug>` (e.g. `feat/stripe-webhook`, `feat/draft-quote-guardrail`). Short-lived.
- One PR = one story from the scope. Reference the section number (e.g. "§7.3") in the PR description.
- PRs touching `landing/` get an automatic Vercel **preview URL** — include it so the reviewer can test. PRs touching only `supabase/` don't need one.
- Bubble work has no diff — describe it in the PR body with screenshots and the workflow names changed.
- `main` has **no technical protection** (free plan) — the rule is social and absolute: **never push directly to `main`, never merge your own PR.** Branch → PR → senior reviews → senior merges. Wait for approval + merge; don't self-merge even though nothing blocks it.
- Merges are **squash** merges. Keep the PR title clean; it becomes the commit.

## Git identity (important)

PRs are authored from each dev's **personal GitHub account** — even though the Claude Code they use is authenticated under `tools@lowcodeflow.co`. Claude Code's login does **not** set commit authorship; git config does. Set your local identity per clone or commits will be misattributed:

```
git config user.name  "Your Name"
git config user.email "your-personal@email"   # the email on your GitHub account
```

- Run this **per clone** (no `--global`) so it only affects this repo.
- Verify with `git config user.email` before your first commit.
- The account that pushes the branch (your personal login, added as a collaborator) must match the git author.

## Local dev

- `npm i -g supabase`, then `supabase login` + `supabase link --project-ref <ref>` (you're a member of the org — pull keys from the dashboard).
- Create `.env.local` / set function secrets per `.env.example` (never commit values):
  - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase dashboard; the only client-safe vars (landing waitlist + Bubble connector).
  - `SUPABASE_SERVICE_ROLE_KEY` — dashboard; server-only, edge functions only.
  - `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` — Stripe dashboard, **test mode**; webhook secret comes from registering the endpoint (or `stripe listen` locally).
  - `ANTHROPIC_API_KEY`, `RESEND_API_KEY` — agency keys; request from the owner, you don't create these.
  - `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` — Cloudflare dashboard.
  - `MAKE_WEBHOOK_URL` — from the Make scenario; treat as a secret.
  - `CRON_SECRET` — invent a long random string; must match the value in the cron migration.
- Deploy loop: `supabase db push` (migrations), `supabase functions deploy <name>`, `supabase secrets set KEY=value`. Local function testing: `supabase functions serve <name>`.
- Stripe testing: `stripe listen --forward-to https://<ref>.supabase.co/functions/v1/stripe-webhook` (or the local serve URL), `stripe trigger checkout.session.completed`, card `4242 4242 4242 4242`.
- **Bubble:** editor access from the owner; the API Connector's only credential is the anon key (private shared header) + the dynamic per-call `Authorization: Bearer [user JWT]`. If a Bubble list is mysteriously empty, check that header before anything else.
- **Make.com / R2 / Resend domain:** scenario, bucket CORS (backend.md §5.2), and the verified sending domain are owner-provisioned; request access rather than creating parallel ones.