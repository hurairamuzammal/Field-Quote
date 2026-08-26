# NOW — paste into a new chat

**Last updated:** 2026-08-26  
**Current:** Finish logo Run JS fix (delete `fqSetLogoPreview`) → then pg_cron deploy (`tasks/18`)  
**Just finished:** Logo upload diagnosis — Missing token = dead `fqSetLogoPreview` before init; login/`sb_access_token` OK. Quote Save/RG/busy + unsaved-Send + popup state cleanup notes → `tasks/01`

## Where we are
Brand chrome + profile/password + logo path are **done** in product. Bubble polish left: Run JS must **only** call `fqInitLogoUploader` (export `(3)` still had `fqSetLogoPreview`). Quote Save pitfalls + dirty/Send + bind money from Get Quote (drop page money states) live in **`tasks/01`**. Next deploy focus after logo confirm = **cron**.

## Do next
1. Bubble: delete `fqSetLogoPreview` from Company-visible Run JS; confirm `__fqLogoOpts` + SVG upload (`tasks/19` checklist)
2. `tasks/18` / `perform/14` — `db push` cron migrations, `CRON_SECRET` / GUC, deploy `quote-followups` + `daily-reminders`
3. Quotes polish when free: `tasks/01` checklist + `tasks/20` hide Send when `viewed` + `s_line_dirty`

## IDs
- Supabase: `chqljfdmgdtsmbbwbdyv`
- Company: `00000000-0000-0000-0000-000000000001`
