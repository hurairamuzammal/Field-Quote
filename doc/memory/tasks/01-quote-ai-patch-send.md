# Quote flow — Request → AI draft → Patch/Save → Send

**Status:** MOSTLY DONE (popup Save / RG / busy polish in progress)  
**Guide:** `doc/MD-files/perform/08-quote-request-ai-patch-send-guide.md` (+ connectors in `perform/05-…`)  
**Last updated:** 2026-08-26  
**Bubble export:** `fieldquote-26446 (3).bubble` (also `(2)`, `(1)`, `fieldquote-26446.bubble`)

---

## Paste for new chat (5–10 lines)
- Money is **DB-only** (trigger on line PATCH). Per-line Save only — no big Save Quote.
- **Never** Display data the **whole Popup Quote** after Save — that resets RG inputs to stale Initial content (looks like “revert”).
- Save: Patch → Get Quote **Action** (flag only) → bump SessionKeeper `s_quotes_ts` → Display data **G: Info Box** (or Status Row + Quote Rows) with **DB - Get Quote (Data)** + page `quote_id` + bust. Do **not** feed Action result into Display data (type mismatch).
- PopupOpened Display list **must** bind named params `quote_id` = page `quote_id`, `bust` = SessionKeeper `s_quotes_ts`. Broken / ID-only params can fall back to Initialize sample UUID → **wrong quote’s lines** under a correct header.
- RG unique id = **Current cell’s `id`** (never `skeleton`). Unique id is an **element property**, not a workflow step.
- Clear `s_draft_busy` **unconditionally** at end of Save (Only when Patch ok → busy sticks forever on error).

---

## Goal
Admin: Draft with AI → edit lines → Save per row → see live totals → Send when all priced → customer token email. Done when Save keeps typed line values, totals refresh, RG shows only that quote’s lines, and busy unlocks after Save.

## Decisions (locked)
| Decision | Choice | Why |
|----------|--------|-----|
| Money math | DB trigger `sync_quote_from_line_items` | No Bubble `s_calc_*` / Patch Totals for Save |
| Save UX | Per-line Save only | Drop big Save Quote / `s_quote_saved` |
| Save Display data target | **G: Info Box** (or header groups), **not** Popup Quote | Display data on popup resets every line Input to Initial content |
| Totals source for Display | **DB - Get Quote (Data)** + bust | Action result / `body` is a different Bubble type — Issue Checker red; headers stay stale |
| Get Quote Action use | Set `s_needs_manual_pricing` from Result’s **body** only | Not for Display data |
| Get Quote bust | `status=neq.[bust]` | `updated_at=neq.0` → 22008 date error |
| Lines list bust | `label=neq.[bust]` on Get Quote Lines | Same pattern as other lists |
| RG unique id | Current cell’s line `id` | `skeleton` = every row same key → stale Initial content |
| Open order | Set page `quote_id` **then** Show popup | PopupOpened must see the right id |
| Send gate | `s_needs_manual_pricing is no` (+ `s_line_dirty`) | Flag from Get Quote / Draft |
| Deposit | `total × deposit_pct/100` upfront | Not full job price |

## Done
- [x] Migrations: `needs_manual_pricing`, recalc totals on line change  
- [x] Per-line Patch Quote Line + Get Quote Action + Display data pattern  
- [x] Get Quote Data bust via `status=neq.[bust]`  
- [x] List Quotes customer embed (name/email)  
- [x] `submit-request` parse Bubble `media` + fail loud on media insert  
- [x] `draft-quote`: disable thinking on text models; strip tags; text model `glm-4.5-flash`; return `zai_error` on fallback  
- [x] E2E smoke script documented in chat (Maya Chen kitchen quote)  
- [x] Diagnosed Save revert = Display data on Popup (2026-08-26)  
- [x] Diagnosed wrong RG lines = PopupOpened Display list param / Initialize fallback  
- [x] Diagnosed stuck busy = `s_draft_busy` clear Only when Patch ok  

