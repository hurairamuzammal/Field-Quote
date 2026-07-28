# FieldQuote — Learning + Build Roadmap (v2 — aligned to the scope doc's §16 weeks)

**Pace:** 6 hrs/day × 5 days/week, optional Bonus Day each week.
**Companion:** `backend.md` — schema, connection patterns, secrets. Read its §1 before Day 1's schema work.

**What changed in v2:**
1. **Weeks now match §16 of the scope doc exactly** — Week 1: schema/RLS/seed + Bubble auth + realtime bridge + R2 presign proven; Week 2: intake + AI drafting; Week 3: quote→Stripe→webhook→job; Week 4: scheduling + tech view + automations; Week 5: ops assistant + landing + polish + demo. (This supersedes the earlier "Week 5 = pure buffer" rule — the doc's Week 5 contains real deliverables, so the buffer behavior now lives in the *priority ladder* at the end: if you're behind, Week 5 items are consumed in that order and the assistant is the negotiated cut.)
2. **One GitHub repo, not two.** A monorepo works fine here: Vercel's *Root Directory* setting points at the `landing/` folder, so only that folder builds and deploys. Layout:
   ```
   fieldquote/
     supabase/          ← migrations + edge functions (CLI-managed)
     landing/           ← Next.js app  → Vercel Root Directory = landing
     tests/rls/
   ```
   Why I originally split them: keeping Vercel's build scope clean and PR histories separate — real benefits on team projects, unnecessary overhead for one trainee. One repo = one clone, one PR stream, one place for your senior to review. Only footnote: pushes that touch only `supabase/` will still trigger a (harmless, fast) Vercel build; silence it later with Vercel's "Ignored Build Step" if it bugs you. `backend.md` §6 is updated to match.
3. **Old Days 1+2 merged into Day 1** (you flagged them as easy/connected), everything shifted up, and **Day 5 gets the freed slot: realtime bridge + R2 presign end-to-end** — which is exactly what §16 demands inside Week 1 anyway, so the shift makes the plan *more* compliant, not less.

**Danger-zone map (unchanged):** 🔴 Stripe webhook (Day 13) · 🔴 API Connector JWT plumbing (Day 3) · 🟠 Claude structured output (Day 8) · 🟠 RLS (Day 2) · 🟡 pg_cron (Day 18).

Every day: **🎓 Learn** (≤90 min, why-it-matters included) → **🔨 Build** (with the *what/where/trigger/does/tables* block for backend pieces) → **✅ Done when** (gate to the next day).

---

# WEEK 1 — §16: "Supabase schema + RLS + seed price book; Bubble auth flow; realtime bridge element; R2 presigned upload proven end-to-end"

## Day 1 — Setup + the entire schema (merged day)
**🎓 Learn (75 min total, split):** (a) What a migration is: a numbered SQL file in Git that rebuilds your DB from nothing — the Git-tracked-server-work requirement made real (backend.md §6 for commands). (b) The four data-modeling ideas this whole project uses — read backend.md §1.1–1.2: *things*, *belongs-to via foreign keys*, *snapshots*, *append-only logs*. Internalize especially why `quote_line_items` copies `unit_price` instead of pointing at it.

**🔨 Build:**
- Accounts: Supabase project, Stripe **test mode**, Resend (agency domain — ask your senior), R2 bucket + S3 keys, Make.com, Vercel. Map every key to its home using backend.md §7 now.
- **One repo** `fieldquote/` per the layout above. `supabase init` + `supabase link` inside it (backend.md §6).
- `landing/`: `npx create-next-app`, placeholder page, push, import to Vercel with **Root Directory = landing**, watch it deploy. (GitHub→Vercel pain point: done, Day 1.)
- Migrations creating **every** table from backend.md §1.3 — including Week-4/5 tables (`email_log`, `assistant_actions`, …). Empty tables are free; mid-Stripe-week migrations are not.
- Seed script: company + settings + **25+ price book items across 4+ categories** (§4.2) with generous keywords — Week 2's AI quality depends on them.
- Bubble: create app, install Toolbox, empty pages (`login`, `reset`, `admin`, `tech`, `request`, `q`), admin shell nav (static).

**Risk:** 🟢 Low — but it's a *full* day; if account provisioning drags (Resend domain access), push the Bubble shell to Day 2's UI slot.
**✅ Done when:** `supabase db push` succeeds; all tables visible; seed runs repeatably; Vercel URL live; Bubble has all six pages; you can explain the snapshot rule out loud.

