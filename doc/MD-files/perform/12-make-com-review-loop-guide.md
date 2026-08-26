# FieldQuote — Make.com feedback loop (final pay → Form email + Jobs Done sheet)

**Scope:** `doc/FieldQuote.docx` §9.3 · **Roadmap:** Day 20 · **Backend:** `P2-backend.md` §4  
**Task memory:** `doc/memory/tasks/11-final-invoice.md`  
**Code already in repo:** `stripe-webhook` → `notifyMakeFinalPaid` (fires only after `payments` insert for `kind=final`)

**Demo decision (locked for this guide):** Google **Form** for ratings + comments only. **Do not prefill quote ID / name / service** — Google Forms cannot hide or lock those fields; `entry.…` is always visible and editable (and also visible in the URL). Job metadata is stored by Make on **Jobs Done**, then copied onto the Form **Responses** row on submit (Apps Script), using **customer email** as the join key.

---



## Goal

After a **final** Stripe payment is recorded:

1. Make receives a webhook from Supabase.
2. Make emails the customer a **Leave Feedback** link (same Form URL for everyone — **no** `entry.` query params).
3. Make appends one row to **Jobs Done** (`quote_id`, `job_id`, `customer_email`, …).
4. Customer submits ratings only → Responses sheet.
5. Form **Apps Script** on submit looks up the latest unmatched Jobs Done row for that email and writes `quote_id` / `job_id` / `customer_name` onto the response row.

**Hard rule (§9.3):** Make failing must **never** block or roll back the payment. Money is already written before the webhook call.

---



## Demo flow

```
Customer pays final invoice
        ↓
Stripe webhook records payment (payments.kind = final)
        ↓
Supabase fire-and-forget → MAKE_WEBHOOK_URL
        ↓
Make
  ├── Send email with the same Form URL (no prefill)
  └── Append row to “Jobs Done” (quote_id, job_id, email, …)
        ↓
Customer clicks “Leave Feedback”
        ↓
Google Form: ratings + comments only (no IDs on screen)
        ↓
Submit → Responses sheet
        ↓
Apps Script: match email → stamp quote_id / job_id on that row
```



### Two sheets (do not mix)


| Sheet              | Who writes               | Purpose                                               |
| ------------------ | ------------------------ | ----------------------------------------------------- |
| **Jobs Done**      | Make (Add a Row)         | Ops log: paid_at, amount, quote_id, job_id, …         |
| **Form Responses** | Google Forms + Apps Script | Ratings/comments from Form; `quote_id` / `job_id` stamped from Jobs Done |




### Why not prefill (locked)

Google Forms has **no hidden / read-only questions**. Prefill `entry.480129265=…` always shows as an editable field. Putting IDs only in the URL still lets the customer see and change them.

**What we use instead:** one public Form URL + Jobs Done as the source of truth + email match on submit.

**Limit:** the customer must submit with the **same email** Make stored (`customer_email` from the payment webhook). Two unpaid-feedback jobs for the same email: script takes the **newest** Jobs Done row that has no `feedback_at` yet.


---



## What Make is / is not


| Make.com                                  | Not Make                                      |
| ----------------------------------------- | --------------------------------------------- |
| Email + Jobs Done row **after** final pay | Writing `payments` (only `stripe-webhook`)    |
| Email with static Form URL                | Storing star ratings (Form → Responses sheet) |
| Free-tier scenario                        | Quote follow-ups / reminders (`pg_cron`)      |
|                                           | Bubble scheduler / Bubble backend workflows   |


---



## Steps (roadmap)

1. Create Google Form (ratings only + collect email)
2. Create Jobs Done Sheet (`feedback_at` column)
3. Apps Script: stamp quote/job from Jobs Done on submit
4. Build Make scenario (Webhook → Email with static Form URL → Sheets)
5. Set `MAKE_WEBHOOK_URL`
6. Curl-test Make
7. Submit Form once → confirm Responses has quote_id
8. End-to-end Stripe final pay
9. Kill-Make test (payment still records)

---



## 1. Create Google Form