## In progress / next (when returning to quotes)
1. Confirm Bubble export has: Display list named `quote_id`/`bust`; Save Display → Info Box with **Data** call; busy clear always  
2. Network smoke: open quote A → `quote_line_items?quote_id=eq.<A>` (not Initialize sample `d527d4ac-…`)  
3. **Hide Send when `viewed`** — `tasks/20-hide-send-when-viewed.md`  
4. Confirm Send Quote uses page `quote_id` JSON-safe  
5. **`s_line_dirty`:** Send can email **DB** lines while popup inputs are unsaved — no dirty gate in export `(3)`. Add Input changed → dirty yes; Save clear; block Send  
6. **Popup cleanup:** bind money texts to **Popup: Quote’s** Get Quote fields; drop page `s_subtotal` / `s_tax_amount` / `s_total` / `s_deposit_amount` / `s_needs_manual_pricing` copies (Send reads Parent group). Keep `quote_id`, busy, SessionKeeper bust, optional dirty  
7. Optional AI notes expandable in popup  

## Diagnosed 2026-08-26 (chat)
- Unsaved line edits + Send = old email (server never sees inputs). Fix = `s_line_dirty` (or force Save), not more money custom states.
- Money page states duplicate Display data; PopupOpened even copied **subtotal** into total/tax/deposit states.

## Blockers / pitfalls
| Issue | Fix |
|-------|-----|
| After Save, totals update but qty/price snap back | Do **not** Display data **Popup Quote**. Display **Info Box** / header groups only. No Display list on Save. |
| Bust on RG Data source “does nothing” after open | PopupOpened **Display list** freezes the list; static Data source bust won’t replace it. Fix open Display list; don’t Display list on Save. |
| Display data red: “should be DB - Get Quote, is Get Quote action / body” | Groups are type **DB - Get Quote**. Use Get data from API → that **Data** call. Action is only for `s_needs_manual_pricing`. |
| RG shows lines from another quote; header looks right | Rebuild PopupOpened **Display list**; params must be named `quote_id` + `bust` = page / SessionKeeper. Watch Network for Initialize sample UUID. |
| `s_draft_busy` stuck; Send stays hidden | Clear busy with **no Only when** at end of Save (match Send workflow). |
| Unique id = `skeleton` | Set to Current cell’s `id` (element property on **RG: Quote Items**). |
| Table updates, popup totals stale | Get Quote Data missing bust; bump `s_quotes_ts` before Display data |
| `(Data with ID "undefined")` | Empty `line_id` / `request_id` / media key |
| Issue Checker: empty Display on Open/PopupClosed | Pre-existing; disabled/clear steps — ignore for Save work |
| Sidebar “None (Custom) is not a possible option” | Unrelated to quote Save |

## Files / migrations / functions
| Kind | Path or name | Notes |
|------|----------------|-------|
| Guide | `perform/08-quote-request-ai-patch-send-guide.md` | Per-line Save §6 |
| Migration | `20260810140000_quotes_needs_manual_pricing.sql` | |
| Migration | `20260810153000_quotes_recalc_totals_on_line_change.sql` | |
| Edge | `draft-quote`, `send-quote`, `resolve-quote-token`, `submit-request` | Deployed in prior sessions |
| Bubble | Popup Quote, RG: Quote Items, G: Info Box | Save + PopupOpened |

## Bubble checklist
- [ ] Open: set page `quote_id` → Show Popup Quote  
- [ ] PopupOpened: Display data Popup → **DB - Get Quote**; Display list RG → **DB - Get Quote Lines** with named `quote_id` + `bust`  
- [ ] RG unique id = Current cell’s `id`  
- [ ] Line Save: Patch → Get Quote Action → set `s_needs_manual_pricing` from body → bump `s_quotes_ts` → Display data **G: Info Box** (**Data** call) → `s_draft_busy = no` (always)  
- [ ] Never Display data Popup / Display list RG on Save  
- [ ] Send enabled only when priced + not busy + draft  
- [ ] Send `quote_id` = state JSON-safe  

## Test plan
- [ ] Open quote A: Network `quote_line_items?quote_id=eq.<A>` matches page `quote_id`  
- [ ] Open quote B: RG lines change to B  
- [ ] Edit line → Save: inputs **stay**, subtotal/tax/total/deposit **change**, busy unlocks  
- [ ] Save second line: first line stays  
- [ ] Manual pricing line blocks Send until filled  
- [ ] Maya Chen smoke: draft → save lines → send → email token  
