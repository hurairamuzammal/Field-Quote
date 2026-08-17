# Quote flow — Request → AI draft → Patch/Save → Send

**Work on this now.** One place for how a quote is born, how AI is used, how you fix prices, how totals work, and how Send finishes.

**Related code:** `draft-quote` · `send-quote` · `resolve-quote-token`  
**Related Bubble:** `05-request-inbox-ai-quote-send-guide.md` (full connector tables)  
**Supabase:** `chqljfdmgdtsmbbwbdyv`

---

## Steps (roadmap)
1. Big picture (what happens end to end)
2. How AI builds the draft from a request
3. Money math (subtotal / tax / total / deposit)
4. Bubble: Draft with AI
5. Bubble: Open quote + states (incl. Save-before-Send)
6. **Per-line Save** — patch line → refetch quote → unlock Send when priced
7. Send (only after Save)
8. What the customer gets next
9. Build order + done checklist

---

## 1. Big picture (what happens end to end)

```
Customer intake → requests (status: new)
        ↓
Admin: Draft with AI → edge draft-quote
        ↓
quotes (draft) + quote_line_items
request → quoted
        ↓
Admin edits qty/price → PATCH lines → PATCH quote totals
        ↓
Admin: Send → edge send-quote
        ↓
quote status sent + token + email
        ↓
Customer /q?token=… → resolve-quote-token
```

1.1 **Request** = customer job description (+ media keys). Not a quote yet.  
1.2 **Quote** = commercial document (totals, tax%, deposit%, status).  
1.3 **Lines** = work rows (`label`, `qty`, `unit_price`, optional `price_book_item_id`).  
1.4 **AI** only suggests which price-book items / labels. **Code** sets money from the price book (or `null` = needs manual pricing).  
1.5 **Send** is blocked until every line has a price. Email + token happen only in `send-quote`.
1.6 **`quotes.needs_manual_pricing`** (DB column) = `true` when any line has `unit_price` null. Set at draft; **auto-updated by trigger** when lines are patched. Bubble reads it from **Get Quote** — no RG filter needed for Send.

---

## 2. How AI builds the draft from a request

### 2.1 Who calls
Admin Bubble Action **`Draft Quote`** → `POST /functions/v1/draft-quote`  
Body: `{ "request_id": "<uuid>" }`  
Header: `Authorization: Bearer <admin JWT>`

### 2.2 What the edge function loads
2.2.1 Prove admin (JWT → `profiles.role = admin`).  
2.2.2 Load the **request** (description, company_id, …).  
2.2.3 Load **active** `price_book_items` for that company.  
2.2.4 Optional: `image_urls` for vision (usually empty for now).

### 2.3 How AI is utilized
2.3.1 **Primary model:** Z.AI GLM (env `ZAI_API_KEY` / `ZAI_MODEL`).  
2.3.2 **Fallback:** OpenRouter Gemini (env `OPENROUTER_*`) if Z.AI fails.  
2.3.3 Prompt tells the model: match **only** price book ids; omit prices; always ≥1 line; return JSON:

```json
{
  "line_items": [{ "price_book_item_id": "uuid|null", "label": "…", "qty": 1 }],
  "assumptions": ["…"],
  "clarifying_questions": ["…"],
  "confidence": 0.0
}
```

2.3.4 Model may “think” about prices in text — **we discard any model price**.

### 2.4 Guardrail (Rule 1 — never invent a price)
For each AI line:

| AI said | Code does |
|---------|-----------|
| Valid `price_book_item_id` in book | Keep id + label; set `unit_price` = **book** price; `qty` sanitized |
| Unknown / null id | `price_book_item_id = null`; `unit_price = null`; label kept or “Needs manual pricing” |
| Empty `line_items` | One fallback unpriced line from request description |

2.4.1 `needs_manual_pricing = true` if **any** line has `unit_price = null`.  
2.4.2 Assumptions / questions → `quotes.internal_notes` (admin only, not customer email).

