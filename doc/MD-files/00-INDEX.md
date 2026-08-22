# FieldQuote docs — reading / build order

Two sequences, **numbered separately**:

- **`learn/`** — concepts, walkthroughs, practice (how it works)
- **`perform/`** — how each task was wired in Bubble / backend (how I did it)

`doc/memory/` is handoff notes for chats, not these guides.

## Plan (architecture)

| # | File | Role |
|---|------|------|
| P1 | `doc/plan/P1-roadmap.md` | Week/day build sequence |
| P2 | `doc/plan/P2-backend.md` | Schema, connectors, Realtime §3.5, secrets |
| Scope | `doc/FieldQuote.docx` | Official AC / rules (source of truth) |

## Learn (`doc/MD-files/learn/`)

Read in this order. Numbers are **learn-only**.

| # | File | Role |
|---|------|------|
| L01 | `01-supabase-bubble-api-connector-guide.md` | API Connector fundamentals |
| L02 | `02-fieldquote-supabase-bubble-auth-guide.md` | Auth connector reference (FieldQuote) |
| L03 | `03-complete-intake-pipeline-plan.md` | Intake → inbox explanation |
| L04 | `04-fieldquote-edge-functions-guide.md` | Edge functions code walkthrough |
| L05 | `05-cachebust-initialize-cheatsheet.md` | Cache-bust URL pattern (cheat sheet) |
| L06 | `06-postgrest-embed-practice.md` | Nested `select=` / FK embeds (drills) |
| L07 | `07-r2-presign-public-vs-private.md` | R2 bucket, presign, public vs private, email logos |

## Perform (`doc/MD-files/perform/`)

Build / “how I did it” order. Numbers are **perform-only** (not the same as L01…).

| # | File | Role |
|---|------|------|
| P01 | `01-fieldquote-auth-implementation-guide.md` | Login / SessionKeeper / invite UI |
| P02 | `02-fieldquote-company-pricebook-guide.md` | Company settings + price book |
| P03 | `03-multi-image-upload-dictation-flow.md` | Intake photos / dictation |
| P04 | `04-supabase-login-bad-json-debug-log.md` | Login JSON debug notes |
| P05 | `05-request-inbox-ai-quote-send-guide.md` | Inbox → draft → send (full connector tables) |
| P11 | `11-dynamic-company-branding-guide.md` | Company name + logo (R2, email, Bubble cache) |
| P12 | `12-make-com-review-loop-guide.md` | Make.com: final pay → Form feedback email + Jobs Done sheet |
| P06 | `06-sessionkeeper-cachebust-fix-guide.md` | SessionKeeper fix + cache-bust interim |
| P07 | `07-realtime-cachebust-to-supabase-guide.md` | Cache-bust → true Realtime |
| P08 | `08-quote-request-ai-patch-send-guide.md` | Request → AI → Patch/Save → Send |
| P09 | `09-admin-assign-technician-guide.md` | Admin Payments + Jobs + Assign popup |
| P10 | `10-resend-invite-technicians-table.md` | Resend invite when `setup_complete` is no |

## Handoff / task memory

| File | Role |
|------|------|
| `doc/memory/00-NOW.md` | **Paste into new chats** — current task only |
| `doc/memory/00-INDEX.md` | Memory folder index |
| `doc/memory/tasks/*.md` | One memory file per task (required form) |
| `PROJECT_MEMORY.md` (repo root) | Short pointer → `doc/memory/` |

**Ignore:** `doc/MD-files/_archive/` (duplicate of P01).

**Updated:** 2026-08-21 — P12 Make.com review loop.
