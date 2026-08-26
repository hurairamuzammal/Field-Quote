# FieldQuote task memory

Handoff notes **by task**. Paste **`00-NOW.md`** into a new chat first; open the linked task file for full detail.

| File | Role |
|------|------|
| [`00-NOW.md`](./00-NOW.md) | **Current task only** — paste into new chat |
| [`_TEMPLATE.md`](./_TEMPLATE.md) | Required shape for every task memory |
| [`tasks/`](./tasks/) | One file per workstream |
| [`shared/`](./shared/) | Constants, bugs, deploy — not a single feature |

### Tasks
| File | Status | Topic |
|------|--------|-------|
| [`tasks/01-quote-ai-patch-send.md`](./tasks/01-quote-ai-patch-send.md) | Mostly done / Save polish | Draft → Save → Send; popup Display/RG/busy pitfalls |
| [`tasks/02-realtime-hybrid.md`](./tasks/02-realtime-hybrid.md) | In progress / polish | SessionKeeper Realtime |
| [`tasks/03-admin-snackbars.md`](./tasks/03-admin-snackbars.md) | **Later — 09 item 21** | Friendly alerts + 429 toasts |
| [`tasks/04-draft-ai-loading.md`](./tasks/04-draft-ai-loading.md) | In progress | Draft with AI — `perform/13` §3 |
| [`tasks/05-company-logo-r2.md`](./tasks/05-company-logo-r2.md) | **Done** (via **19**) | Logo + name; picker/Run JS polish 08-26 |
| [`tasks/07-change-password-ui.md`](./tasks/07-change-password-ui.md) | **Done** (via **19**) | Password = **forgot-email** reuse |
| [`tasks/06-admin-sidebar-full-height.md`](./tasks/06-admin-sidebar-full-height.md) | **Todo later** | Admin sidebar `100vh` |
| [`tasks/08-admin-assign-technician.md`](./tasks/08-admin-assign-technician.md) | In progress | Assign + `perform/13` §6–7 |
| [`tasks/09-security-hardening.md`](./tasks/09-security-hardening.md) | **Bubble pass verified** | Auth, rate limits, connectors; deploy if needed |
| [`tasks/10-technician-dashboard.md`](./tasks/10-technician-dashboard.md) | In progress | Tech UI — `perform/13` §9 |
| [`tasks/11-final-invoice.md`](./tasks/11-final-invoice.md) | **Worked** (Bubble JWT) | Complete → final invoice email |
| [`tasks/12-loading-shimmer-q-assign.md`](./tasks/12-loading-shimmer-q-assign.md) | In progress | `perform/13` §4 + §6 |
| [`tasks/13-q-success-copy.md`](./tasks/13-q-success-copy.md) | In progress | `perform/13` §5 |
| [`tasks/14-feedback-form-quote-stamp.md`](./tasks/14-feedback-form-quote-stamp.md) | **Done** | Form Responses quote_id stamp |
| [`tasks/15-realtime-live-indicator.md`](./tasks/15-realtime-live-indicator.md) | In progress | `perform/13` §8 |
| [`tasks/16-landing-waitlist.md`](./tasks/16-landing-waitlist.md) | **Done in repo** | §11 waitlist — deploy + Vercel env |
| [`tasks/17-week4-ui-polish.md`](./tasks/17-week4-ui-polish.md) | Optional | Bubble UX refinement |
| [`tasks/18-pg-cron-automations.md`](./tasks/18-pg-cron-automations.md) | Deploy pending | pg_cron §9.1–9.2 |
| [`tasks/19-profile-brand-password.md`](./tasks/19-profile-brand-password.md) | **Done** / logo Run JS fix | Profile + brand RE; delete `fqSetLogoPreview` |
| [`tasks/20-hide-send-when-viewed.md`](./tasks/20-hide-send-when-viewed.md) | **Todo** | Send still allowed when quote is `viewed` |

**Root** [`PROJECT_MEMORY.md`](../../PROJECT_MEMORY.md) is a short pointer here (legacy long dump retired).

**Guides:** [`doc/MD-files/00-INDEX.md`](../MD-files/00-INDEX.md) — `learn/` (concepts) vs `perform/` (how the work was done).

**Updated:** 2026-08-26 — logo Missing-token = leftover `fqSetLogoPreview`; quote dirty/Send + state cleanup in `tasks/01`; current = confirm logo → pg_cron (`tasks/18`)