1.1 Open [Google Forms](https://forms.google.com) → **Blank form**.  
1.2 Title: `**FieldQuote — service feedback**`.  
1.3 Description (optional): `Thanks for your business. This takes about a minute.`

### 1.4 Questions (exact set for the demo)

Add these questions **in order**. Use **Required** on ratings.


| #   | Question text       | Type                    | Notes                    |
| --- | ------------------- | ----------------------- | ------------------------ |
| 1   | Overall rating      | Linear scale **1 to 5** | Required. Poor → Excellent |
| 2   | Quality of work     | Linear scale **1 to 5** | Required                 |
| 3   | Completion time     | Linear scale **1 to 5** | Required                 |
| 4   | Price satisfaction  | Linear scale **1 to 5** | Required                 |
| 5   | Additional comments | Paragraph               | Not required             |

**Do not** add Customer name, Quote ID, or Job / service questions. Delete them if they already exist.

### 1.5 Collect email (join key)

1.5.1 Form → **Settings** (gear) → **Responses**.  
1.5.2 **Collect email addresses** → **ON**.  
1.5.3 Prefer **Verified** (Google account) for demo Gmail customers so they cannot type a fake address. They must open the Form while signed into the **same Gmail** Make emailed (`customer_email`).  
1.5.4 Optional: **Limit to 1 response** OFF (same person may have two jobs).

Linear scale: Min **1**, Max **5**.

### 1.6 Link Responses to a Sheet

1.5.1 Form → **Responses** tab → green Sheets icon → **Create a new spreadsheet**.  
1.5.2 Name: `**FieldQuote — feedback responses**`.  
1.5.3 Confirm: after a test submit, a new row appears with Timestamp + answers.

Google owns this sheet. **Do not** also have Make write feedback rows here.

---



## 2. Stamp quote/job onto Responses (Apps Script)

No `entry.` IDs. Make already wrote metadata to Jobs Done. On each Form submit, a script copies it onto that response.

### 2.1 Jobs Done extra column

Add header **J** = `feedback_at` (empty until a response is matched).

### 2.2 Open script on the **Responses** spreadsheet

2.2.1 Open **FieldQuote — feedback responses**.
2.2.2 **Extensions** → **Apps Script**.
2.2.3 Replace the default file with:

```javascript
const JOBS_SPREADSHEET_ID = 'PASTE_JOBS_DONE_SPREADSHEET_ID_HERE'
const JOBS_TAB = 'jobs_done'

function onFormSubmit(e) {
  const respSheet = e.range.getSheet()
  const row = e.range.getRow()
  const headers = respSheet.getRange(1, 1, 1, Math.max(respSheet.getLastColumn(), 1)).getValues()[0]
  const emailCol = headers.findIndex((h) => String(h).toLowerCase().includes('email')) + 1
  if (!emailCol) return
  const email = String(respSheet.getRange(row, emailCol).getValue()).trim().toLowerCase()
  if (!email) return

  const jobs = SpreadsheetApp.openById(JOBS_SPREADSHEET_ID).getSheetByName(JOBS_TAB)
  if (!jobs) return
  const data = jobs.getDataRange().getValues()
  if (data.length < 2) return
  const h = data[0].map((x) => String(x).toLowerCase().trim())
  const iEmail = h.indexOf('customer_email')
  const iQuote = h.indexOf('quote_id')
  const iJob = h.indexOf('job_id')
  const iName = h.indexOf('customer_name')
  let iFb = h.indexOf('feedback_at')
  if (iEmail < 0 || iQuote < 0 || iJob < 0) return
  if (iFb < 0) {
    jobs.getRange(1, h.length + 1).setValue('feedback_at')
    iFb = h.length
  }

  let match = null
  let matchRow = -1
  for (let r = data.length - 1; r >= 1; r--) {
    const em = String(data[r][iEmail] || '').trim().toLowerCase()
    const used = String(data[r][iFb] || '')
    if (em === email && !used) {
      match = data[r]
      matchRow = r + 1
      break
    }
  }
  if (!match) return

  function col(name) {
    let i = headers.findIndex((x) => String(x) === name)
    if (i < 0) {
      i = headers.length
      respSheet.getRange(1, i + 1).setValue(name)
      headers.push(name)
    }
    return i + 1
  }
  respSheet.getRange(row, col('quote_id')).setValue(match[iQuote])
  respSheet.getRange(row, col('job_id')).setValue(match[iJob])
  if (iName >= 0) respSheet.getRange(row, col('customer_name')).setValue(match[iName])
  jobs.getRange(matchRow, iFb + 1).setValue(new Date())
}
```

2.2.4 `JOBS_SPREADSHEET_ID`: Jobs Done file → URL `https://docs.google.com/spreadsheets/d/THIS_ID/edit`.
2.2.5 Save.

### 2.3 Install the trigger

2.3.1 Apps Script → **Triggers** (clock icon) → **Add trigger**.
2.3.2 Function: `onFormSubmit`.
2.3.3 Event source: **From spreadsheet**.
2.3.4 Event type: **On form submit**.
2.3.5 Save → authorize the Google account (must open **both** spreadsheets).

### 2.4 Make email URL

Constant (no query string):

```
https://docs.google.com/forms/d/e/YOUR_FORM_ID/viewform
```

Copy **Send** → **Link** from the Form editor. Do **not** use Get pre-filled link.

---

## 3. Create Google Sheet “Jobs Done”

Separate from the Form Responses sheet.

3.1 Create spreadsheet `**FieldQuote — jobs done**`.  
3.2 Tab name: `**jobs_done**`.  
3.3 Row 1 headers:


| A       | B     | C             | D              | E      | F        | G        | H      | I          | J           |
| ------- | ----- | ------------- | -------------- | ------ | -------- | -------- | ------ | ---------- | ----------- |
| paid_at | event | customer_name | customer_email | amount | currency | quote_id | job_id | company_id | feedback_at |


3.4 Leave row 2+ empty — Make appends here.  
3.5 Same Google account will connect in Make for Sheets.

---



## 4. Build Make scenario



### 4.1 New scenario

4.1.1 [make.com](https://www.make.com) → **Scenarios** → **Create a new scenario**.  
4.1.2 Name: `**FieldQuote final paid → feedback form + jobs done**`.  
4.1.3 Free tier only (scope Rule 10).

### 4.2 Module 1 — Custom webhook

4.2.1 **Webhooks** → **Custom webhook** → Add → name `**fieldquote_job_final_paid`**.  
4.2.2 Copy the **Webhook URL** (`https://hook….make.com/…`).  
4.2.3 Save. Train structure in Part 6.

**Never** put this URL in Bubble, Git, or public chat.

### 4.3 Payload Make must accept

`stripe-webhook` POSTs (`Content-Type: application/json`):

```json
{
  "event": "job_final_paid",
  "quote_id": "11111111-1111-1111-1111-111111111111",
  "job_id": "22222222-2222-2222-2222-222222222222",
  "company_id": "00000000-0000-0000-0000-000000000001",
  "amount": 150.00,
  "currency": "gbp",
  "customer_name": "Ada Customer",
  "customer_email": "ada@example.com"
}
```


| Field            | Type         | Meaning                                            |
| ---------------- | ------------ | -------------------------------------------------- |
| `event`          | text         | Always `job_final_paid`                            |
| `quote_id`       | uuid         | Jobs Done + script stamp (not shown on Form) |
| `job_id`         | uuid or null | Jobs Done                                    |
| `company_id`     | uuid         | Seed tenant `00000000-0000-0000-0000-000000000001` |
| `amount`         | number       | Final pay (major units)                      |
| `currency`       | text         | e.g. `gbp`                                   |
| `customer_name`  | text or null | Email greeting + Jobs Done                   |
| `customer_email` | text or null | **Required** for email **and** Form match    |




### 4.4 Filter

On the line after the webhook:

- `event` **Equal to** `job_final_paid`  
- `customer_email` **Exists** (not empty)



### 4.5 Module 2 — Send feedback email

**Email** → **Send an Email**, or **Gmail** → send email (whichever your free account allows).


| Field   | Value                                  |
| ------- | -------------------------------------- |
| To      | `customer_email`                       |
| Subject | `Thanks — please leave quick feedback` |
| Body    | Template below (HTML or plain)         |


**Body (plain text OK):**

```
Hi {{customer_name}},

Thank you for choosing us.

Please rate your recent service (about one minute):

Leave Feedback:
{{FEEDBACK_FORM_URL}}

— Your team
```

If `customer_name` is empty, use `there`.

**`FEEDBACK_FORM_URL`:** a **constant** (no `entry.` params):

```
https://docs.google.com/forms/d/e/YOUR_FORM_ID/viewform
```

Same link for every customer. Greeting can still say `Hi {{customer_name}}`. Put that URL in the email as **Leave Feedback**.

Add in the body (one line): `Please submit while signed into the same email this message was sent to.`

### 4.6 Module 3 — Google Sheets → Add a Row (Jobs Done)

4.6.1 **Google Sheets** → **Add a Row**.  
4.6.2 Spreadsheet: **FieldQuote — jobs done** · Sheet: **jobs_done**.  
4.6.3 Map:


| Column         | Value                                            |
| -------------- | ------------------------------------------------ |
| paid_at        | Make `now` / `formatDate(now; YYYY-MM-DD HH:mm)` |
| event          | `event`                                          |
| customer_name  | `customer_name`                                  |
| customer_email | `customer_email`                                 |
| amount         | `amount`                                         |
| currency       | `currency`                                       |
| quote_id       | `quote_id`                                       |
| job_id         | `job_id`                                         |
| company_id     | `company_id`                                     |




### 4.7 Scenario shape + ON

```
[1] Custom webhook
      → filter: event = job_final_paid AND customer_email not empty
[2] Email (Leave Feedback = static Form URL)
[3] Google Sheets — Add a Row (Jobs Done only)
```

Save → turn scenario **ON**.

Make does **not** write to the Form Responses sheet.

---



## 5. Set `MAKE_WEBHOOK_URL` in Supabase

5.1 Copy the Custom webhook URL from Part 4.2.  

```bash
npx supabase secrets set MAKE_WEBHOOK_URL='https://hook.REGION.make.com/YOUR_HOOK_ID'
```

5.2 `.env.example` already has `MAKE_WEBHOOK_URL=` (name only).  
5.3 Optional redeploy:

```bash
npx supabase functions deploy stripe-webhook --no-verify-jwt
```

5.4 Never put this secret in Bubble or `NEXT_PUBLIC_*`.

---



## 6. Curl-test Make (before Stripe)

6.1 Make → webhook module → **Redetermine data structure** / scenario **Run once**.  

```bash
curl -sS -X POST 'https://hook.REGION.make.com/YOUR_HOOK_ID' \
  -H 'Content-Type: application/json' \
  -d '{
    "event": "job_final_paid",
    "quote_id": "11111111-1111-1111-1111-111111111111",
    "job_id": "22222222-2222-2222-2222-222222222222",
    "company_id": "00000000-0000-0000-0000-000000000001",
    "amount": 150.00,
    "currency": "gbp",
    "customer_name": "Ada Customer",
    "customer_email": "YOUR_REAL_INBOX@example.com"
  }'
```

6.2 **Done when:** Make success; email arrives; Jobs Done has one new row.  
6.3 Open **Leave Feedback** → Form shows **only** ratings + comments (no quote ID).

---



## 7. Submit Form once (Responses sheet)

7.1 From the email link, set Overall / Quality / Completion / Price to any 1–5, add a short comment, **Submit**.  
7.2 Open `**FieldQuote — feedback responses**`.  
7.3 **Done when:** one row with Timestamp, Email, ratings/comments, **and** stamped `quote_id` / `job_id`. Jobs Done `feedback_at` filled.

---



## 8. End-to-end with Stripe (final payment)

Prerequisites: `send-final-invoice` deployed, job can complete, Stripe test mode, webhook live.

8.1 Complete job → final invoice email → pay with `4242 4242 4242 4242`.  
8.2 Supabase: one `payments` row `kind = final`.  
8.3 Make: one run → feedback email + Jobs Done row.  
8.4 Optional: submit Form → Responses row for that `quote_id`.

If Make silent: check logs for `MAKE_WEBHOOK_URL failed`, secret name, scenario **ON**.

---



## 9. Kill-Make isolation test (§9.3)

9.1 Turn scenario **OFF** (or junk URL, then restore).  
9.2 Another final pay / new Stripe event (same `stripe_event_id` must not double-insert payment).  
9.3 **Done when:** payment path still healthy; Make silence OK.

Restore valid `MAKE_WEBHOOK_URL` + scenario **ON**.

---



## Error table


| Symptom                             | Likely cause                                | Fix                                          |
| ----------------------------------- | ------------------------------------------- | -------------------------------------------- |
| No Make run after pay               | Secret / OFF / wrong URL                    | `secrets set` + ON + logs                    |
| Email OK, Responses missing quote_id | Script/trigger missing or email mismatch | Apps Script trigger; same Gmail as `customer_email`; Jobs Done row exists |
| quote_id columns empty after submit | `JOBS_SPREADSHEET_ID` wrong or no `on form submit` | Fix ID; re-authorize; check Executions log |
| Jobs Done empty, Responses has rows | Expected if only Form submitted | Make writes Jobs Done first |
| Make wrote into Responses sheet     | Wrong spreadsheet selected                  | Point Add a Row at **jobs done** only        |
| Payment missing when Make fails     | Wrong architecture                          | Money only in webhook **before** Make        |


---



## Done checklist

- [ ] Form: 4× 1–5 scales + comments; **no** name/quote/service questions; collect email ON  
- [ ] Responses sheet + Apps Script `onFormSubmit` + trigger  
- [ ] Jobs Done header includes `feedback_at`  
- [ ] Make: Webhook → Email (**static** Form URL) → Sheets Jobs Done, **ON**  
- [ ] `MAKE_WEBHOOK_URL` in Supabase secrets  
- [ ] Curl → email + Jobs Done row; Form shows ratings only  
- [ ] Form submit → Responses row has stamped `quote_id` / `job_id`  
- [ ] Real final pay → same path + one `payments` row  
- [ ] Scenario OFF → payment still records  

---



## After this guide

Next Week-4 track: **pg_cron** + `quote-followups` / `daily-reminders` (scope §9.1–9.2). Make stays on final-pay feedback + Jobs Done only.