## Day 2 — RLS + negative tests ⚠️ DANGER ZONE
**🎓 Learn (75 min):** RLS = WHERE clauses the DB staples onto every query from the JWT (`auth.uid()`). Bubble-hidden buttons are decoration (§13 Rule 6); the final eval attacks the database directly. backend.md §2 end to end.

**🔨 Build — Backend pieces:** RLS enablement + policies (migration, in Postgres, fired automatically on every query): technicians → own `jobs`/`job_events`/`job_media` only, status/notes column-limited (backend.md §2.3); admin full; anon → `waitlist` INSERT only; quotes/payments/price_book/requests/settings/logs have *no* tech or anon policy at all — absence is denial. Plus the negative-test script in `tests/rls/` (backend.md §2.5), re-run after every future migration.
**Bubble UI in parallel:** Price Book screens (list, search/filter, add/edit) — wired tomorrow.

**Risk:** ⚠️ Too-tight policies = mysterious empty screens later; too-loose = failed eval. The script tells you which. Whole afternoon budgeted.
**✅ Done when:** tests pass; you broke one policy on purpose, watched the script catch it, fixed it.

## Day 3 — API Connector day: Bubble ↔ Supabase auth ⚠️ DANGER ZONE
**🎓 Learn (90 min):** The API Connector — your declared weak spot #2, taught the day you need it: calls as saved HTTP templates, initializing, private vs **dynamic** headers. backend.md §3.1–3.4 is the literal click-path.

**🔨 Build — Backend pieces (API Connector calls — no code; live in Bubble → Plugins; triggered by workflows):** login / refresh / recover / logout (`/auth/v1/...`), `GET /rest/v1/profiles` for role routing, `GET/POST/PATCH /rest/v1/price_book_items` wiring yesterday's UI. The session-keeper reusable element (silent refresh <5 min before expiry; fail → login). Role routing live; wrong-role URL redirects (cosmetic — RLS is the wall).

**Risk:** ⚠️ The dynamic `Authorization: Bearer [token]` header — missing/static doesn't error, it returns empty lists and you'll debug the wrong layer. Prove ONE authenticated read end-to-end before wiring more.
**✅ Done when:** login → role landing → live seeded price book → add an item → logout bounces you; a JWT-less curl gets nothing.

## Day 4 — First edge function: technician invites
**🎓 Learn (60 min):** Edge functions: small TypeScript endpoints inside Supabase where secrets are safe. The project's routing rule (backend.md §3.6): Bubble = screens, PostgREST = authenticated CRUD, edge functions = secrets/public/multi-step, pg_cron = the clock. Note: **Bubble backend workflows are used for nothing** in this stack. Deploy loop: `supabase functions deploy`.

**🔨 Build — Backend pieces:**
- `invite-technician` fn — **where:** `supabase/functions/`; **trigger:** admin Invite button (admin JWT verified); **does:** create auth user with role metadata (service role) → set-password link → Resend email → clean 409 on duplicates; **tables:** `profiles` (via trigger), `email_log`.
- `handle_new_user()` DB trigger (migration) auto-creating `profiles` from auth metadata.
**Bubble UI:** Settings form (`company_settings`), team list + invite modal + deactivate toggle (blocks login, unassigns *future* jobs only, §3.2). **Landing:** one-section hero replaces the placeholder.

