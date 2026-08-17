# Quote flow — Request → AI draft → Patch/Save → Send

**Status:** MOSTLY DONE (polish / Send edge cases remain)  
**Guide:** `doc/MD-files/perform/08-quote-request-ai-patch-send-guide.md` (+ connectors in `perform/05-…`)  
**Last updated:** 2026-08-11

---

## Paste for new chat (5–10 lines)
- Quote money is **DB-only** (trigger on line PATCH). Per-line Save → Get Quote Action → **Display data** popup + bust.  
- Popup Get Quote needs **`status=neq.[bust]`** (not `updated_at`) or Bubble caches totals; bump bust **before** Display data.  
- List Quotes can embed `requests(customer_name,customer_email)`.  
- `submit-request` accepts Bubble `media`/`honeypot`; `draft-quote` Z.AI hardened (thinking/text flash + `zai_error`).  
- **Current focus moved to Realtime** — see `02-realtime-hybrid.md` / `00-NOW.md`.

---

## Goal
Admin: Draft with AI → edit lines → Save per row → see live totals → Send when all priced → customer token email.

## Decisions (locked)
| Decision | Choice | Why |
|----------|--------|-----|
| Money math | DB trigger `sync_quote_from_line_items` | No Bubble `s_calc_*` / Patch Totals for Save |
| Save UX | Per-line Save only | Drop big Save Quote / `s_quote_saved` |
| Popup totals refresh | Display data Get Quote **Data** + bust param | Action alone does not redraw UI |
| Get Quote bust | `status=neq.[bust]` | `updated_at=neq.0` → 22008 date error |
| Send gate | `s_needs_manual_pricing is no` (+ optional dirty) | Flag from Get Quote / Draft |
| Deposit | `total × deposit_pct/100` upfront | Not full job price |

## Done
- [x] Migrations: `needs_manual_pricing`, recalc totals on line change  
- [x] Per-line Patch Quote Line + Get Quote Action + Display data pattern  
- [x] Get Quote Data bust via `status=neq.[bust]`  
- [x] List Quotes customer embed (name/email)  
- [x] `submit-request` parse Bubble `media` + fail loud on media insert  
- [x] `draft-quote`: disable thinking on text models; strip tags; text model `glm-4.5-flash`; return `zai_error` on fallback  
- [x] E2E smoke script documented in chat (Maya Chen kitchen quote)

## In progress / next (when returning to quotes)
1. Confirm Send Quote uses page/`quote_id` JSON-safe (not wrong Parent id on request popup)  
2. Optional `s_line_dirty`  
3. AI notes expandable in popup  
4. Instant bumps after Draft/Send → point at **SessionKeeper** bust states once Realtime lands  

## Blockers / pitfalls
| Issue | Fix |
|-------|-----|
| Table updates, popup totals stale | Get Quote Data missing bust; Display data before bump |
| `(Data with ID "undefined")` | Empty `line_id` / `request_id` / media key |
| Z.AI “not used” but draft works | Check `ai_provider` / `ai_fallback` / `zai_error` |
| Bubble Submit `media` vs edge `photo_keys` | Fixed in `submit-request` — redeploy if old |

## Files / migrations / functions
| Kind | Path or name | Notes |
|------|----------------|-------|
| Guide | `perform/08-quote-request-ai-patch-send-guide.md` | |
| Migration | `20260810140000_quotes_needs_manual_pricing.sql` | |
| Migration | `20260810153000_quotes_recalc_totals_on_line_change.sql` | |
| Edge | `draft-quote`, `send-quote`, `resolve-quote-token`, `submit-request` | Deployed in prior sessions |

## Bubble checklist
- [ ] Popup texts bind Parent group Get Quote money fields  
- [ ] Line Save: Patch → Get Quote Action → bump bust → Display data  
- [ ] Send enabled only when priced  
- [ ] Send `quote_id` = state JSON-safe  

## Test plan
- [ ] Maya Chen smoke: draft → save lines → totals 444-ish → send → email token  
- [ ] Manual pricing line blocks Send until filled  
- [ ] Popup totals change without full page refresh  
