# Cache-bust cheat sheet

**If Initialize fails with `this header name is not correct X-Bust`:**  
Delete the entire `X-Bust` header row. Keep only `apikey` + `Authorization`.

**Skip payments** — no connector yet.

## Bind Table (short)

1. **Type of content** = API item type (e.g. `DB - List Requests`)  
2. **Data source** = Get data from API → that call → Bearer + `bust` = `s_*_ts`  
3. **Conditional** tab (bottom of Table editor) → When `sb_access_token is empty` → change **Data source** to **empty**  
   ← this is how you block the call (not a workflow “Only when” on the data source line)  
4. Workflows (Refresh / Page loaded): **Only when** token not empty → Set state bump  

## Custom state (short)
Page memory number (e.g. `s_requests_ts`). Not in the DB. Bind Table `bust` to it. Change the number → table refetches (only if token not empty).

## Test
Button → Only when token not empty → Set state `s_requests_ts` = unix now → table updates without full reload.

### DB - List Requests
URL ends with `&customer_name=neq.[bust]`  
`bust` Init = `0` → Table = `s_requests_ts`

### List Technicians
URL: `.../profiles?role=eq.[role]&select=id,full_name,email,active&order=full_name.asc&email=neq.[bust]`  
`role` = `technician`, `bust` Init = `0` → Table = `s_techs_ts`  
Resend button: visible when Current cell’s `active` is **no**. Connector: **Resend Invite** (`perform/10`).

### DB - Get Price Book
URL ends with `&name=neq.[bust]`  
`bust` Init = `0` → Table = `s_pricebook_ts`

### DB - List Quotes
URL ends with `&status=neq.[bust]`  
`bust` Init = `0` → Table = `s_quotes_ts`

### DB - Get Jobs (tech panel later)
URL ends with `&status=neq.[bust]`  
`bust` Init = `0` → Table = `s_jobs_ts`