**Risk:** 🟡 First Deno deploy fumbles (env vars, CORS — copy backend.md §5.1's block).
**✅ Done when:** invite email → set password → that user logs into Bubble and sees the empty tech view.

## Day 5 — Realtime bridge + R2 presign, proven end-to-end (the freed slot — closes out §16 Week 1)
**🎓 Learn (60 min, two shorts):** (a) Presigned URLs: your edge function signs a short-lived upload URL; the browser PUTs **straight to R2**; the DB stores only the key (§13 Rule 9). (b) Supabase Realtime: the DB broadcasts row changes; a small supabase-js element converts them into Bubble events; realtime obeys RLS too.

**🔨 Build — Backend pieces:**
- `r2-presign` fn — **where:** functions; **trigger:** any page needing an upload/download URL (intake next week, tech photos in Week 4); **does:** validate type/size (images ≤10MB, audio ≤20MB, §5.1) → presigned PUT (and GET mode) via R2's S3 API (`aws4fetch`); **tables:** none (keys saved by callers). **Set the R2 bucket CORS (backend.md §5.2) BEFORE the first test** — this is the classic half-day sink, pre-empted.
- **RealtimeBridge** reusable element (HTML + Toolbox, snippet in backend.md §3.5) subscribed to `requests`/`quotes`/`jobs`/`payments`, with a "live" indicator + reconnect; enable the tables on the realtime publication (one SQL line).
**Proof, per §16:** a throwaway Bubble test page uploads a photo → visible in the R2 dashboard → key held in Bubble state → re-displayed via presigned GET. Insert a row into `requests` from the SQL editor → the open admin page reacts without refresh.

**Risk:** 🟠 Medium — CORS and the JS bridge are both first-times, but each is small.
**✅ Done when:** both §16 Week-1 proofs above pass; oversized/wrong-type uploads are rejected politely.

**⭐ Bonus Day (optional):** Head start on the public intake page UI (form layout, states) — pure Bubble, de-risks Day 6.

---

# WEEK 2 — §16: "Public intake (text/voice/photos) → admin realtime inbox; AI quote drafting + review/edit screen with guardrails"

## Day 6 — Public intake page, complete UI + uploads
**🎓 Learn (30 min):** Browser Web Speech API: `webkitSpeechRecognition` dictates into the textarea; undefined → hide the mic (the graceful-degrade AC, §5.1). Claude is *not* the transcriber [scope ASSUMPTION]; raw audio uploads for reference only.

**🔨 Build:** the `/request` page in full — description + mic dictation, up-to-5 photos + optional audio through Day 5's presign, contact + preferred-timing fields, honeypot field, loading/error/offline-retry states. Wire uploads for real.
**Risk:** 🟢 Low (presign already proven). **✅ Done when:** incognito, you can fill everything and hold all R2 keys in state, dictation works in Chrome and hides in an unsupported browser.

## Day 7 — Submit pipeline + realtime inbox
**🎓 Learn (45 min):** Why public intake must NOT be an anon PostgREST insert (junk floods, schema probing) — instead: edge function validates, *then* service role writes. The gatekeeper pattern you'll reuse for tokens and webhooks (backend.md §2.4).

**🔨 Build — Backend piece:** `submit-request` fn — **trigger:** intake Submit; **does:** honeypot → per-IP rate limit → email/phone format checks → insert `requests` (status `new`) + `request_media` → Resend confirmation (customer) + notification (admin) → `email_log`; **tables:** `requests`, `request_media`, `email_log`.
**Bubble UI:** admin Requests inbox (list, `new` highlighted; detail with description, contact, photos via presigned GET) — fed live by the Day-5 bridge.
**Risk:** 🟡 **✅ Done when:** a stranger's submission pops into the open inbox ≤2s without refresh; two emails arrive; a honeypot-filled submit is silently dropped.

## Day 8 — Claude day 1: structured drafting, text only ⚠️ DANGER ZONE
**🎓 Learn (90 min):** Your AI lesson, sized to this task: stateless Messages API; JSON-only output validated with Zod (never trust well-formedness); grounding = the model *chooses from* your price book; and the crucial one — **the guardrail is code, not prompt**: after Claude answers, your code verifies each `price_book_item_id` and overwrites the price with the stored one; unmatched → null → "needs manual pricing" (§13 Rule 1). Full design: backend.md §5.3.

**🔨 Build — Backend piece:** `draft-quote` fn v1 — **trigger:** admin "Draft with AI" (JWT verified); **does:** load request + active price book → Claude → parse strict JSON `{line_items[], assumptions[], clarifying_questions[], confidence}` (one retry on malformed, then a clean error — never a blank screen) → guardrail pass → store draft quote + lines, `ai_generated`, model, `ai_raw`; **tables:** read `requests`/`price_book_items`, write `quotes`/`quote_line_items`.
**Bubble UI:** the button + raw draft display.
**Risk:** ⚠️ Prompt-tuning has no bottom — timebox: 4 of 5 seeded requests sensible → stop. The guardrail is the AC, not perfect matching.
**✅ Done when:** grounded lines from a text request; an out-of-price-book request yields the null-item line; a forced-malformed response surfaces a retry.

## Day 9 — Claude day 2: vision + adversarial tests
**🎓 Learn (30 min):** Images to Claude: fetch R2 photos *inside the function* (presigned GET), base64 image blocks beside the text.
**🔨 Build:** v2 with up to 5 photos; surface confidence + clarifying questions; 3 adversarial seeds (vague / mixed-scope / out-of-scope) checked. **Bubble UI:** start the review screen — line items in an RG, assumptions/questions prominent on top (§6.2).
**Risk:** 🟡 **✅ Done when:** a photo demonstrably changes a draft; `ai_raw` browsable.

## Day 10 — Review & edit, complete (closes §16 Week 2)
**🎓 Learn (30 min):** DB-enforced state machines: a Postgres trigger rejecting illegal `quotes.status` jumps — the flow lives in the database, not Bubble goodwill.
**🔨 Build — Backend piece:** `quote_status_transition()` trigger (migration): `draft→sent→viewed→accepted|declined|expired` only. **Bubble UI (bulk of day):** add/remove lines, qty, price override with visible `overridden` flag, live subtotal/tax/deposit from settings, internal notes, **Send disabled while any line is unpriced** (server re-checks on Day 11 anyway).
**Risk:** 🟢 Bubble-strengths day before Stripe week. **✅ Done when:** AI draft → clean approved quote; curl-ing an illegal status jump gets rejected by the DB.

**⭐ Bonus Day:** CSV import for the price book (§4.2 nice-to-have); intake state polish.

---

# WEEK 3 — §16: "Quote send (Resend + token page) → accept → Stripe deposit → webhook → job created; decline/expiry paths"

## Day 11 — Tokenized delivery (Stripe's warm-up)
**🎓 Learn (45 min):** The tokenized-link pattern (§13 Rule 5): no customer accounts, so a ≥20-char random token in the URL is the key; `quotes` is never anon-readable; a server-side resolver returns display-safe fields only. 32 hex chars ≈ unguessable; no anon policy ≈ unenumerable.
**🔨 Build — Backend pieces:** `send-quote` fn (**trigger:** Send button; **does:** server-side unpriced-line re-check → snapshot totals → status `sent` + `valid_until` → token → branded Resend email with `/q/<token>` → `email_log`) and `resolve-quote-token` fn (**trigger:** public `q` page load; **does:** service-role lookup → unknown/expired → friendly dead-end → first hit stamps `viewed_at` + status `viewed` → safe JSON). **Bubble UI:** the public quote page (lines, totals, deposit, validity, company details, Accept / Decline-with-reason — wired Day 12).
**Risk:** 🟡 **✅ Done when:** email link renders the quote; mangled token → friendly page; `viewed_at` stamps once; anon `/rest/v1/quotes` returns nothing.

## Day 12 — Stripe part 1: Checkout Sessions
**🎓 Learn (75 min):** Stripe minimum viable model: you never touch cards (§13 Rule 4); server asks Stripe for a Checkout Session with your metadata; customer pays on *Stripe's* page; the success redirect **proves nothing** — truth arrives via tomorrow's webhook. Test card `4242…`.
**🔨 Build — Backend piece:** `create-checkout` fn — **trigger:** Accept on `/q/<token>`; **does:** re-resolve token → status/expiry check → Session for `deposit_amount`, `metadata:{quote_id, kind:"deposit"}` → redirect URL; Decline records reason + notifies admin; **tables:** `quotes`. **Bubble UI:** wire Accept/Decline; "payment processing…" return page (completes Day 14); pipeline board columns started.
**Risk:** 🟡 **✅ Done when:** Accept → Stripe-hosted page, right amount, test card "pays" (and your DB correctly shows *nothing yet*).

## Day 13 — Stripe part 2: the webhook ⚠️⚠️ DANGER ZONE (the big one)
**🎓 Learn (90 min):** The three pillars, because the final eval replays an event at you: **signature on the RAW body** (verify before any parse; fail → 400, write nothing), **idempotency** (event id in a UNIQUE column; duplicate insert → caught → still 200), **metadata linkage**. Tooling: `stripe listen --forward-to`, `stripe trigger`. Working Deno code: backend.md §5.4.
**🔨 Build — Backend piece:** `stripe-webhook` fn — the most important function in the project. **Trigger:** Stripe's servers. **Does:** verify → `checkout.session.completed` + `kind=deposit` ⇒ insert `payments` (event id UNIQUE) → quote `accepted` → **auto-create `jobs`** (`unscheduled`) → confirmations; `checkout.session.expired` ⇒ session dead, quote still actionable. Money fields from the webhook payload only (§7.3). **Tables:** `payments`, `quotes`, `jobs`, `email_log`.
**Risk:** ⚠️⚠️ Whole day; expect the signature to fail 3+ times (raw-body handling). Touch nothing else today.
**✅ Done when:** pay → accepted + job + payment; replay twice → still exactly one of each; tampered body → 400, zero writes. **Save these as a script** — regression + demo.

## Day 14 — Money-path hardening + live confirmation
**🎓 Learn:** none — deliberate slack for Day 13 overrun.
**🔨 Build:** all paths end-to-end: accept→pay→job; decline; expiry (hand-set `valid_until` yesterday → token page dead, accept refused server-side). Realtime: `payments`/`jobs` inserts flip the customer's processing page and pop the job on the board (§7.2 — status only after webhook). **Bubble UI:** pipeline board finished; quote detail shows payment state + job link.
**Risk:** 🟡 buffer by design. **✅ Done when:** three paths clean; board reacts ≤2s; replay script green.

## Day 15 — Week-3 closeout: eval-grade money demo + admin money views
**🔨 Build:** rehearse the §16 Week-3 deliverable as a demo (request→draft→send→view→accept→pay→job, then decline and expiry variants); admin payments list + `email_log` browser; fix everything the rehearsal surfaces; PRs tidy with § references.
**Risk:** 🟢 **✅ Done when:** you can run the full money demo cold, twice, no surprises.

**⭐ Bonus Day:** Tech mobile layout skeleton (pure UI) — softens Week 4.

---

# WEEK 4 — §16: "Scheduling + technician mobile view + job events; completion → final invoice → Make.com review loop; pg_cron follow-ups/reminders"

## Day 16 — Scheduling & assignment
**🎓 Learn (30 min):** SQL overlap detection per tech via `tstzrange(...) && ...` — a *warning*, not a block (§8.1 [ASSUMPTION] — confirm with your senior).
**🔨 Build — Backend pieces:** job-status trigger (migration): `unscheduled→scheduled→en_route→in_progress→completed` + `cancelled` pre-completion, every change auto-appending `job_events` (who/when/from/to). Scheduling writes = plain `PATCH /rest/v1/jobs` with the admin JWT (RLS covers it — no function needed); overlap check = one GET before save. Shared `send-email` helper started; customer confirmation (date/time + tech first name). **Bubble UI:** week calendar, job detail (customer, quote lines, media), tech picker + slot.
**Risk:** 🟢 **✅ Done when:** job scheduled + assigned; deliberate double-book warns; email arrives; `job_events` shows the trail.

## Day 17 — Technician mobile view
**🎓 Learn (30 min):** Column-limited updates for techs (status/notes only — backend.md §2.3's grant approach).
**🔨 Build:** tech pages mobile-first at 375px: today-first "My Jobs" (RLS delivers only theirs), one-tap `en_route`/`in_progress`/`completed`; completion **requires ≥1 photo** (reuse `r2-presign` → `job_media`) + notes; prices in no tech-visible `select=` (and RLS blocks the tables anyway). Realtime: tech changes move admin-board cards live.
**Risk:** 🟡 **✅ Done when:** on a real phone, start-to-finish job; photo-less completion refused; zero price leakage; events complete.

## Day 18 — pg_cron + quote follow-ups ⚠️ DANGER ZONE
**🎓 Learn (60 min):** pg_cron = a clock inside Postgres; `pg_net` HTTP-POSTs to your functions on schedule; no user JWT exists, so a shared `x-cron-secret` header is validated first (backend.md §5.5). Pattern for everything recurring: one daily cron per function; the function decides what's due.
**🔨 Build — Backend piece:** `quote-followups` fn + daily cron (+ a manual admin trigger button — build one for every cron job): sent-unviewed 48h → reminder; viewed-unanswered 3d → follow-up; past `valid_until` → `expired`. Copy = Claude filling a **locked admin-approved template** with a code-side fallback to plain merge-fields (§9.1); **cap of 2 per quote enforced by counting `email_log`**, not by trusting the code path (§13 Rule 8). **Tables:** `quotes`, `email_log`.
**Risk:** ⚠️ Real-time-based testing is miserable — accept a `now` override param and simulate "48h later" instantly.
**✅ Done when:** each branch fires exactly once under simulated time; the 3rd follow-up is refused by the cap; expired token page is dead.

## Day 19 — Reminders: appointments, digest, invoice nudges
**🔨 Build — Backend piece (yesterday's pattern, composed):** `daily-reminders` fn + cron: customer T-1 for tomorrow's jobs; tech morning digest; unpaid final-invoice nudges +3/+7 then admin flag — never more (§9.2). All through `send-email`, all logged, all capped via `email_log`. **Bubble UI:** automations pause toggle in Settings; "automation activity" feed off `email_log`.
**Risk:** 🟢 **✅ Done when:** simulated dates fire each once; caps hold.

## Day 20 — Completion → final invoice → Make.com review loop (closes §16 Week 4)
**🎓 Learn (30 min):** Make scenario = webhook-in → actions-out; isolation rule: Make failing must never block payment recording (§9.3) — fire-and-forget + logged failure.
**🔨 Build — Backend pieces:** job `completed` fires `send-final-invoice` (total − deposit → Checkout link via `create-checkout` with `kind:"final"` → invoice email); `stripe-webhook` gains the `kind=final` branch (record payment → fully paid → fire the Make webhook: review-request email with Google link [NEEDS CLIENT INPUT — confirm platform with your senior] + Sheets "jobs done" row). **Re-run the Day-13 replay script — you changed money code.** **Tables:** `jobs`, `quotes`, `payments`, `email_log`.
**Risk:** 🟡 **✅ Done when:** completion → working invoice link → test pay → review email + Sheets row; a killed Make scenario still records payment cleanly; replay script green.

**⭐ Bonus Day:** Assistant tool functions as plain TypeScript (`search_quotes`, `get_pipeline_summary`) — no AI yet; halves Day 21.

---

# WEEK 5 — §16: "Agentic ops assistant; landing page (direction → build → deploy); polish of empty/error/loading states; demo script + walkthrough of every §13 rule"

## Days 21–22 — Ops assistant (§10)
Week-2 skills, composed. **D21:** the read tools as admin-JWT-gated TypeScript (`search_quotes`, `search_jobs`, `get_pipeline_summary`, `get_customer_history`) + the `ops-assistant` fn tool-use loop (history + tool defs → execute → `tool_result` → repeat, cap ~6; answers only from tool results; out-of-scope declined) + Bubble chat panel + `chat_sessions`/`chat_messages` + rough token count shown. **D22:** `draft_followup_email` → outbox for review (never auto-sends); `schedule_job` returns a **proposed action** the admin confirms in Bubble before a gated execute call; everything to `assistant_actions`.
**✅ Done when:** "what's unscheduled this week?" answers from live data; a proposed schedule executes only after confirmation and is logged; a "delete all quotes" ask is declined.

## Day 23 — Landing page (direction → build → deploy)
**Morning:** written design direction (type pairing, color system, motion — explicitly not purple-gradient-on-dark, §11) → **senior sign-off before building**. **Then:** build on the Day-1 scaffold — hero narrative (request → AI quote → deposit → job), how-it-works, highlights with *real screenshots you now have*, pricing placeholder, FAQ, waitlist (anon INSERT + `submit-waitlist` Resend confirmation — the one legitimate anon write; note per backend.md §8 that Vercel and Bubble still never call each other). Lighthouse ≥90 perf/SEO mobile on the deployed URL.
**✅ Done when:** live, ≥90, waitlist works end-to-end.

## Day 24 — Polish sweep
Empty/error/loading states across every screen; mobile passes; token-expiry mid-session; reconnect behavior on the bridge; copy/typo pass; PR backlog closed.

## Day 25 — Demo script + full §13 walkthrough
Write and rehearse the demo hitting **every** §13 rule live: the AI null-price flow and blocked send (R1–2), webhook replay not double-crediting (R3), no card fields (R4), a mangled token dying politely + anon API attempts failing (R5–6), secrets audit (R7), capped + logged sends (R8), R2-only files (R9), free tiers confirmed (R10). Run it cold twice.

**If you fall behind, consume Week 5 in this order (agreed cut = the assistant — confirm with your senior):**
1. Money path bulletproof (replay, decline, expiry) → 2. RLS tests green + tech price-invisibility → 3. AI guardrail demonstrable → 4. Automations correct *and capped* → 5. Demo script → 6. Landing polish → 7. Assistant (cut first), then CSV import, voice audio, Make review loop (keep invoice, drop review automation).

---

## Standing rules, every week
- Re-run `tests/rls/` after any migration; re-run the webhook replay script after any webhook change
- One PR per story, § number in the title; Bubble changes described with screenshots in the PR body
- [ASSUMPTION] / [NEEDS CLIENT INPUT] items → your senior, Week 1, in writing (double-booking warning-vs-block, review platform, the Week-5 cut order)
- A day's ✅ list is the gate: finish it before starting the next day, even at the cost of the bonus day