### 2.5 What gets written
2.5.1 Insert `quotes`: `status=draft`, snapshot `tax_pct` / `deposit_pct`, computed totals, `ai_generated=true`, `ai_model`, `ai_raw`.  
2.5.2 Insert `quote_line_items` for each guarded line.  
2.5.3 If request was `new` → set request `status=quoted`.  
2.5.4 Return to Bubble: `quote_id`, `line_items`, `needs_manual_pricing`, totals, notes fields.

---

## 3. Money math (same at draft, Save, and Send)

Use quote’s stored `%` (from `company_settings` at draft time):

```
subtotal        = Σ (qty × unit_price)     // only lines that have a price
tax_amount      = subtotal × (tax_pct / 100)
total           = subtotal + tax_amount
deposit_amount  = total × (deposit_pct / 100)
```

3.1 Unpriced lines **do not** add to subtotal.  
3.2 After you Patch line prices, a **DB trigger** recomputes quote totals. Bubble only **refetches Get Quote**. Send recomputes again from lines before email (safety).  
3.3 Send recomputes from DB lines again and snapshots onto the quote before emailing.

---

## 4. Bubble: Draft with AI

### 4.1 Connector (already usually done)
| | |
|--|--|
| Name | `Draft Quote` |
| Use as | **Action** |
| Method | POST |
| URL | `https://chqljfdmgdtsmbbwbdyv.supabase.co/functions/v1/draft-quote` |
| Body | `{ "request_id": <request_id> }` |
| Headers | `apikey` (private anon) · `Authorization: Bearer <access_token>` (not private) · `Content-Type: application/json` |
| Init | `request_id` = `"real-request-uuid"` · token = admin JWT |
| Workflow | `request_id` = `s_request_id:formatted as JSON-safe` · Bearer = `Current User's sb_access_token` |

### 4.2 Workflow (request detail)
4.2.1 Set `s_request_id` from the request row.  
4.2.2 Call **Draft Quote**.  
4.2.3 Set `s_quote_id` = Result’s `quote_id`.  
4.2.4 Set `s_needs_manual_pricing` = Result’s `needs_manual_pricing`.  
4.2.5 Show **Popup Quote** (recommend always).  
4.2.6 Bump `s_quotes_ts` / `s_requests_ts` so tables refresh.

---

## 5. Bubble: Open quote + see lines

### 5.1 Page states (create these)
| State | Type | Meaning |
|-------|------|---------|
| `s_quote_id` | text | Current quote |
| `s_needs_manual_pricing` | yes/no | From Get Quote after each line Save / Draft |
| `s_line_dirty` | yes/no | Input changed; clear after that line Save |
| `s_save_busy` | yes/no | optional |
| `s_send_busy` | yes/no | Send in progress |
| `s_quote_banner` | text | optional |

*(Drop `s_quote_saved` — not needed with per-line Save + DB totals.)*

### 5.2 Data calls (popup)
| Call | Use | Bind |
|------|-----|------|
| `DB - Get Quote` | Data | `quote_id` = `s_quote_id` · Bearer · header: status, totals, tax_pct, deposit_pct, notes |
| `DB - Get Quote Lines` | Data / list | same `quote_id` · RG of lines |

5.2.1 Open / after Draft: set `s_quote_id` → Show popup → **Display data** (Get Quote) + **Display list** (Get Quote Lines).  
5.2.2 Qty / price inputs: **Initial content** = Current cell’s `qty` / `unit_price`.  
5.2.3 Banner if `s_needs_manual_pricing is yes`: “Fill every unit price, then Save that line.”

### 5.3 Send button (no Save Quote button)

**Per-line Save is enough.** DB totals update on each line PATCH. Drop `s_quote_saved` / big Save Quote.

