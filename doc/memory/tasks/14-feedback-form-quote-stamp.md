# Feedback Form — quote_id / job_id not stamped on submit

**Status:** IN PROGRESS — stamp via Apps Script; retest after job rollback  
**Last updated:** 2026-08-22

---

## Paste for new chat (5–10 lines)
- Make feedback email works; Google Form submit saves ratings + **Email** column.
- **Missing:** `quote_id`, `job_id`, `customer_name` on Responses sheet (had them with old prefill; removed for hidden IDs).
- Fix: Apps Script `onFormSubmit` → match `customer_email` to latest Jobs Done row with empty `feedback_at` → stamp columns.
- Check trigger installed, `JOBS_SPREADSHEET_ID`, tab `jobs_done`, Form **Collect email** ON (verified).

---

## Goal
After final pay → Make → customer submits Form, Responses row includes quote/job metadata without showing IDs on the Form.

## Done
- [x] Static Form URL (no `entry.` prefill)
- [x] Make → email + Jobs Done row

## Next
1. Verify Apps Script on **feedback responses** sheet (§2.2 in P12).
2. Confirm trigger **On form submit** + Executions log on test submit.
3. Jobs Done: `customer_email`, `quote_id`, `job_id`, `feedback_at` headers; Make maps email on pay.
4. Submit with **same Gmail** as Jobs Done row; confirm stamp + `feedback_at`.

## Blockers / pitfalls
| Issue | Fix |
|-------|-----|
| Email column name mismatch | Script finds header containing `email` |
| Wrong Google account on Form | Verified email must match Jobs Done `customer_email` |
| `feedback_at` already set | Clear for retest row or use new pay |
| Script on wrong spreadsheet | Must be Form-linked **responses** book, not Jobs Done |
