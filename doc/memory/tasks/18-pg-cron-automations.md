# pg_cron automations (§9.1–9.2 / Days 18–19)

**Status:** IMPLEMENTED in repo — deploy + db push + set GUC  
**Last updated:** 2026-08-23  
**Guide:** `doc/MD-files/perform/14-pg-cron-automations-guide.md`

---

## Paste for new chat
- Functions: `quote-followups`, `daily-reminders` — POST with `x-cron-secret` or admin JWT.
- Migration schedules daily 07:00 / 07:15 UTC via `cron_post_edge`.
- Test: POST body `{"now":"2026-08-25T12:00:00Z"}` after backdating quote/job/email_log.
- GUC: `app.settings.cron_secret` must match `CRON_SECRET` secret (hosted: may need dashboard SQL).

---

## Done
- [x] `quote-followups` — expire, 48h sent, 3d viewed, cap 2/email_log
- [x] `daily-reminders` — T-1, tech digest, invoice nudge +3/+7
- [x] `automations_paused` on company_settings
- [x] `invoice_nudge_exhausted` on jobs
- [ ] Deploy + db push + Bubble manual run buttons (guide §4)

## Deploy
```bash
npx supabase db push
npx supabase functions deploy quote-followups daily-reminders --no-verify-jwt --project-ref chqljfdmgdtsmbbwbdyv
```

## Out of scope (Bubble — guide only)
- Settings pause toggle
- Manual “Run follow-ups now” buttons
- email_log activity feed