**Send enabled when ALL of:**
- status `draft`
- `s_needs_manual_pricing is no`
- not busy
- optional: `s_line_dirty is no` (Input changed but that line not Saved yet)

### 5.4 Popup + Quotes table — how latest shows

| UI | After line Save do this |
|----|-------------------------|
| Popup header totals | **Display data** on header group → Get Quote (**Data**) — Action alone does **not** redraw header |
| Send / banner | **Set state** `s_needs_manual_pricing` from Get Quote **Action** Result |
| Quotes table | Bump **`s_quotes_ts`** (or Display list List Quotes) |
| Line Inputs | Already show typed values — skip Display list lines |

### 5.5 DB once

```bash
supabase db push
```

Get Quote Data + Action `select=` includes `needs_manual_pricing,subtotal,tax_amount,total,deposit_amount,…`

---

## 6. Per-line Save workflow (replaces Save Quote)

```
Patch Quote Line
  → Get Quote (Action)           → set s_needs_manual_pricing
  → Display data header          → popup shows new totals
  → bump s_quotes_ts             → Quotes table refreshes
When flag is no → Send clickable
```

### 6A. Line Save button (inside RG cell)

| # | Action |
|---|--------|
| 1 | **DB - Patch Quote Line** · cell `id` · Input qty/price · Bearer |
| 2 | **DB - Get Quote (Action)** · `s_quote_id` · Bearer |
| 3 | **Set state** `s_needs_manual_pricing` = Result of step 2's `needs_manual_pricing` |
| 4 | **Display data** → Group Quote Header → **DB - Get Quote** (Data) · same `quote_id` |
| 5 | **Set state** `s_quotes_ts` = Current date/time (Unix) or +1 |
| 6 | Optional: `s_line_dirty` = **no** |

### 6A.1 Draft / Open
Set `s_needs_manual_pricing` from Draft or first Get Quote. Display data + Display list as usual.

### 6A.2 Input value changed
`s_line_dirty` = **yes** (keeps Send off until line Saved).

### 6A.3 Banner + Send
- Banner: `s_needs_manual_pricing is yes`
- Send off: flag **yes** OR `s_line_dirty is yes` OR not draft

---

## 6B. Connectors (Initialize once)

### 6B.1 `DB - Patch Quote Line`
| | |
|--|--|
| Use as | **Action** |
| Method | PATCH |
| URL | `https://chqljfdmgdtsmbbwbdyv.supabase.co/rest/v1/quote_line_items?id=eq.[line_id]&select=id,qty,unit_price,overridden,quotes(needs_manual_pricing)` |
| Include errors | ON |

The `select=…,quotes(needs_manual_pricing)` embed returns the **fresh parent flag** in the same response (DB trigger runs before PostgREST returns). Use for per-row Save; for full Save prefer **Get Quote Action** after all patches (§6A.1).

Body (placeholders **unquoted**):

```json
{
  "qty": <qty>,
  "unit_price": <unit_price>,
  "overridden": true
}
```

| Param | Init | Workflow |
|-------|------|----------|
| `line_id` | `"real-line-uuid"` | Current cell’s `id` |
| `qty` | `1` | Input qty’s value (**number — no JSON-safe**) |
| `unit_price` | `55` | Input price’s value (**number — no JSON-safe**; leave empty/null if clearing — DB stores null) |
| Bearer | admin JWT | `Current User's sb_access_token` |

Headers: `apikey` (private) · `Authorization: Bearer <access_token>` · `Content-Type: application/json` · **`Prefer: return=representation`**

**Success shape (Initialize):** `id`, `qty`, `unit_price`, `overridden`, nested **`quotes`** → **`needs_manual_pricing`** (boolean).

| Error | Meaning | Fix |
|-------|---------|-----|
| `(Data with ID "undefined")` | `line_id` blank | Current cell's `id`; re-init Get Quote Lines as list |
| 400 / PGRST | Bad body | qty number; unit_price number or omit for null |
| Nested `quotes` missing | Old URL without select embed | Use full URL above · re-Initialize |

### 6B.2 `DB - Get Quote` (Action) — refetch after Save

Duplicate **DB - Get Quote** as **Action** (Data call stays for popup header).

| | |
|--|--|
| Use as | **Action** |
| Method | GET |
| URL | `https://chqljfdmgdtsmbbwbdyv.supabase.co/rest/v1/quotes?id=eq.[quote_id]&select=id,status,needs_manual_pricing,subtotal,tax_amount,total,deposit_amount,deposit_pct,tax_pct,internal_notes,request_id,created_at` |
| Include errors | OFF |

| Param | Init | Workflow |
|-------|------|----------|
| `quote_id` | `"real-quote-uuid"` | `s_quote_id` |
| Bearer | admin JWT | `Current User's sb_access_token` |

Headers: `apikey` (private) · `Authorization: Bearer <access_token>` · `Accept: application/vnd.pgrst.object+json`

**After Initialize you get:** `needs_manual_pricing`, `subtotal`, `tax_amount`, `total`, `deposit_amount` — already recalculated by DB when lines were PATCHed.

**Workflow:** Set `s_needs_manual_pricing` from Result. Optional: show Result's `total` in a text. No Bubble math.

### 6B.3 `DB - Patch Quote Totals` — optional / not needed for Save

Skip for Save. Totals update from line PATCH trigger. Keep connector only if you need a manual override later.

---

## 6C. (removed) Schedule-all-lines Save Quote

Use **per-row Save** only (§6A). No “save all lines then mark quote saved”.

---

## 6D–6E. Totals — backend only

After line PATCH, DB updates money. Bubble **Get Quote** + **Display data** header. No Bubble calc / Patch Totals.

---

## 7. Send (only after Save)

### 7.1 Gate
**Send** enabled when:
- `s_needs_manual_pricing is no`
- `s_line_dirty is no` (if you use it)
- Get Quote’s `status` is `draft`
- not busy

### 7.2 Connector — `Send Quote`
| | |
|--|--|
| Use as | **Action** |
| Method | POST |
| URL | `https://chqljfdmgdtsmbbwbdyv.supabase.co/functions/v1/send-quote` |
| Body | `{ "quote_id": <quote_id> }` |
| Workflow | `s_quote_id:formatted as JSON-safe` + Bearer |

### 7.3 What server does
Recomputes totals from **DB lines** again, sets token, `status=sent`, emails customer, `email_log`.  
If any line still null price → 400 (safety net).

### 7.4 After Send
Hide Send; bump `s_quotes_ts`; show “Sent”.

---

## 8. What the customer gets next

8.1 Email link → public `q?token=…` (never raw quote id).  
8.2 `resolve-quote-token` → safe JSON.  
8.3 First open: `sent` → `viewed`.  
8.4 Accept / Stripe = later.

---

## 9. Build order + done checklist

### 9.1 Do in this order (now)
1. `supabase db push`  
2. States: `s_needs_manual_pricing`, optional `s_line_dirty`  
3. Get Quote Data + Action; lines RG  
4. Per-line Save → Patch → Get Quote Action → Display data header → bump `s_quotes_ts`  
5. Send when flag no (+ dirty no)  
6. Wire Send Quote  

### 9.2 Done when
- [ ] Line Save → popup totals update  
- [ ] Line Save → Quotes table row total updates  
- [ ] Empty price → flag yes → Send off  
- [ ] All priced + saved → Send on → email + `sent`  

### 9.3 Deploy (only if edge changed)
```bash
supabase functions deploy draft-quote --no-verify-jwt
supabase functions deploy send-quote --no-verify-jwt
```

Patch Line / Totals = PostgREST only (Initialize in Bubble).

---

**Updated:** 2026-08-10 — Save-first gate; check manual pricing → dynamic totals → patch → then Send.
